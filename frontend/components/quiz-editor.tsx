"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { managementError } from "@/lib/course-authoring";
import { api, ApiError } from "@/lib/learning-api";

interface DraftOption {
  id: string;
  content: string;
  isCorrect: boolean;
}

interface DraftQuestion {
  id: string;
  content: string;
  options: DraftOption[];
}

interface ManagedQuiz {
  passScore: number;
  timeLimitSec: number | null;
  locked: boolean;
  questions: DraftQuestion[];
}

function newOption(): DraftOption {
  return { id: crypto.randomUUID(), content: "", isCorrect: false };
}

function newQuestion(): DraftQuestion {
  return {
    id: crypto.randomUUID(),
    content: "",
    options: [newOption(), newOption()],
  };
}

export function QuizEditor({
  lessonId,
  token,
}: {
  lessonId: string;
  token: string;
}) {
  const [revision, setRevision] = useState(0);
  const [load, setLoad] = useState<{
    revision: number;
    quiz: ManagedQuiz | null;
    error?: string;
  }>();
  const path = `/lessons/${lessonId}/quiz`;

  useEffect(() => {
    let active = true;
    void api<ManagedQuiz>(`${path}/manage`, token)
      .then((quiz) => {
        if (active) setLoad({ revision, quiz });
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (
          error instanceof ApiError &&
          error.status === 404 &&
          error.message === "Quiz not found"
        ) {
          setLoad({ revision, quiz: null });
        } else {
          setLoad({ revision, quiz: null, error: managementError(error) });
        }
      });
    return () => {
      active = false;
    };
  }, [path, token, revision]);

  if (!load || load.revision !== revision)
    return <p role="status">Đang tải trắc nghiệm…</p>;
  if (load.error) {
    return (
      <div className="space-y-2">
        <p role="alert" className="text-sm text-destructive">
          {load.error}
        </p>
        <Button variant="outline" onClick={() => setRevision(revision + 1)}>
          Tải lại
        </Button>
      </div>
    );
  }

  return <QuizForm key={revision} quiz={load.quiz} path={path} token={token} />;
}

function QuizForm({
  quiz,
  path,
  token,
}: {
  quiz: ManagedQuiz | null;
  path: string;
  token: string;
}) {
  const [questions, setQuestions] = useState(
    () => quiz?.questions ?? [newQuestion()],
  );
  const [exists, setExists] = useState(quiz !== null);
  const [locked, setLocked] = useState(quiz?.locked ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function editQuestion(
    id: string,
    change: (question: DraftQuestion) => DraftQuestion,
  ) {
    setNotice("");
    setQuestions((current) =>
      current.map((question) =>
        question.id === id ? change(question) : question,
      ),
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked || busy) return;
    setError("");
    setNotice("");
    const fields = new FormData(event.currentTarget);
    const timeLimitSec = Number(fields.get("timeLimitSec"));
    const payload = questions.map(({ content, options }) => ({
      content: content.trim(),
      options: options.map((option) => ({
        content: option.content.trim(),
        isCorrect: option.isCorrect,
      })),
    }));
    if (
      payload.some(
        (question) =>
          !question.content ||
          question.options.some((option) => !option.content),
      )
    ) {
      setError("Điền nội dung cho tất cả câu hỏi và lựa chọn.");
      return;
    }
    if (
      payload.some(
        (question) => !question.options.some((option) => option.isCorrect),
      )
    ) {
      setError("Chọn một đáp án đúng cho mỗi câu hỏi.");
      return;
    }
    setBusy(true);
    try {
      await api(path, token, {
        method: exists ? "PUT" : "POST",
        body: JSON.stringify({
          passScore: Number(fields.get("passScore")),
          timeLimitSec,
          questions: payload,
        }),
      });
      setExists(true);
      setNotice(`Đã lưu ${questions.length} câu hỏi.`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        if (error.message.includes("attempt has started")) {
          setLocked(true);
          setError("Đã có lượt làm bài. Mở lại trình soạn để xem bản đã lưu.");
          return;
        }
        if (error.message.includes("already has a quiz")) {
          setError(
            "Bài học đã có trắc nghiệm. Mở lại trình soạn để tải dữ liệu mới nhất.",
          );
          return;
        }
      }
      setError(managementError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-lg border bg-muted/25 p-3 sm:p-4"
    >
      <h4 className="font-semibold">Câu hỏi trắc nghiệm</h4>
      {locked && (
        <p className="text-sm text-muted-foreground">
          Quiz đã có lượt làm bài và được khóa chỉnh sửa.
        </p>
      )}
      <fieldset className="grid min-w-0 gap-4" disabled={busy || locked}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium">
            Điểm đạt (%)
            <Input
              name="passScore"
              type="number"
              required
              min={0}
              max={100}
              defaultValue={quiz?.passScore ?? 70}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Giới hạn (giây, 0 là không giới hạn)
            <Input
              name="timeLimitSec"
              type="number"
              required
              min={0}
              max={2147483647}
              defaultValue={quiz?.timeLimitSec ?? 0}
            />
          </label>
        </div>
        {questions.map((question, index) => (
          <fieldset
            key={question.id}
            className="min-w-0 space-y-3 rounded-lg border bg-card p-3"
          >
            <legend className="px-1 text-sm font-semibold">
              Câu {index + 1}
            </legend>
            <label className="grid gap-2 text-sm font-medium">
              Nội dung câu hỏi
              <textarea
                required
                maxLength={5000}
                className="min-h-18 rounded-lg border border-input bg-background p-2 text-sm"
                value={question.content}
                onChange={(event) =>
                  editQuestion(question.id, (item) => ({
                    ...item,
                    content: event.target.value,
                  }))
                }
              />
            </label>
            <div className="space-y-2">
              {question.options.map((option, optionIndex) => (
                <div
                  key={option.id}
                  className="flex flex-wrap items-center gap-2"
                >
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="radio"
                      name={`correct-${question.id}`}
                      value={option.id}
                      checked={option.isCorrect}
                      aria-label={`Chọn lựa chọn ${optionIndex + 1} làm đáp án đúng cho câu ${index + 1}`}
                      className="accent-primary"
                      onChange={() =>
                        editQuestion(question.id, (item) => ({
                          ...item,
                          options: item.options.map((choice) => ({
                            ...choice,
                            isCorrect: choice.id === option.id,
                          })),
                        }))
                      }
                    />
                    Đúng
                  </label>
                  <Input
                    className="min-w-20 flex-1"
                    required
                    maxLength={2000}
                    aria-label={`Lựa chọn ${optionIndex + 1} của câu ${index + 1}`}
                    placeholder={`Lựa chọn ${optionIndex + 1}`}
                    value={option.content}
                    onChange={(event) =>
                      editQuestion(question.id, (item) => ({
                        ...item,
                        options: item.options.map((choice) =>
                          choice.id === option.id
                            ? { ...choice, content: event.target.value }
                            : choice,
                        ),
                      }))
                    }
                  />
                  {question.options.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      aria-label={`Xóa lựa chọn ${optionIndex + 1} của câu ${index + 1}`}
                      onClick={() =>
                        editQuestion(question.id, (item) => ({
                          ...item,
                          options: item.options.filter(
                            (choice) => choice.id !== option.id,
                          ),
                        }))
                      }
                    >
                      Xóa
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={question.options.length >= 8}
                onClick={() =>
                  editQuestion(question.id, (item) => ({
                    ...item,
                    options: [...item.options, newOption()],
                  }))
                }
              >
                Thêm lựa chọn
              </Button>
              {questions.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setNotice("");
                    setQuestions((current) =>
                      current.filter((item) => item.id !== question.id),
                    );
                  }}
                >
                  Xóa câu {index + 1}
                </Button>
              )}
            </div>
          </fieldset>
        ))}
        {!locked && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={questions.length >= 100}
              onClick={() => {
                setNotice("");
                setQuestions((current) => [...current, newQuestion()]);
              }}
            >
              Thêm câu hỏi
            </Button>
            <Button type="submit">
              {busy ? "Đang lưu…" : "Lưu trắc nghiệm"}
            </Button>
          </div>
        )}
      </fieldset>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-primary">
          {notice}
        </p>
      )}
    </form>
  );
}
