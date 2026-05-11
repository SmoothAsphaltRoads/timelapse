"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const isLocalhost =
      window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

    if (isLocalhost) {
      return;
    }

    void navigator.serviceWorker.register("/sw.js", { scope: "/" });
  }, []);

  return null;
}
