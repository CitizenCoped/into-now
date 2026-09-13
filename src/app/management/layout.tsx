import type { Metadata } from "next";
import ManagementShell from "@/components/management/ManagementShell";

export const metadata: Metadata = {
  title: "Management",
  robots: { index: false, follow: false },
};

export default function ManagementLayout({ children }: { children: React.ReactNode }) {
  return <ManagementShell>{children}</ManagementShell>;
}
