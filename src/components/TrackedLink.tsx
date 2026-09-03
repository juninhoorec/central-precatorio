"use client";
import type { ReactNode } from "react";
import { readJson } from "@/lib/browser-storage";
export default function TrackedLink({
  href,
  event,
  children,
  className,
  ariaLabel,
}: {
  href: string;
  event: string;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  function track() {
    void fetch("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: event,
        page: location.pathname,
        attribution: {
          firstTouch: readJson("cp-attribution-first", {}),
          lastTouch: readJson("cp-attribution-last", {}),
        },
        at: new Date().toISOString(),
      }),
    });
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      aria-label={ariaLabel}
      onClick={track}
    >
      {children}
    </a>
  );
}
