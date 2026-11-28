import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CourseDetails } from "@/components/course-details";
import { Heading } from "@/components/heading";

export const metadata: Metadata = {
  title: "Phòng học · E-Learning LMS",
  description: "Học bài, làm trắc nghiệm và theo dõi tiến độ khóa học.",
};

async function LearningCourse({
  params,
}: Pick<PageProps<"/learning/[courseId]">, "params">) {
  const { courseId } = await params;
  return <CourseDetails courseId={courseId} />;
}

export default function LearningCoursePage({
  params,
}: PageProps<"/learning/[courseId]">) {
  return (
    <section className="site-container site-content">
      <Link className="mb-5 inline-block text-primary underline" href="/learning">
        ← Các khóa học của tôi
      </Link>
      <Heading className="sr-only">Phòng học</Heading>
      <Suspense fallback={<p role="status">Đang tải khóa học…</p>}>
        <LearningCourse params={params} />
      </Suspense>
    </section>
  );
}
