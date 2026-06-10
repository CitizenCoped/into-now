import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "into.now — what are you into? NOW?",
  description:
    "Discover and share what you're into, right now. A map-first local discovery app.",
  openGraph: {
    title: "into.now",
    description: "what are you into? NOW?",
    siteName: "into.now",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
