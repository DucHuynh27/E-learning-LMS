"use client";

import { useState, type FormEvent } from "react";
import { QuizEditor } from "@/components/quiz-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/learning-api";
import { managementError } from "@/lib/course-authoring";

const lessonTypes = {
  ARTICLE: "Bài đọc",
  VIDEO: "Video",
  QUIZ: "Trắc nghiệm",
};

interface LessonFields {
  title: string;
  content: string | null;
  type: keyof typeof lessonTypes;
  durationSec: number;
  isPublished: boolean;
}

interface Lesson extends LessonFields {
  id: string;
}

export interface CourseSection {
  id: string;
  title: string;
  lessons: Lesson[];
}

export function SectionEditor({
  section,
  token,
  onChange,
}: {
  section: CourseSection;
  token: string;
  onChange: (change: (current: CourseSection) => CourseSection) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [adding, setAdding] = useState(false);

  async function rename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const title = String(new FormData(event.currentTarget).get("title")).trim();
    setError("");
    setNotice("");
    if (!title) {
      setError("Nhập tên chương.");
      return;
    }
    setBusy(true);
    try {
      const saved = await api<Pick<CourseSection, "title">>(
        `/sections/${section.id}`,
        token,
        {
          method: "PATCH",
          body: JSON.stringify({ title }),
        },
      );
      onChange((current) => ({ ...current, title: saved.title }));
      setNotice("Đã lưu tên chương.");
    } catch (error) {
      setError(managementError(error));
    } finally {
      setBusy(false);
    }
  }

  async function createLesson(fields: LessonFields) {
    const lesson = await api<Lesson>(`/sections/${section.id}/lessons`, token, {
      method: "POST",
      body: JSON.stringify(fields),
    });
    onChange((current) => ({
      ...current,
      lessons: [...current.lessons, lesson],
    }));
    setAdding(false);
  }

  return (
    <section className="min-w-0 space-y-4 rounded-lg border bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold break-words">{section.title}</h3>
        <Button variant="outline" onClick={() => setAdding(!adding)}>
          {adding ? "Đóng form" : "Thêm bài học"}
        </Button>
      </div>
      <form onSubmit={rename} className="flex flex-wrap items-end gap-2">
        <label className="grid min-w-0 flex-1 gap-2 text-sm font-medium">
          Tên chương
          <Input
            name="title"
            required
            maxLength={200}
            defaultValue={section.title}
            disabled={busy}
          />
        </label>
        <Button type="submit" variant="ghost" disabled={busy}>
          Lưu tên chương
        </Button>
      </form>
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
      {adding && (
        <div className="rounded-lg border p-3 bg-muted/25">
          <LessonForm onSave={createLesson} />
        </div>
      )}
      <ul className="space-y-2">
        {section.lessons.map((lesson) => (
          <li key={lesson.id}>
            <LessonEditor
              lesson={lesson}
              token={token}
              onSaved={(saved) =>
                onChange((current) => ({
                  ...current,
                  lessons: current.lessons.map((item) =>
                    item.id === saved.id ? saved : item,
                  ),
                }))
              }
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function LessonEditor({
  lesson,
  token,
  onSaved,
}: {
  lesson: Lesson;
  token: string;
  onSaved: (lesson: Lesson) => void;
}) {
  const [showQuiz, setShowQuiz] = useState(false);

  async function save(fields: LessonFields) {
    const saved = await api<Lesson>(`/lessons/${lesson.id}`, token, {
      method: "PATCH",
      body: JSON.stringify(fields),
    });
    onSaved(saved);
  }

  return (
    <details className="rounded-lg border p-3">
      <summary className="cursor-pointer break-words text-sm font-medium">
        {lesson.title}{" "}
        <span className="text-muted-foreground">
          · {lessonTypes[lesson.type]} ·{" "}
          {lesson.isPublished ? "Hiển thị" : "Ẩn"}
        </span>
      </summary>
      <div className="mt-4 space-y-4">
        <LessonForm lesson={lesson} onSave={save} />
        {lesson.type === "QUIZ" && (
          <>
            <Button variant="outline" onClick={() => setShowQuiz(!showQuiz)}>
              {showQuiz ? "Đóng trình soạn" : "Soạn câu hỏi trắc nghiệm"}
            </Button>
            {showQuiz && <QuizEditor lessonId={lesson.id} token={token} />}
          </>
        )}
      </div>
    </details>
  );
}

function LessonForm({
  lesson,
  onSave,
}: {
  lesson?: Lesson;
  onSave: (fields: LessonFields) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [type, setType] = useState<LessonFields["type"]>(
    lesson?.type ?? "ARTICLE",
  );
  const [content, setContent] = useState(lesson?.content ?? "");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const values = new FormData(event.currentTarget);
    const title = String(values.get("title")).trim();
    const theory = String(values.get("content") ?? "").trim();
    setSaved(false);
    setError("");
    if (!title) {
      setError("Nhập tên bài học.");
      return;
    }
    if (
      type === "ARTICLE" &&
      ((theory.length > 0 && theory.length < 50) ||
        (!lesson && theory.length < 50))
    ) {
      setError(
        "Phần lý thuyết cần ít nhất 50 ký tự để giải thích kiến thức trọng tâm.",
      );
      return;
    }
    setBusy(true);
    try {
      await onSave({
        title,
        type,
        content: type === "ARTICLE" && theory ? theory : null,
        durationSec: Number(values.get("durationSec")),
        isPublished: values.has("isPublished"),
      });
      setSaved(true);
    } catch (error) {
      setError(managementError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <label className="grid gap-2 text-sm font-medium">
        Tên bài học
        <Input
          name="title"
          required
          maxLength={200}
          defaultValue={lesson?.title}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">
          Loại bài
          <select
            name="type"
            value={type}
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
            onChange={(event) =>
              setType(event.target.value as LessonFields["type"])
            }
          >
            {Object.entries(lessonTypes).map(([type, label]) => (
              <option key={type} value={type}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Thời lượng dự kiến (giây)
          <Input
            name="durationSec"
            type="number"
            required
            min={0}
            max={2147483647}
            step={1}
            defaultValue={lesson?.durationSec ?? 0}
          />
        </label>
      </div>
      <div hidden={type !== "ARTICLE"} className="grid gap-2">
        <label
          htmlFor={`lesson-theory-${lesson?.id ?? "new"}`}
          className="text-sm font-medium"
        >
          Phần lý thuyết
        </label>
        <textarea
          id={`lesson-theory-${lesson?.id ?? "new"}`}
          name="content"
          value={content}
          required={!lesson && type === "ARTICLE"}
          minLength={!lesson && type === "ARTICLE" ? 50 : undefined}
          maxLength={20000}
          className="min-h-36 rounded-lg border border-input bg-background p-3 text-sm leading-6"
          placeholder="Giải thích khái niệm, nguyên tắc và ví dụ cần nắm trước khi thực hành."
          onChange={(event) => setContent(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          {content.length}/20000 ký tự · Khuyến nghị trình bày khái niệm, ví dụ
          và lỗi thường gặp.
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          name="isPublished"
          type="checkbox"
          defaultChecked={lesson?.isPublished ?? true}
          className="accent-primary"
        />
        Hiển thị khi khóa học được xuất bản
      </label>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm text-primary">
          Đã lưu bài học.
        </p>
      )}
      <Button
        type="submit"
        variant="outline"
        className="justify-self-start"
        disabled={busy}
      >
        {busy ? "Đang lưu…" : lesson ? "Lưu bài học" : "Thêm bài học"}
      </Button>
    </form>
  );
}
