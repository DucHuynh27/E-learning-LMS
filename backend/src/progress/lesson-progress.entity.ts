import {
  Check,
  Column,
  Entity,
  ForeignKey,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../user/user.entity.js';

@Entity('lesson_progress')
@ForeignKey(() => User, ['userId'], ['id'], {
  name: 'FK_progress_user',
  onDelete: 'CASCADE',
})
@Unique('UQ_progress_user_lesson', ['userId', 'lessonId'])
@Index('IDX_progress_lesson_completed', ['lessonId', 'completed'])
@Check('CHK_progress_watched', '"watchedSec" >= 0')
@Check('CHK_progress_completion', '"completed" = ("completedAt" IS NOT NULL)')
export class LessonProgress {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) userId: string;
  @Column({ type: 'uuid' }) lessonId: string;
  @Column({ type: 'integer', default: 0 }) watchedSec: number;
  @Column({ type: 'boolean', default: false }) completed: boolean;
  @Column({ type: 'timestamptz', nullable: true }) completedAt: Date | null;
}
