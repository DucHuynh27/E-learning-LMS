"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BookOpen, CheckCircle2, PlayCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useSession } from "@/components/session-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { api, type Session } from "@/lib/learning-api";

type EnrolledCourse = {
  courseId: string;
  status: "ACTIVE" | "COMPLETED" | "EXPIRED";
  progressPct: number;
  course?: { title: string; status: string };
};

type EnrolmentPage = {
  items: EnrolledCourse[];
  meta: { page: number; limit: number; total: number };
};

const statusLabels = {
  ACTIVE: "Đang học",
  COMPLETED: "Đã hoàn thành",
  EXPIRED: "Hết hạn ghi danh",
};

function available(course: EnrolledCourse) {
  return (
    course.status !== "EXPIRED" &&
    (!course.course || course.course.status === "PUBLISHED")
  );
}

export function MyLearning() {
  const { session } = useSession();
  if (!session) {
    return (
      <div className="site-panel space-y-4 p-6">
        <p>Đăng nhập để xem các khóa bạn đã ghi danh và tiếp tục học.</p>
        <div className="flex flex-wrap gap-2">
          <Link className={buttonVariants()} href="/login?next=/learning">
            Đăng nhập
          </Link>
          <Link
            className={buttonVariants({ variant: "outline" })}
            href="/learning/demo"
          >
            Thử lớp học mẫu
          </Link>
        </div>
      </div>
    );
  }
  if (session.user.role !== "STUDENT") {
    return (
      <div className="site-panel space-y-4 p-6">
        <p>Danh sách ghi danh thuộc về tài khoản học viên.</p>
        <Link className={buttonVariants()} href="/admin/courses">
          Quản lý khóa học
        </Link>
      </div>
    );
  }
  return <LearningWorkspace key={session.user.id} session={session} />;
}

function LearningWorkspace({ session }: { session: Session }) {
  const params = useSearchParams();
  const pageNumber = Number(params.get("page") ?? 1);
  const page =
    Number.isSafeInteger(pageNumber) && pageNumber > 0 ? pageNumber : 1;
  const token = session.accessToken;
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{
    page: number;
    revision: number;
    data?: EnrolmentPage;
    error?: string;
  }>();
  useEffect(() => {
    let active = true;
    void api<EnrolmentPage>(`/enrolments/me?page=${page}`, token)
      .then((data) => {
        if (active) setResult({ page, revision, data });
      })
      .catch((error: unknown) => {
        if (active)
          setResult({
            page,
            revision,
            error:
              error instanceof Error
                ? error.message
                : "Không tải được danh sách khóa học.",
          });
      });
    return () => {
      active = false;
    };
  }, [page, revision, token]);

  const current =
    result?.page === page && result.revision === revision ? result : undefined;
  if (!current) return <p role="status">Đang tải khóa học đã ghi danh…</p>;
  if (!current.data) {
    return (
      <div className="site-panel space-y-3 p-6">
        <p className="text-destructive" role="alert">
          {current.error}
        </p>
        <Button
          variant="outline"
          onClick={() => setRevision((previous) => previous + 1)}
        >
          Tải lại
        </Button>
      </div>
    );
  }
  const { items, meta } = current.data;
  if (meta.total === 0) {
    return (
      <div className="site-panel space-y-4 p-6">
        <BookOpen className="size-8 text-primary" aria-hidden="true" />
        <p>Bạn chưa ghi danh khóa học nào.</p>
        <Link className={buttonVariants()} href="/courses">
          Khám phá khóa học
        </Link>
      </div>
    );
  }
  const totalPages = Math.ceil(meta.total / meta.limit);
  const pageHref = (nextPage: number) => `/learning?page=${nextPage}`;

  return (
    <div className="space-y-5">
      <section className="min-w-0">
        <div className="mb-4 flex items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold">Khóa học đã ghi danh</h2>
          <span className="text-sm tabular-nums text-muted-foreground">
            {meta.total} khóa
          </span>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Khóa học đã ghi danh">
          {items.map((item) => {
            const percentage = item.progressPct;
            const status =
              item.status === "EXPIRED"
                ? statusLabels.EXPIRED
                : !available(item)
                  ? "Khóa học đang ẩn"
                : statusLabels[item.status];
            const content = (
              <>
                <div className="flex items-start justify-between gap-2">
                  <span className="break-words font-medium">
                    {item.course?.title ??
                      `Khóa học ${item.courseId.slice(0, 8)}`}
                  </span>
                  {status === statusLabels.COMPLETED && (
                    <CheckCircle2
                      className="mt-0.5 size-4 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                  )}
                </div>
                <div className="mt-1 flex justify-between gap-2 text-xs text-muted-foreground">
                  <span>{status}</span>
                  <span className="tabular-nums">{percentage}%</span>
                </div>
                <progress
                  value={percentage}
                  max={100}
                  aria-label="Tiến độ"
                  className="mt-2 block h-1.5 w-full accent-primary"
                />
              </>
            );
            return (
              <li key={item.courseId} className="text-sm">
                {available(item) ? (
                  <Link
                    href={`/learning/${item.courseId}`}
                    className="site-panel block h-full p-5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                  >
                    {content}
                    <span className="mt-4 inline-flex items-center gap-2 font-medium text-primary">
                      <PlayCircle className="size-4" aria-hidden="true" />
                      {percentage > 0 ? "Tiếp tục học" : "Bắt đầu học"}
                    </span>
                  </Link>
                ) : (
                  <div className="site-panel h-full px-5 py-4 text-muted-foreground">
                    {content}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {page > 1 || page < totalPages ? (
          <nav
            className="mt-4 flex flex-wrap gap-2"
            aria-label="Phân trang khóa đã ghi danh"
          >
            {page > 1 && (
              <Link
                className={buttonVariants({ variant: "outline", size: "sm" })}
                href={pageHref(page - 1)}
              >
                Trang trước
              </Link>
            )}
            {page < totalPages && (
              <Link
                className={buttonVariants({ variant: "outline", size: "sm" })}
                href={pageHref(page + 1)}
              >
                Trang sau
              </Link>
            )}
          </nav>
        ) : null}
        <Link
          className="mt-4 inline-block text-sm text-primary underline-offset-4 hover:underline"
          href="/courses"
        >
          Xem thêm khóa học
        </Link>
      </section>
    </div>
  );
}
