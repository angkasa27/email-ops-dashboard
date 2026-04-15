import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

import { AppLiveRefresh } from "@/components/features/app-live-refresh";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/server/session";

import { logoutAction } from "../(auth)/login/actions";

const navigation = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/messages", label: "Messages" },
  { href: "/mailboxes", label: "Mailboxes" },
  { href: "/system", label: "System" }
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="mx-auto grid w-full max-w-7xl gap-4 md:grid-cols-[230px_1fr]">
        <AppLiveRefresh />
        <aside className="rounded-3xl border border-stone-300 bg-white/90 p-4 shadow-sm">
          <h1 className="text-2xl font-semibold">Mail Monitor</h1>
          <p className="mt-1 text-xs text-stone-600">Operational traffic dashboard</p>
          <nav className="mt-6 space-y-1">
            {navigation.map((item) => (
              <Link
                key={item.href}
                className="block rounded-2xl px-3 py-2 text-sm font-medium text-stone-800 transition hover:bg-stone-100"
                href={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-6 rounded-2xl bg-stone-100 p-3 text-xs text-stone-700">
            Signed in as <strong>{session.username}</strong>
            <br />
            Session refreshed {formatDistanceToNow(new Date(), { addSuffix: true })}
          </div>
          <form className="mt-4" action={logoutAction}>
            <Button className="w-full" variant="outline" type="submit">
              Logout
            </Button>
          </form>
        </aside>
        <section className="space-y-4">{children}</section>
      </div>
    </div>
  );
}
