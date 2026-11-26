"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CourseSummary } from "@/components/course-catalog";
import { Heading } from "@/components/heading";
import { CourseQuiz } from "@/components/course-quiz";
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

export function CourseDetails({ courseId }: { courseId: string }) {
  const { session } = useSession();
  return (
    <CourseDetailContent
      key={`${courseId}:${session?.user.id ?? "guest"}`}
      courseId={courseId}
      session={session}
    />
  );
}

function CourseDetailContent({
  courseId,
  session,
}: {
  courseId: string;
  session: Session | null;
}) {
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
        if (active) setTracking(data);
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
  }, [canLearn, courseId, revision, token]);

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
      setEnrolmentMessage("Đã ghi danh vào khóa học.");
      refreshTracking();
    } catch (caught) {
      if (
        caught instanceof ApiError &&
        caught.status === 409 &&
        caught.message === "Already enrolled in this course"
      ) {
        setEnrolmentMessage("Bạn đã ghi danh vào khóa học này.");
        refreshTracking();
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
      <Link
        className="mb-5 inline-block text-primary underline"
        href="/courses"
      >
        Tất cả khóa học
      </Link>
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
              href="/learning"
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
      ) : (
        <>
          <Heading className="mb-3">{course.title}</Heading>
          {course.description && (
            <p className="mb-5 whitespace-pre-wrap text-muted-foreground">
              {course.description}
            </p>
          )}
          <div className="mb-6 flex flex-wrap gap-2">
            {canLearn && tracking === null && (
              <Button disabled={busy} onClick={enrol}>
                {busy ? "Đang ghi danh…" : "Ghi danh"}
              </Button>
            )}
            {isDemo && (
              <Link
                className={buttonVariants({ variant: "outline" })}
                href="/learning"
              >
                Vào lớp học mẫu
              </Link>
            )}
          </div>
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
              {tracking.certificate && (
                <Link
                  className="inline-block text-sm font-medium text-primary underline"
                  href={`/api/certificates/${encodeURIComponent(tracking.certificate.serialNo)}/verify`}
                >
                  Xác thực chứng chỉ {tracking.certificate.serialNo}
                </Link>
              )}
            </section>
          )}
          <h2 className="mb-4 text-xl font-semibold">Nội dung khóa học</h2>
          {course.sections.length === 0 && <p>Khóa học chưa có bài học.</p>}
          <ul className="space-y-3">
            {course.sections.map((section) => (
              <li key={section.id} className="site-panel p-4">
                <h3 className="font-semibold">{section.title}</h3>
                <ul className="mt-2 divide-y">
                  {section.lessons
                    .filter((lesson) => lesson.isPublished)
                    .map((lesson) => (
                      <li className="py-2" key={lesson.id}>
                        <div className="flex flex-wrap items-baseline gap-x-3">
                          <span>{lesson.title}</span>
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
                        {!isDemo && lesson.type === "QUIZ" && tracking && (
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
