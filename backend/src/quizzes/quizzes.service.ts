import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface.js';
import { CatalogAccess } from '../learning/catalog-access.service.js';
import type {
  PublicQuestion,
  QuizResponse,
} from '../learning/learning.responses.js';
import { QuizAttempt } from '../attempts/quiz-attempt.entity.js';
import { Role } from '../user/user.entity.js';
import type { CreateQuizDto } from './dto/create-quiz.dto.js';
import { Option, Question, Quiz } from './quiz.entity.js';

export type QuestionWithOptions = Question & { options: Option[] };

@Injectable()
export class QuizzesService {
  constructor(
    @Inject(DataSource) private readonly source: DataSource,
    @Inject(CatalogAccess) private readonly catalog: CatalogAccess,
  ) {}

  async get(user: AuthenticatedUser, lessonId: string): Promise<QuizResponse> {
    const lesson = await this.catalog.lesson(lessonId);
    if (
      user.role !== Role.ADMIN &&
      !(user.role === Role.INSTRUCTOR && user.userId === lesson.instructorId)
    )
      this.catalog.assertPublished(lesson);
    const quiz = await this.forLesson(this.source.manager, lesson.id);
    return this.response(this.source.manager, quiz);
  }

  async create(
    user: AuthenticatedUser,
    lessonId: string,
    dto: CreateQuizDto,
    replace = false,
  ): Promise<QuizResponse> {
    if (
      dto.questions.some(
        (question) =>
          question.options.filter((option) => option.isCorrect).length !== 1,
      )
    ) {
      throw new BadRequestException(
        'Each single-choice question must have exactly one correct option',
      );
    }
    return this.source.transaction(async (manager) => {
      const lesson = await this.catalog.lesson(lessonId, manager);
      this.catalog.assertOwner(lesson, user);
      // Serializes first creation as well as replacements, including when no quiz row exists yet.
      await manager.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [`learning:quiz:${lesson.id}`],
      );
      const repository = manager.getRepository(Quiz);
      let quiz = await repository.findOne({
        where: { lessonId: lesson.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (quiz && !replace)
        throw new ConflictException('This lesson already has a quiz');
      if (!quiz && replace) throw new NotFoundException('Quiz not found');
      if (
        quiz &&
        (await manager.getRepository(QuizAttempt).existsBy({ quizId: quiz.id }))
      ) {
        throw new ConflictException(
          'A quiz cannot be changed after an attempt has started',
        );
      }
      quiz = await repository.save(
        repository.create({
          id: quiz?.id,
          lessonId: lesson.id,
          passScore: dto.passScore,
          timeLimitSec: dto.timeLimitSec ?? null,
        }),
      );
      await manager.getRepository(Question).delete({ quizId: quiz.id });
      for (const [position, input] of dto.questions.entries()) {
        const question = await manager
          .getRepository(Question)
          .save({ quizId: quiz.id, content: input.content, position });
        await manager.getRepository(Option).save(
          input.options.map((option, optionPosition) => ({
            questionId: question.id,
            content: option.content,
            isCorrect: option.isCorrect,
            position: optionPosition,
          })),
        );
      }
      return this.response(manager, quiz);
    });
  }

  async forLesson(
    manager: EntityManager,
    lessonId: string,
    lock = false,
  ): Promise<Quiz> {
    const quiz = await manager
      .getRepository(Quiz)
      .findOne({
        where: { lessonId },
        ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
      });
    if (!quiz) throw new NotFoundException('Quiz not found');
    return quiz;
  }

  async questions(
    manager: EntityManager,
    quizId: string,
  ): Promise<QuestionWithOptions[]> {
    const questions = await manager
      .getRepository(Question)
      .find({ where: { quizId }, order: { position: 'ASC' } });
    if (!questions.length)
      throw new ConflictException('This quiz has no questions');
    const options = await manager
      .getRepository(Option)
      .createQueryBuilder('option')
      .addSelect('option.isCorrect')
      .where('option.questionId IN (:...ids)', {
        ids: questions.map((question) => question.id),
      })
      .orderBy('option.position', 'ASC')
      .getMany();
    return questions.map((question) => ({
      id: question.id,
      quizId: question.quizId,
      content: question.content,
      position: question.position,
      options: options.filter((option) => option.questionId === question.id),
    }));
  }

  publicQuestions(questions: QuestionWithOptions[]): PublicQuestion[] {
    return questions.map((question) => ({
      id: question.id,
      content: question.content,
      options: question.options.map((option) => ({
        id: option.id,
        content: option.content,
      })),
    }));
  }

  private async response(
    manager: EntityManager,
    quiz: Quiz,
  ): Promise<QuizResponse> {
    return {
      id: quiz.id,
      lessonId: quiz.lessonId,
      passScore: quiz.passScore,
      timeLimitSec: quiz.timeLimitSec,
      questions: this.publicQuestions(await this.questions(manager, quiz.id)),
    };
  }
}
