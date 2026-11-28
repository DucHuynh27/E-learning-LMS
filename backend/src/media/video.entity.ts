import {
  Column,
  CreateDateColumn,
  Entity,
  ForeignKey,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Lesson } from '../lessons/lesson.entity.js';

export enum VideoStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  FAILED = 'FAILED',
}

@Entity('videos')
@ForeignKey(() => Lesson, ['lessonId'], ['id'], {
  name: 'FK_videos_lesson',
  onDelete: 'CASCADE',
})
@Index('IDX_videos_status', ['status'])
export class Video {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('UQ_videos_lessonId', { unique: true })
  @Column({ type: 'uuid' })
  lessonId: string;

  @Column({ type: 'varchar', length: 1024 })
  originalKey: string;

  @Column({ type: 'varchar', length: 1024, nullable: true })
  thumbnailKey: string | null;

  @Column({ type: 'int', nullable: true })
  durationSec: number | null;

  @Column({ type: 'enum', enum: VideoStatus, enumName: 'videos_status_enum' })
  status: VideoStatus;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  error: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
