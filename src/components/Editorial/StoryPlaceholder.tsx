import React from 'react'

import { hashSeed } from '@/lib/personalized/images'

// Our own stand-ins for a story picture, used when the source has none, has only furniture (share icons, logos),
// only a thumbnail too small to stretch, or a picture that fails to load. Each one is a small piece of print
// vocabulary (halftone, page columns, misregistered inks, press rules, engraving hatch, registration marks)
// drawn from the site's palette variables, so light and dark mode need nothing extra.
//
// The pick comes from a hash of the story, never Math.random(): a story keeps its placeholder from render to
// render, and server and client agree on it, so there is no flicker and no hydration mismatch.

const COLOR = {
  accent: 'var(--ep-accent)',
  ink: 'var(--ep-ink)',
  muted: 'var(--ep-muted)',
  navy: 'var(--ep-navy)',
  paper: 'var(--ep-paper-muted)',
}

const range = (count: number) => Array.from({ length: count }, (_, index) => index)

// 300 x 200 canvas; every variant fills it, and `slice` crops it to whatever box the card gives.
const Halftone = () => {
  const cols = 16
  const rows = 11
  return (
    <>
      {range(rows).flatMap((row) =>
        range(cols).map((col) => {
          // Dots swell from the top-left toward the bottom-right, the way a screened photograph does.
          const t = (col / (cols - 1)) * 0.65 + (row / (rows - 1)) * 0.35
          return (
            <circle
              cx={18 + col * 18.5}
              cy={16 + row * 17.2}
              key={`${row}-${col}`}
              r={0.8 + t * 7}
              style={{ fill: COLOR.accent }}
            />
          )
        }),
      )}
    </>
  )
}

const PageColumns = () => {
  const lengths = [72, 68, 72, 60, 72, 66, 72, 54, 38]
  return (
    <>
      <rect height="13" style={{ fill: COLOR.ink }} width="170" x="24" y="26" />
      <rect height="13" style={{ fill: COLOR.ink }} width="112" x="24" y="45" />
      <rect height="42" style={{ fill: COLOR.navy }} width="56" x="220" y="26" />
      <rect height="1.5" style={{ fill: COLOR.ink }} width="252" x="24" y="72" />
      {range(3).flatMap((col) =>
        lengths.map((length, line) => (
          <rect
            height="3.4"
            key={`${col}-${line}`}
            style={{ fill: COLOR.muted, opacity: 0.55 }}
            width={line === lengths.length - 1 ? length * 0.6 : length}
            x={24 + col * 90}
            y={86 + line * 12}
          />
        )),
      )}
    </>
  )
}

const Misregistered = () => (
  <>
    <circle cx="128" cy="102" r="64" style={{ fill: COLOR.navy, opacity: 0.78 }} />
    <circle cx="172" cy="98" r="64" style={{ fill: COLOR.accent, opacity: 0.72 }} />
    <rect height="2" style={{ fill: COLOR.ink }} width="252" x="24" y="176" />
  </>
)

const PressRules = () => (
  <>
    {range(9).map((index) => (
      <circle
        cx="150"
        cy="200"
        fill="none"
        key={index}
        r={34 + index * 19}
        strokeWidth="1.6"
        style={{ stroke: COLOR.ink, opacity: 0.8 }}
      />
    ))}
    <circle cx="150" cy="200" r="27" style={{ fill: COLOR.accent }} />
  </>
)

const Hatch = () => (
  <>
    {range(56).map((index) => (
      <line
        key={index}
        strokeWidth="1"
        style={{ stroke: COLOR.ink, opacity: 0.26 }}
        x1={index * 9}
        x2={index * 9 - 200}
        y1="0"
        y2="200"
      />
    ))}
    <rect height="104" style={{ fill: COLOR.navy }} width="126" x="62" y="48" />
    <circle cx="204" cy="88" r="38" style={{ fill: COLOR.accent }} />
  </>
)

const Registration = () => (
  <>
    <circle cx="150" cy="96" fill="none" r="52" strokeWidth="2" style={{ stroke: COLOR.ink }} />
    <circle cx="150" cy="96" fill="none" r="18" strokeWidth="4" style={{ stroke: COLOR.accent }} />
    <line strokeWidth="2" style={{ stroke: COLOR.ink }} x1="76" x2="224" y1="96" y2="96" />
    <line strokeWidth="2" style={{ stroke: COLOR.ink }} x1="150" x2="150" y1="22" y2="170" />
    {[COLOR.navy, COLOR.accent, COLOR.ink, COLOR.muted].map((fill, index) => (
      <rect height="12" key={index} style={{ fill }} width="12" x={24 + index * 16} y="168" />
    ))}
    <path
      d="M12 30V12h18M270 12h18v18M288 170v18h-18M30 188H12v-18"
      fill="none"
      strokeWidth="1.6"
      style={{ stroke: COLOR.ink }}
    />
  </>
)

const VARIANTS = [Halftone, PageColumns, Misregistered, PressRules, Hatch, Registration]

export const PLACEHOLDER_COUNT = VARIANTS.length

export const placeholderIndex = (seed: string) => hashSeed(seed) % PLACEHOLDER_COUNT

export function StoryPlaceholder({ className, seed }: { className?: string; seed: string }) {
  const Variant = VARIANTS[placeholderIndex(seed)]

  return (
    <svg
      aria-hidden="true"
      className={className}
      focusable="false"
      preserveAspectRatio="xMidYMid slice"
      viewBox="0 0 300 200"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect height="200" style={{ fill: COLOR.paper }} width="300" />
      <Variant />
    </svg>
  )
}
