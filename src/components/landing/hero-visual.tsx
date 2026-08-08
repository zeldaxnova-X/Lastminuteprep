"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { Sparkles } from "lucide-react";
import { useReducedMotion } from "./motion";

/**
 * Hero visual: three slightly-tilted floating photo cards with gentle
 * mouse-parallax and a hover lift. Parallax is disabled under reduced motion or
 * coarse (touch) pointers — the base tilt still reads as intentional. Hero
 * images are priority-loaded.
 */
export function HeroVisual() {
  const reduced = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const layers = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    if (reduced) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    const wrap = wrapRef.current;
    if (!wrap) return;

    let raf = 0;
    let tx = 0, ty = 0, cx = 0, cy = 0;
    const onMove = (e: MouseEvent) => {
      const r = wrap.getBoundingClientRect();
      tx = (e.clientX - (r.left + r.width / 2)) / r.width;
      ty = (e.clientY - (r.top + r.height / 2)) / r.height;
    };
    const tick = () => {
      cx += (tx - cx) * 0.07;
      cy += (ty - cy) * 0.07;
      layers.current.forEach((el) => {
        if (!el) return;
        const d = Number(el.dataset.depth || "0");
        const rot = Number(el.dataset.rot || "0");
        el.style.transform = `translate3d(${cx * d * 22}px, ${cy * d * 22}px, 0) rotate(${rot}deg)`;
      });
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [reduced]);

  const ref = (i: number) => (el: HTMLDivElement | null) => {
    layers.current[i] = el;
  };

  return (
    <div ref={wrapRef} className="relative mx-auto aspect-[4/5] w-full max-w-md sm:aspect-square lg:max-w-none">
      <div className="absolute inset-10 rounded-[2.5rem] bg-accent-soft blur-2xl" aria-hidden />

      {/* left tall */}
      <div
        ref={ref(0)}
        data-depth="0.5"
        data-rot="-7"
        className="absolute left-0 top-2 w-[46%]"
        style={{ transform: "rotate(-7deg)" }}
      >
        <Card
          src="/images/hero-exam-focus.jpg"
          alt="A student focused during a computer-based test"
          aspect="3 / 4"
          position="center 30%"
          priority
          sizes="(max-width: 1024px) 46vw, 20vw"
        />
      </div>

      {/* center */}
      <div
        ref={ref(1)}
        data-depth="0.85"
        data-rot="2"
        className="absolute left-1/2 top-10 w-[48%] -translate-x-1/2"
        style={{ transform: "translateX(-50%) rotate(2deg)" }}
      >
        <Card
          src="/images/hero-study-library.jpg"
          alt="Aspirants studying together in a library"
          aspect="3 / 4"
          position="center"
          priority
          sizes="(max-width: 1024px) 48vw, 22vw"
        />
      </div>

      {/* right tall + badge */}
      <div
        ref={ref(2)}
        data-depth="1"
        data-rot="6"
        className="absolute bottom-0 right-0 w-[50%]"
        style={{ transform: "rotate(6deg)" }}
      >
        <div className="group relative">
          <Card
            src="/images/hero-success.jpg"
            alt="A successful exam aspirant"
            aspect="3 / 4"
            position="center 25%"
            priority
            sizes="(max-width: 1024px) 50vw, 22vw"
          />
          <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-panel-dark/85 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-gold-bright" />
            <Sparkles className="h-3.5 w-3.5 text-gold-bright" />
            AI Mentor · strategising
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({
  src,
  alt,
  aspect,
  position,
  priority,
  sizes,
}: {
  src: string;
  alt: string;
  aspect: string;
  position: string;
  priority?: boolean;
  sizes: string;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl bg-panel shadow-lift ring-1 ring-black/[0.06] transition-premium group-hover:-translate-y-1"
      style={{ aspectRatio: aspect }}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover"
        style={{ objectPosition: position }}
      />
    </div>
  );
}
