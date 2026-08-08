import Image from "next/image";
import { Reveal } from "./motion";
import { GhostImage } from "./photo";

/**
 * Aspiration band — three warm candid photos + one honest line. NO testimonials,
 * NO invented user counts or ratings. Imagery and honest copy only.
 */
export function AspirationBand() {
  const photos = [
    { src: "/images/band-community.jpg", alt: "Aspirants studying as a community", pos: "center" },
    { src: "/images/band-aspirants.jpg", alt: "Students preparing for competitive exams", pos: "center 30%" },
    { src: "/images/band-laptop.jpg", alt: "A student practising on a laptop", pos: "center" },
  ];
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <Reveal className="mx-auto mb-8 max-w-2xl text-center">
        <p className="font-report text-2xl font-medium tracking-tight text-ink sm:text-3xl">
          Built for the aspirant grinding through the last mile.
        </p>
      </Reveal>
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {photos.map((p, i) => (
          <Reveal key={p.src} delay={i * 90}>
            <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-panel ring-1 ring-hairline sm:aspect-[4/5]">
              <Image
                src={p.src}
                alt={p.alt}
                fill
                sizes="(max-width: 640px) 33vw, 30vw"
                loading="lazy"
                className="object-cover"
                style={{ objectPosition: p.pos }}
              />
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

const GOALS = [
  { src: "/images/goal-red-fort.jpg" },
  { src: "/images/goal-victoria-day.jpg" },
  { src: "/images/goal-secretariat.jpg" },
  { src: "/images/goal-parade.jpg" },
  { src: "/images/goal-victoria-dusk.jpg" },
  { src: "/images/goal-flag.jpg" },
  { src: "/images/goal-india-gate.jpg" },
];

/**
 * The goal montage — a slow, cinematic marquee of the institutions the aspirant
 * is working toward. Ghosted + desaturated, restrained. The marquee freezes
 * under prefers-reduced-motion (handled by the .marquee-track CSS media rule).
 */
export function GoalMontage() {
  const items = [...GOALS, ...GOALS];
  return (
    <section className="border-y border-hairline bg-panel/40 py-16 sm:py-20">
      <Reveal className="mx-auto mb-8 max-w-2xl px-4 text-center sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-tertiary">
          Why the last mile matters
        </p>
        <p className="mt-3 font-report text-3xl font-medium tracking-tight text-ink sm:text-4xl">
          Everything you&apos;re working toward.
        </p>
      </Reveal>
      <div
        className="relative overflow-hidden"
        style={{
          maskImage: "linear-gradient(to right, transparent, #000 10%, #000 90%, transparent)",
          WebkitMaskImage: "linear-gradient(to right, transparent, #000 10%, #000 90%, transparent)",
        }}
        aria-hidden
      >
        <div className="marquee-track flex w-max items-center gap-4">
          {items.map((g, i) => (
            <div
              key={i}
              className="relative aspect-[16/10] w-[220px] flex-shrink-0 overflow-hidden rounded-xl ring-1 ring-hairline sm:w-[300px]"
            >
              <GhostImage src={g.src} sizes="300px" overlay="soft" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
