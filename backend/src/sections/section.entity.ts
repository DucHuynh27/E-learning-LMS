import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Course } from '../courses/course.entity.js';
import { Lesson } from '../lessons/lesson.entity.js';

@Entity('sections')
@Unique('UQ_section_course_position', ['courseId', 'position'])
@Index(['courseId'])
export class Section {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  courseId: string;

  @ManyToOne(() => Course, (course) => course.sections, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'courseId' })
  course?: Course;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'integer' })
  position: number;

  @OneToMany(() => Lesson, (lesson) => lesson.section, { cascade: true })
  lessons?: Lesson[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
