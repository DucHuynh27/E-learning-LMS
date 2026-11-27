import Link from "next/link";
import { Award, ShieldCheck } from "lucide-react";

export function CertificateCard({
  studentName,
  courseTitle,
  serialNo,
  issuedAt,
}: {
  studentName: string;
  courseTitle: string;
  serialNo: string;
  issuedAt: string;
}) {
  const date = new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "long",
    timeZone: "Asia/Bangkok",
  }).format(new Date(issuedAt));

  return (
    <section
      aria-label="Chứng chỉ hoàn thành khóa học"
      className="my-6 rounded-xl border border-amber-200 bg-linear-to-br from-amber-50 via-white to-amber-50 p-2 text-slate-900"
    >
      <div className="rounded-lg border border-amber-200/80 px-4 py-6 text-center sm:px-7">
        <Award
          className="mx-auto mb-3 size-11 text-amber-700"
          aria-hidden="true"
        />
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
          Chứng chỉ hoàn thành
        </h2>
        <p className="mt-4 break-words text-lg font-semibold text-primary sm:text-xl">
          {studentName}
        </p>
        <p className="mt-1 break-words text-sm text-slate-700">{courseTitle}</p>
        <dl className="my-4 grid gap-3 border-y border-amber-200/80 py-3 text-sm sm:grid-cols-[1fr_auto] sm:text-left">
          <div className="min-w-0">
            <dt className="text-xs font-medium text-slate-600">Mã chứng chỉ</dt>
            <dd className="mt-1 break-all font-medium">{serialNo}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-600">Ngày cấp</dt>
            <dd className="mt-1">
              <time dateTime={issuedAt}>{date}</time>
            </dd>
          </div>
        </dl>
        <Link
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary underline-offset-4 hover:underline"
          href={`/api/certificates/${encodeURIComponent(serialNo)}/verify`}
          target="_blank"
          rel="noreferrer"
        >
          <ShieldCheck className="size-4" aria-hidden="true" />
          Xác thực chứng chỉ
        </Link>
      </div>
    </section>
  );
}
