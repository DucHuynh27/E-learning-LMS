export class ThreadResponseDto {
  id: string;
  courseId: string;
  lessonId?: string | null;
  authorId: string;
  title: string;
  resolved: boolean;
  createdAt: Date;
}

export class PostResponseDto {
  id: string;
  threadId: string;
  authorId: string;
  content: string;
  createdAt: Date;
}

export class NotificationResponseDto {
  id: string;
  userId: string;
  type: string;
  payload: Record<string, unknown>;
  read: boolean;
  createdAt: Date;
}
