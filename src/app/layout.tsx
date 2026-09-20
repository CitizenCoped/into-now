import type { Metadata, Viewport } from "next";
import { Anton } from "next/font/google";
import SerwistRegister from "@/components/SerwistRegister";
import "./globals.css";

/** Display face — italic uppercase wordmark, titles and CTA labels (see tailwind `font-display`). */
const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://thebestdrug.com").replace(
  /\/$/,
  ""
);

/** 1200×630 link-preview card (iMessage / RCS / SMS / email / Slack), absolute via metadataBase. */
const OG_IMAGE = "/og.png";

const TAGLINE = "Get On Then Get Off";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  manifest: "/manifest.json",
  title: `The Best Drug — ${TAGLINE}`,
  description: "See who's nearby, share what you're into, and connect in the moment. 18+.",
  openGraph: {
    title: "The Best Drug",
    description: TAGLINE,
    siteName: "The Best Drug",
    type: "website",
    url: APP_URL,
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: `The Best Drug — ${TAGLINE}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Best Drug",
    description: TAGLINE,
    images: [OG_IMAGE],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "The Best Drug",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "48x48" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#07060B",
  width: "device-width",
  initialScale: 1,
  // Map app: page-level zoom fights map pinch-zoom and double-tap on the
  // controls. iOS still allows deliberate accessibility zoom.
  maximumScale: 1,
  userScalable: false,
  // Real env(safe-area-inset-*) values — the corner FABs and the map's
  // chrome padding both key off them.
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={anton.variable}>
      <body className="antialiased">
        <SerwistRegister />
        {children}
      </body>
    </html>
  );
}
