"use client";

import { useState, type FormEvent } from "react";
import { BookOpenText, CircleHelp, Clapperboard, Plus, Sparkles } from "lucide-react";
import { QuizEditor } from "@/components/quiz-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/learning-api";
import { managementError } from "@/lib/course-authoring";

const lessonTypes = {
  ARTICLE: "Bài lý thuyết",
  VIDEO: "Video",
  QUIZ: "Trắc nghiệm",
};

const lessonTypeDetails = {
  ARTICLE: "Viết nội dung, khái niệm và ví dụ cho học viên đọc.",
  VIDEO: "Dán liên kết video để học viên xem ngay trong bài học.",
  QUIZ: "Tạo câu hỏi và chọn đáp án đúng để chấm tự động.",
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
        <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-4 sm:p-5">
          <div className="mb-4">
            <h4 className="font-semibold">Tạo bài học mới</h4>
            <p className="mt-1 text-sm text-muted-foreground">Chọn loại nội dung, đặt tên rồi điền phần cần thiết.</p>
          </div>
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
  const [showQuiz, setShowQuiz] = useState(lesson.type === "QUIZ");

  async function save(fields: LessonFields) {
    const saved = await api<Lesson>(`/lessons/${lesson.id}`, token, {
      method: "PATCH",
      body: JSON.stringify(fields),
    });
    onSaved(saved);
  }

  return (
    <details open={lesson.type === "QUIZ"} className="rounded-lg border p-3">
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
    if (type === "ARTICLE" && !theory) {
      setError("Thêm nội dung bài lý thuyết.");
      return;
    }
    if (type === "VIDEO") {
      try {
        const videoUrl = new URL(theory);
        if (videoUrl.protocol !== "https:" && videoUrl.protocol !== "http:") {
          throw new Error("Invalid protocol");
        }
      } catch {
        setError("Nhập liên kết video hợp lệ, bắt đầu bằng https:// hoặc http://.");
        return;
      }
    }
    setBusy(true);
    try {
      await onSave({
        title,
        type,
        content: type === "ARTICLE" || type === "VIDEO" ? theory : null,
        durationSec: Number(values.get("durationSec")) * 60,
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
    <form onSubmit={submit} className="grid gap-5">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Loại nội dung</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {Object.entries(lessonTypes).map(([value, label]) => {
            const Icon = value === "ARTICLE" ? BookOpenText : value === "VIDEO" ? Clapperboard : CircleHelp;
            const selected = type === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={selected}
                onClick={() => setType(value as LessonFields["type"])}
                className="flex min-h-24 items-start gap-3 rounded-xl border p-3 text-left transition hover:border-primary/50 hover:bg-primary/[0.03] aria-pressed:border-primary aria-pressed:bg-primary/[0.07]"
              >
                <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                <span>
                  <span className="block text-sm font-semibold">{label}</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">{lessonTypeDetails[value as keyof typeof lessonTypeDetails]}</span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>
      <label className="grid gap-2 text-sm font-medium">
        Tên bài
        <Input
          name="title"
          required
          maxLength={200}
          defaultValue={lesson?.title}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">
          Thời lượng (phút)
          <Input
            name="durationSec"
            type="number"
            required
            min={0}
            max={35791394}
            step={1}
            defaultValue={Math.ceil((lesson?.durationSec ?? 0) / 60)}
          />
        </label>
      </div>
      <div hidden={type !== "ARTICLE"} className="grid gap-2">
        <label
          htmlFor={`lesson-theory-${lesson?.id ?? "new"}`}
          className="text-sm font-medium"
        >
          Nội dung bài học
        </label>
        <textarea
          id={`lesson-theory-${lesson?.id ?? "new"}`}
          name="content"
          value={content}
          required={type === "ARTICLE"}
          maxLength={20000}
          className="min-h-36 rounded-lg border border-input bg-background p-3 text-sm leading-6"
          placeholder="Viết nội dung bài học. Có thể thêm khái niệm, ví dụ và ghi chú cho học viên."
          onChange={(event) => setContent(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          {content.length}/20000 ký tự
        </p>
      </div>
      {type === "VIDEO" && (
        <label className="grid gap-2 text-sm font-medium">
          Liên kết video
          <Input
            name="videoUrl"
            type="url"
            required
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
          />
          <span className="font-normal text-muted-foreground">Dùng liên kết YouTube hoặc URL video MP4 công khai.</span>
        </label>
      )}
      {type === "QUIZ" && (
        <div className="flex gap-3 rounded-xl border bg-muted/30 p-4 text-sm">
          <Sparkles className="size-5 shrink-0 text-primary" aria-hidden="true" />
          <p>Sau khi thêm bài, mở mục <strong>Soạn câu hỏi</strong> để viết câu hỏi và đánh dấu đáp án đúng.</p>
        </div>
      )}
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
        className="justify-self-start"
        disabled={busy}
      >
        {busy ? "Đang lưu…" : lesson ? "Lưu bài học" : <><Plus className="size-4" /> Thêm bài học</>}
      </Button>
    </form>
  );
}
