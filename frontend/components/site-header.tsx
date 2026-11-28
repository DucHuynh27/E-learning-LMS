"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useSession } from "@/components/session-provider";
import { forgetAllAttempts } from "@/lib/learning-state";
import { canManageCourses } from "@/lib/learning-api";

const navigation = [
  { label: "Trang chủ", href: "/" },
  { label: "Khóa học", href: "/courses" },
  { label: "Học tập", href: "/learning" },
  { label: "Hỗ trợ", href: "/pages" },
];

export function SiteHeader() {
  const { session, setSession } = useSession();

  return (
    <header className="sticky top-0 z-10 border-b bg-background">
      <div className="site-container flex flex-wrap items-center justify-between gap-2 py-3 md:gap-4">
        <Link href="/" className="shrink-0">
          <Image src="/logo.svg" alt="E-learning LMS" width={843} height={237} priority className="h-8 w-auto sm:h-9" />
        </Link>

        <nav aria-label="Điều hướng chính" className="order-last flex w-full flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium md:order-none md:w-auto md:gap-x-6">
          {navigation.map(({ href, label }) => (
            <Link className="py-1 text-muted-foreground hover:text-primary" key={href} href={href}>{label}</Link>
          ))}
          {canManageCourses(session) && (
            <Link className="py-1 text-muted-foreground hover:text-primary" href="/admin/courses">
              Quản lý
            </Link>
          )}
          {session?.user.role === "ADMIN" && (
            <Link className="py-1 text-muted-foreground hover:text-primary" href="/admin/users">
              Người dùng
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {session ? (
            <>
              <span className="hidden max-w-32 truncate text-sm text-muted-foreground lg:inline">{session.user.fullName}</span>
              <Button variant="ghost" onClick={() => {
                forgetAllAttempts(session.user.id);
                setSession(null);
              }}>Đăng xuất</Button>
            </>
          ) : (
            <>
              <Button variant="ghost" nativeButton={false} render={<Link href="/login" />}>Đăng nhập</Button>
              <Button nativeButton={false} render={<Link href="/register" />}>Đăng ký</Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
