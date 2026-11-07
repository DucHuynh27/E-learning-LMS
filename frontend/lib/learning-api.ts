export interface Session {
  accessToken: string;
  refreshToken: string;
  user: { id: string; fullName: string; email: string; role: string };
}

export interface LessonProgress {
  lessonId: string;
  watchedSec: number;
  completed: boolean;
  completedAt: string | null;
}

export interface CourseProgress {
  progressPct: number;
  lessons: LessonProgress[];
}
export interface Certificate {
  serialNo: string;
  courseId: string;
  userId: string;
  issuedAt: string;
}
export interface Question {
  id: string;
  content: string;
  options: { id: string; content: string }[];
}
export interface Quiz {
  id: string;
  passScore: number;
  timeLimitSec: number | null;
  questions: Question[];
}
export interface Attempt {
  attemptId: string;
  questions: Question[];
}
export interface AttemptResult {
  attemptId: string;
  score: number;
  passed: boolean;
  submittedAt: string;
}
export interface Health {
  status: string;
  checks: { postgres: boolean; redis: boolean; minio: boolean };
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  token?: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body) headers.set("Content-Type", "application/json");
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new Error("Chưa kết nối được backend. Vui lòng thử lại sau.");
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = Array.isArray(payload.message)
      ? payload.message.join(" · ")
      : payload.message;
    throw new ApiError(
      message || `Yêu cầu không thành công (${response.status}).`,
      response.status,
    );
  }
  return payload.data as T;
}
