import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { QnaPost } from './qna-post.entity.js';

@Entity('qna_threads')
@Index(['courseId', 'createdAt'])
export class QnaThread {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  courseId: string;

  @Column({ type: 'uuid', nullable: true })
  lessonId?: string | null;

  @Index()
  @Column({ type: 'uuid' })
  authorId: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'boolean', default: false })
  resolved: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => QnaPost, (post) => post.thread)
  posts?: QnaPost[];
}
