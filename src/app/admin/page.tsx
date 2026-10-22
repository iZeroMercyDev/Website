import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/auth/guards";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Bankai", robots: { index: false, follow: false } };

function fmt(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function AdminPage() {
  const admin = await requireAdmin();

  const [users, anime, comments, reviews, lists, history, recentUsers, announcements] = await Promise.all([
    prisma.user.count(),
    prisma.anime.count(),
    prisma.comment.count(),
    prisma.review.count(),
    prisma.listEntry.count(),
    prisma.watchHistory.count(),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, username: true, role: true, createdAt: true },
    }),
    prisma.announcement.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  const stats = [
    { label: "Users", value: users },
    { label: "Anime cached", value: anime },
    { label: "Comments", value: comments },
    { label: "Reviews", value: reviews },
    { label: "List entries", value: lists },
    { label: "Watch history", value: history },
  ];

  return (
    <main className="mx-auto max-w-5xl px-4 pb-16 pt-24">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin dashboard</h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-white/50">Signed in as {admin.username}</p>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-gray-200 p-4 dark:border-white/10">
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-white/50">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{s.value.toLocaleString("en-US")}</p>
          </div>
        ))}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Newest users</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-500 dark:bg-white/5 dark:text-white/50">
              <tr>
                <th className="px-4 py-2 font-medium">Username</th>
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="px-4 py-2 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody className="text-gray-800 dark:text-white/80">
              {recentUsers.map((u) => (
                <tr key={u.id} className="border-t border-gray-100 dark:border-white/5">
                  <td className="px-4 py-2">{u.username ?? "—"}</td>
                  <td className="px-4 py-2">{u.role}</td>
                  <td className="px-4 py-2">{fmt(u.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Announcements</h2>
        {announcements.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500 dark:text-white/50">No announcements yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {announcements.map((a) => (
              <li key={a.id} className="rounded-xl border border-gray-200 p-4 dark:border-white/10">
                <p className="font-medium text-gray-900 dark:text-white">
                  {a.title}{" "}
                  <span className="ml-2 text-xs font-normal text-gray-500 dark:text-white/50">
                    {a.active ? "active" : "hidden"} · {fmt(a.createdAt)}
                  </span>
                </p>
                <p className="mt-1 text-sm text-gray-600 dark:text-white/60">{a.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
