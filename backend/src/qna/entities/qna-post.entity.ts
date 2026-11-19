import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { QnaThread } from './qna-thread.entity.js';

@Entity('qna_posts')
@Index(['threadId', 'createdAt'])
export class QnaPost {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  threadId: string;

  @Index()
  @Column({ type: 'uuid' })
  authorId: string;

  @Column({ type: 'varchar', length: 5000 })
  content: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => QnaThread, (thread) => thread.posts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'threadId' })
  thread?: QnaThread;
}
