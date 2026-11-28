"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import type { CourseSummary } from "@/components/course-catalog";
import { CourseLogo } from "@/components/course-logo";
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
  thumbnailKey: string | null;
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
  const [title, setTitle] = useState(course?.title ?? "");
  const [description, setDescription] = useState(course?.description ?? "");
  const [thumbnailUrl, setThumbnailUrl] = useState(
    course?.thumbnailKey?.startsWith("http") ? course.thumbnailKey : "",
  );
  const [paid, setPaid] = useState((course?.priceCents ?? 0) > 0);
  const [priceInput, setPriceInput] = useState(
    course?.priceCents ? String(course.priceCents) : "",
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const fields = new FormData(event.currentTarget);
    const title = String(fields.get("title")).trim();
    const slug = course ? String(fields.get("slug")).trim() : undefined;
    const priceCents = paid ? Number(priceInput) : 0;
    if (!title) {
      setError("Nhập tên khóa học.");
      return;
    }
    if (course && !slug) {
      setError("Nhập slug cho khóa học.");
      return;
    }
    if (thumbnailUrl) {
      try {
        const imageUrl = new URL(thumbnailUrl);
        if (imageUrl.protocol !== "https:" && imageUrl.protocol !== "http:") throw new Error();
      } catch {
        setError("Nhập liên kết ảnh hợp lệ, bắt đầu bằng https:// hoặc http://.");
        return;
      }
    }
    if (
      paid &&
      (!Number.isSafeInteger(priceCents) || priceCents <= 0)
    ) {
      setError("Nhập mức học phí lớn hơn 0.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSave({
        title,
        description: String(fields.get("description")).trim(),
        priceCents,
        thumbnailKey: thumbnailUrl.trim() || null,
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
      <div className="flex items-center gap-4 rounded-lg border bg-muted/25 p-4">
        <CourseLogo
          title={title.trim() || "Khóa học mới"}
          imageUrl={thumbnailUrl}
          className="w-16 shrink-0"
        />
        <div>
          <p className="font-medium">Ảnh bìa khóa học</p>
          <p className="text-sm text-muted-foreground">
            Ảnh được tự chọn theo tên khóa học; bạn có thể thay bằng ảnh riêng.
          </p>
        </div>
      </div>
      <label className="grid gap-2 text-sm font-medium">
        Ảnh riêng (không bắt buộc)
        <Input
          name="thumbnailKey"
          type="url"
          value={thumbnailUrl}
          onChange={(event) => setThumbnailUrl(event.target.value)}
          placeholder="https://example.com/anh-khoa-hoc.jpg"
        />
        <span className="font-normal text-muted-foreground">Bỏ trống để dùng logo thương hiệu tự nhận diện hoặc ảnh chủ đề phù hợp.</span>
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Tên khóa học
        <Input
          name="title"
          required
          maxLength={200}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
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
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Mục tiêu, nội dung chính và đối tượng phù hợp với khóa học"
        />
        <span className="text-right text-xs font-normal text-muted-foreground">
          {description.length}/5000 ký tự
        </span>
      </label>
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">Học phí</legend>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={paid ? "outline" : "default"}
            aria-pressed={!paid}
            onClick={() => setPaid(false)}
          >
            Miễn phí
          </Button>
          <Button
            type="button"
            variant={paid ? "default" : "outline"}
            aria-pressed={paid}
            onClick={() => setPaid(true)}
          >
            Có học phí
          </Button>
        </div>
        {paid ? (
          <label className="grid max-w-64 gap-2 text-sm font-medium">
            Mức học phí (cent)
            <Input
              name="priceCents"
              type="number"
              required
              min={1}
              max={2147483647}
              step={1}
              value={priceInput}
              onChange={(event) => setPriceInput(event.target.value)}
            />
          </label>
        ) : (
          <p className="text-sm text-muted-foreground">
            Học viên có thể ghi danh khóa học miễn phí.
          </p>
        )}
      </fieldset>
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
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Bước 2 · Nội dung khóa học</p>
          <h2 className="mt-1 text-xl font-semibold">Chương và bài học</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Chia nội dung thành chương, sau đó thêm bài lý thuyết, video hoặc trắc nghiệm.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-muted px-3 py-1.5">{course.sections.length} chương</span>
          <span className="rounded-full bg-muted px-3 py-1.5">
          {course.sections.reduce(
            (total, section) => total + section.lessons.length,
            0,
          )} bài học
          </span>
        </div>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) =>
            submitTitle(event, addSection, "Đã thêm chương.")
          }
        >
          <label className="grid min-w-48 flex-1 gap-2 text-sm font-medium">
            Tên chương
            <Input name="title" required maxLength={200} disabled={busy} placeholder="Ví dụ: Bắt đầu với khóa học" />
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
