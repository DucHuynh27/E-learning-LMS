import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  ForeignKey,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../user/user.entity.js';
import { Quiz, Question, Option } from '../quizzes/quiz.entity.js';

@Entity('quiz_attempts')
@ForeignKey(() => User, ['userId'], ['id'], {
  name: 'FK_attempt_user',
  onDelete: 'CASCADE',
})
@ForeignKey(() => Quiz, ['quizId'], ['id'], {
  name: 'FK_attempt_quiz',
  onDelete: 'CASCADE',
})
@Index('IDX_attempt_user_quiz', ['userId', 'quizId'])
@Check(
  'CHK_attempt_result',
  '("submittedAt" IS NULL AND "score" IS NULL AND "passed" IS NULL) OR ("submittedAt" IS NOT NULL AND "score" IS NOT NULL AND "score" BETWEEN 0 AND 100 AND "passed" IS NOT NULL)',
)
export class QuizAttempt {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) quizId: string;
  @Column({ type: 'uuid' }) userId: string;
  @Column({ type: 'integer', nullable: true }) score: number | null;
  @Column({ type: 'boolean', nullable: true }) passed: boolean | null;
  @CreateDateColumn({ type: 'timestamptz' }) startedAt: Date;
  @Column({ type: 'timestamptz', nullable: true }) submittedAt: Date | null;
}

@Entity('quiz_answers')
@ForeignKey(() => QuizAttempt, ['attemptId'], ['id'], {
  name: 'FK_answer_attempt',
  onDelete: 'CASCADE',
})
@ForeignKey(() => Question, ['questionId'], ['id'], {
  name: 'FK_answer_question',
  onDelete: 'CASCADE',
})
@ForeignKey(() => Option, ['questionId', 'optionId'], ['questionId', 'id'], {
  name: 'FK_answer_question_option',
})
@Unique('UQ_answer_attempt_question', ['attemptId', 'questionId'])
export class QuizAnswer {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) attemptId: string;
  @Column({ type: 'uuid' }) questionId: string;
  @Column({ type: 'uuid', nullable: true }) optionId: string | null;
}
