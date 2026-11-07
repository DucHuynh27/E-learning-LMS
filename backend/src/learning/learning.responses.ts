import type { LessonProgress } from '../progress/lesson-progress.entity.js';
import type { Certificate } from '../certificates/certificate.entity.js';

export class LessonProgressResponse {
  lessonId: string;
  watchedSec: number;
  completed: boolean;
  completedAt: Date | null;
  constructor(
    progress: Pick<
      LessonProgress,
      'lessonId' | 'watchedSec' | 'completed' | 'completedAt'
    >,
  ) {
    this.lessonId = progress.lessonId;
    this.watchedSec = progress.watchedSec;
    this.completed = progress.completed;
    this.completedAt = progress.completedAt;
  }
}

export class CertificateResponse {
  serialNo: string;
  courseId: string;
  userId: string;
  issuedAt: Date;
  constructor(certificate: Certificate) {
    this.serialNo = certificate.serialNo;
    this.courseId = certificate.courseId;
    this.userId = certificate.userId;
    this.issuedAt = certificate.issuedAt;
  }
}

export interface PublicQuestion {
  id: string;
  content: string;
  options: { id: string; content: string }[];
}

export interface QuizResponse {
  id: string;
  lessonId: string;
  passScore: number;
  timeLimitSec: number | null;
  questions: PublicQuestion[];
}

export interface AttemptResultResponse {
  attemptId: string;
  score: number;
  passed: boolean;
  submittedAt: Date;
}
