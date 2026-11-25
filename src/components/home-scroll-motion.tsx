"use client";

import { useEffect } from "react";

export function HomeScrollMotion() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".home-immersive");
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const targets = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (!("IntersectionObserver" in window)) {
      targets.forEach((target) => target.classList.add("is-visible"));
      return;
    }

    root.classList.add("motion-enhanced");
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -7% 0px" });

    targets.forEach((target, index) => {
      target.style.setProperty("--reveal-delay", String(Math.min(index % 4, 3) * 75) + "ms");
      observer.observe(target);
    });

    return () => observer.disconnect();
  }, []);

  return null;
}
