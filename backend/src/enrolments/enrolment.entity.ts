import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../user/user.entity.js';
import { Course } from '../courses/course.entity.js';

export enum EnrolmentStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  EXPIRED = 'EXPIRED',
}

@Entity('enrolments')
@Unique('UQ_enrolment_user_course', ['userId', 'courseId'])
@Index(['courseId', 'status'])
@Index(['userId'])
export class Enrolment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ type: 'uuid' })
  courseId: string;

  @ManyToOne(() => Course, (course) => course.enrolments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'courseId' })
  course?: Relation<Course>;

  @Column({
    type: 'enum',
    enum: EnrolmentStatus,
    default: EnrolmentStatus.ACTIVE,
  })
  status: EnrolmentStatus;

  @Column({ type: 'integer', default: 0 })
  progressPct: number;

  @CreateDateColumn({ type: 'timestamptz' })
  enrolledAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt?: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
