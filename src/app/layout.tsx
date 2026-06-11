import type { Metadata } from "next";
import "./globals.css";

const OG_IMAGE =
  "https://res.cloudinary.com/dq2wjozdk/image/upload/v1781158468/IMG_1255_eg2rnc.jpg";

export const metadata: Metadata = {
  metadataBase: new URL("https://into-now.vercel.app"),
  title: "into.now — what are you into? NOW?",
  description:
    "Discover and share what you're into, right now. A map-first local discovery app.",
  openGraph: {
    title: "into.now",
    description: "what are you into? NOW?",
    siteName: "into.now",
    type: "website",
    url: "https://into-now.vercel.app",
    images: [
      {
        url: OG_IMAGE,
        width: 720,
        height: 1280,
        alt: "into.now — what are you into? NOW?",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "into.now",
    description: "what are you into? NOW?",
    images: [OG_IMAGE],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
