import type { Metadata } from "next";
import { CourseManagement } from "@/components/course-management";
import { Heading } from "@/components/heading";

export const metadata: Metadata = {
  title: "Quản lý khóa học · E-Learning LMS",
};

export default function ManageCoursesPage() {
  return (
    <section className="site-container site-content">
      <Heading className="mb-6">Quản lý khóa học</Heading>
      <CourseManagement />
    </section>
  );
}
