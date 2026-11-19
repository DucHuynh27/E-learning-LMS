import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QnaThread } from './entities/qna-thread.entity.js';
import { QnaPost } from './entities/qna-post.entity.js';
import { CreateThreadDto } from './dto/create-thread.dto.js';
import { CreatePostDto } from './dto/create-post.dto.js';
import { QueryThreadsDto } from './dto/query-threads.dto.js';
import { WsGateway } from '../realtime/ws.gateway.js';
import { Role } from '../user/user.entity.js';

@Injectable()
export class QnaService {
  constructor(
    @InjectRepository(QnaThread)
    private readonly threadRepo: Repository<QnaThread>,
    @InjectRepository(QnaPost)
    private readonly postRepo: Repository<QnaPost>,
    private readonly wsGateway: WsGateway,
  ) {}

  async createThread(courseId: string, authorId: string, dto: CreateThreadDto) {
    const thread = this.threadRepo.create({
      courseId,
      authorId,
      title: dto.title,
      lessonId: dto.lessonId ?? null,
    });
    const saved = await this.threadRepo.save(thread);

    this.wsGateway.emitToCourse(courseId, 'qna.thread.created', {
      thread: saved,
    });

    return saved;
  }

  async findThreads(courseId: string, query: QueryThreadsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.threadRepo
      .createQueryBuilder('t')
      .where('t.courseId = :courseId', { courseId });

    if (query.resolved !== undefined) {
      qb.andWhere('t.resolved = :resolved', { resolved: query.resolved });
    }

    qb.orderBy('t.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getThreadWithPosts(threadId: string) {
    const thread = await this.threadRepo.findOne({ where: { id: threadId } });
    if (!thread) {
      throw new NotFoundException(`Thread ${threadId} not found`);
    }

    const posts = await this.postRepo.find({
      where: { threadId },
      order: { createdAt: 'ASC' },
    });

    return { thread, posts };
  }

  async createPost(threadId: string, authorId: string, dto: CreatePostDto) {
    const thread = await this.threadRepo.findOne({ where: { id: threadId } });
    if (!thread) {
      throw new NotFoundException(`Thread ${threadId} not found`);
    }

    const post = this.postRepo.create({
      threadId,
      authorId,
      content: dto.content,
    });
    const saved = await this.postRepo.save(post);

    this.wsGateway.emitToCourse(thread.courseId, 'qna.post.created', {
      threadId,
      post: saved,
    });

    return saved;
  }

  async resolveThread(threadId: string, user: { userId: string; role: Role }) {
    const thread = await this.threadRepo.findOne({ where: { id: threadId } });
    if (!thread) {
      throw new NotFoundException(`Thread ${threadId} not found`);
    }

    if (user.role !== Role.ADMIN && user.userId !== thread.authorId) {
      throw new ForbiddenException('Only course owner or admin can resolve');
    }

    thread.resolved = true;
    return this.threadRepo.save(thread);
  }
}
