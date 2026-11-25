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

    scanHeadings(document);
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) scanHeadings(node);
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
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
