import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../lib/learning-api";
import {
  forgetAttempt,
  loadLearningSnapshot,
  restoreAttempt,
} from "../lib/learning-state";

afterEach(() => vi.unstubAllGlobals());
describe("Learning snapshot with an optional quiz", () => {
  const course = {
    progressPct: 50,
    lessons: [
      {
        lessonId: "lesson",
        watchedSec: 90,
        completed: true,
        completedAt: null,
      },
    ],
  };
  const certificates = [
    {
      serialNo: "LMS-123",
      courseId: "course",
      userId: "student",
      issuedAt: "2026-11-19T00:00:00Z",
    },
  ];
  function responses(quizStatus: number) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (path: string) => {
        if (path.endsWith("/quiz"))
          return new Response(JSON.stringify({ message: "Quiz unavailable" }), {
            status: quizStatus,
          });
        return Response.json({
          data: path.endsWith("/progress") ? course : certificates,
        });
      }),
    );
  }
  it("retains progress and certificates when the lesson has no quiz", async () => {
    responses(404);
    expect(await loadLearningSnapshot("token", "course", "lesson")).toEqual({
      course,
      certificates,
      quiz: null,
    });
  });
  it.each([401, 403, 500])(
    "does not disguise a quiz HTTP %s as missing content",
    async (status) => {
      responses(status);
      await expect(
        loadLearningSnapshot("token", "course", "lesson"),
      ).rejects.toBeInstanceOf(ApiError);
    },
  );
});

describe("Attempt storage lifecycle", () => {
  const future = {
    attemptId: "attempt",
    questions: [],
    expiresAt: "2026-11-19T01:00:00Z",
  };
  const now = Date.parse("2026-11-19T00:00:00Z");
  function storage(value: string) {
    return { getItem: vi.fn(() => value), removeItem: vi.fn() };
  }
  it("uses the server expiry when restoring an active attempt", () => {
    const saved = storage(JSON.stringify(future));
    expect(restoreAttempt(saved, "student", now)?.deadline).toBe(
      Date.parse(future.expiresAt),
    );
  });
  it.each([
    "broken json",
    JSON.stringify({ ...future, expiresAt: "2026-11-18T00:00:00Z" }),
    JSON.stringify({ ...future, expiresAt: "invalid" }),
  ])("removes invalid or expired persisted attempts", (value) => {
    const saved = storage(value);
    expect(restoreAttempt(saved, "student", now)).toBeNull();
    expect(saved.removeItem).toHaveBeenCalledWith("lms-attempt:student");
  });
  it("removes only the signing-out user attempt", () => {
    const saved = storage(JSON.stringify(future));
    forgetAttempt(saved, "student");
    expect(saved.removeItem).toHaveBeenCalledExactlyOnceWith(
      "lms-attempt:student",
    );
  });
});
