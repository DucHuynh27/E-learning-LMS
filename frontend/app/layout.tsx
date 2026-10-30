import type {Metadata} from "next";
import {Be_Vietnam_Pro} from "next/font/google";
import "./globals.css";
import {SiteHeader} from "@/components/site-header";
import {SiteFooter} from "@/components/site-footer";

const beVietnam = Be_Vietnam_Pro({
  variable: "--font-sans",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "E-learning LMS",
  description:
    "Xây dựng website LMS với nền tảng là backend API Nest.js, hỗ trợ xử lý Video & Real-time Q&A",
};

export default function RootLayout({children}: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${beVietnam.variable} h-full antialiased`}>
    <body className="min-h-full flex flex-col">
    <SiteHeader />
    <main className="flex-1">{children}</main>
    <SiteFooter />
    </body>
    </html>
  );
}
