import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../lib/learning-api";
import {
  forgetAttempt,
  loadLearningSnapshot,
  rememberAttempt,
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
    startedAt: "2026-11-19T00:00:00Z",
    questions: [
      {
        id: "question",
        content: "A question",
        options: [{ id: "option", content: "An option" }],
      },
    ],
    expiresAt: "2026-11-19T01:00:00Z",
  };
  const now = Date.parse("2026-11-19T00:00:00Z");
  function storage(value: string) {
    const saved = {
      getItem: vi.fn(() => value),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    vi.stubGlobal("window", { sessionStorage: saved });
    return saved;
  }
  it("uses the server expiry when restoring an active attempt", () => {
    storage(JSON.stringify(future));
    expect(restoreAttempt("student", now)?.deadline).toBe(
      Date.parse(future.expiresAt),
    );
  });
  it.each([
    "broken json",
    JSON.stringify({ ...future, expiresAt: "2026-11-18T00:00:00Z" }),
    JSON.stringify({ ...future, expiresAt: "invalid" }),
    JSON.stringify({ ...future, startedAt: "invalid" }),
    JSON.stringify({ ...future, questions: [null] }),
    JSON.stringify({
      ...future,
      questions: [{ ...future.questions[0], options: null }],
    }),
    JSON.stringify({
      ...future,
      questions: [{ ...future.questions[0], content: { broken: true } }],
    }),
  ])("removes invalid or expired persisted attempts", (value) => {
    const saved = storage(value);
    expect(restoreAttempt("student", now)).toBeNull();
    expect(saved.removeItem).toHaveBeenCalledWith("lms-attempt:student");
  });
  it("removes only the signing-out user attempt", () => {
    const saved = storage(JSON.stringify(future));
    forgetAttempt("student");
    expect(saved.removeItem).toHaveBeenCalledExactlyOnceWith(
      "lms-attempt:student",
    );
  });
  it("persists the server attempt under the current user key", () => {
    const saved = storage("");
    rememberAttempt("student", future);
    expect(saved.setItem).toHaveBeenCalledExactlyOnceWith(
      "lms-attempt:student",
      JSON.stringify(future),
    );
  });
  it("restores an unlimited attempt without trusting a saved client deadline", () => {
    storage(JSON.stringify({ ...future, expiresAt: null, deadline: now - 1 }));
    expect(restoreAttempt("student", now)).toEqual({
      ...future,
      expiresAt: null,
      deadline: null,
    });
  });
  it("continues when the browser denies access to sessionStorage itself", () => {
    vi.stubGlobal("window", {
      get sessionStorage() {
        throw new DOMException("Storage blocked", "SecurityError");
      },
    });
    expect(() => rememberAttempt("student", future)).not.toThrow();
    expect(restoreAttempt("student", now)).toBeNull();
    expect(() => forgetAttempt("student")).not.toThrow();
  });
  it("tolerates failing storage methods after a server operation succeeds", () => {
    const saved = storage("");
    saved.getItem.mockImplementation(() => {
      throw new Error("Read blocked");
    });
    saved.setItem.mockImplementation(() => {
      throw new DOMException("Full", "QuotaExceededError");
    });
    saved.removeItem.mockImplementation(() => {
      throw new Error("Write blocked");
    });
    expect(() => rememberAttempt("student", future)).not.toThrow();
    expect(restoreAttempt("student", now)).toBeNull();
    expect(() => forgetAttempt("student")).not.toThrow();
  });
});
