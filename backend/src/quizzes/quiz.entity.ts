import {
  Check,
  Column,
  Entity,
  ForeignKey,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity('quizzes')
@Unique('UQ_quiz_lesson', ['lessonId'])
@Check('CHK_quiz_pass_score', '"passScore" BETWEEN 0 AND 100')
@Check('CHK_quiz_time_limit', '"timeLimitSec" IS NULL OR "timeLimitSec" >= 0')
export class Quiz {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) lessonId: string;
  @Column({ type: 'integer' }) passScore: number;
  @Column({ type: 'integer', nullable: true }) timeLimitSec: number | null;
}

@Entity('quiz_questions')
@ForeignKey(() => Quiz, ['quizId'], ['id'], {
  name: 'FK_question_quiz',
  onDelete: 'CASCADE',
})
@Unique('UQ_question_quiz_position', ['quizId', 'position'])
@Check('CHK_question_position', '"position" >= 0')
@Check('CHK_question_content', 'length(btrim("content")) > 0')
export class Question {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) quizId: string;
  @Column({ type: 'text' }) content: string;
  @Column({ type: 'integer' }) position: number;
}

@Entity('quiz_options')
@ForeignKey(() => Question, ['questionId'], ['id'], {
  name: 'FK_option_question',
  onDelete: 'CASCADE',
})
@Unique('UQ_option_question_position', ['questionId', 'position'])
@Unique('UQ_option_question_id', ['questionId', 'id'])
@Index('UQ_option_one_correct', ['questionId'], {
  unique: true,
  where: '"isCorrect" = true',
})
@Check('CHK_option_position', '"position" >= 0')
@Check('CHK_option_content', 'length(btrim("content")) > 0')
export class Option {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) questionId: string;
  @Column({ type: 'text' }) content: string;
  @Column({ type: 'integer' }) position: number;
  @Column({ type: 'boolean', select: false }) isCorrect: boolean;
}
