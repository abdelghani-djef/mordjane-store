import { cn } from "@/lib/utils";

/**
 * Illustrated stand-ins used until real photos are uploaded. Products are drawn in a container
 * (glass jar, tub, bucket, pouch, box) filled with the product's own colour. The container
 * follows the product type and the weight, so the picture changes when a customer picks
 * another size.
 */

type ContainerKind = "jar" | "tub" | "bucket" | "bag" | "box";

type Flavour = {
  fill: string; // the spread / powder colour
  deep: string; // shading of the fill
  tint: [string, string]; // backdrop gradient
  crunchy?: boolean; // "rocher": crunchy pieces on top
};

const FLAVOURS: Record<string, Flavour> = {
  hazelnut: { fill: "#C98B4E", deep: "#A56C35", tint: ["#FFF4E6", "#F7DFC0"] },
  cocoa: { fill: "#6B3A24", deep: "#4F2A19", tint: ["#FBEFE6", "#EFD9C8"] },
  peanut: { fill: "#D9A05A", deep: "#B9803F", tint: ["#FFF6E4", "#F8E1B8"] },
  pistachio: { fill: "#9DBF5B", deep: "#7E9F42", tint: ["#F4F8EA", "#E1ECC9"] },
  dark: { fill: "#3E2217", deep: "#2A160E", tint: ["#F8EFEA", "#EBDDD3"] },
  white: { fill: "#F5E9D3", deep: "#E2D0B0", tint: ["#FFF8EE", "#F4E8D6"] },
  powder: { fill: "#5A3222", deep: "#42241A", tint: ["#FAEEE6", "#EDD8CA"] },
  cream: { fill: "#FFF9F0", deep: "#EEDFC9", tint: ["#FFF7EF", "#F5E5D2"] },
  syrup: { fill: "#EAC46F", deep: "#D2A74C", tint: ["#FFF7E5", "#F6E3B4"] },
};

function pickFlavour(hint: string): Flavour {
  const s = hint.toLowerCase();
  let base: Flavour;
  if (/pistach/.test(s)) base = FLAVOURS.pistachio;
  else if (/cacahu|peanut/.test(s)) base = FLAVOURS.peanut;
  else if (/blanc|white/.test(s)) base = FLAVOURS.white;
  // The glazes category tile shows dark glaze; individual glazes match their own flavour.
  else if (/noir|dark|^\s*glazes\s*$/.test(s)) base = FLAVOURS.dark;
  else if (/chantilly|whip/.test(s)) base = FLAVOURS.cream;
  else if (/trimoline|sucre|sugar|syrup/.test(s)) base = FLAVOURS.syrup;
  else if (/cacao|cocoa-powder/.test(s)) base = FLAVOURS.powder;
  else if (/tartiner|cocoa|choc/.test(s)) base = FLAVOURS.cocoa;
  else base = FLAVOURS.hazelnut;
  return /rocher|crunch/.test(s) ? { ...base, crunchy: true } : base;
}

/** The container to draw: bulk weights come in buckets, the rest follows the product type. */
function containerFor(hint: string, grams?: number | null): ContainerKind {
  const s = hint.toLowerCase();
  let kind: ContainerKind = "jar";
  // Rocher shows its crunchy top in an open tub; glazes come in tubs too.
  if (/rocher|crunch|glaz|glac|trimoline/.test(s)) kind = "tub";
  else if (/cacao|cocoa-powder/.test(s)) kind = "box";
  else if (/baking|patis|chantilly|sucre/.test(s)) kind = "bag";
  if (!grams) return kind;
  if (grams >= 2000 && (kind === "jar" || kind === "tub")) return "bucket";
  if (grams >= 500 && kind === "jar") return "tub";
  return kind;
}

const RED = "#C8202B";
const RED_DEEP = "#A3161F";
const LABEL = "#FFFBF5";

function Crunch({ x, y, w }: { x: number; y: number; w: number }) {
  const bits = [0.12, 0.3, 0.46, 0.63, 0.8, 0.22, 0.55, 0.72];
  return (
    <g>
      {bits.map((f, i) => (
        <circle
          key={i}
          cx={x + f * w}
          cy={y + (i % 3) * 3}
          r={i % 2 ? 2.6 : 3.4}
          fill={i % 3 ? "#B87A3E" : "#E6BD86"}
        />
      ))}
    </g>
  );
}

/** Hazelnut (on labels, scattered in the hero): round brown nut, pale base, small tip. */
function LabelNut({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path
        d="M0 -8.5 C 7.5 -8, 8.6 1, 7.2 5 L -7.2 5 C -8.6 1, -7.5 -8, 0 -8.5 Z"
        fill="#B0703D"
      />
      <path
        d="M-7.2 4.6 C -6.4 8.8, 6.4 8.8, 7.2 4.6 C 3.5 6.1, -3.5 6.1, -7.2 4.6 Z"
        fill="#EBD2A6"
      />
      <path d="M0 -8.5 L 1.4 -10.8 L -1.2 -10.6 Z" fill="#7A4520" />
      <ellipse cx="-3" cy="-3" rx="1.8" ry="3" fill="white" opacity=".3" />
    </g>
  );
}

function Jar({ f }: { f: Flavour }) {
  return (
    <g>
      <ellipse cx="100" cy="170" rx="46" ry="7" fill="#000" opacity=".08" />
      {/* glass body with the spread inside */}
      <rect x="58" y="62" width="84" height="108" rx="18" fill={f.fill} />
      <rect x="58" y="62" width="84" height="108" rx="18" fill="white" opacity=".12" />
      <rect x="64" y="70" width="10" height="92" rx="5" fill="white" opacity=".28" />
      {/* label */}
      <rect x="58" y="92" width="84" height="50" fill={LABEL} />
      <rect x="58" y="92" width="84" height="8" fill={RED} />
      <LabelNut x={100} y={120} s={1.3} />
      {/* lid */}
      <rect x="54" y="40" width="92" height="26" rx="8" fill={RED} />
      <rect x="54" y="58" width="92" height="8" rx="3" fill={RED_DEEP} />
      <rect x="60" y="44" width="80" height="4" rx="2" fill="white" opacity=".25" />
    </g>
  );
}

function Tub({ f }: { f: Flavour }) {
  return (
    <g>
      <ellipse cx="100" cy="162" rx="58" ry="8" fill="#000" opacity=".08" />
      <path d="M44 84 L156 84 L148 160 Q100 168 52 160 Z" fill={f.fill} />
      <path d="M44 84 L156 84 L148 160 Q100 168 52 160 Z" fill="white" opacity=".1" />
      <path d="M50 104 L150 104 L146 140 L54 140 Z" fill={LABEL} />
      <rect x="50" y="104" width="100" height="7" fill={RED} />
      <LabelNut x={100} y={124} s={1.1} />
      {/* lid (closed, so no crunchy topping shows) */}
      <rect x="38" y="68" width="124" height="18" rx="8" fill={RED} />
      <rect x="44" y="72" width="112" height="4" rx="2" fill="white" opacity=".25" />
    </g>
  );
}

function Bucket({ f }: { f: Flavour }) {
  return (
    <g>
      <ellipse cx="100" cy="172" rx="62" ry="8" fill="#000" opacity=".08" />
      {/* handle */}
      <path d="M44 72 C 44 20, 156 20, 156 72" fill="none" stroke="#8C8C8C" strokeWidth="4" />
      {/* pail */}
      <path d="M40 68 L160 68 L150 168 Q100 176 50 168 Z" fill={f.tint[1]} />
      <path d="M40 68 L160 68 L150 168 Q100 176 50 168 Z" fill={f.fill} opacity=".85" />
      <path d="M46 92 L154 92 L149 150 L51 150 Z" fill={LABEL} />
      <rect x="46" y="92" width="108" height="8" fill={RED} />
      <LabelNut x={100} y={120} s={1.4} />
      <rect x="84" y="136" width="32" height="6" rx="3" fill={f.fill} />
      {/* lid rim */}
      <rect x="34" y="58" width="132" height="16" rx="6" fill={RED} />
      <rect x="40" y="62" width="120" height="3" rx="1.5" fill="white" opacity=".3" />
    </g>
  );
}

function Bag({ f }: { f: Flavour }) {
  return (
    <g>
      <ellipse cx="100" cy="172" rx="48" ry="7" fill="#000" opacity=".08" />
      <path d="M58 40 L142 40 L150 150 Q150 170 130 170 L70 170 Q50 170 50 150 Z" fill={LABEL} />
      <path d="M58 40 L142 40 L143 58 L57 58 Z" fill={RED} />
      <rect x="60" y="64" width="80" height="3" rx="1.5" fill={RED_DEEP} opacity=".5" />
      <circle cx="100" cy="116" r="30" fill={f.fill} />
      <circle cx="92" cy="108" r="8" fill="white" opacity=".25" />
      {f.crunchy && <Crunch x={76} y={112} w={48} />}
    </g>
  );
}

function Box({ f }: { f: Flavour }) {
  return (
    <g>
      <ellipse cx="100" cy="172" rx="46" ry="7" fill="#000" opacity=".08" />
      <rect x="60" y="46" width="80" height="124" rx="6" fill={RED} />
      <rect x="60" y="46" width="80" height="16" rx="6" fill={RED_DEEP} />
      <rect x="68" y="80" width="64" height="64" rx="32" fill={LABEL} />
      {/* a heap of powder on the label */}
      <path d="M78 130 Q100 92 122 130 Z" fill={f.fill} />
      <circle cx="94" cy="118" r="4" fill="white" opacity=".2" />
    </g>
  );
}

function Container({ kind, f }: { kind: ContainerKind; f: Flavour }) {
  switch (kind) {
    case "tub":
      return <Tub f={f} />;
    case "bucket":
      return <Bucket f={f} />;
    case "bag":
      return <Bag f={f} />;
    case "box":
      return <Box f={f} />;
    default:
      return <Jar f={f} />;
  }
}

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return h;
}

export function ProductArt({
  hint,
  grams,
  seed,
  className,
  label,
}: {
  /** Category slug and/or product slug: picks the flavour colour and the container. */
  hint: string;
  /** Weight of the size shown, if any: bigger sizes are drawn in bigger containers. */
  grams?: number | null;
  seed?: string | number;
  className?: string;
  label?: string;
}) {
  const f = pickFlavour(hint);
  const kind = containerFor(hint, grams);
  const gid = `pa-${kind}-${hash(`${hint}-${seed ?? ""}`).toString(36)}`;

  return (
    <svg
      viewBox="0 0 200 200"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("size-full", className)}
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor={f.tint[0]} />
          <stop offset="1" stopColor={f.tint[1]} />
        </linearGradient>
      </defs>
      <rect width="200" height="200" fill={`url(#${gid})`} />
      <g transform="translate(0 4)">
        <Container kind={kind} f={f} />
      </g>
    </svg>
  );
}

/**
 * Hero illustration: an open jar of hazelnut cream with a swirl rising, the bulk bucket behind
 * it, a loaded spoon and hazelnuts in front — retail and professional formats together.
 */
export function HeroSpreadArt({ className, label }: { className?: string; label?: string }) {
  const hz = FLAVOURS.hazelnut;
  return (
    <svg
      viewBox="0 0 440 400"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("size-full", className)}
    >
      {/* bucket, back left */}
      <g transform="translate(0 30) scale(1.2)">
        <Bucket f={FLAVOURS.cocoa} />
      </g>
      {/* open jar, front right */}
      <g transform="translate(180 90)">
        <ellipse cx="110" cy="262" rx="92" ry="12" fill="#000" opacity=".1" />
        <rect x="30" y="70" width="160" height="190" rx="30" fill={hz.fill} />
        <rect x="30" y="70" width="160" height="190" rx="30" fill="white" opacity=".12" />
        <rect x="42" y="84" width="16" height="160" rx="8" fill="white" opacity=".28" />
        <rect x="30" y="140" width="160" height="80" fill={LABEL} />
        <rect x="30" y="140" width="160" height="12" fill={RED} />
        <LabelNut x={110} y={186} s={2.2} />
        {/* opened rim with a piped swirl of cream: three tiers and a curled tip */}
        <ellipse cx="110" cy="72" rx="80" ry="16" fill={hz.deep} />
        <path d="M46 74 C 46 50, 174 50, 174 74 C 140 82, 80 82, 46 74 Z" fill={hz.fill} />
        <path d="M64 58 C 64 36, 156 36, 156 58 C 130 65, 90 65, 64 58 Z" fill={hz.fill} />
        <path d="M82 42 C 84 22, 138 22, 138 42 C 118 48, 102 48, 82 42 Z" fill={hz.fill} />
        <path d="M100 28 C 102 12, 122 8, 130 -2 C 134 14, 128 28, 116 31 Z" fill={hz.fill} />
        <path
          d="M52 70 C 90 80, 130 80, 168 70 M70 55 C 96 62, 124 62, 150 55 M88 40 C 104 45, 118 45, 132 40"
          stroke={hz.deep}
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          opacity=".7"
        />
        <path
          d="M96 24 C 100 14, 110 10, 116 12"
          stroke="white"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          opacity=".35"
        />
        <Crunch x={60} y={62} w={100} />
      </g>
      {/* spoon */}
      <g transform="translate(40 300) rotate(-14)">
        <rect x="0" y="0" width="150" height="12" rx="6" fill="#D8D2C8" />
        <ellipse cx="164" cy="6" rx="26" ry="16" fill="#E5E0D7" />
        <ellipse cx="166" cy="4" rx="18" ry="10" fill={hz.fill} />
      </g>
      {/* loose hazelnuts */}
      <LabelNut x={60} y={378} s={2.2} />
      <LabelNut x={214} y={382} s={1.8} />
      <LabelNut x={410} y={376} s={2} />
    </svg>
  );
}
