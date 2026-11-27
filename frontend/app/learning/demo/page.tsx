import type { Metadata } from "next";
import { LearningDashboard } from "@/components/learning-dashboard";
import styles from "@/components/learning-dashboard.module.css";

export const metadata: Metadata = { title: "Lớp học mẫu · E-Learning LMS" };

export default function LearningDemoPage() {
  return (
    <div className={styles.page}>
      <LearningDashboard />
    </div>
  );
}
