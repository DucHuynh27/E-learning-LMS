"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "@/components/session-provider";
import { api, canManageCourses } from "@/lib/learning-api";
import { managementError } from "@/lib/course-authoring";

type UserRole = "STUDENT" | "INSTRUCTOR" | "ADMIN";
type ManagedUser = { id: string; email: string; fullName: string; role: UserRole; createdAt: string };
type UserPage = { items: ManagedUser[]; meta: { page: number; limit: number; total: number; totalPages: number } };
const roleNames: Record<UserRole, string> = { STUDENT: "Học viên", INSTRUCTOR: "Giảng viên", ADMIN: "Quản trị viên" };

export function UserManagement() {
  const { session } = useSession();
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState<UserPage>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ManagedUser>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!session || session.user.role !== "ADMIN") return;
    let active = true;
    void api<UserPage>(`/users/manage?page=${page}`, session.accessToken)
      .then((result) => { if (active) setUsers(result); })
      .catch((caught: unknown) => { if (active) setError(managementError(caught)); });
    return () => { active = false; };
  }, [page, session]);

  if (!session) return <div className="site-panel space-y-3 p-6"><p>Đăng nhập bằng tài khoản quản trị viên để quản lý người dùng.</p><Link className={buttonVariants()} href="/login?next=/admin/users">Đăng nhập</Link></div>;
  if (!canManageCourses(session) || session.user.role !== "ADMIN") return <p className="site-panel p-6">Trang này chỉ dành cho quản trị viên.</p>;
  const token = session.accessToken;
  const currentUserId = session.user.id;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(form.entries());
    if (editing && !values.password) delete values.password;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await api<ManagedUser>(editing ? `/users/${editing.id}/manage` : "/users/manage", token, {
        method: editing ? "PATCH" : "POST", body: JSON.stringify(values),
      });
      setUsers((current) => current && ({ ...current, items: editing ? current.items.map((user) => user.id === result.id ? result : user) : [result, ...current.items].slice(0, current.meta.limit), meta: editing ? current.meta : { ...current.meta, total: current.meta.total + 1 } }));
      setEditing(undefined); setAdding(false); setNotice(editing ? "Đã cập nhật tài khoản." : "Đã tạo tài khoản.");
    } catch (caught) { setError(managementError(caught)); }
    finally { setBusy(false); }
  }

  async function remove(user: ManagedUser) {
    if (!window.confirm(`Xóa tài khoản ${user.email}?`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await api(`/users/${user.id}/manage`, token, { method: "DELETE" });
      setUsers((current) => current && ({ ...current, items: current.items.filter((item) => item.id !== user.id), meta: { ...current.meta, total: Math.max(0, current.meta.total - 1) } }));
      setNotice("Đã xóa tài khoản.");
    } catch (caught) { setError(managementError(caught)); }
    finally { setBusy(false); }
  }

  const form = adding || editing;
  return (
    <div className="space-y-6">
      <section className="site-panel flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
        <div className="flex items-center gap-4"><span className="grid size-12 place-items-center rounded-xl bg-primary/10 text-primary"><Users aria-hidden="true" /></span><div><p className="text-sm text-muted-foreground">Tài khoản trong hệ thống</p><p className="text-2xl">{users?.meta.total ?? "—"}</p></div></div>
        <Button type="button" onClick={() => { setEditing(undefined); setAdding(true); setError(""); }}><Plus className="size-4" />Thêm người dùng</Button>
      </section>
      {error && <p role="alert" className="site-panel p-4 text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="site-panel p-4 text-sm text-primary">{notice}</p>}
      {form && (
        <form onSubmit={save} className="site-panel grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
          <h2 className="text-lg sm:col-span-2">{editing ? "Chỉnh sửa người dùng" : "Tạo tài khoản"}</h2>
          <label className="grid gap-2 text-sm">Họ và tên<Input name="fullName" required maxLength={255} defaultValue={editing?.fullName} /></label>
          <label className="grid gap-2 text-sm">Email<Input name="email" type="email" required defaultValue={editing?.email} /></label>
          <label className="grid gap-2 text-sm">Vai trò<select name="role" defaultValue={editing?.role ?? "STUDENT"} className="h-10 rounded-lg border border-input bg-background px-3"><option value="STUDENT">Học viên</option><option value="INSTRUCTOR">Giảng viên</option><option value="ADMIN">Quản trị viên</option></select></label>
          <label className="grid gap-2 text-sm">{editing ? "Mật khẩu mới (để trống nếu giữ nguyên)" : "Mật khẩu"}<Input name="password" type="password" required={!editing} minLength={8} maxLength={72} autoComplete="new-password" /></label>
          <div className="flex flex-wrap gap-2 sm:col-span-2"><Button type="submit" disabled={busy}>{busy ? "Đang lưu…" : editing ? "Lưu thay đổi" : "Tạo tài khoản"}</Button><Button type="button" variant="outline" onClick={() => { setAdding(false); setEditing(undefined); }}>Hủy</Button></div>
        </form>
      )}
      <section className="site-panel overflow-hidden">
        <div className="flex items-center justify-between border-b px-5 py-4"><h2 className="font-medium">Danh sách người dùng</h2><span className="text-sm text-muted-foreground">{users?.meta.total ?? 0} tài khoản</span></div>
        {!users ? <p className="p-5 text-sm text-muted-foreground">Đang tải người dùng…</p> : users.items.length === 0 ? <p className="p-5 text-sm text-muted-foreground">Chưa có tài khoản.</p> : (
          <ul className="divide-y">
            {users.items.map((user) => <li key={user.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="min-w-0"><p className="truncate font-medium">{user.fullName}</p><p className="truncate text-sm text-muted-foreground">{user.email}</p></div>
              <div className="flex items-center gap-3"><span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">{roleNames[user.role]}</span><Button type="button" variant="outline" size="sm" onClick={() => { setAdding(false); setEditing(user); setError(""); }}><Pencil className="size-3.5" />Sửa</Button><Button type="button" variant="ghost" size="sm" disabled={busy || user.id === currentUserId} aria-label={`Xóa ${user.email}`} title={user.id === currentUserId ? "Không thể tự xóa tài khoản đang đăng nhập" : "Xóa người dùng"} onClick={() => void remove(user)}><Trash2 className="size-4 text-destructive" /></Button></div>
            </li>)}
          </ul>
        )}
        {users && users.meta.totalPages > 1 && <div className="flex items-center justify-between border-t px-5 py-3 text-sm"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Trước</Button><span>{page} / {users.meta.totalPages}</span><Button variant="outline" size="sm" disabled={page >= users.meta.totalPages} onClick={() => setPage((current) => current + 1)}>Sau</Button></div>}
      </section>
    </div>
  );
}
