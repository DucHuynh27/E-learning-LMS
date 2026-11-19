import {
  api,
  ApiError,
  type Attempt,
  type Certificate,
  type CourseProgress,
  type Quiz,
} from "./learning-api";

export type ActiveAttempt = Attempt & { deadline: number | null };

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

type AttemptStorage = Pick<Storage, "getItem" | "removeItem">;

export function forgetAttempt(storage: AttemptStorage, userId: string): void {
  try {
    storage.removeItem(`lms-attempt:${userId}`);
  } catch {
    /* Storage may be disabled by the browser. */
  }
}

export function restoreAttempt(
  storage: AttemptStorage,
  userId: string,
  now = Date.now(),
): ActiveAttempt | null {
  try {
    const saved = storage.getItem(`lms-attempt:${userId}`);
    if (!saved) return null;
    const attempt = JSON.parse(saved) as Attempt;
    if (
      typeof attempt.attemptId !== "string" ||
      !Array.isArray(attempt.questions) ||
      !(attempt.expiresAt === null || typeof attempt.expiresAt === "string")
    )
      throw new Error("Invalid attempt");
    const deadline =
      attempt.expiresAt === null ? null : Date.parse(attempt.expiresAt);
    if (deadline !== null && (!Number.isFinite(deadline) || deadline <= now))
      throw new Error("Expired attempt");
    return { ...attempt, deadline };
  } catch {
    forgetAttempt(storage, userId);
    return null;
  }
}
