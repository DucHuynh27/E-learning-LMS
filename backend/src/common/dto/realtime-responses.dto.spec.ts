import { describe, expect, it } from 'vitest';
import {
  toNotificationResponseDto,
  toPostResponseDto,
  toThreadResponseDto,
} from './realtime-responses.dto.js';

describe('Realtime response DTO mappers', () => {
  it('maps a thread without leaking authorId or nested relations', () => {
    const response = toThreadResponseDto({
      id: 'thread-id',
      courseId: 'course-id',
      lessonId: null,
      authorId: 'private-author-id',
      title: 'A thread',
      resolved: false,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      posts: [{ id: 'private-post-id', authorId: 'private-post-author' }],
    } as never);

    expect(response).toEqual({
      id: 'thread-id',
      courseId: 'course-id',
      lessonId: null,
      title: 'A thread',
      resolved: false,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    expect(response).not.toHaveProperty('authorId');
    expect(response).not.toHaveProperty('posts');
  });

  it('maps a post without leaking authorId or its thread relation', () => {
    const response = toPostResponseDto({
      id: 'post-id',
      threadId: 'thread-id',
      authorId: 'private-author-id',
      content: 'A post',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      thread: { id: 'thread-id', authorId: 'private-thread-author' },
    } as never);

    expect(response).toEqual({
      id: 'post-id',
      threadId: 'thread-id',
      content: 'A post',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    expect(response).not.toHaveProperty('authorId');
    expect(response).not.toHaveProperty('thread');
  });

  it('maps a notification and recursively removes internal identity fields', () => {
    const response = toNotificationResponseDto({
      id: 'notification-id',
      userId: 'private-user-id',
      type: 'qna.reply',
      payload: {
        threadId: 'thread-id',
        courseId: 'course-id',
        postId: 'post-id',
        replierId: 'private-replier-id',
        nested: {
          authorId: 'private-author-id',
          userId: 'private-nested-user-id',
          resolvedBy: 'private-resolver-id',
        },
      },
      read: false,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    expect(response).not.toHaveProperty('userId');
    expect(response.payload).toEqual({
      threadId: 'thread-id',
      courseId: 'course-id',
      postId: 'post-id',
      nested: {},
    });
  });

  it('uses an empty payload when notification payload is null', () => {
    const response = toNotificationResponseDto({
      id: 'notification-id',
      type: 'qna.reply',
      payload: null,
      read: false,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    expect(response.payload).toEqual({});
  });
});
