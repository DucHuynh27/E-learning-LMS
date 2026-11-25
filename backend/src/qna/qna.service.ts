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
import { QnaCatalogAccess } from './qna-catalog-access.service.js';
import { NotificationService } from '../notification/notification.service.js';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface.js';
import {
  PostResponseDto,
  ThreadResponseDto,
  toPostResponseDto,
  toThreadResponseDto,
} from '../common/dto/realtime-responses.dto.js';

@Injectable()
export class QnaService {
  constructor(
    @InjectRepository(QnaThread)
    private readonly threadRepo: Repository<QnaThread>,
    @InjectRepository(QnaPost)
    private readonly postRepo: Repository<QnaPost>,
    private readonly wsGateway: WsGateway,
    private readonly catalogAccess: QnaCatalogAccess,
    private readonly notificationService: NotificationService,
  ) {}

  async createThread(
    courseId: string,
    user: AuthenticatedUser,
    dto: CreateThreadDto,
  ): Promise<ThreadResponseDto> {
    await this.catalogAccess.assertCanAccess(courseId, user);

    if (dto.lessonId) {
      const lesson = await this.catalogAccess.findLesson(
        dto.lessonId,
        courseId,
      );
      if (!lesson) {
        throw new NotFoundException(
          `Lesson ${dto.lessonId} not found in this course`,
        );
      }
    }

    const thread = this.threadRepo.create({
      courseId,
      authorId: user.userId,
      title: dto.title,
      lessonId: dto.lessonId ?? null,
    });
    const saved = await this.threadRepo.save(thread);

    this.wsGateway.emitToCourse(courseId, 'qna.thread.created', {
      thread: saved,
    });

    return toThreadResponseDto(saved);
  }

  async findThreads(
    courseId: string,
    user: AuthenticatedUser,
    query: QueryThreadsDto,
  ) {
    await this.catalogAccess.assertCanAccess(courseId, user);

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
      items: items.map((item) => toThreadResponseDto(item)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getThreadWithPosts(threadId: string, user: AuthenticatedUser) {
    const thread = await this.threadRepo.findOne({ where: { id: threadId } });
    if (!thread) {
      throw new NotFoundException(`Thread ${threadId} not found`);
    }

    await this.catalogAccess.assertCanAccess(thread.courseId, user);

    const posts = await this.postRepo.find({
      where: { threadId },
      order: { createdAt: 'ASC' },
    });

    return {
      thread: toThreadResponseDto(thread),
      posts: posts.map((post) => toPostResponseDto(post)),
    };
  }

  async createPost(
    threadId: string,
    user: AuthenticatedUser,
    dto: CreatePostDto,
  ): Promise<PostResponseDto> {
    const thread = await this.threadRepo.findOne({ where: { id: threadId } });
    if (!thread) {
      throw new NotFoundException(`Thread ${threadId} not found`);
    }

    await this.catalogAccess.assertCanAccess(thread.courseId, user);

    const post = this.postRepo.create({
      threadId,
      authorId: user.userId,
      content: dto.content,
    });
    const saved = await this.postRepo.save(post);

    this.wsGateway.emitToCourse(thread.courseId, 'qna.post.created', {
      threadId,
      post: saved,
    });

    // Tạo notification cho tác giả thread nếu người trả lời khác tác giả
    if (thread.authorId !== user.userId) {
      await this.notificationService.createNotification(
        thread.authorId,
        'qna.reply',
        {
          threadId: thread.id,
          courseId: thread.courseId,
          postId: saved.id,
          replierId: user.userId,
        },
      );
    }

    return toPostResponseDto(saved);
  }

  async resolveThread(
    threadId: string,
    user: AuthenticatedUser,
  ): Promise<ThreadResponseDto> {
    const thread = await this.threadRepo.findOne({ where: { id: threadId } });
    if (!thread) {
      throw new NotFoundException(`Thread ${threadId} not found`);
    }

    const { isOwner } = await this.catalogAccess.assertCanAccess(
      thread.courseId,
      user,
    );

    if (user.role !== Role.ADMIN && !isOwner) {
      throw new ForbiddenException('Only course owner or admin can resolve');
    }

    thread.resolved = true;
    const saved = await this.threadRepo.save(thread);

    // Gửi notification cho author thread nếu người resolve là instructor / admin
    if (thread.authorId !== user.userId) {
      await this.notificationService.createNotification(
        thread.authorId,
        'qna.resolved',
        {
          threadId: thread.id,
          courseId: thread.courseId,
          resolvedBy: user.userId,
        },
      );
    }

    return toThreadResponseDto(saved);
  }
}
