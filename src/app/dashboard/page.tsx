const stats = [
  { label: "Today", value: "0m" },
  { label: "This week", value: "0m" },
  { label: "Sessions", value: "0" },
];

export default function DashboardPage() {
  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Ready for session creation, sparse capture state, and upload lifecycle wiring.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        {stats.map((item) => (
          <article
            key={item.label}
            className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{item.label}</p>
            <p className="mt-2 text-2xl font-semibold">{item.value}</p>
          </article>
        ))}
      </div>

      <section className="rounded-xl border border-dashed border-zinc-300 bg-zinc-100/50 p-6 dark:border-zinc-700 dark:bg-zinc-900/40">
        <h2 className="text-sm font-semibold">No active session</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Session controls and timelines will live here.
        </p>
      </section>
    </section>
  );
}
