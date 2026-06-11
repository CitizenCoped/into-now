"use client";

import { useEffect } from "react";

export default function SerwistRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);

  return null;
}