"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { CourseSummary } from "@/components/course-catalog";
import { CourseLogo } from "@/components/course-logo";
import { Heading } from "@/components/heading";
import { CourseQuiz } from "@/components/course-quiz";
import { CertificateCard } from "@/components/certificate-card";
import { useSession } from "@/components/session-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  api,
  ApiError,
  type Certificate,
  type CourseProgress,
  type Session,
} from "@/lib/learning-api";
import { demoCourse } from "@/lib/learning-demo";

interface Detail extends CourseSummary {
  status: string;
  sections: {
    id: string;
    title: string;
    lessons: {
      id: string;
      title: string;
      content: string | null;
      type: string;
      durationSec: number;
      isPublished: boolean;
    }[];
  }[];
}

interface CourseTracking {
  progress: CourseProgress;
  certificate?: Certificate;
}

async function readTracking(
  courseId: string,
  token: string,
): Promise<CourseTracking | null> {
  const progress = await api<CourseProgress>(
    `/enrolments/${courseId}/progress`,
    token,
  ).catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 403) return null;
    throw error;
  });
  if (!progress) return null;
  const certificates = await api<Certificate[]>("/certificates/me", token);
  return {
    progress,
    certificate: certificates.find((item) => item.courseId === courseId),
  };
}

export function CourseDetails({
  courseId,
  embedded = false,
  onProgress,
}: {
  courseId: string;
  embedded?: boolean;
  onProgress?: (
    courseId: string,
    percentage: number,
    completed: boolean,
  ) => void;
}) {
  const { session } = useSession();
  return (
    <CourseDetailContent
      key={`${courseId}:${session?.user.id ?? "guest"}`}
      courseId={courseId}
      session={session}
      embedded={embedded}
      onProgress={onProgress}
    />
  );
}

function CourseDetailContent({
  courseId,
  session,
  embedded,
  onProgress,
}: {
  courseId: string;
  session: Session | null;
  embedded: boolean;
  onProgress?: (
    courseId: string,
    percentage: number,
    completed: boolean,
  ) => void;
}) {
  const router = useRouter();
  const token = session?.accessToken;
  const [course, setCourse] = useState<Detail>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [enrolmentMessage, setEnrolmentMessage] = useState("");
  const [tracking, setTracking] = useState<CourseTracking | null>();
  const [trackingError, setTrackingError] = useState("");
  const [revision, setRevision] = useState(0);
  const isDemo = courseId === demoCourse.id;
  const canLearn =
    session?.user.role === "STUDENT" && course?.status === "PUBLISHED";
  const publishedLessons =
    course?.sections.flatMap((section) =>
      section.lessons.filter((lesson) => lesson.isPublished),
    ) ?? [];
  const totalDurationSec = publishedLessons.reduce(
    (total, lesson) => total + lesson.durationSec,
    0,
  );

  useEffect(() => {
    if (!token) return;
    let active = true;
    void api<Detail>(`/courses/${encodeURIComponent(courseId)}`, token)
      .then((data) => {
        if (active) setCourse(data);
      })
      .catch((caught: unknown) => {
        if (active)
          setError(
            caught instanceof Error
              ? caught.message
              : "Không tải được khóa học.",
          );
      });
    return () => {
      active = false;
    };
  }, [courseId, token]);

  useEffect(() => {
    if (!token || !canLearn) return;
    let active = true;
    void readTracking(courseId, token)
      .then((data) => {
        if (!active) return;
        setTracking(data);
        if (data) {
          const { progress } = data;
          onProgress?.(
            courseId,
            progress.progressPct,
            progress.lessons.length > 0 &&
              progress.lessons.every((lesson) => lesson.completed),
          );
        }
      })
      .catch((error: unknown) => {
        if (active)
          setTrackingError(
            error instanceof Error ? error.message : "Không tải được tiến độ.",
          );
      });
    return () => {
      active = false;
    };
  }, [canLearn, courseId, onProgress, revision, token]);

  function refreshTracking() {
    setTrackingError("");
    setRevision((current) => current + 1);
  }

  async function enrol() {
    if (!token || busy) return;
    setBusy(true);
    setEnrolmentMessage("");
    try {
      await api(`/courses/${encodeURIComponent(courseId)}/enroll`, token, {
        method: "POST",
      });
      router.push(`/learning/${encodeURIComponent(courseId)}`);
    } catch (caught) {
      if (
        caught instanceof ApiError &&
        caught.status === 409 &&
        caught.message === "Already enrolled in this course"
      ) {
        router.push(`/learning/${encodeURIComponent(courseId)}`);
      } else {
        setEnrolmentMessage(
          caught instanceof Error ? caught.message : "Không thể ghi danh.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function completeLesson(lessonId: string, durationSec: number) {
    if (!token || busy) return;
    setBusy(true);
    setTrackingError("");
    setEnrolmentMessage("");
    try {
      await api(`/lessons/${lessonId}/progress`, token, {
        method: "PATCH",
        body: JSON.stringify({ watchedSec: durationSec }),
      });
      setEnrolmentMessage("Đã lưu tiến độ.");
      refreshTracking();
    } catch (error) {
      setTrackingError(
        error instanceof Error ? error.message : "Không lưu được tiến độ.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {!embedded && (
        <Link
          className="mb-5 inline-block text-primary underline"
          href="/courses"
        >
          Tất cả khóa học
        </Link>
      )}
      {!session ? (
        <>
          <Heading className="mb-4">
            {isDemo ? demoCourse.title : "Chi tiết khóa học"}
          </Heading>
          <p className="mb-4">Đăng nhập để xem đề cương và ghi danh.</p>
          <Link
            className={buttonVariants()}
            href={{
              pathname: "/login",
              query: { next: `/courses/${courseId}` },
            }}
          >
            Đăng nhập
          </Link>
          {isDemo && (
            <Link
              className={buttonVariants({ variant: "ghost" })}
              href="/learning/demo"
            >
              Thử lớp học mẫu
            </Link>
          )}
        </>
      ) : error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : !course ? (
        <p role="status">Đang tải khóa học…</p>
      ) : embedded && (!canLearn || tracking === null) ? (
        <div className="site-panel p-6">
          <p>Khóa này chưa có ghi danh còn hiệu lực.</p>
          <Link
            className="mt-3 inline-block text-primary underline"
            href={`/courses/${course.id}`}
          >
            Xem chi tiết và ghi danh
          </Link>
        </div>
      ) : (
        <>
          <section className="site-panel mb-7 overflow-hidden">
            <div className="flex flex-col gap-5 bg-linear-to-br from-primary/10 via-card to-card p-5 sm:flex-row sm:items-center sm:p-7">
              <CourseLogo
                title={course.title}
                className="w-28 shrink-0 sm:w-36"
              />
              <div className="min-w-0">
                <p className="mb-2 text-sm font-semibold uppercase tracking-[0.14em] text-primary">
                  Lộ trình học tập
                </p>
                <Heading
                  level={embedded ? "h2" : "h1"}
                  className="mb-3 break-words"
                >
                  {course.title}
                </Heading>
                <p className="whitespace-pre-wrap leading-7 text-muted-foreground">
                  {course.description ||
                    "Xem đề cương chi tiết và bắt đầu lộ trình học của bạn."}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {!embedded && canLearn && tracking === null && (
                    <Button disabled={busy} onClick={enrol}>
                      {busy ? "Đang ghi danh…" : "Ghi danh khóa học"}
                    </Button>
                  )}
                  {!embedded && tracking && (
                    <Link
                      className={buttonVariants()}
                      href={`/learning/${course.id}`}
                    >
                      Tiếp tục học
                    </Link>
                  )}
                  {isDemo && (
                    <Link
                      className={buttonVariants({ variant: "outline" })}
                      href="/learning/demo"
                    >
                      Vào lớp học mẫu
                    </Link>
                  )}
                </div>
              </div>
            </div>
            <dl className="grid gap-px border-t bg-border sm:grid-cols-3">
              <div className="bg-card px-5 py-4">
                <dt className="text-sm text-muted-foreground">
                  Chương học
                </dt>
                <dd className="mt-1 font-semibold">
                  {course.sections.length} chương
                </dd>
              </div>
              <div className="bg-card px-5 py-4">
                <dt className="text-sm text-muted-foreground">
                  Bài học đã xuất bản
                </dt>
                <dd className="mt-1 font-semibold">
                  {publishedLessons.length} bài
                </dd>
              </div>
              <div className="bg-card px-5 py-4">
                <dt className="text-sm text-muted-foreground">
                  Thời lượng nội dung
                </dt>
                <dd className="mt-1 font-semibold">
                  {totalDurationSec > 0
                    ? `${Math.ceil(totalDurationSec / 60)} phút`
                    : "Theo tiến độ của bạn"}
                </dd>
              </div>
            </dl>
          </section>
          {enrolmentMessage && (
            <p className="mb-6" role="status">
              {enrolmentMessage}
            </p>
          )}
          {canLearn && tracking === undefined && !trackingError && (
            <p role="status" className="mb-4 text-sm text-muted-foreground">
              Đang tải tiến độ…
            </p>
          )}
          {trackingError && (
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <p role="alert" className="text-sm text-destructive">
                {trackingError}
              </p>
              <Button variant="outline" onClick={refreshTracking}>
                Tải lại tiến độ
              </Button>
            </div>
          )}
          {tracking && (
            <section className="site-panel mb-6 space-y-2 p-4">
              <h2 className="font-semibold">Tiến độ khóa học</h2>
              <p className="text-sm text-muted-foreground">
                {
                  tracking.progress.lessons.filter((lesson) => lesson.completed)
                    .length
                }
                /{tracking.progress.lessons.length} bài đã hoàn thành ·{" "}
                {tracking.progress.progressPct}%
              </p>
              <progress
                aria-label="Phần trăm hoàn thành khóa học"
                className="block h-2 w-full max-w-sm accent-primary"
                max={100}
                value={tracking.progress.progressPct}
              />
            </section>
          )}
          {tracking?.certificate && (
            <CertificateCard
              courseTitle={course.title}
              studentName={session.user.fullName}
              serialNo={tracking.certificate.serialNo}
              issuedAt={tracking.certificate.issuedAt}
            />
          )}
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-xl font-semibold">Đề cương khóa học</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {course.sections.length} chương · {publishedLessons.length} bài
                học
              </p>
            </div>
          </div>
          {course.sections.length === 0 && (
            <p className="site-panel p-5 text-muted-foreground">
              Khóa học chưa có bài học.
            </p>
          )}
          <ul className="space-y-4">
            {course.sections.map((section) => (
              <li key={section.id} className="site-panel overflow-hidden">
                <h3 className="border-b bg-muted/35 px-5 py-4 font-semibold">
                  {section.title}
                </h3>
                <ul className="divide-y px-5">
                  {section.lessons
                    .filter((lesson) => lesson.isPublished)
                    .map((lesson) => (
                      <li className="py-4" key={lesson.id}>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="break-words">{lesson.title}</span>
                          {lesson.type === "QUIZ" && (
                            <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                              Trắc nghiệm
                            </span>
                          )}
                          {lesson.durationSec > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {Math.ceil(lesson.durationSec / 60)} phút
                            </span>
                          )}
                        </div>
                        {tracking &&
                          (tracking.progress.lessons.find(
                            ({ lessonId }) => lessonId === lesson.id,
                          )?.completed ? (
                            <p className="mt-2 text-sm font-medium text-primary">
                              Đã hoàn thành
                            </p>
                          ) : (
                            <Button
                              className="mt-2 mr-2"
                              variant="outline"
                              disabled={busy}
                              onClick={() =>
                                void completeLesson(
                                  lesson.id,
                                  lesson.durationSec,
                                )
                              }
                            >
                              Đánh dấu đã học
                            </Button>
                          ))}
                        {lesson.type === "ARTICLE" && (
                          <section className="mt-4 rounded-lg border bg-muted/30 p-4">
                            <h4 className="font-semibold">Lý thuyết</h4>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                              {lesson.content?.trim() ||
                                "Giảng viên chưa cập nhật nội dung lý thuyết cho bài học này."}
                            </p>
                          </section>
                        )}
                        {lesson.type === "QUIZ" && tracking && (
                          <CourseQuiz lessonId={lesson.id} session={session} />
                        )}
                      </li>
                    ))}
                </ul>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
