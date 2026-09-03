"use client";
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { readAttribution } from "@/lib/attribution";
import { writeJson } from "@/lib/browser-storage";
export default function AttributionTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useEffect(() => {
    if (pathname.startsWith("/workspace") || pathname.startsWith("/admin")) return;
    const params = new URLSearchParams(searchParams.toString());
    const touch = {
      ...readAttribution(params),
      gclid: params.get("gclid"),
      fbclid: params.get("fbclid"),
      referrer: document.referrer,
      page: window.location.pathname,
      at: new Date().toISOString(),
    };
    try {
      if (!localStorage.getItem("cp-attribution-first"))
        writeJson("cp-attribution-first", touch);
    } catch {}
    writeJson("cp-attribution-last", touch);
    void fetch("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "page_view",
        page: pathname,
        attribution: { lastTouch: touch },
        at: new Date().toISOString(),
      }),
    });
  }, [pathname, searchParams]);
  return null;
}
