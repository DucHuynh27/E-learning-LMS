"use client";

import Link from "next/link";
import Form from "next/form";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/learning-api";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CourseLogo } from "@/components/course-logo";

export interface CourseSummary {
  id: string;
  title: string;
  description: string | null;
  priceCents: number;
  thumbnailKey?: string | null;
}

interface CatalogPage {
  items: CourseSummary[];
  meta: { page: number; limit: number; total: number };
}

type CatalogResult = { query: string; data?: CatalogPage; error?: string };
const topicKeywords = new Map([
  ["programming", "Lập trình"],
  ["design", "Thiết kế"],
]);

export function CourseCatalog() {
  const params = useSearchParams();
  const q =
    params.get("q")?.trim() ??
    topicKeywords.get(params.get("topic") ?? "") ??
    "";
  const candidate = Number(params.get("page") ?? 1);
  const page = Number.isSafeInteger(candidate) && candidate > 0 ? candidate : 1;
  const query = new URLSearchParams({ q, page: String(page) }).toString();
  const [result, setResult] = useState<CatalogResult>();
  const [retry, setRetry] = useState(0);
  const [sort, setSort] = useState("title-asc");

  useEffect(() => {
    let active = true;
    void api<CatalogPage>(`/courses?${query}`)
      .then((data) => {
        if (active) setResult({ query, data });
      })
      .catch((error: unknown) => {
        if (active)
          setResult({
            query,
            error:
              error instanceof Error
                ? error.message
                : "Không tải được danh mục.",
          });
      });
    return () => {
      active = false;
    };
  }, [query, retry]);

  const current = result?.query === query ? result : undefined;
  const data = current?.data;
  const totalPages = data ? Math.ceil(data.meta.total / data.meta.limit) : 0;
  const courses = [...(data?.items ?? [])].sort((first, second) => {
    if (sort === "title-desc")
      return second.title.localeCompare(first.title, "vi");
    if (sort === "price-asc")
      return first.priceCents - second.priceCents;
    return first.title.localeCompare(second.title, "vi");
  });

  function pageLink(number: number) {
    return `/courses?${new URLSearchParams({ q, page: String(number) })}`;
  }

  return (
    <div className="space-y-5">
      <div className="site-panel grid gap-4 p-4 sm:p-5">
        <Form action="/courses" className="flex flex-wrap gap-2">
          <Input
            key={q}
            name="q"
            defaultValue={q}
            aria-label="Tìm khóa học"
            placeholder="Tìm theo tên hoặc nội dung"
            className="min-w-48 flex-1"
          />
          <Button type="submit">Tìm khóa học</Button>
          {q && (
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/courses" />}
            >
              Xóa tìm kiếm
            </Button>
          )}
        </Form>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {data
              ? `${data.meta.total} khóa học${q ? ` phù hợp với “${q}”` : ""}`
              : "Đang cập nhật danh mục khóa học"}
          </p>
          <label className="flex items-center gap-2 text-sm font-medium">
            Sắp xếp trang này
            <select
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="title-asc">Tên: A – Z</option>
              <option value="title-desc">Tên: Z – A</option>
              <option value="price-asc">Giá: thấp đến cao</option>
            </select>
          </label>
        </div>
      </div>
      {!current && <p role="status">Đang tải danh mục…</p>}
      {current?.error && (
        <div className="space-y-3">
          <p role="alert" className="text-destructive">
            {current.error}
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setResult(undefined);
              setRetry(retry + 1);
            }}
          >
            Thử lại
          </Button>
        </div>
      )}
      {data && (
        <>
          {courses.length === 0 && (
            <p className="site-panel p-6 text-muted-foreground">
              {q
                ? "Không tìm thấy khóa học phù hợp."
                : "Chưa có khóa học nào được xuất bản."}
            </p>
          )}
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <li
                key={course.id}
                className="site-panel flex min-w-0 flex-col overflow-hidden transition-shadow hover:shadow-lg"
              >
                <div className="flex items-start justify-between gap-4 bg-muted/35 p-5">
                  <CourseLogo
                    title={course.title}
                    imageUrl={course.thumbnailKey}
                    className="w-24 shrink-0 sm:w-28"
                  />
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      course.priceCents === 0
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    {course.priceCents === 0 ? "Miễn phí" : "Có học phí"}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h2 className="mb-2 text-lg font-semibold leading-snug">
                    <Link
                      className="rounded-sm hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      href={`/courses/${course.id}`}
                    >
                      {course.title}
                    </Link>
                  </h2>
                  <p className="mb-5 line-clamp-3 flex-1 text-sm leading-6 text-muted-foreground">
                    {course.description || "Khám phá nội dung và lộ trình học của khóa học này."}
                  </p>
                  <Link
                    className={`${buttonVariants({ variant: "outline" })} w-full`}
                    href={`/courses/${course.id}`}
                  >
                    Xem chi tiết khóa học
                  </Link>
                </div>
              </li>
            ))}
          </ul>
          {(page > 1 || page < totalPages) && (
            <nav className="mt-6 flex gap-2" aria-label="Phân trang khóa học">
              {page > 1 && (
                <Link
                  className={buttonVariants({ variant: "outline" })}
                  href={pageLink(page - 1)}
                >
                  Trang trước
                </Link>
              )}
              {page < totalPages && (
                <Link
                  className={buttonVariants({ variant: "outline" })}
                  href={pageLink(page + 1)}
                >
                  Trang sau
                </Link>
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
