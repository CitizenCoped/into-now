"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const NAV = [
  { href: "/management", label: "Dashboard", exact: true },
  { href: "/management/moderation", label: "Photo review" },
  { href: "/management/moderation/settings", label: "Sensitivity" },
  { href: "/management/moderation/playground", label: "Playground" },
  { href: "/management/activity", label: "Activity" },
];

export default function ManagementShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const standalone = pathname === "/management/login" || pathname === "/management/setup";
  const [username, setUsername] = useState<string | null>(null);
  const [pending, setPending] = useState(0);

  const refresh = useCallback(async () => {
    if (standalone) return;
    const [me, dash] = await Promise.all([
      fetch("/api/management/me").then((r) => r.json()).catch(() => null),
      fetch("/api/management/dashboard").then((r) => r.json()).catch(() => null),
    ]);
    setUsername(me?.admin?.username ?? null);
    setPending(typeof dash?.pendingCount === "number" ? dash.pendingCount : 0);
  }, [standalone]);

  useEffect(() => {
    void refresh();
  }, [refresh, pathname]);

  async function logout() {
    await fetch("/api/management/logout", { method: "POST" });
    router.replace("/management/login");
  }

  if (standalone) {
    return <div className="h-full overflow-y-auto">{children}</div>;
  }

  return (
    <div className="flex h-full overflow-hidden">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-white/10 bg-black/30 md:flex">
        <div className="px-4 py-5">
          <p className="text-xs uppercase tracking-widest text-white/40">Management</p>
          <p className="mt-1 text-sm font-medium text-white">{username ?? "…"}</p>
        </div>
        <nav className="flex-1 space-y-1 px-2">
          {NAV.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : item.href === "/management/moderation"
                ? pathname === "/management/moderation" ||
                  /^\/management\/moderation\/[0-9a-f-]+$/i.test(pathname)
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const showBadge = item.href === "/management/moderation" && pending > 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                  active ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span>{item.label}</span>
                {showBadge ? (
                  <span className="rounded-full bg-[#FF2D8A] px-2 py-0.5 text-[10px] font-semibold text-[#07060B]">
                    {pending}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={() => void logout()}
          className="m-3 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/60 hover:text-white"
        >
          Sign out
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 md:hidden">
          <p className="text-sm font-medium text-white">Management</p>
          <button type="button" onClick={() => void logout()} className="text-xs text-white/50">
            Sign out
          </button>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-white/10 px-2 py-2 md:hidden">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-lg px-3 py-1.5 text-xs text-white/70"
            >
              {item.label}
              {item.href === "/management/moderation" && pending > 0 ? ` (${pending})` : ""}
            </Link>
          ))}
        </nav>
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
