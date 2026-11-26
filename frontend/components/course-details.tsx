"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CourseSummary } from "@/components/course-catalog";
import { Heading } from "@/components/heading";
import { CourseQuiz } from "@/components/course-quiz";
import { useSession } from "@/components/session-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { api, ApiError, type Session } from "@/lib/learning-api";
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
  const [enrolled, setEnrolled] = useState(false);
  const isDemo = courseId === demoCourse.id;

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

  async function enrol() {
    if (!token || busy) return;
    setBusy(true);
    setEnrolmentMessage("");
    try {
      await api(`/courses/${encodeURIComponent(courseId)}/enroll`, token, {
        method: "POST",
      });
      setEnrolled(true);
      setEnrolmentMessage("Đã ghi danh vào khóa học.");
    } catch (caught) {
      if (
        caught instanceof ApiError &&
        caught.status === 409 &&
        caught.message === "Already enrolled in this course"
      ) {
        setEnrolled(true);
        setEnrolmentMessage("Bạn đã ghi danh vào khóa học này.");
      } else {
        setEnrolmentMessage(
          caught instanceof Error ? caught.message : "Không thể ghi danh.",
        );
      }
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
            {session.user.role === "STUDENT" &&
              course.status === "PUBLISHED" && (
                <Button disabled={busy || enrolled} onClick={enrol}>
                  {busy
                    ? "Đang ghi danh…"
                    : enrolled
                      ? "Đã ghi danh"
                      : "Ghi danh"}
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
                        {!isDemo &&
                          lesson.type === "QUIZ" &&
                          session.user.role === "STUDENT" && (
                            <CourseQuiz
                              lessonId={lesson.id}
                              session={session}
                            />
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
