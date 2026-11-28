import { Suspense } from "react";
import { CourseCatalog } from "@/components/course-catalog";
import { Heading } from "@/components/heading";

export default function CoursesPage() {
  return (
    <section className="site-container site-content">
      <div className="mb-7 max-w-2xl">
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-primary">
          Học tập có định hướng
        </p>
        <Heading className="mb-3">Khám phá khóa học</Heading>
        <p className="leading-7 text-muted-foreground">
          Chọn lộ trình phù hợp, xem đề cương chi tiết và theo dõi tiến độ học
          tập của bạn trong một nơi.
        </p>
      </div>
      <Suspense fallback={<p>Đang tải danh mục…</p>}>
        <CourseCatalog />
      </Suspense>
    </section>
  );
}
