"use client";

import type { CSSProperties } from "react";
import type { MoodId } from "@/lib/moods";
import { Moon, Sun, VeiledSun } from "@/components/mood/scenery";

/**
 * Ambient mood backdrop for the Explore header.
 *
 * Modelled on how weather apps handle "current conditions": the top of the
 * screen quietly becomes the weather instead of showing a card about it. Each
 * mood gets a small scene — sky wash, a light source, a distant ridge and the
 * landmark that names the mood (the cafe, the cabin, the palm) — held at low
 * opacity and masked away at every edge so it never resolves into a banner.
 * The landmark sits on the right, where the 3D book goes when no mood is set.
 *
 * Shapes deliberately echo the Top Shelf scenery on the profile page so both
 * surfaces read as the same world.
 */

type Particle = "rain" | "snow" | "stars" | "fireflies" | "waves" | "steam";

type Ridge = { kind: "skyline" | "hills" | "pines" | "countryside"; color: string };

type Landmark =
  | "cafe"
  | "cabin"
  | "palm"
  | "streetlamp"
  | "armchair"
  | "snowpines"
  | "train"
  | "rooftop";

/**
 * The sky only gets a light source if that mood's Top Shelf scene has one, and
 * it is the same `Sun` / `Moon` / `VeiledSun` art. Sizes are the Top Shelf
 * sizes scaled up by roughly 1.7, because this canvas is that much bigger and
 * a 40px moon would vanish in it.
 */
type Orb = {
  kind: "sun" | "moon" | "veiled";
  /** Parked in the top-right corner, high above the landmark below it. */
  position: string;
  size: string;
  tone?: string;
};

type AtmosConfig = {
  /** Wash that sets the weather of the whole header. */
  sky: string;
  orb: Orb | null;
  /** Null when the sky should stay clear. */
  cloudTint: string | null;
  /** Far silhouette along the bottom edge. */
  ridge: Ridge | null;
  landmark: Landmark | null;
  particles: Particle[];
  /** Deliberately restrained — this is behind live UI. */
  opacity: number;
};

const ATMOS: Record<MoodId, AtmosConfig> = {
  "rainy-nook": {
    sky: "linear-gradient(180deg, rgba(51,65,85,0.5) 0%, rgba(100,116,139,0.24) 52%, transparent 100%)",
    orb: { kind: "veiled", position: "right-[8%] top-[6%]", size: "h-28 w-28 blur-[12px]" },
    cloudTint: "rgba(100,116,139,0.85)",
    ridge: { kind: "skyline", color: "#3f4a5c" },
    landmark: "armchair",
    particles: ["rain"],
    opacity: 0.6,
  },
  "beach-drift": {
    sky: "linear-gradient(180deg, rgba(56,189,248,0.34) 0%, rgba(125,211,252,0.16) 50%, rgba(254,240,138,0.10) 100%)",
    orb: { kind: "sun", position: "right-[8%] top-[6%]", size: "h-28 w-28" },
    cloudTint: "rgba(255,255,255,0.9)",
    ridge: null,
    landmark: "palm",
    particles: ["waves"],
    opacity: 0.55,
  },
  "snow-window": {
    sky: "linear-gradient(180deg, rgba(30,58,95,0.5) 0%, rgba(125,211,252,0.18) 55%, transparent 100%)",
    // No sun or moon in the snow-window Top Shelf, so none here either.
    orb: null,
    cloudTint: "rgba(203,225,244,0.7)",
    ridge: { kind: "pines", color: "#22423c" },
    landmark: "snowpines",
    particles: ["snow"],
    opacity: 0.55,
  },
  "midnight-lamp": {
    sky: "linear-gradient(180deg, rgba(23,26,62,0.62) 0%, rgba(76,49,124,0.28) 55%, transparent 100%)",
    orb: { kind: "moon", position: "right-[8%] top-[6%]", size: "h-[68px] w-[68px]" },
    cloudTint: null,
    ridge: { kind: "skyline", color: "#241f3a" },
    landmark: "streetlamp",
    particles: ["stars"],
    opacity: 0.62,
  },
  "forest-cabin": {
    sky: "linear-gradient(180deg, rgba(5,46,33,0.55) 0%, rgba(16,185,129,0.14) 55%, transparent 100%)",
    orb: null,
    cloudTint: "rgba(148,180,164,0.45)",
    ridge: { kind: "pines", color: "#14372a" },
    landmark: "cabin",
    particles: ["fireflies"],
    opacity: 0.58,
  },
  "cafe-corner": {
    sky: "linear-gradient(180deg, rgba(251,191,36,0.28) 0%, rgba(217,119,6,0.16) 50%, transparent 100%)",
    orb: { kind: "sun", position: "right-[8%] top-[6%]", size: "h-[76px] w-[76px]" },
    cloudTint: "rgba(255,237,213,0.85)",
    ridge: null,
    landmark: "cafe",
    particles: ["steam"],
    opacity: 0.55,
  },
  "train-window": {
    sky: "linear-gradient(180deg, rgba(14,165,233,0.32) 0%, rgba(125,211,252,0.16) 52%, transparent 100%)",
    orb: {
      kind: "sun",
      position: "right-[8%] top-[6%]",
      size: "h-[76px] w-[76px]",
      tone: "text-orange-400",
    },
    cloudTint: "rgba(255,255,255,0.85)",
    ridge: { kind: "countryside", color: "#4e7c59" },
    landmark: "train",
    particles: [],
    opacity: 0.55,
  },
  "rooftop-dusk": {
    sky: "linear-gradient(180deg, rgba(168,85,247,0.34) 0%, rgba(249,115,22,0.22) 52%, transparent 100%)",
    orb: {
      kind: "sun",
      position: "right-[8%] top-[6%]",
      size: "h-[68px] w-[68px]",
      tone: "text-orange-400",
    },
    cloudTint: "rgba(253,186,116,0.5)",
    ridge: { kind: "skyline", color: "#3b2450" },
    landmark: "rooftop",
    particles: ["stars"],
    opacity: 0.6,
  },
};

function OrbArt({ orb }: { orb: Orb }) {
  const place = `${orb.position} ${orb.size}`;
  if (orb.kind === "moon") return <Moon className={place} />;
  if (orb.kind === "veiled") return <VeiledSun className={place} />;
  return <Sun className={orb.position} sizeClass={orb.size} toneClass={orb.tone} />;
}

/* ── Ridges: distant silhouettes stretched across the header ───────────── */

function RidgeArt({ ridge }: { ridge: Ridge }) {
  if (ridge.kind === "countryside") {
    // Rolling farmland for the train to cross. `slice` keeps the farmhouse and
    // trees in proportion at any header width.
    return (
      <svg
        viewBox="0 0 480 70"
        preserveAspectRatio="xMidYMax slice"
        aria-hidden
        className="rq-atmos-ridge"
      >
        {/* Everything stands on y=42 — the height the rails cross this layer,
            so the train runs in front of the farm rather than through it. */}
        <path
          d="M0 42 V30 Q60 12 120 26 Q190 40 250 22 Q320 4 380 22 Q440 36 480 26 V42 Z"
          fill={ridge.color}
          opacity="0.45"
        />
        <path
          d="M0 42 V36 Q70 22 140 34 Q210 46 280 30 Q350 16 420 32 Q452 39 480 35 V42 Z"
          fill={ridge.color}
          opacity="0.75"
        />
        {/* farmhouse, sitting on the ridge line */}
        <g transform="translate(292 14)">
          <path d="M0 13 L15 0 L30 13 Z" fill="#8a3b2f" />
          <rect x="3" y="13" width="24" height="15" fill="#e8dcc4" />
          <rect x="11" y="19" width="8" height="9" fill="#6b4a2f" />
        </g>
        {[
          { x: 36, s: 1 },
          { x: 74, s: 0.8 },
          { x: 160, s: 1.15 },
          { x: 196, s: 0.9 },
          { x: 392, s: 1.05 },
          { x: 430, s: 0.85 },
        ].map((t, i) => (
          <g key={i} transform={`translate(${t.x} ${42 - 19 * t.s}) scale(${t.s})`}>
            <rect x="-1.6" y="5" width="3.2" height="14" fill="#4a3826" />
            <circle cx="-5" cy="7" r="6" fill="#357c50" />
            <circle cx="5" cy="7" r="6" fill="#2a6040" />
            <circle cx="0" cy="2" r="8" fill="#2f6b45" />
          </g>
        ))}
        {/* the field the track is laid across */}
        <rect x="0" y="41" width="480" height="29" fill={ridge.color} />
      </svg>
    );
  }

  if (ridge.kind === "hills") {
    return (
      <svg
        viewBox="0 0 240 60"
        preserveAspectRatio="none"
        aria-hidden
        className="rq-atmos-ridge"
      >
        <path d="M0 60 Q60 18 120 38 T240 26 V60 Z" fill={ridge.color} />
      </svg>
    );
  }

  if (ridge.kind === "pines") {
    // `slice` keeps the trees in proportion at any header width; `none` would
    // smear them sideways on wide screens.
    return (
      <svg
        viewBox="0 0 480 60"
        preserveAspectRatio="xMidYMax slice"
        aria-hidden
        className="rq-atmos-ridge"
      >
        <path d="M0 60 V46 h480 V60 Z" fill={ridge.color} />
        {Array.from({ length: 35 }).map((_, i) => {
          const x = i * 14 + (i % 3) * 3;
          const h = 20 + (i % 4) * 8;
          return (
            <path
              key={i}
              d={`M${x} ${48 - h} L${x + 8} 50 L${x - 8} 50 Z`}
              fill={ridge.color}
            />
          );
        })}
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 240 70"
      preserveAspectRatio="none"
      aria-hidden
      className="rq-atmos-ridge"
    >
      <path
        d="M0 70 V42 h16 V28 h12 V42 h14 V18 h14 V42 h18 V32 h12 V14 h10 V32 h16 V46 h14 V24 h12 V46 h20 V36 h12 V52 h16 V30 h12 V52 h20 V40 h14 V70 Z"
        fill={ridge.color}
      />
      {[
        [24, 34],
        [70, 24],
        [120, 20],
        [166, 30],
        [210, 46],
      ].map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="3" height="3" fill="#fbbf24" opacity="0.9" />
      ))}
    </svg>
  );
}

/* ── Landmarks: the thing that names the mood ──────────────────────────── */

function CafeArt() {
  return (
    <svg viewBox="0 0 130 108" aria-hidden>
      <rect x="12" y="34" width="106" height="70" rx="4" fill="#f4e3c6" />
      <rect x="8" y="23" width="114" height="16" rx="3" fill="#6b4a2f" />
      <text
        x="65"
        y="35"
        textAnchor="middle"
        fontSize="10"
        fontWeight="800"
        letterSpacing="2"
        fill="#ffe6b3"
      >
        CAFÉ
      </text>
      {Array.from({ length: 7 }).map((_, i) => (
        <path
          key={i}
          d={`M${16 + i * 14} 44 h14 l-4 9 h-14 Z`}
          fill={i % 2 ? "#e0705a" : "#f7ecd6"}
        />
      ))}
      <rect x="15" y="42" width="100" height="3" fill="#9c3f30" />
      <rect x="20" y="58" width="56" height="42" rx="2" fill="#ffd77a" stroke="#8a5a33" strokeWidth="2.5" />
      <line x1="48" y1="58" x2="48" y2="100" stroke="#8a5a33" strokeWidth="1.5" />
      <line x1="20" y1="79" x2="76" y2="79" stroke="#8a5a33" strokeWidth="1.5" />
      <rect x="84" y="60" width="26" height="44" rx="2" fill="#8a5a33" />
      <rect x="88" y="64" width="18" height="17" rx="1.5" fill="#ffd77a" opacity="0.85" />
      <path d="M114 92 c-4 -3 -5 -10 -2 -15 c2 4 3 10 2 15" fill="#3f8f5f" />
      <path d="M114 92 c4 -3 5 -10 2 -15 c-2 4 -3 10 -2 15" fill="#4aa66d" />
      <path d="M110 92 h8 l-1 12 h-6 Z" fill="#c9703f" />
    </svg>
  );
}

function CabinArt() {
  return (
    <svg viewBox="0 0 140 120" aria-hidden>
      <rect x="92" y="14" width="14" height="26" rx="2" fill="#6d4a30" />
      <rect x="89" y="11" width="20" height="7" rx="2" fill="#5a3b25" />
      <path d="M70 8 L136 54 H4 Z" fill="#3f2e1e" />
      <path d="M70 8 L136 54 H120 L70 19 Z" fill="#4c3826" />
      <rect x="2" y="52" width="136" height="6" rx="3" fill="#33251a" />
      <rect x="18" y="58" width="104" height="58" rx="3" fill="#8a5e39" />
      {[64, 71, 78, 85, 92, 99, 106, 113].map((y) => (
        <line key={y} x1="18" y1={y} x2="122" y2={y} stroke="#6f4a2c" strokeWidth="1.4" />
      ))}
      <rect x="28" y="66" width="26" height="22" rx="2" fill="#ffd071" stroke="#5a3b25" strokeWidth="2.5" />
      <line x1="41" y1="66" x2="41" y2="88" stroke="#5a3b25" strokeWidth="1.6" />
      <rect x="90" y="66" width="24" height="22" rx="2" fill="#ffd071" stroke="#5a3b25" strokeWidth="2.5" />
      <line x1="102" y1="66" x2="102" y2="88" stroke="#5a3b25" strokeWidth="1.6" />
      <rect x="62" y="72" width="22" height="44" rx="2" fill="#5c3d24" />
      <rect x="65" y="76" width="16" height="12" rx="1.5" fill="#ffce74" opacity="0.8" />
    </svg>
  );
}

function PalmArt() {
  return (
    <svg viewBox="0 0 180 132" aria-hidden>
      {/* Beach umbrella. Radial wedges from the apex down to a dipping rim —
          concentric arcs would just read as a rainbow. */}
      <rect x="127" y="26" width="4" height="100" rx="2" fill="#b98a5e" />
      {(
        [
          [92, 58, 104.3, 63],
          [104.3, 63, 116.6, 66],
          [116.6, 66, 129, 67],
          [129, 67, 141.3, 66],
          [141.3, 66, 153.7, 63],
          [153.7, 63, 166, 58],
        ] as const
      ).map(([x1, y1, x2, y2], i) => (
        <path
          key={i}
          d={`M129 24 L${x1} ${y1} L${x2} ${y2} Z`}
          fill={i % 2 ? "#f7ecd6" : "#e0705a"}
        />
      ))}
      <rect x="127.5" y="16" width="3" height="10" rx="1.5" fill="#b98a5e" />
      {/* palm */}
      <path
        d="M56 128 q-8 -48 4 -82"
        fill="none"
        stroke="#8a5a33"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <g fill="#2f9e6b">
        <path d="M60 44 q-34 -12 -50 8 q28 -6 50 -2 Z" />
        <path d="M60 44 q34 -14 52 4 q-30 -8 -52 2 Z" />
        <path d="M60 44 q-26 -30 -8 -42 q-2 24 8 42 Z" />
        <path d="M60 44 q26 -28 46 -22 q-26 4 -46 22 Z" />
      </g>
      <g fill="#25845a">
        <path d="M60 44 q-30 6 -38 26 q24 -18 38 -26 Z" />
        <path d="M60 44 q30 8 36 28 q-22 -20 -36 -28 Z" />
      </g>
      <circle cx="60" cy="42" r="5" fill="#8a5a33" />
      {/* coconuts */}
      <circle cx="52" cy="50" r="4" fill="#6f4a2c" />
      <circle cx="68" cy="52" r="4" fill="#6f4a2c" />
    </svg>
  );
}

function StreetLampArt() {
  return (
    <svg viewBox="0 0 150 150" aria-hidden>
      <ellipse cx="62" cy="34" rx="28" ry="21" fill="rgba(251,191,36,0.3)" />
      <rect x="14" y="18" width="6" height="128" rx="3" fill="#3c4a63" />
      <rect x="6" y="140" width="22" height="7" rx="3" fill="#2a3448" />
      <path d="M17 20 q28 -14 40 8" fill="none" stroke="#3c4a63" strokeWidth="6" strokeLinecap="round" />
      <path d="M50 24 h18 l-4 11 h-10 Z" fill="#4b5b76" />
      <ellipse cx="59" cy="35" rx="7" ry="3" fill="#ffe7a3" />
      {/* park bench under the lamp — a lone pole reads as too empty */}
      <rect x="82" y="98" width="60" height="4" rx="2" fill="#6b5238" />
      <rect x="82" y="106" width="60" height="4" rx="2" fill="#6b5238" />
      <rect x="80" y="116" width="64" height="6" rx="3" fill="#5b4630" />
      <rect x="84" y="96" width="4" height="26" fill="#3c4a63" />
      <rect x="136" y="96" width="4" height="26" fill="#3c4a63" />
      <rect x="86" y="122" width="4" height="24" fill="#3c4a63" />
      <rect x="134" y="122" width="4" height="24" fill="#3c4a63" />
    </svg>
  );
}

function ArmchairArt() {
  return (
    <svg viewBox="0 0 176 134" aria-hidden>
      {/* floor lamp */}
      <ellipse cx="150" cy="40" rx="24" ry="19" fill="rgba(251,191,36,0.24)" />
      <rect x="148" y="42" width="4" height="86" rx="2" fill="#4b5563" />
      <rect x="138" y="124" width="24" height="6" rx="3" fill="#374151" />
      <path d="M136 42 h28 l-7 -20 h-14 Z" fill="#f6c453" />
      <path d="M136 42 h28 l-2 -6 h-24 Z" fill="#fcd97a" />
      {/* armchair */}
      <path d="M34 128 v-52 a18 18 0 0 1 18 -18 h40 a18 18 0 0 1 18 18 v52 Z" fill="#7c4a52" />
      <rect x="44" y="72" width="56" height="34" rx="8" fill="#96606b" />
      <rect x="24" y="86" width="20" height="42" rx="9" fill="#6d3f47" />
      <rect x="100" y="86" width="20" height="42" rx="9" fill="#6d3f47" />
      <rect x="30" y="100" width="84" height="28" rx="10" fill="#8d5560" />
      {/* open book resting on the seat */}
      <path d="M56 100 l16 -5 v14 l-16 5 Z" fill="#f4e3c6" />
      <path d="M88 100 l-16 -5 v14 l16 5 Z" fill="#e8d3ae" />
      {/* mug on the floor */}
      <rect x="126" y="116" width="12" height="12" rx="2" fill="#c98a58" />
      <path d="M138 119 a4 4 0 0 1 0 7" fill="none" stroke="#c98a58" strokeWidth="2" />
    </svg>
  );
}

function SnowPinesArt() {
  return (
    <svg viewBox="0 0 170 140" aria-hidden>
      {[
        { x: 34, s: 1, c: "#1f5137" },
        { x: 92, s: 1.24, c: "#1a4530" },
        { x: 138, s: 0.82, c: "#22593c" },
      ].map((t, i) => (
        <g key={i} transform={`translate(${t.x} ${140 - 120 * t.s}) scale(${t.s})`}>
          <rect x="-4" y="92" width="8" height="28" rx="2" fill="#5b3a1e" />
          <path d="M0 4 L17 42 L-17 42 Z" fill={t.c} />
          <path d="M0 26 L22 72 L-22 72 Z" fill={t.c} />
          <path d="M0 50 L27 100 L-27 100 Z" fill={t.c} />
          {/* snow settled on each tier */}
          <path d="M0 4 L11 28 q-11 6 -22 0 Z" fill="#eef6ff" opacity="0.92" />
          <path d="M0 26 L14 56 q-14 7 -28 0 Z" fill="#eef6ff" opacity="0.85" />
          <path d="M0 50 L18 84 q-18 8 -36 0 Z" fill="#eef6ff" opacity="0.78" />
        </g>
      ))}
    </svg>
  );
}

/** One locomotive plus five carriages, drawn from `s` rightwards. */
function TrainConsist({ s }: { s: number }) {
  return (
    <g transform={`translate(${s} 0)`}>
      {/* smoke trailing back off the chimney */}
      {[0, 1, 2].map((i) => (
        <circle
          key={i}
          className="rq-atmos-puff"
          cx="31"
          cy="32"
          r={4 + i * 1.6}
          fill="#eef3f8"
          style={{ animationDelay: `${i * 1.2}s` }}
        />
      ))}

      {[0, 1, 2, 3, 4].map((i) => {
        const c = 132 + i * 68;
        return (
          <g key={i}>
            <rect x={c - 2} y="50" width="66" height="7" rx="3.5" fill="#4a5058" />
            <rect x={c} y="56" width="62" height="34" rx="3" fill="#8a4a3c" />
            <rect x={c} y="78" width="62" height="3" fill="#6f3a2f" />
            {[0, 1, 2, 3].map((j) => (
              <rect
                key={j}
                x={c + 7 + j * 14}
                y="61"
                width="11"
                height="13"
                rx="1.5"
                fill="#ffd77a"
              />
            ))}
            <rect x={c} y="88" width="62" height="5" fill="#5c3229" />
            {[13, 25, 39, 51].map((w) => (
              <g key={w}>
                <circle cx={c + w} cy="99" r="5" fill="#1f2937" />
                <circle cx={c + w} cy="99" r="1.8" fill="#566270" />
              </g>
            ))}
            <rect x={c + 62} y="93" width="6" height="2.5" fill="#4b5563" />
          </g>
        );
      })}

      {/* locomotive */}
      <path d="M12 88 L2 102 L20 102 Z" fill="#39414d" />
      <rect x="12" y="88" width="110" height="8" rx="2" fill="#39414d" />
      <rect x="16" y="56" width="70" height="32" rx="15" fill="#2b3a45" />
      <circle cx="24" cy="72" r="16" fill="#222c36" />
      <circle cx="24" cy="70" r="5" fill="#ffe7a3" />
      <rect x="26" y="40" width="11" height="18" rx="2" fill="#222c36" />
      <rect x="23" y="36" width="17" height="6" rx="2.5" fill="#222c36" />
      <rect x="52" y="45" width="13" height="12" rx="6" fill="#2b3a45" />
      <rect x="70" y="48" width="10" height="9" rx="4.5" fill="#2b3a45" />
      <rect x="86" y="46" width="36" height="42" rx="3" fill="#24313d" />
      <rect x="82" y="41" width="44" height="6" rx="3" fill="#1b2530" />
      <rect x="94" y="53" width="19" height="15" rx="2" fill="#ffd77a" />
      <rect x="36" y="97" width="48" height="3" rx="1.5" fill="#6b7280" />
      {[36, 60, 84].map((x) => (
        <g key={x}>
          <circle cx={x} cy="94" r="10" fill="#1f2937" />
          <circle cx={x} cy="94" r="3.6" fill="#566270" />
        </g>
      ))}
      <circle cx="22" cy="98" r="6" fill="#1f2937" />
      <circle cx="22" cy="98" r="2.2" fill="#566270" />
    </g>
  );
}

/**
 * A long train crossing the countryside. The artwork is two identical 800-unit
 * sections on one continuous track; the wrapper marquees it left by exactly
 * half its width, so the train rolls on forever while the sleepers (spaced to
 * divide 800 evenly) land back on themselves and the rails read as stationary.
 * The section is far wider than the train so it stays long and low rather than
 * rearing up over the header.
 */
function TrainArt() {
  return (
    <svg viewBox="0 0 1600 130" aria-hidden>
      <rect x="0" y="112" width="1600" height="18" fill="#6f6350" />
      {Array.from({ length: 100 }).map((_, i) => (
        <rect key={i} x={i * 16} y="106" width="9" height="7" rx="1" fill="#5b4630" />
      ))}
      <rect x="0" y="103" width="1600" height="3.2" fill="#9aa3ad" />
      <rect x="0" y="99.5" width="1600" height="2" fill="#7d868f" />
      <TrainConsist s={0} />
      <TrainConsist s={800} />
    </svg>
  );
}

function RooftopArt() {
  return (
    <svg viewBox="0 0 190 132" aria-hidden>
      {/* string lights along the top; bulbs sit on the sag of the wire */}
      <path d="M4 14 Q52 40 100 20 Q148 40 188 14" fill="none" stroke="#5b4a6b" strokeWidth="1.6" />
      {(
        [
          [22, 25, "#fbbf24"],
          [58, 31, "#f97373"],
          [100, 21, "#34d399"],
          [140, 31, "#38bdf8"],
          [176, 18, "#f59e0b"],
        ] as const
      ).map(([x, y, fill], i) => (
        <circle key={i} cx={x} cy={y} r="3.4" fill={fill} />
      ))}
      {/* railing, drawn before the furniture so the lounger sits in front */}
      <rect x="0" y="92" width="190" height="4" rx="2" fill="#4a3f5c" />
      <rect x="0" y="126" width="190" height="6" rx="2" fill="#3b3049" />
      {[10, 44, 78, 112, 146, 180].map((x) => (
        <rect key={x} x={x} y="92" width="4" height="36" fill="#4a3f5c" />
      ))}
      {/* reclining lounger in profile */}
      <path d="M34 122 L54 76 L65 80 L45 122 Z" fill="#e0705a" />
      <path d="M42 106 h54 l-3 14 h-54 Z" fill="#e0705a" />
      <rect x="40" y="118" width="4" height="12" rx="2" fill="#8a5a33" />
      <rect x="90" y="118" width="4" height="12" rx="2" fill="#8a5a33" />
      {/* side table with a mug */}
      <rect x="104" y="102" width="24" height="4" rx="2" fill="#8a5a33" />
      <rect x="114" y="106" width="4" height="22" rx="2" fill="#8a5a33" />
      <rect x="107" y="94" width="9" height="8" rx="1.5" fill="#c98a58" />
      {/* potted plant in the corner */}
      <path d="M160 96 c-6 -5 -7 -16 -3 -23 c3 6 5 15 3 23" fill="#3f8f5f" />
      <path d="M160 96 c6 -5 7 -16 3 -23 c-3 6 -5 15 -3 23" fill="#4aa66d" />
      <path d="M154 96 h13 l-2 18 h-9 Z" fill="#c9703f" />
    </svg>
  );
}

const LANDMARK_ART: Record<Landmark, () => React.ReactElement> = {
  cafe: CafeArt,
  cabin: CabinArt,
  palm: PalmArt,
  streetlamp: StreetLampArt,
  armchair: ArmchairArt,
  snowpines: SnowPinesArt,
  train: TrainArt,
  rooftop: RooftopArt,
};

/** Landmarks that span the header instead of standing on the right. */
const LANDMARK_MODIFIER: Partial<Record<Landmark, string>> = {
  train: "rq-atmos-landmark--train",
};

/* ── Particles ─────────────────────────────────────────────────────────── */

const RAIN = Array.from({ length: 26 }, (_, i) => ({
  left: `${(i * 41) % 100}%`,
  height: 10 + (i % 4) * 6,
  delay: `${((i * 7) % 13) * 0.12}s`,
  duration: `${0.8 + (i % 5) * 0.14}s`,
  opacity: 0.3 + (i % 3) * 0.2,
}));

const SNOW = Array.from({ length: 16 }, (_, i) => ({
  left: `${(i * 53) % 100}%`,
  size: 3 + (i % 3),
  delay: `${(i % 7) * 0.9}s`,
  duration: `${6 + (i % 4) * 1.6}s`,
}));

const STARS = Array.from({ length: 22 }, (_, i) => ({
  top: `${5 + ((i * 29) % 52)}%`,
  left: `${(i * 37) % 97}%`,
  size: i % 5 === 0 ? 3 : 2,
  delay: `${(i % 6) * 0.6}s`,
  duration: `${2.4 + (i % 4) * 0.7}s`,
}));

const FIREFLIES = Array.from({ length: 9 }, (_, i) => ({
  top: `${18 + ((i * 31) % 55)}%`,
  left: `${6 + ((i * 43) % 88)}%`,
  delay: `${(i % 5) * 0.8}s`,
  duration: `${3 + (i % 3)}s`,
}));

const WAVES = Array.from({ length: 6 }, (_, i) => ({
  top: `${62 + (i % 3) * 8}%`,
  left: `${4 + i * 12}%`,
  width: `${7 + (i % 3) * 5}%`,
  delay: `${i * 0.7}s`,
  duration: `${4.5 + (i % 3)}s`,
}));

const STEAM = Array.from({ length: 5 }, (_, i) => ({
  left: `${14 + i * 12}%`,
  height: 26 + (i % 3) * 10,
  delay: `${i * 1.1}s`,
  duration: `${4 + (i % 3) * 0.8}s`,
}));

function Particles({ kind }: { kind: Particle }) {
  switch (kind) {
    case "rain":
      return (
        <>
          {RAIN.map((r, i) => (
            <span
              key={i}
              className="rq-atmos-rain"
              style={{
                left: r.left,
                height: r.height,
                opacity: r.opacity,
                animationDelay: r.delay,
                animationDuration: r.duration,
              }}
            />
          ))}
        </>
      );
    case "snow":
      return (
        <>
          {SNOW.map((s, i) => (
            <span
              key={i}
              className="rq-atmos-snow"
              style={{
                left: s.left,
                height: s.size,
                width: s.size,
                animationDelay: s.delay,
                animationDuration: s.duration,
              }}
            />
          ))}
        </>
      );
    case "stars":
      return (
        <>
          {STARS.map((s, i) => (
            <span
              key={i}
              className="rq-atmos-star"
              style={{
                top: s.top,
                left: s.left,
                height: s.size,
                width: s.size,
                animationDelay: s.delay,
                animationDuration: s.duration,
              }}
            />
          ))}
        </>
      );
    case "fireflies":
      return (
        <>
          {FIREFLIES.map((f, i) => (
            <span
              key={i}
              className="rq-atmos-fly"
              style={{
                top: f.top,
                left: f.left,
                animationDelay: f.delay,
                animationDuration: f.duration,
              }}
            />
          ))}
        </>
      );
    case "waves":
      return (
        <>
          {WAVES.map((w, i) => (
            <span
              key={i}
              className="rq-atmos-wave"
              style={{
                top: w.top,
                left: w.left,
                width: w.width,
                animationDelay: w.delay,
                animationDuration: w.duration,
              }}
            />
          ))}
        </>
      );
    case "steam":
      return (
        <>
          {STEAM.map((s, i) => (
            <span
              key={i}
              className="rq-atmos-steam"
              style={{
                left: s.left,
                height: s.height,
                animationDelay: s.delay,
                animationDuration: s.duration,
              }}
            />
          ))}
        </>
      );
  }
}

/** Three soft banks of cloud, hand-placed to stay clear of the headline. */
const CLOUDS = [
  { top: "6%", left: "-4%", w: "34%", h: "38%", delay: "0s" },
  { top: "-6%", left: "46%", w: "30%", h: "34%", delay: "-9s" },
  { top: "20%", left: "72%", w: "32%", h: "30%", delay: "-17s" },
];

export function MoodAtmosphere({ mood }: { mood: MoodId }) {
  const cfg = ATMOS[mood];
  if (!cfg) return null;

  const Art = cfg.landmark ? LANDMARK_ART[cfg.landmark] : null;
  const modifier = cfg.landmark ? LANDMARK_MODIFIER[cfg.landmark] : undefined;

  return (
    <div
      aria-hidden
      className="rq-atmos"
      data-mood={mood}
      style={{ "--atmos-o": cfg.opacity } as CSSProperties}
    >
      <span className="rq-atmos-sky" style={{ background: cfg.sky }} />

      {cfg.orb ? <OrbArt orb={cfg.orb} /> : null}

      {cfg.cloudTint
        ? CLOUDS.map((c, i) => (
            <span
              key={i}
              className="rq-atmos-cloud"
              style={{
                top: c.top,
                left: c.left,
                width: c.w,
                height: c.h,
                animationDelay: c.delay,
                background: `radial-gradient(58% 100% at 50% 58%, ${cfg.cloudTint}, transparent 72%)`,
              }}
            />
          ))
        : null}

      {cfg.ridge ? <RidgeArt ridge={cfg.ridge} /> : null}

      {Art ? (
        <span className={`rq-atmos-landmark ${modifier ?? ""}`.trim()}>
          <Art />
        </span>
      ) : null}

      {cfg.particles.map((p) => (
        <Particles key={p} kind={p} />
      ))}
    </div>
  );
}
