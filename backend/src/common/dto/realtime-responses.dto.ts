import { Exclude } from 'class-transformer';

export class ThreadResponseDto {
  id: string;
  courseId: string;
  lessonId?: string | null;
  authorId: string;
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
  authorId: string;
  content: string;
  createdAt: Date;

  constructor(partial: Partial<PostResponseDto>) {
    Object.assign(this, partial);
  }
}

export class NotificationResponseDto {
  id: string;
  @Exclude()
  userId: string;
  type: string;
  payload: Record<string, unknown>;
  read: boolean;
  createdAt: Date;

  constructor(partial: Partial<NotificationResponseDto>) {
    Object.assign(this, partial);
  }
}
