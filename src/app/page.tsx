import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { Container } from "@/components/ui/container";

export default function Home() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        <Container className="py-16 sm:py-24">
          <div className="mx-auto max-w-3xl space-y-8 text-center sm:text-left">
            <span className="inline-flex rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
              Study verification, not surveillance
            </span>
            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
              Sparse timelapse proof for focused study sessions.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-400 sm:text-lg">
              Share screen, capture lightweight frames, encode locally, and upload only
              the final MP4 with metadata.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/dashboard"
                className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                Open dashboard
              </Link>
              <a
                href="#architecture"
                className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Learn more
              </a>
            </div>
            <section
              id="architecture"
              className="grid gap-3 pt-4 text-left sm:grid-cols-3"
            >
              {[
                ["Local-first", "Frames stay in-browser until final MP4 export."],
                ["Low overhead", "45s/300s sparse cadence to keep CPU and RAM low."],
                ["Secure by default", "Signed uploads and row-level access controls."],
              ].map(([title, text]) => (
                <div
                  key={title}
                  className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <h2 className="text-sm font-semibold">{title}</h2>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{text}</p>
                </div>
              ))}
            </section>
          </div>
        </Container>
      </main>
    </div>
  );
}
