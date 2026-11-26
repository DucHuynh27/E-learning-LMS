import {
  api,
  ApiError,
  type Attempt,
  type Certificate,
  type CourseProgress,
  type Question,
  type Quiz,
} from "./learning-api";

export type ActiveAttempt = Attempt & { deadline: number | null };

export function withDeadline(attempt: Attempt): ActiveAttempt {
  return {
    ...attempt,
    deadline: attempt.expiresAt === null ? null : Date.parse(attempt.expiresAt),
  };
}

export async function readActiveAttempt(
  token: string,
  lessonId: string,
): Promise<Attempt | null> {
  try {
    return await api<Attempt | null>(
      `/lessons/${lessonId}/quiz/attempts/active`,
      token,
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function startOrResumeAttempt(
  token: string,
  lessonId: string,
): Promise<Attempt> {
  try {
    return await api<Attempt>(`/lessons/${lessonId}/quiz/attempts`, token, {
      method: "POST",
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      const active = await readActiveAttempt(token, lessonId);
      if (active) return active;
    }
    throw error;
  }
}

export async function loadLearningSnapshot(
  token: string,
  courseId: string,
  quizLessonId: string,
) {
  const [course, certificates, quiz] = await Promise.all([
    api<CourseProgress>(`/enrolments/${courseId}/progress`, token),
    api<Certificate[]>("/certificates/me", token),
    api<Quiz>(`/lessons/${quizLessonId}/quiz`, token).catch(
      (error: unknown) => {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      },
    ),
  ]);
  return { course, certificates, quiz };
}

export function forgetAttempt(userId: string): void {
  try {
    window.sessionStorage.removeItem(`lms-attempt:${userId}`);
  } catch {
    /* Storage may be disabled by the browser. */
  }
}

export function forgetAllAttempts(userId: string): void {
  forgetAttempt(userId);
  try {
    const storage = window.sessionStorage;
    for (let index = storage.length - 1; index >= 0; index--) {
      const key = storage.key(index);
      if (key?.startsWith(`lms-attempt:${userId}:`)) storage.removeItem(key);
    }
  } catch {
    /* Storage may be disabled by the browser. */
  }
}

export function rememberAttempt(userId: string, attempt: Attempt): void {
  try {
    window.sessionStorage.setItem(
      `lms-attempt:${userId}`,
      JSON.stringify(attempt),
    );
  } catch {
    /* A successful server operation must not fail because persistence is unavailable. */
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isQuestion(value: unknown): value is Question {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.content === "string" &&
    Array.isArray(value.options) &&
    value.options.length > 0 &&
    value.options.every(
      (option: unknown) =>
        isRecord(option) &&
        typeof option.id === "string" &&
        option.id.length > 0 &&
        typeof option.content === "string",
    )
  );
}

function isAttempt(value: unknown): value is Attempt {
  return (
    isRecord(value) &&
    typeof value.attemptId === "string" &&
    value.attemptId.length > 0 &&
    typeof value.startedAt === "string" &&
    Number.isFinite(Date.parse(value.startedAt)) &&
    (value.expiresAt === null || typeof value.expiresAt === "string") &&
    Array.isArray(value.questions) &&
    value.questions.length > 0 &&
    value.questions.every(isQuestion)
  );
}

export function restoreAttempt(
  userId: string,
  now = Date.now(),
): ActiveAttempt | null {
  try {
    const saved = window.sessionStorage.getItem(`lms-attempt:${userId}`);
    if (!saved) return null;
    const attempt: unknown = JSON.parse(saved);
    if (!isAttempt(attempt)) throw new Error("Invalid attempt");
    const deadline =
      attempt.expiresAt === null ? null : Date.parse(attempt.expiresAt);
    if (deadline !== null && (!Number.isFinite(deadline) || deadline <= now))
      throw new Error("Expired attempt");
    return { ...attempt, deadline };
  } catch {
    forgetAttempt(userId);
    return null;
  }
}
