/**
 * Myntra-style "How to measure" illustration.
 *
 * Draws the GARMENT (or body, for body-fit items) as clean line-art with ALL
 * measurement guides shown at once - dashed green lines/loops capped with
 * arrowheads, plus text labels and leader lines pointing to each - exactly
 * like the size-guide diagrams on Myntra/Ajio.
 *
 * Which illustration is used is inferred from the garment: a template with an
 * inseam (and no sleeve) is lower-body -> trousers; one with sleeve/shoulder/
 * neck is upper-body -> shirt; a female body-fit garment -> body silhouette.
 * Built with react-native-svg (already a project dependency) so it scales
 * crisply and needs no image assets.
 */
import React from "react";
import Svg, {
  Defs,
  Ellipse,
  G,
  Line,
  Marker,
  Path,
  Text as SvgText,
} from "react-native-svg";
import type { MeasurementValueKey } from "../../utils/measurementInput";

export type DiagramGender = "male" | "female";
export type DiagramKind = "shirt" | "pants" | "body";

const OUTLINE = "#9AA5A5";
const OUTLINE_FILL = "#FFFFFF";
const GUIDE = "#7CB518"; // Myntra's green measurement lines
const LEADER = "#8A9494";
const LABEL = "#4A5555";
const STAGE_BG = "#F2F4F4";

/**
 * Pick the illustration for the garment.
 *
 * The backend has no garment-type field, and the common (legacy-fallback)
 * template ships with EVERY measurement field, so field-presence alone can't
 * tell a top from a bottom. We therefore prioritise the two reliable signals
 * in order: an explicit category/garment-type hint (from the service name),
 * then the category gender, and only fall back to field-presence for a
 * genuinely field-specific (non-legacy) template.
 *
 * - Women's clothing -> a female body silhouette (matches how Myntra shows a
 *   full-body measurement guide for women's wear).
 * - Men's/unisex -> a shirt for tops, pants for bottoms, inferred from the
 *   garment name; defaults to shirt.
 */
export function pickDiagramKind(
  fieldKeys: string[],
  gender?: DiagramGender,
  garmentName?: string | null,
): DiagramKind {
  const name = (garmentName ?? "").toLowerCase();

  const looksLikeBottom =
    /\b(pant|pants|trouser|trousers|jean|jeans|salwar|pyjama|pajama|palazzo|legging|leggings|short|shorts|skirt|lehenga|churidar|dhoti|lower)\b/.test(
      name,
    );
  const looksLikeTop =
    /\b(shirt|t-?shirt|tee|top|blouse|kurta|kurti|kameez|jacket|coat|blazer|sweater|hoodie|sweatshirt|choli)\b/.test(
      name,
    );
  const looksLikeDress =
    /\b(dress|gown|saree|sari|frock|jumpsuit|romper|anarkali|suit|abaya)\b/.test(
      name,
    );

  // 1) Explicit garment-name hints win (most specific).
  if (looksLikeBottom && !looksLikeTop) return "pants";
  if (looksLikeDress) return gender === "male" ? "shirt" : "body";
  if (looksLikeTop) return "shirt";

  // 2) Gender: women's wear defaults to the body guide.
  if (gender === "female") return "body";

  // 3) Field-specificity fallback (only meaningful for non-legacy templates
  //    that don't include the whole field set).
  const has = (k: MeasurementValueKey) => fieldKeys.includes(k);
  const hasAllFields =
    has("chest") && has("inseam") && has("sleeve_length") && has("hips");
  if (!hasAllFields) {
    const upperBody = has("sleeve_length") || has("shoulder") || has("neck");
    if (has("inseam") && !upperBody) return "pants";
  }
  return "shirt";
}

export interface BodyOutlineDiagramProps {
  /** Field keys present on the garment - a weak fallback signal for the kind. */
  fieldKeys: string[];
  gender?: DiagramGender;
  /** Garment/service name, e.g. "Simple Blouse" - the strongest kind hint. */
  garmentName?: string | null;
  /** Explicit override; when omitted it's inferred from name + gender + fields. */
  kind?: DiagramKind;
  size?: number;
}

export default function BodyOutlineDiagram({
  fieldKeys,
  gender = "male",
  garmentName,
  kind,
  size = 260,
}: BodyOutlineDiagramProps) {
  const resolved = kind ?? pickDiagramKind(fieldKeys, gender, garmentName);
  return (
    <Svg width={size} height={size * 0.92} viewBox="0 0 300 276">
      <Defs>
        <Marker
          id="arrow"
          markerWidth={6}
          markerHeight={6}
          refX={3}
          refY={3}
          orient="auto"
        >
          <Path d="M0.5,0.5 L5.5,3 L0.5,5.5 Z" fill={GUIDE} />
        </Marker>
      </Defs>

      {resolved === "shirt" ? (
        <ShirtDiagram />
      ) : resolved === "pants" ? (
        <PantsDiagram />
      ) : (
        <BodyDiagram />
      )}
    </Svg>
  );
}

// ── Shared label helper ──────────────────────────────────────────────────────
function LeaderLabel({
  side,
  x,
  y,
  toX,
  toY,
  lines,
}: {
  side: "left" | "right";
  x: number; // label anchor x
  y: number; // label anchor y (baseline of first line)
  toX: number; // leader target on the garment
  toY: number;
  lines: string[];
}) {
  const bendX = side === "left" ? x + 34 : x - 34;
  return (
    <G>
      <Line x1={side === "left" ? x + 4 : x - 4} y1={y - 4} x2={bendX} y2={y - 4} stroke={LEADER} strokeWidth={1} />
      <Line x1={bendX} y1={y - 4} x2={toX} y2={toY} stroke={LEADER} strokeWidth={1} />
      {lines.map((ln, i) => (
        <SvgText
          key={i}
          x={x}
          y={y + i * 13}
          fontSize={12}
          fontWeight="500"
          fill={LABEL}
          textAnchor={side === "left" ? "end" : "start"}
        >
          {ln}
        </SvgText>
      ))}
    </G>
  );
}

// ── SHIRT ────────────────────────────────────────────────────────────────────
function ShirtDiagram() {
  return (
    <G>
      {/* Body of the shirt */}
      <Path
        d="M120 60
           C128 54 172 54 180 60
           L212 78 L200 108 L192 100 L192 214
           C192 218 188 220 184 220 L116 220
           C112 220 108 218 108 214 L108 100 L88 108 L88 78 Z"
        fill={OUTLINE_FILL}
        stroke={OUTLINE}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      {/* Sleeves */}
      <Path d="M88 78 L64 150 L86 160 L108 108" fill={OUTLINE_FILL} stroke={OUTLINE} strokeWidth={1.4} strokeLinejoin="round" />
      <Path d="M212 78 L236 150 L214 160 L192 108" fill={OUTLINE_FILL} stroke={OUTLINE} strokeWidth={1.4} strokeLinejoin="round" />
      {/* Collar */}
      <Path d="M120 60 L138 84 L150 74 L162 84 L180 60" fill={OUTLINE_FILL} stroke={OUTLINE} strokeWidth={1.4} strokeLinejoin="round" />
      {/* Placket + buttons */}
      <Line x1={150} y1={84} x2={150} y2={216} stroke={OUTLINE} strokeWidth={1} />
      {[100, 124, 148, 172, 196].map((cy) => (
        <Ellipse key={cy} cx={150} cy={cy} rx={1.6} ry={1.6} fill="none" stroke={OUTLINE} strokeWidth={0.9} />
      ))}

      {/* ── Guides ── */}
      {/* Collar loop */}
      <Ellipse cx={150} cy={64} rx={24} ry={6} fill="none" stroke={GUIDE} strokeWidth={1.6} strokeDasharray="4,3" />
      {/* Across shoulder */}
      <Line x1={112} y1={92} x2={188} y2={92} stroke={GUIDE} strokeWidth={1.6} strokeDasharray="4,3" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
      {/* Chest loop */}
      <Ellipse cx={150} cy={130} rx={40} ry={9} fill="none" stroke={GUIDE} strokeWidth={1.6} strokeDasharray="4,3" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
      {/* Waist / length-bottom loop */}
      <Ellipse cx={150} cy={196} rx={40} ry={9} fill="none" stroke={GUIDE} strokeWidth={1.6} strokeDasharray="4,3" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
      {/* Length (collar to hem) */}
      <Line x1={132} y1={82} x2={132} y2={216} stroke={GUIDE} strokeWidth={1.6} strokeDasharray="4,3" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
      {/* Sleeve length (shoulder to cuff) */}
      <Line x1={200} y1={94} x2={224} y2={154} stroke={GUIDE} strokeWidth={1.6} strokeDasharray="4,3" markerStart="url(#arrow)" markerEnd="url(#arrow)" />

      {/* ── Labels ── */}
      <LeaderLabel side="left" x={62} y={66} toX={128} toY={64} lines={["Collar"]} />
      <LeaderLabel side="left" x={62} y={130} toX={112} toY={130} lines={["Chest"]} />
      <LeaderLabel side="left" x={62} y={196} toX={112} toY={196} lines={["Waist"]} />
      <SvgText x={150} y={244} fontSize={12} fontWeight="500" fill={LABEL} textAnchor="middle">Length</SvgText>
      <Line x1={132} y1={218} x2={140} y2={236} stroke={LEADER} strokeWidth={1} />
      <LeaderLabel side="right" x={238} y={70} toX={188} toY={90} lines={["Across", "Shoulder"]} />
      <LeaderLabel side="right" x={238} y={150} toX={214} toY={150} lines={["Sleeve", "Length"]} />
    </G>
  );
}

// ── PANTS ────────────────────────────────────────────────────────────────────
function PantsDiagram() {
  return (
    <G>
      {/* Waistband */}
      <Path d="M96 74 L204 74 L204 88 L96 88 Z" fill={OUTLINE_FILL} stroke={OUTLINE} strokeWidth={1.4} strokeLinejoin="round" />
      {/* Left + right leg (single outline with inseam notch) */}
      <Path
        d="M96 88 L204 88
           L214 250 L166 250 L150 128
           L134 250 L86 250 Z"
        fill={OUTLINE_FILL}
        stroke={OUTLINE}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      {/* Fly + pocket hints */}
      <Line x1={150} y1={88} x2={150} y2={128} stroke={OUTLINE} strokeWidth={1} />
      <Ellipse cx={150} cy={92} rx={1.6} ry={1.6} fill="none" stroke={OUTLINE} strokeWidth={0.9} />
      <Path d="M110 92 Q118 100 128 92" fill="none" stroke={OUTLINE} strokeWidth={0.9} />
      <Path d="M172 92 Q182 100 190 92" fill="none" stroke={OUTLINE} strokeWidth={0.9} />

      {/* ── Guides ── */}
      {/* To fit waist loop (above band) */}
      <Ellipse cx={150} cy={58} rx={54} ry={7} fill="none" stroke={GUIDE} strokeWidth={1.6} strokeDasharray="4,3" />
      {/* Rise (waist to crotch) */}
      <Line x1={138} y1={90} x2={138} y2={126} stroke={GUIDE} strokeWidth={1.6} strokeDasharray="4,3" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
      {/* Thigh loop */}
      <Ellipse cx={120} cy={128} rx={30} ry={7} fill="none" stroke={GUIDE} strokeWidth={1.6} strokeDasharray="4,3" />
      {/* Inseam (crotch to hem) */}
      <Line x1={150} y1={130} x2={150} y2={248} stroke={GUIDE} strokeWidth={1.6} strokeDasharray="4,3" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
      {/* Outseam (band to hem) */}
      <Line x1={196} y1={80} x2={196} y2={248} stroke={GUIDE} strokeWidth={1.6} strokeDasharray="4,3" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
      {/* Bottom hem loop */}
      <Ellipse cx={190} cy={248} rx={22} ry={6} fill="none" stroke={GUIDE} strokeWidth={1.6} strokeDasharray="4,3" />

      {/* ── Labels ── */}
      <LeaderLabel side="left" x={54} y={60} toX={96} toY={58} lines={["To Fit", "Waist"]} />
      <LeaderLabel side="left" x={54} y={112} toX={138} toY={112} lines={["Rise"]} />
      <LeaderLabel side="left" x={54} y={152} toX={92} toY={130} lines={["Thigh"]} />
      <LeaderLabel side="left" x={54} y={214} toX={150} toY={200} lines={["Inseam", "Length"]} />
      <LeaderLabel side="right" x={246} y={152} toX={198} toY={160} lines={["Outseam", "Length"]} />
      <LeaderLabel side="right" x={246} y={214} toX={210} toY={248} lines={["Bottom", "Hem"]} />
    </G>
  );
}

// ── BODY (female body-fit garments) ──────────────────────────────────────────
function BodyDiagram() {
  return (
    <G>
      {/* Torso + legs */}
      <Path
        d="M150 32 C145 32 141 36 141 41 C141 45 143 48 146 50 C140 52 135 55 133 60 L138 72
           C130 78 127 90 131 102 C124 118 123 136 128 154 C123 172 123 192 127 210 L129 248
           C129 251 133 251 134 248 L139 210 C141 196 143 188 145 180 C147 196 148 228 148 248
           C148 251 152 251 152 248 L150 186 L152 248 C152 251 156 251 156 248
           C156 228 157 196 159 180 C161 188 163 196 165 210 L170 248 C171 251 175 251 175 248
           L177 210 C181 192 181 172 176 154 C181 136 180 118 173 102 C177 90 174 78 166 72
           L171 60 C169 55 164 52 158 50 C161 48 163 45 163 41 C163 36 159 32 154 32 Z"
        fill={OUTLINE_FILL}
        stroke={OUTLINE}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      {/* Left arm */}
      <Path
        d="M131 76 C118 88 112 112 110 140 C109 154 108 168 110 178 C111 182 115 182 116 178
           C118 166 120 150 122 138 C124 118 128 100 135 90 Z"
        fill={OUTLINE_FILL}
        stroke={OUTLINE}
        strokeWidth={1.3}
        strokeLinejoin="round"
      />
      {/* Right arm */}
      <Path
        d="M173 76 C186 88 192 112 194 140 C195 154 196 168 194 178 C193 182 189 182 188 178
           C186 166 184 150 182 138 C180 118 176 100 169 90 Z"
        fill={OUTLINE_FILL}
        stroke={OUTLINE}
        strokeWidth={1.3}
        strokeLinejoin="round"
      />

      {/* ── Guides ── */}
      <Line x1={128} y1={78} x2={172} y2={78} stroke={GUIDE} strokeWidth={1.6} strokeDasharray="4,3" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
      <Ellipse cx={150} cy={104} rx={30} ry={7} fill="none" stroke={GUIDE} strokeWidth={1.6} strokeDasharray="4,3" />
      <Ellipse cx={150} cy={132} rx={26} ry={6} fill="none" stroke={GUIDE} strokeWidth={1.6} strokeDasharray="4,3" />
      <Ellipse cx={150} cy={160} rx={34} ry={8} fill="none" stroke={GUIDE} strokeWidth={1.6} strokeDasharray="4,3" />

      {/* ── Labels (all on the right, like the reference) ── */}
      <LeaderLabel side="right" x={222} y={82} toX={172} toY={78} lines={["Shoulder"]} />
      <LeaderLabel side="right" x={222} y={108} toX={180} toY={104} lines={["Bust"]} />
      <LeaderLabel side="right" x={222} y={136} toX={176} toY={132} lines={["Waist"]} />
      <LeaderLabel side="right" x={222} y={164} toX={184} toY={160} lines={["Hips"]} />
    </G>
  );
}

export { STAGE_BG };
