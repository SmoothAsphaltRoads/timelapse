import Link from "next/link";
import { Container } from "@/components/ui/container";

export function SiteHeader() {
  return (
    <header className="border-b border-zinc-200/80 bg-zinc-50/80 backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-950/80">
      <Container className="flex h-14 items-center justify-between">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          Timelapse
        </Link>
        <nav className="flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-300">
          <Link href="/dashboard" className="hover:text-zinc-900 dark:hover:text-zinc-100">
            Dashboard
          </Link>
        </nav>
      </Container>
    </header>
  );
}
