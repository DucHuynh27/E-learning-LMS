import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface.js';
import { CatalogAccess } from '../learning/catalog-access.service.js';
import type {
  AttemptResultResponse,
  StartedAttemptResponse,
} from '../learning/learning.responses.js';
import { Quiz } from '../quizzes/quiz.entity.js';
import {
  QuizzesService,
  type QuestionWithOptions,
} from '../quizzes/quizzes.service.js';
import type {
  SubmitAnswerDto,
  SubmitAttemptDto,
} from './dto/submit-attempt.dto.js';
import { QuizAnswer, QuizAttempt } from './quiz-attempt.entity.js';

export const MAX_QUIZ_ATTEMPTS = 3;

export function gradeAnswers(
  questions: QuestionWithOptions[],
  answers: SubmitAnswerDto[],
): number {
  const questionMap = new Map(
    questions.map((question) => [question.id, question]),
  );
  const seen = new Set<string>();
  let correct = 0;
  for (const answer of answers) {
    const questionId = answer.questionId.toLowerCase();
    if (seen.has(questionId))
      throw new BadRequestException('Duplicate questionId');
    seen.add(questionId);
    const question = questionMap.get(questionId);
    if (!question)
      throw new BadRequestException(
        'An answer refers to a question outside this quiz',
      );
    if (answer.optionId == null) continue;
    const option = question.options.find(
      (option) => option.id === answer.optionId!.toLowerCase(),
    );
    if (!option)
      throw new BadRequestException(
        'An option does not belong to its question',
      );
    if (option.isCorrect) correct++;
  }
  return questions.length ? Math.round((correct / questions.length) * 100) : 0;
}

function expired(attempt: QuizAttempt, quiz: Quiz, now: Date): boolean {
  return (
    Boolean(quiz.timeLimitSec) &&
    now.getTime() >= attempt.startedAt.getTime() + quiz.timeLimitSec! * 1000
  );
}

@Injectable()
export class AttemptsService {
  constructor(
    @Inject(DataSource) private readonly source: DataSource,
    @Inject(CatalogAccess) private readonly catalog: CatalogAccess,
    @Inject(QuizzesService) private readonly quizzes: QuizzesService,
  ) {}

  async start(
    user: AuthenticatedUser,
    lessonId: string,
  ): Promise<StartedAttemptResponse> {
    this.catalog.assertStudent(user);
    return this.source.transaction(async (manager) => {
      const lesson = await this.catalog.lesson(lessonId, manager);
      this.catalog.assertPublished(lesson);
      await this.catalog.enrolment(user.userId, lesson.courseId, manager, true);
      const quiz = await this.quizzes.forLesson(manager, lesson.id, true);
      const repository = manager.getRepository(QuizAttempt);
      const count = await repository.countBy({
        userId: user.userId,
        quizId: quiz.id,
      });
      if (count >= MAX_QUIZ_ATTEMPTS)
        throw new ConflictException(
          `Maximum of ${MAX_QUIZ_ATTEMPTS} quiz attempts reached`,
        );
      const now = await this.databaseTime(manager);
      if (await this.findActive(manager, user.userId, quiz, now))
        throw new ConflictException(
          'Submit the active attempt before starting another',
        );
      const attempt = await repository.save(
        repository.create({
          userId: user.userId,
          quizId: quiz.id,
          startedAt: now,
          submittedAt: null,
          score: null,
          passed: null,
        }),
      );
      return this.attemptResponse(manager, quiz, attempt);
    });
  }

  async active(
    user: AuthenticatedUser,
    lessonId: string,
  ): Promise<StartedAttemptResponse | null> {
    this.catalog.assertStudent(user);
    return this.source.transaction('REPEATABLE READ', async (manager) => {
      await manager.query('SET TRANSACTION READ ONLY');
      const lesson = await this.catalog.lesson(lessonId, manager);
      this.catalog.assertPublished(lesson);
      await this.catalog.enrolment(user.userId, lesson.courseId, manager);
      const quiz = await this.quizzes.forLesson(manager, lesson.id);
      const attempt = await this.findActive(
        manager,
        user.userId,
        quiz,
        await this.databaseTime(manager),
      );
      return attempt ? this.attemptResponse(manager, quiz, attempt) : null;
    });
  }

  async submit(
    user: AuthenticatedUser,
    id: string,
    dto: SubmitAttemptDto,
  ): Promise<AttemptResultResponse> {
    this.catalog.assertStudent(user);
    return this.source.transaction(async (manager) => {
      const repository = manager.getRepository(QuizAttempt);
      const attempt = await repository.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!attempt) throw new NotFoundException('Attempt not found');
      if (attempt.userId !== user.userId)
        throw new ForbiddenException('This attempt belongs to another student');
      if (attempt.submittedAt)
        throw new ConflictException('This attempt has already been submitted');
      const quiz = await manager
        .getRepository(Quiz)
        .findOneByOrFail({ id: attempt.quizId });
      const lesson = await this.catalog.lesson(quiz.lessonId, manager);
      this.catalog.assertPublished(lesson);
      await this.catalog.enrolment(user.userId, lesson.courseId, manager, true);
      const now = await this.databaseTime(manager);
      if (expired(attempt, quiz, now))
        throw new BadRequestException('The quiz time limit has expired');
      const questions = await this.quizzes.questions(manager, quiz.id);
      const score = gradeAnswers(questions, dto.answers);
      const answers = new Map(
        dto.answers.map((answer) => [
          answer.questionId.toLowerCase(),
          answer.optionId?.toLowerCase() ?? null,
        ]),
      );
      await manager.getRepository(QuizAnswer).insert(
        questions.map((question) => ({
          attemptId: attempt.id,
          questionId: question.id,
          optionId: answers.get(question.id) ?? null,
        })),
      );
      const passed = score >= quiz.passScore;
      await repository.update(attempt.id, { score, passed, submittedAt: now });
      return { attemptId: attempt.id, score, passed, submittedAt: now };
    });
  }

  private async databaseTime(manager: EntityManager): Promise<Date> {
    const [{ now }] = await manager.query<{ now: Date }[]>(
      'SELECT clock_timestamp() AS "now"',
    );
    return now;
  }

  private async findActive(
    manager: EntityManager,
    userId: string,
    quiz: Quiz,
    now: Date,
  ): Promise<QuizAttempt | null> {
    const attempt = await manager.getRepository(QuizAttempt).findOne({
      where: { userId, quizId: quiz.id, submittedAt: IsNull() },
      order: { startedAt: 'DESC' },
    });
    return attempt && !expired(attempt, quiz, now) ? attempt : null;
  }

  private async attemptResponse(
    manager: EntityManager,
    quiz: Quiz,
    attempt: QuizAttempt,
  ): Promise<StartedAttemptResponse> {
    const questions = await this.quizzes.questions(manager, quiz.id);
    return {
      attemptId: attempt.id,
      questions: this.quizzes.publicQuestions(questions),
      startedAt: attempt.startedAt,
      expiresAt: quiz.timeLimitSec
        ? new Date(attempt.startedAt.getTime() + quiz.timeLimitSec * 1000)
        : null,
    };
  }
}
