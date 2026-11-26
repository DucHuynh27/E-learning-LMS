import { Suspense } from "react";
import { CourseCatalog } from "@/components/course-catalog";
import { Heading } from "@/components/heading";

export default function CoursesPage() {
  return (
    <section className="site-container site-content">
      <Heading className="mb-6">Khóa học</Heading>
      <Suspense fallback={<p>Đang tải danh mục…</p>}>
        <CourseCatalog />
      </Suspense>
    </section>
  );
}
