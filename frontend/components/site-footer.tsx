import Link from "next/link";
import Image from "next/image";
import {Text} from "@/components/text"
import {MapPin, Phone, Mail} from "lucide-react";

const footerColumns = [
  {
    title: "Khoá học",
    items: [
      {label: "Lập trình", href: '/courses/programming'},
      {label: "Thiết kế", href: '/courses/design'},
    ],
  },
  {
    title: "Hỗ trợ",
    items: [
      {label: "FAQ", href: '/faq'},
      {label: "Bài viết mới nhất", href: '/blog'},
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t bg-muted/40">
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/*Cột 1*/}
          <div className="flex flex-col gap-3">
            <Link href="/">
              <Image src="/logo.svg" alt="E-learning LMS" width={843} height={237} priority className="h-13 w-auto" />
            </Link>

            <Text variant="sidebar" className="text-muted-foreground leading-relaxed">Nền tảng E-Learning hỗ trợ xử lý
              Video & Real-time Q&A sử dùng Next.js và Nest.js</Text>
          </div>

          {/*Cột 2 + 3*/}
          {footerColumns.map((col) => (
            <div key={col.title}>
              <Text variant="body" className="mb-4 uppercase">
                {col.title}
              </Text>
              <ul className="space-y-3">
                {col.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="text-base text-muted-foreground hover:text-foreground"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/*Cột 4*/}
          {/*Thông tin liên hệ*/}
          <div>
            <Text variant="body" className="mb-4 uppercase">
              Liên hệ
            </Text>
            <ul className="space-y-3">
              <li className="flex items-start gap-2">
                <MapPin className="size-4 shrink-0"></MapPin>
                <Text variant="sidebar" className="text-muted-foreground">
                  Địa chỉ: 137 Trần Quang Khải, phường Hội An, thành phố Đà Nẵng
                </Text>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="size-4 shrink-0"></Phone>
                <Text variant="sidebar" className="text-muted-foreground">
                  Số điện thoại: 0355045462
                </Text>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="size-4 shrink-0"></Mail>
                <Text variant="sidebar" className="text-muted-foreground">
                  Email: caigido@edu.vn
                </Text>
              </li>
            </ul>
          </div>

        </div>

        <div className="mt-5 border-t pt-3 text-center">
          <Text variant="sidebar">© 2026 Trường Đại học Đông Á - E-learning LMS </Text>
        </div>
      </div>
    </footer>
  );
}