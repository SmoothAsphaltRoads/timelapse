import Link from "next/link";
import { Container } from "@/components/ui/container";

export function DashboardShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-200/80 bg-zinc-50/80 backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-950/80">
        <Container className="flex h-14 items-center justify-between">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            Timelapse
          </Link>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">MVP</span>
        </Container>
      </header>
      <Container className="py-8">{children}</Container>
    </div>
  );
}
