import type { Metadata, Viewport } from "next";
import SerwistRegister from "@/components/SerwistRegister";
import "./globals.css";

const OG_IMAGE =
  "https://res.cloudinary.com/dq2wjozdk/image/upload/v1781158468/IMG_1255_eg2rnc.jpg";

const PWA_ICON =
  "https://res.cloudinary.com/dq2wjozdk/image/upload/w_192,h_192,c_fill/IMG_1255_eg2rnc.jpg";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://into-now.vercel.app").replace(
  /\/$/,
  ""
);

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  manifest: "/manifest.json",
  title: "into.now — what are you into? NOW?",
  description:
    "Discover and share what you're into, right now. A map-first local discovery app.",
  openGraph: {
    title: "into.now",
    description: "what are you into? NOW?",
    siteName: "into.now",
    type: "website",
    url: APP_URL,
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
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "into.now",
  },
  icons: {
    apple: PWA_ICON,
  },
};

export const viewport: Viewport = {
  themeColor: "#06040c",
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
    <html lang="en">
      <body className="antialiased">
        <SerwistRegister />
        {children}
      </body>
    </html>
  );
}
