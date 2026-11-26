"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import type { CourseSummary } from "@/components/course-catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/learning-api";
import { managementError } from "@/lib/course-authoring";
import { SectionEditor, type CourseSection } from "@/components/section-editor";

export const courseStatuses = {
  DRAFT: "Bản nháp",
  PUBLISHED: "Đã xuất bản",
  ARCHIVED: "Đã lưu trữ",
};

export interface ManagedCourse extends CourseSummary {
  status: keyof typeof courseStatuses;
  slug: string;
}

interface CourseDetails extends ManagedCourse {
  sections: CourseSection[];
}

export interface CourseFields {
  title: string;
  description: string;
  priceCents: number;
  slug?: string;
}

export function CourseForm({
  course,
  onSave,
}: {
  course?: ManagedCourse;
  onSave: (values: CourseFields) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const fields = new FormData(event.currentTarget);
    const title = String(fields.get("title")).trim();
    const slug = course ? String(fields.get("slug")).trim() : undefined;
    const priceCents = Number(fields.get("priceCents"));
    if (!title) {
      setError("Nhập tên khóa học.");
      return;
    }
    if (course && !slug) {
      setError("Nhập slug cho khóa học.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSave({
        title,
        description: String(fields.get("description")).trim(),
        priceCents,
        slug,
      });
    } catch (error) {
      setError(managementError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <label className="grid gap-2 text-sm font-medium">
        Tên khóa học
        <Input
          name="title"
          required
          maxLength={200}
          defaultValue={course?.title}
          placeholder="Ví dụ: Nhập môn TypeScript"
        />
      </label>
      {course && (
        <label className="grid gap-2 text-sm font-medium">
          Slug
          <Input
            name="slug"
            required
            maxLength={255}
            defaultValue={course.slug}
          />
        </label>
      )}
      <label className="grid gap-2 text-sm font-medium">
        Mô tả
        <textarea
          className="min-h-24 rounded-lg border border-input bg-background p-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          name="description"
          maxLength={5000}
          defaultValue={course?.description ?? ""}
          placeholder="Mục tiêu, nội dung chính và đối tượng phù hợp với khóa học"
        />
      </label>
      <label className="grid max-w-52 gap-2 text-sm font-medium">
        Giá (cent, 0 là miễn phí)
        <Input
          name="priceCents"
          type="number"
          required
          min={0}
          max={2147483647}
          step={1}
          defaultValue={course?.priceCents ?? 0}
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button
        type="submit"
        size="lg"
        className="justify-self-start"
        disabled={busy}
      >
        {busy ? "Đang lưu…" : course ? "Lưu thay đổi" : "Tạo bản nháp"}
      </Button>
    </form>
  );
}

export function CourseEditor({
  id,
  token,
  onCourseChanged,
}: {
  id: string;
  token: string;
  onCourseChanged: () => void;
}) {
  const [course, setCourse] = useState<CourseDetails>();
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void api<CourseDetails>(`/courses/${id}`, token)
      .then((data) => {
        if (active) setCourse(data);
      })
      .catch((error: unknown) => {
        if (active) setLoadError(managementError(error));
      });
    return () => {
      active = false;
    };
  }, [id, token]);

  async function update(work: () => Promise<void>, success: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
      setNotice(success);
    } finally {
      setBusy(false);
    }
  }

  function run(work: () => Promise<void>, success: string) {
    if (busy) return;
    void update(work, success).catch((error: unknown) =>
      setError(managementError(error)),
    );
  }

  function submitTitle(
    event: FormEvent<HTMLFormElement>,
    save: (title: string) => Promise<void>,
    success: string,
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const title = String(new FormData(form).get("title")).trim();
    if (!title) {
      setError("Nhập tên chương hoặc bài học.");
      return;
    }
    run(async () => {
      await save(title);
      form.reset();
    }, success);
  }

  if (loadError)
    return (
      <p className="site-panel p-5 text-destructive" role="alert">
        {loadError}
      </p>
    );
  if (!course)
    return (
      <p className="site-panel p-5" role="status">
        Đang tải khóa học…
      </p>
    );

  async function edit(values: CourseFields) {
    await update(async () => {
      const saved = await api<ManagedCourse>(`/courses/${id}`, token, {
        method: "PATCH",
        body: JSON.stringify(values),
      });
      setCourse((current) => current && { ...current, ...saved });
      onCourseChanged();
    }, "Đã lưu thông tin khóa học.");
  }

  async function addSection(title: string) {
    const section = await api<Omit<CourseSection, "lessons">>(
      `/courses/${id}/sections`,
      token,
      {
        method: "POST",
        body: JSON.stringify({ title }),
      },
    );
    setCourse(
      (current) =>
        current && {
          ...current,
          sections: [...current.sections, { ...section, lessons: [] }],
        },
    );
  }

  function replaceSection(
    sectionId: string,
    change: (section: CourseSection) => CourseSection,
  ) {
    setCourse(
      (current) =>
        current && {
          ...current,
          sections: current.sections.map((section) =>
            section.id === sectionId ? change(section) : section,
          ),
        },
    );
  }

  const published = course.status === "PUBLISHED";
  const hasLessons = course.sections.some(
    (section) => section.lessons.length > 0,
  );

  function togglePublication() {
    run(
      async () => {
        const saved = await api<ManagedCourse>(
          `/courses/${id}/${published ? "unpublish" : "publish"}`,
          token,
          { method: "POST" },
        );
        setCourse((current) => current && { ...current, ...saved });
        onCourseChanged();
      },
      published ? "Đã chuyển khóa học về bản nháp." : "Đã xuất bản khóa học.",
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      <section className="site-panel space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Thông tin khóa học</h2>
            <p className="text-sm text-muted-foreground">
              {courseStatuses[course.status]}
            </p>
          </div>
          <Button
            variant={published ? "outline" : "default"}
            disabled={busy || (!published && !hasLessons)}
            onClick={togglePublication}
          >
            {published ? "Đưa về bản nháp" : "Xuất bản"}
          </Button>
        </div>
        {published ? (
          <Link
            className="inline-block text-sm text-primary underline"
            href={`/courses/${id}`}
          >
            Xem trang khóa học
          </Link>
        ) : (
          !hasLessons && (
            <p className="text-sm text-muted-foreground">
              Thêm một chương và một bài học để xuất bản.
            </p>
          )
        )}
        {notice && (
          <p role="status" className="text-sm text-primary">
            {notice}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <fieldset disabled={busy}>
          <CourseForm course={course} onSave={edit} />
        </fieldset>
      </section>

      <section className="site-panel space-y-4 p-5 sm:p-6">
        <h2 className="text-xl font-semibold">Chương và bài học</h2>
        <p className="text-sm text-muted-foreground">
          {course.sections.length} chương ·{" "}
          {course.sections.reduce(
            (total, section) => total + section.lessons.length,
            0,
          )}{" "}
          bài học
        </p>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) =>
            submitTitle(event, addSection, "Đã thêm chương.")
          }
        >
          <label className="grid min-w-48 flex-1 gap-2 text-sm font-medium">
            Tên chương
            <Input name="title" required maxLength={200} disabled={busy} />
          </label>
          <Button type="submit" variant="outline" disabled={busy}>
            Thêm chương
          </Button>
        </form>
        {course.sections.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Khóa học chưa có chương.
          </p>
        )}
        {course.sections.map((section) => (
          <SectionEditor
            key={section.id}
            token={token}
            section={section}
            onChange={(change) => replaceSection(section.id, change)}
          />
        ))}
      </section>
    </div>
  );
}
