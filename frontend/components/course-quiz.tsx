"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  api,
  ApiError,
  type AttemptResult,
  type Session,
} from "@/lib/learning-api";
import {
  forgetAttempt,
  rememberAttempt,
  readActiveAttempt,
  restoreAttempt,
  startOrResumeAttempt,
  withDeadline,
  type ActiveAttempt,
} from "@/lib/learning-state";

export function CourseQuiz({
  lessonId,
  session,
}: {
  lessonId: string;
  session: Session;
}) {
  const [opened, setOpened] = useState(false);
  return opened ? (
    <QuizAttemptPanel lessonId={lessonId} session={session} />
  ) : (
    <Button variant="outline" className="mt-2" onClick={() => setOpened(true)}>
      Mở trắc nghiệm
    </Button>
  );
}

function QuizAttemptPanel({
  lessonId,
  session,
}: {
  lessonId: string;
  session: Session;
}) {
  const storageKey = `${session.user.id}:${lessonId}`;
  const [attempt, setAttempt] = useState<ActiveAttempt | null>(() =>
    restoreAttempt(storageKey),
  );
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<AttemptResult>();
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const remaining =
    attempt?.deadline === null || !attempt
      ? null
      : Math.max(0, Math.ceil((attempt.deadline - now) / 1000));

  useEffect(() => {
    let active = true;
    void readActiveAttempt(session.accessToken, lessonId)
      .then((saved) => {
        if (!active) return;
        if (saved) rememberAttempt(storageKey, saved);
        else forgetAttempt(storageKey);
        setAttempt(saved ? withDeadline(saved) : null);
        setNow(Date.now());
      })
      .catch(() => {
        /* The start action can retry discovery. */
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [lessonId, session.accessToken, storageKey]);

  useEffect(() => {
    if (!attempt?.deadline) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [attempt?.deadline]);

  async function start() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const saved = await startOrResumeAttempt(session.accessToken, lessonId);
      rememberAttempt(storageKey, saved);
      setAttempt(withDeadline(saved));
      setNow(Date.now());
      setAnswers({});
      setResult(undefined);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setError("Bạn cần ghi danh vào khóa học để làm trắc nghiệm.");
      } else if (error instanceof ApiError && error.status === 404) {
        setError("Bài học này chưa có trắc nghiệm để làm.");
      } else {
        setError(
          error instanceof Error
            ? error.message
            : "Không bắt đầu được lượt làm bài.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!attempt || remaining === 0 || busy) return;
    setBusy(true);
    setError("");
    try {
      const saved = await api<AttemptResult>(
        `/quiz-attempts/${attempt.attemptId}/submit`,
        session.accessToken,
        {
          method: "POST",
          body: JSON.stringify({
            answers: attempt.questions.map(({ id }) => ({
              questionId: id,
              optionId: answers[id],
            })),
          }),
        },
      );
      forgetAttempt(storageKey);
      setAttempt(null);
      setResult(saved);
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === 409 &&
        error.message.includes("already been submitted")
      ) {
        forgetAttempt(storageKey);
        setAttempt(null);
      }
      setError(error instanceof Error ? error.message : "Không nộp được bài.");
    } finally {
      setBusy(false);
    }
  }

  if (checking)
    return (
      <p role="status" className="mt-3 text-sm">
        Đang kiểm tra lượt làm bài…
      </p>
    );

  return (
    <div className="mt-3 space-y-3 rounded-lg border bg-muted/25 p-4">
      {result && (
        <p role="status" className="font-medium">
          Kết quả {result.score}% · {result.passed ? "Đạt" : "Chưa đạt"}
        </p>
      )}
      {remaining === 0 && (
        <p className="text-sm text-muted-foreground">
          Lượt làm bài đã hết giờ.
        </p>
      )}
      {(!attempt || remaining === 0) && (
        <Button disabled={busy} onClick={() => void start()}>
          {busy
            ? "Đang mở…"
            : result || attempt
              ? "Bắt đầu lượt khác"
              : "Bắt đầu làm bài"}
        </Button>
      )}
      {attempt && remaining !== 0 && (
        <form className="space-y-3" onSubmit={submit}>
          {remaining !== null && (
            <p className="text-sm font-medium tabular-nums">
              Còn {Math.floor(remaining / 60)}:
              {String(remaining % 60).padStart(2, "0")}
            </p>
          )}
          {attempt.questions.map((question, index) => (
            <fieldset
              key={question.id}
              className="space-y-2 rounded-lg border bg-card p-3"
              disabled={busy}
            >
              <legend className="px-1 text-sm font-semibold">
                Câu {index + 1}
              </legend>
              <p className="whitespace-pre-wrap">{question.content}</p>
              {question.options.map((option) => (
                <label
                  key={option.id}
                  className="flex cursor-pointer items-start gap-2 text-sm"
                >
                  <input
                    className="mt-1 accent-primary"
                    type="radio"
                    name={question.id}
                    value={option.id}
                    required
                    checked={answers[question.id] === option.id}
                    onChange={() =>
                      setAnswers((current) => ({
                        ...current,
                        [question.id]: option.id,
                      }))
                    }
                  />
                  <span className="break-words">{option.content}</span>
                </label>
              ))}
            </fieldset>
          ))}
          <Button type="submit" disabled={busy}>
            {busy ? "Đang chấm…" : "Nộp bài"}
          </Button>
        </form>
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
