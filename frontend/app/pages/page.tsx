import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  BadgeHelp,
  CheckCircle2,
  GraduationCap,
  Mail,
} from "lucide-react";
import { Heading } from "@/components/heading";

export const metadata: Metadata = {
  title: "Hỗ trợ học tập · E-Learning LMS",
  description: "Hướng dẫn ghi danh, học bài, làm trắc nghiệm và xem chứng chỉ.",
};

const questions = [
  {
    question: "Làm sao để ghi danh khóa học?",
    answer: (
      <>
        Mở danh mục, chọn khóa học phù hợp rồi bấm <strong>Ghi danh khóa học</strong>. Sau đó khóa học sẽ xuất hiện trong mục Học tập của bạn.
      </>
    ),
  },
  {
    question: "Tôi tìm các khóa đã ghi danh ở đâu?",
    answer: (
      <>
        Vào <Link className="font-medium text-primary underline underline-offset-4" href="/learning">Học tập</Link>. Chọn <strong>Bắt đầu học</strong> hoặc <strong>Tiếp tục học</strong> trên thẻ khóa học để mở phòng học riêng.
      </>
    ),
  },
  {
    question: "Tiến độ và kết quả trắc nghiệm có được lưu không?",
    answer: "Có. Hệ thống lưu tiến độ và kết quả theo tài khoản. Bạn có thể quay lại khóa học để tiếp tục.",
  },
  {
    question: "Khi nào tôi nhận được chứng chỉ?",
    answer: "Chứng chỉ xuất hiện trong khóa học sau khi bạn hoàn thành toàn bộ bài học được yêu cầu.",
  },
];

export default function HelpPage() {
  return (
    <div className="site-container site-content space-y-8 sm:space-y-10">
      <section className="relative overflow-hidden rounded-3xl border bg-linear-to-br from-primary/[0.09] via-card to-accent/[0.10] px-6 py-8 sm:px-10 sm:py-11">
        <div className="relative z-1 max-w-2xl">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1.5 text-sm text-muted-foreground">
            <BadgeHelp className="size-4 text-primary" aria-hidden="true" />
            Trung tâm trợ giúp
          </span>
          <Heading className="mb-3">Hỗ trợ học tập</Heading>
          <p className="max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
            Tìm hướng dẫn nhanh để bắt đầu khóa học, theo dõi tiến độ và hoàn thành bài học.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90" href="/courses">
              Khám phá khóa học <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link className="inline-flex h-10 items-center justify-center rounded-lg border bg-background px-4 text-sm font-medium hover:bg-muted" href="/learning">
              Mở Học tập
            </Link>
          </div>
        </div>
        <div aria-hidden="true" className="absolute -right-12 -top-12 hidden size-64 rounded-full border-[28px] border-primary/5 sm:block" />
        <div aria-hidden="true" className="absolute -bottom-20 right-28 hidden size-48 rounded-full bg-accent/10 blur-2xl sm:block" />
      </section>

      <section aria-label="Lối tắt hỗ trợ" className="grid gap-4 sm:grid-cols-3">
        <Link href="/courses" className="site-panel group flex gap-4 p-5 transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-sm">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><GraduationCap aria-hidden="true" /></span>
          <span><span className="block font-medium">Ghi danh khóa học</span><span className="mt-1 block text-sm leading-5 text-muted-foreground">Tìm và tham gia khóa học phù hợp.</span></span>
        </Link>
        <Link href="/learning" className="site-panel group flex gap-4 p-5 transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-sm">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"><BookOpenCheck aria-hidden="true" /></span>
          <span><span className="block font-medium">Tiếp tục học</span><span className="mt-1 block text-sm leading-5 text-muted-foreground">Mở khóa đã ghi danh và xem tiến độ.</span></span>
        </Link>
        <a href="mailto:caigido@edu.vn" className="site-panel group flex gap-4 p-5 transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-sm">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300"><Mail aria-hidden="true" /></span>
          <span><span className="block font-medium">Liên hệ hỗ trợ</span><span className="mt-1 block text-sm leading-5 text-muted-foreground">caigido@edu.vn</span></span>
        </a>
      </section>

      <section id="faq" className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)]">
        <div className="space-y-3">
          <p className="text-sm font-medium text-primary">Hướng dẫn sử dụng</p>
          <h2 className="text-2xl tracking-tight sm:text-3xl">Câu hỏi thường gặp</h2>
          <p className="max-w-md leading-7 text-muted-foreground">Các câu trả lời ngắn cho những bước thường dùng trên nền tảng.</p>
        </div>
        <div className="site-panel divide-y px-5 sm:px-6">
          {questions.map(({ question, answer }) => (
            <details key={question} className="group py-4 first:pt-5 last:pb-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-1 font-medium marker:hidden [&::-webkit-details-marker]:hidden">
                {question}
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground transition group-open:rotate-45" aria-hidden="true">+</span>
              </summary>
              <p className="max-w-2xl pt-3 text-sm leading-7 text-muted-foreground">{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="site-panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex gap-3">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <div><h2 className="font-medium">Bắt đầu học ngay</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Khám phá danh mục hoặc quay lại các khóa bạn đang học.</p></div>
        </div>
        <Link className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-medium hover:bg-muted" href="/courses">Xem khóa học <ArrowRight className="size-4" aria-hidden="true" /></Link>
      </section>
    </div>
  );
}
