import type { Metadata } from "next";
import Link from "next/link";
import Wordmark from "@/components/Wordmark";

export const metadata: Metadata = {
  title: {
    template: "%s — The Best Drug",
    default: "Terms & Policies — The Best Drug",
  },
};

/**
 * Standalone, scrollable shell for the legal documents. globals.css locks
 * `html, body { overflow: hidden }` for the map app, so this <main> is the
 * scroll container (same pattern as OnboardingGate / ManagementShell).
 */
export default function PoliciesLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="h-dvh w-full overflow-y-auto overflow-x-hidden bg-[#07060B] text-[#F5F5F0]">
      <header className="sticky top-0 z-10 border-b border-[#F5F5F0]/10 bg-[#07060B]/85 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-3">
          <Link href="/" className="text-[12px] text-[#F5F5F0]/55 transition hover:text-[#F5F5F0]">
            ← Back
          </Link>
          <Link href="/policies" aria-label="Terms & policies">
            <Wordmark className="text-[18px]" />
          </Link>
        </div>
      </header>
      <div className="mx-auto w-full max-w-2xl px-5 pb-[max(4rem,env(safe-area-inset-bottom))] pt-6">
        {children}
      </div>
    </main>
  );
}
