# Landing page images

The 18 provided photos are in place and wired into the landing page via
`next/image` (responsive `sizes`, priority only on the three hero cards, the rest
lazy-loaded). The optimizer generates width-appropriate, compressed variants at
serve time, so the large originals here never ship to the browser directly.

## Treatments applied in code (not baked into the files)
- `ai-mentor.jpg` — duotoned toward ink + emerald/gold at low opacity behind the
  dark AI-Mentor panel (`Duotone` in `src/components/landing/photo.tsx`), taming
  the neon green so it reads as premium AI.
- `goal-*` landmarks — desaturated with an ink overlay for legible text and a
  cinematic feel (`GhostImage`).

## Slot map (all present)
| File | Used in |
|---|---|
| hero-exam-focus.jpg / hero-study-library.jpg / hero-success.jpg | Hero floating cards |
| tension-focus.jpg | Tension section side image |
| goal-secretariat.jpg | SSC CGL exam card + goal montage |
| goal-india-gate.jpg | UPSC exam card + goal montage + final CTA |
| feature-questions.jpg | Feature row 01 |
| how-sit-test.jpg / how-know-fix.jpg | How-it-works steps 1 & 3 |
| ai-mentor.jpg | AI Mentor section (duotone) |
| band-community.jpg / band-aspirants.jpg / band-laptop.jpg | Aspiration band |
| goal-red-fort.jpg / goal-victoria-day.jpg / goal-victoria-dusk.jpg / goal-parade.jpg / goal-flag.jpg | Goal montage |

To swap any photo, replace the file in place (keep the name) — no code change needed.
