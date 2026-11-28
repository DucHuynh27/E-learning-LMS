import type { Metadata } from "next";
import { Heading } from "@/components/heading";
import { UserManagement } from "@/components/user-management";

export const metadata: Metadata = { title: "Quản lý người dùng · E-Learning LMS" };

export default function ManageUsersPage() {
  return (
    <section className="site-container site-content space-y-6">
      <div><Heading>Quản lý người dùng</Heading><p className="mt-2 text-muted-foreground">Tạo tài khoản, đổi vai trò, cập nhật thông tin và xóa người dùng.</p></div>
      <UserManagement />
    </section>
  );
}
