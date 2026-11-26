import { Suspense } from "react";
import { CourseDetails } from "@/components/course-details";

async function Course({
  params,
}: Pick<PageProps<"/courses/[courseId]">, "params">) {
  const { courseId } = await params;
  return <CourseDetails courseId={courseId} />;
}

export default function CoursePage({
  params,
}: PageProps<"/courses/[courseId]">) {
  return (
    <section className="site-container site-content">
      <Suspense fallback={<p>Đang tải khóa học…</p>}>
        <Course params={params} />
      </Suspense>
    </section>
  );
}
