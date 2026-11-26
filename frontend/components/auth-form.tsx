"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useSession } from "@/components/session-provider";
import { Heading } from "@/components/heading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError, type Session } from "@/lib/learning-api";

export function AuthForm({ register }: { register: boolean }) {
  const { session, setSession } = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const fields = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const data = await api<Session>(
        register ? "/auth/register" : "/auth/login",
        undefined,
        {
          method: "POST",
          body: JSON.stringify(Object.fromEntries(fields)),
        },
      );
      setSession(data);
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(
        next &&
          (next === "/admin/courses" ||
            /^\/courses\/[0-9a-f-]{36}$/i.test(next))
          ? next
          : "/courses",
      );
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        setError("Email hoặc mật khẩu chưa đúng.");
      } else if (caught instanceof ApiError && caught.status === 409) {
        setError("Email này đã được đăng ký.");
      } else {
        setError(
          caught instanceof Error ? caught.message : "Không thể gửi yêu cầu.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="site-container site-content max-w-md">
      <Heading className="mb-6">
        {register ? "Tạo tài khoản" : "Đăng nhập"}
      </Heading>
      {session ? (
        <p>
          Bạn đang đăng nhập với tên {session.user.fullName}.{" "}
          <Link className="text-primary underline" href="/courses">
            Xem khóa học
          </Link>
        </p>
      ) : (
        <>
          <form className="site-panel grid gap-4 p-6" onSubmit={submit}>
            {register && (
              <label className="grid gap-2">
                Họ và tên
                <Input
                  name="fullName"
                  required
                  maxLength={255}
                  autoComplete="name"
                />
              </label>
            )}
            <label className="grid gap-2">
              Email
              <Input
                name="email"
                type="email"
                required
                autoComplete="username"
              />
            </label>
            <label className="grid gap-2">
              Mật khẩu
              <Input
                name="password"
                type="password"
                required
                minLength={register ? 8 : undefined}
                maxLength={72}
                autoComplete={register ? "new-password" : "current-password"}
              />
            </label>
            {error && (
              <p role="alert" className="text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy}>
              {busy ? "Đang gửi…" : register ? "Đăng ký" : "Đăng nhập"}
            </Button>
          </form>
          <Link
            className="mt-4 inline-block text-primary underline"
            href={register ? "/login" : "/register"}
          >
            {register
              ? "Đã có tài khoản? Đăng nhập"
              : "Chưa có tài khoản? Đăng ký"}
          </Link>
        </>
      )}
    </section>
  );
}
