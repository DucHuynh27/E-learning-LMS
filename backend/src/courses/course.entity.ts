import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../user/user.entity.js';
import { Section } from '../sections/section.entity.js';
import { Enrolment } from '../enrolments/enrolment.entity.js';

export enum CourseStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

@Entity('courses')
@Index(['instructorId'])
@Index(['status', 'createdAt'])
export class Course {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  thumbnailKey?: string | null;

  @Column({ type: 'integer', default: 0 })
  priceCents: number;

  @Column({ type: 'enum', enum: CourseStatus, default: CourseStatus.DRAFT })
  status: CourseStatus;

  @Column({ type: 'uuid' })
  instructorId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'instructorId' })
  instructor?: User;

  @OneToMany(() => Section, (section) => section.course, { cascade: true })
  sections?: Section[];

  @OneToMany(() => Enrolment, (enrolment) => enrolment.course)
  enrolments?: Enrolment[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
