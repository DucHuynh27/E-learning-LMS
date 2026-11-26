"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "@/components/session-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { api, canManageCourses } from "@/lib/learning-api";
import { managementError } from "@/lib/course-authoring";
import {
  CourseEditor,
  CourseForm,
  courseStatuses,
  type CourseFields,
  type ManagedCourse,
} from "@/components/course-editor";

interface ManagementPage {
  items: ManagedCourse[];
  meta: { page: number; limit: number; total: number };
}

export function CourseManagement() {
  const { session } = useSession();
  if (!session) {
    return (
      <div className="site-panel space-y-4 p-6">
        <p>
          Đăng nhập bằng tài khoản giảng viên hoặc quản trị viên để quản lý khóa
          học.
        </p>
        <Link className={buttonVariants()} href="/login?next=/admin/courses">
          Đăng nhập
        </Link>
      </div>
    );
  }

  if (!canManageCourses(session)) {
    return (
      <div className="site-panel space-y-4 p-6">
        <p>
          Bạn cần quyền giảng viên hoặc quản trị viên để truy cập trang này.
        </p>
        <Link
          className={buttonVariants({ variant: "outline" })}
          href="/courses"
        >
          Về danh mục khóa học
        </Link>
      </div>
    );
  }

  return (
    <ManagementWorkspace
      key={session.user.id}
      token={session.accessToken}
      admin={session.user.role === "ADMIN"}
    />
  );
}

function ManagementWorkspace({
  token,
  admin,
}: {
  token: string;
  admin: boolean;
}) {
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [selectedId, setSelectedId] = useState<string>();
  const [result, setResult] = useState<{
    page: number;
    revision: number;
    data?: ManagementPage;
    error?: string;
  }>();

  useEffect(() => {
    let active = true;
    void api<ManagementPage>(`/courses/manage?page=${page}`, token)
      .then((data) => {
        if (active) setResult({ page, revision, data });
      })
      .catch((error: unknown) => {
        if (active)
          setResult({ page, revision, error: managementError(error) });
      });
    return () => {
      active = false;
    };
  }, [page, revision, token]);

  function reload() {
    setRevision((previous) => previous + 1);
  }

  async function create(values: CourseFields) {
    const course = await api<ManagedCourse>("/courses", token, {
      method: "POST",
      body: JSON.stringify(values),
    });
    setPage(1);
    setSelectedId(course.id);
    reload();
  }

  const list =
    result?.page === page && result.revision === revision ? result : undefined;
  const data = list?.data;
  const pages = data ? Math.ceil(data.meta.total / data.meta.limit) : 0;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(16rem,1fr)_minmax(0,2fr)]">
      <aside className="site-panel min-w-0 space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">
            {admin ? "Tất cả khóa học" : "Khóa học của bạn"}
          </h2>
          <Button variant="outline" onClick={() => setSelectedId(undefined)}>
            Thêm khóa học
          </Button>
        </div>
        {!list && (
          <p role="status" className="text-sm text-muted-foreground">
            Đang tải danh sách…
          </p>
        )}
        {list?.error && (
          <div className="space-y-2">
            <p role="alert" className="text-sm text-destructive">
              {list.error}
            </p>
            <Button variant="outline" onClick={reload}>
              Tải lại
            </Button>
          </div>
        )}
        {data?.items.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Chưa có khóa học để quản lý.
          </p>
        )}
        {data && (
          <ul className="space-y-1">
            {data.items.map((course) => (
              <li key={course.id}>
                <button
                  type="button"
                  aria-pressed={selectedId === course.id}
                  className="w-full rounded-lg px-3 py-2 text-left hover:bg-muted aria-pressed:bg-primary/10"
                  onClick={() => setSelectedId(course.id)}
                >
                  <span className="block break-words text-sm font-medium">
                    {course.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {courseStatuses[course.status]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {(page > 1 || pages > 1) && (
          <nav
            aria-label="Phân trang quản lý khóa học"
            className="flex flex-wrap items-center gap-2"
          >
            <Button
              variant="outline"
              disabled={page === 1 || !data}
              onClick={() => setPage(page - 1)}
            >
              Trang trước
            </Button>
            <span className="text-xs text-muted-foreground">
              {page}
              {pages > 0 && ` / ${pages}`}
            </span>
            <Button
              variant="outline"
              disabled={!data || page >= pages}
              onClick={() => setPage(page + 1)}
            >
              Trang sau
            </Button>
          </nav>
        )}
      </aside>
      {selectedId ? (
        <CourseEditor
          key={selectedId}
          id={selectedId}
          token={token}
          onCourseChanged={reload}
        />
      ) : (
        <div className="site-panel space-y-4 p-5 sm:p-6">
          <h2 className="text-xl font-semibold">Thêm khóa học</h2>
          <CourseForm onSave={create} />
        </div>
      )}
    </div>
  );
}
