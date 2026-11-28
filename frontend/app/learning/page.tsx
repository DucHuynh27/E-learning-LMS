import type { Metadata } from "next";
import { Suspense } from "react";
import { MyLearning } from "@/components/my-learning";
import { Heading } from "@/components/heading";

export const metadata: Metadata = {
  title: "Khóa học của tôi · E-Learning LMS",
  description: "Theo dõi tiến độ, làm quiz và xem chứng chỉ.",
};

export default function LearningPage() {
  return (
    <section className="site-container site-content">
      <Heading className="mb-6">Khóa học của tôi</Heading>
      <Suspense fallback={<p role="status">Đang tải khóa học đã ghi danh…</p>}>
        <MyLearning />
      </Suspense>
    </section>
  );
}
