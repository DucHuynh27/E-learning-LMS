import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Section } from '../sections/section.entity.js';

export enum LessonType {
  VIDEO = 'VIDEO',
  ARTICLE = 'ARTICLE',
  QUIZ = 'QUIZ',
}

@Entity('lessons')
@Unique('UQ_lesson_section_position', ['sectionId', 'position'])
@Index(['sectionId'])
export class Lesson {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  sectionId: string;

  @ManyToOne(() => Section, (section) => section.lessons, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sectionId' })
  section?: Section;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'enum', enum: LessonType, default: LessonType.ARTICLE })
  type: LessonType;

  @Column({ type: 'integer' })
  position: number;

  @Column({ type: 'integer', default: 0 })
  durationSec: number;

  @Column({ type: 'boolean', default: false })
  isPublished: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
