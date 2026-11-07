import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Learning Space · E-Learning LMS",
  description:
    "Không gian học tập: theo dõi tiến độ, làm quiz và xem chứng chỉ.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
