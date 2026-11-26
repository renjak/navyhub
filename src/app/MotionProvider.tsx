"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

export default function MotionProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return;

    gsap.registerPlugin(ScrollTrigger);
    const lenis = new Lenis({
      duration: 1.05,
      smoothWheel: true,
      syncTouch: false,
      autoRaf: false
    });

    const updateScroll = () => ScrollTrigger.update();
    lenis.on("scroll", updateScroll);

    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    const animateHeading = (element: HTMLElement) => {
      if (element.dataset.motionProcessed === "true") return;
      const label = (element.textContent || "").replace(/\s+/g, " ").trim();
      if (!label) return;

      element.dataset.motionProcessed = "true";
      element.setAttribute("aria-label", label);
      const words = label.split(" ");
      element.textContent = "";

      words.forEach((word, index) => {
        const span = document.createElement("span");
        span.textContent = word;
        span.setAttribute("aria-hidden", "true");
        span.style.display = "inline-block";
        element.appendChild(span);
        if (index < words.length - 1) element.appendChild(document.createTextNode(" "));
      });

      const wordSpans = Array.from(element.querySelectorAll<HTMLElement>("span[aria-hidden='true']"));
      const tween = gsap.fromTo(
        wordSpans,
        { autoAlpha: 0, y: 12 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.42,
          stagger: 0.045,
          ease: "power2.out",
          scrollTrigger: {
            trigger: element,
            start: "top 88%",
            once: true
          }
        }
      );
      activeAnimations.push(tween);
    };

    const activeAnimations: gsap.core.Tween[] = [];
    const scanHeadings = (root: ParentNode) => {
      root.querySelectorAll<HTMLElement>("[data-gsap-heading]").forEach(animateHeading);
      if (root instanceof HTMLElement && root.matches("[data-gsap-heading]")) animateHeading(root);
    };

    /* Reveal cards and list rows as they scroll into view. Elements already in
       view on first paint get a short stagger; later ones animate on entry. */
    const REVEAL = ".dg-titlebar,.dg-card,.dg-kpi,.dg-log-kpi,.dg-log-summary .dg-log-title,.dg-fault,.dg-files>li,.dg-check,.dg-supply,.dg-plain-list>li,.dg-content .panel,.dg-content .module-hero,.dg-content .dl-shell,.dg-content .watch-archive";
    let batch = 0, batchTimer = 0;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target as HTMLElement;
        el.style.setProperty("--dg-delay", Math.min(batch++, 8) * 55 + "ms");
        el.classList.add("dg-in");
        io.unobserve(el);
        const done = (ev: TransitionEvent) => {
          if (ev.target !== el || ev.propertyName !== "transform") return;
          el.removeEventListener("transitionend", done);
          el.classList.remove("dg-reveal", "dg-in");
          el.style.removeProperty("--dg-delay");
        };
        el.addEventListener("transitionend", done);
      }
      window.clearTimeout(batchTimer);
      batchTimer = window.setTimeout(() => { batch = 0; }, 120);
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.06 });
    const scanReveal = (root: ParentNode) => {
      const list: HTMLElement[] = [];
      if (root instanceof HTMLElement && root.matches(REVEAL)) list.push(root);
      root.querySelectorAll<HTMLElement>(REVEAL).forEach((el) => list.push(el));
      for (const el of list) {
        if (el.dataset.dgReveal || el.closest(".dg-modal,.supply-modal,.v3d-root")) continue;
        el.dataset.dgReveal = "1";
        el.classList.add("dg-reveal");
        io.observe(el);
      }
    };

    scanHeadings(document);
    scanReveal(document);
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) { scanHeadings(node); scanReveal(node); }
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      io.disconnect();
      window.clearTimeout(batchTimer);
      activeAnimations.forEach((animation) => {
        animation.scrollTrigger?.kill();
        animation.kill();
      });
      lenis.off("scroll", updateScroll);
      gsap.ticker.remove(raf);
      lenis.destroy();
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    };
  }, []);

  return <>{children}</>;
}
