"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/* Renders dialogs directly under <body>. Glass cards use backdrop-filter and
   reveal animations use transforms; both make position:fixed children
   relative to the card instead of the viewport, so dialogs must escape them. */
export default function Portal({ children }: { children: React.ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => { setHost(document.body); }, []);
  return host ? createPortal(children, host) : null;
}
