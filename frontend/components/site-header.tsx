import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";

const navLink = [
  {label: "Home", href: "/"},
  {label: "Courses", href: "/courses"},
  {label: "Pages", href: "/pages"},
];

export function SiteHeader() {
  return (
    <header className="border-b bg-background sticky top-0">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
        {/*Logo*/}
        <Link href="/" className="...">
          <Image src="/logo.svg" alt="E-learning LMS" width={843} height={237} priority className="h-10 w-auto" />
        </Link>

        {/*Nav*/}
        <nav className="flex gap-6">
          {navLink.map((l) => (
            <Link key={l.href} href={l.href}>{l.label}</Link>
          ))}
        </nav>

        {/*Auth*/}
        <div className="flex items-center gap-2">
          <Button variant="ghost" render={<Link href="/login" />}>Login</Button>
          <Button render={<Link href="/register" />}>Register</Button>
        </div>
      </div>
    </header>
  );
}