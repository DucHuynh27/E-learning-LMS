"use client";

import Link from "next/link";
import Form from "next/form";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/learning-api";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface CourseSummary {
  id: string;
  title: string;
  description: string | null;
  priceCents: number;
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

  function pageLink(number: number) {
    return `/courses?${new URLSearchParams({ q, page: String(number) })}`;
  }

  return (
    <>
      <Form action="/courses" className="mb-6 flex max-w-lg gap-2">
        <Input
          key={q}
          name="q"
          defaultValue={q}
          aria-label="Tìm khóa học"
          placeholder="Tìm theo tên hoặc nội dung"
        />
        <Button type="submit">Tìm kiếm</Button>
      </Form>
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
          {data.items.length === 0 && (
            <p className="site-panel p-6 text-muted-foreground">
              {q
                ? "Không tìm thấy khóa học phù hợp."
                : "Chưa có khóa học nào được xuất bản."}
            </p>
          )}
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((course) => (
              <li key={course.id} className="site-panel p-5">
                <h2 className="mb-2 text-lg font-semibold">
                  <Link
                    className="hover:underline"
                    href={`/courses/${course.id}`}
                  >
                    {course.title}
                  </Link>
                </h2>
                {course.description && (
                  <p className="text-muted-foreground">{course.description}</p>
                )}
                {course.priceCents === 0 && (
                  <p className="mt-3 text-sm text-primary">Miễn phí</p>
                )}
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
    </>
  );
}
