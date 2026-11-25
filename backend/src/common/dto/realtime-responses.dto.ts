export class ThreadResponseDto {
  id: string;
  courseId: string;
  lessonId?: string | null;
  title: string;
  resolved: boolean;
  createdAt: Date;

  constructor(partial: Partial<ThreadResponseDto>) {
    Object.assign(this, partial);
  }
}

export class PostResponseDto {
  id: string;
  threadId: string;
  content: string;
  createdAt: Date;

  constructor(partial: Partial<PostResponseDto>) {
    Object.assign(this, partial);
  }
}

export class NotificationResponseDto {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  read: boolean;
  createdAt: Date;

  constructor(partial: Partial<NotificationResponseDto>) {
    Object.assign(this, partial);
  }
}

export function toThreadResponseDto(thread: {
  id: string;
  courseId: string;
  lessonId?: string | null;
  title: string;
  resolved: boolean;
  createdAt: Date;
}): ThreadResponseDto {
  return new ThreadResponseDto({
    id: thread.id,
    courseId: thread.courseId,
    lessonId: thread.lessonId ?? null,
    title: thread.title,
    resolved: thread.resolved,
    createdAt: thread.createdAt,
  });
}

export function toPostResponseDto(post: {
  id: string;
  threadId: string;
  content: string;
  createdAt: Date;
}): PostResponseDto {
  return new PostResponseDto({
    id: post.id,
    threadId: post.threadId,
    content: post.content,
    createdAt: post.createdAt,
  });
}

export function toNotificationResponseDto(notification: {
  id: string;
  type: string;
  payload?: Record<string, unknown> | null;
  read: boolean;
  createdAt: Date;
}): NotificationResponseDto {
  const sanitizePayload = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map((item) => sanitizePayload(item));
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .filter(
            ([key]) =>
              !['userId', 'authorId', 'replierId', 'resolvedBy'].includes(key),
          )
          .map(([key, nested]) => [key, sanitizePayload(nested)]),
      );
    }
    return value;
  };

  const payload = sanitizePayload(notification.payload);

  return new NotificationResponseDto({
    id: notification.id,
    type: notification.type,
    payload:
      payload && typeof payload === 'object' && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : {},
    read: notification.read,
    createdAt: notification.createdAt,
  });
}
