import type { Metadata } from "next";
import { LearningDashboard } from "@/components/learning-dashboard";
import styles from "./learning.module.css";

export const metadata: Metadata = {
  title: "Learning Space · E-Learning LMS",
  description: "Theo dõi tiến độ, làm quiz và xem chứng chỉ.",
};

export default function LearningPage() {
  return (
    <div className={styles.page}>
      <LearningDashboard />
    </div>
  );
}
