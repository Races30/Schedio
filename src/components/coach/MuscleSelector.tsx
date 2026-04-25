import { useState } from 'react';

// ── Muscle data ───────────────────────────────────────────────────────────────
// Each muscle has an id, label, and SVG shape definitions (front or back view).
// viewBox is "0 0 120 260" for both front and back.

type ShapeDef =
  | { type: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { type: 'rect';    x: number;  y: number;  w: number;  h: number; rx?: number }
  | { type: 'path';    d: string };

interface MuscleDef { id: string; label: string; shapes: ShapeDef[] }

const FRONT: MuscleDef[] = [
  {
    id: 'deltoidi',
    label: 'Deltoidi',
    shapes: [
      { type: 'ellipse', cx: 23, cy: 62, rx: 11, ry: 13 },
      { type: 'ellipse', cx: 97, cy: 62, rx: 11, ry: 13 },
    ],
  },
  {
    id: 'pettorali',
    label: 'Pettorali',
    shapes: [
      { type: 'ellipse', cx: 44, cy: 72, rx: 15, ry: 12 },
      { type: 'ellipse', cx: 76, cy: 72, rx: 15, ry: 12 },
    ],
  },
  {
    id: 'bicipiti',
    label: 'Bicipiti',
    shapes: [
      { type: 'rect', x: 11, y: 75, w: 14, h: 30, rx: 7 },
      { type: 'rect', x: 95, y: 75, w: 14, h: 30, rx: 7 },
    ],
  },
  {
    id: 'avambracci',
    label: 'Avambracci',
    shapes: [
      { type: 'rect', x: 8,  y: 107, w: 13, h: 28, rx: 6 },
      { type: 'rect', x: 99, y: 107, w: 13, h: 28, rx: 6 },
    ],
  },
  {
    id: 'addominali',
    label: 'Addominali',
    shapes: [
      { type: 'rect', x: 46, y: 86, w: 28, h: 42, rx: 6 },
    ],
  },
  {
    id: 'quadricipiti',
    label: 'Quadricipiti',
    shapes: [
      { type: 'rect', x: 36, y: 144, w: 20, h: 54, rx: 10 },
      { type: 'rect', x: 64, y: 144, w: 20, h: 54, rx: 10 },
    ],
  },
  {
    id: 'polpacci',
    label: 'Polpacci',
    shapes: [
      { type: 'rect', x: 37, y: 202, w: 17, h: 44, rx: 8 },
      { type: 'rect', x: 66, y: 202, w: 17, h: 44, rx: 8 },
    ],
  },
];

const BACK: MuscleDef[] = [
  {
    id: 'trapezi',
    label: 'Trapezi',
    shapes: [{ type: 'rect', x: 38, y: 50, w: 44, h: 20, rx: 5 }],
  },
  {
    id: 'deltoidi_post',
    label: 'Deltoidi (post.)',
    shapes: [
      { type: 'ellipse', cx: 23, cy: 62, rx: 11, ry: 13 },
      { type: 'ellipse', cx: 97, cy: 62, rx: 11, ry: 13 },
    ],
  },
  {
    id: 'dorsali',
    label: 'Dorsali',
    shapes: [
      { type: 'rect', x: 26, y: 70, w: 22, h: 44, rx: 9 },
      { type: 'rect', x: 72, y: 70, w: 22, h: 44, rx: 9 },
    ],
  },
  {
    id: 'tricipiti',
    label: 'Tricipiti',
    shapes: [
      { type: 'rect', x: 11, y: 75, w: 14, h: 30, rx: 7 },
      { type: 'rect', x: 95, y: 75, w: 14, h: 30, rx: 7 },
    ],
  },
  {
    id: 'lombari',
    label: 'Lombari',
    shapes: [{ type: 'rect', x: 42, y: 114, w: 36, h: 20, rx: 5 }],
  },
  {
    id: 'glutei',
    label: 'Glutei',
    shapes: [
      { type: 'ellipse', cx: 43, cy: 152, rx: 17, ry: 14 },
      { type: 'ellipse', cx: 77, cy: 152, rx: 17, ry: 14 },
    ],
  },
  {
    id: 'femorali',
    label: 'Femorali',
    shapes: [
      { type: 'rect', x: 36, y: 163, w: 20, h: 50, rx: 10 },
      { type: 'rect', x: 64, y: 163, w: 20, h: 50, rx: 10 },
    ],
  },
  {
    id: 'polpacci_post',
    label: 'Polpacci (post.)',
    shapes: [
      { type: 'rect', x: 37, y: 217, w: 17, h: 38, rx: 8 },
      { type: 'rect', x: 66, y: 217, w: 17, h: 38, rx: 8 },
    ],
  },
];

// ── Body silhouette SVG paths ─────────────────────────────────────────────────
// Simple body outline drawn with basic shapes — same for front and back.
const BodyOutline = () => (
  <g fill="none" stroke="currentColor" strokeWidth="1.2" className="text-border opacity-60">
    {/* Head */}
    <ellipse cx="60" cy="22" rx="17" ry="19" />
    {/* Neck */}
    <rect x="53" y="39" width="14" height="13" rx="4" />
    {/* Torso */}
    <rect x="30" y="50" width="60" height="80" rx="12" />
    {/* Left arm (upper + lower) */}
    <rect x="8"  y="52" width="22" height="40" rx="11" />
    <rect x="6"  y="93" width="20" height="44" rx="10" />
    {/* Right arm */}
    <rect x="90" y="52" width="22" height="40" rx="11" />
    <rect x="94" y="93" width="20" height="44" rx="10" />
    {/* Left leg (upper + lower) */}
    <rect x="31" y="130" width="24" height="68" rx="12" />
    <rect x="32" y="199" width="22" height="52" rx="11" />
    {/* Right leg */}
    <rect x="65" y="130" width="24" height="68" rx="12" />
    <rect x="66" y="199" width="22" height="52" rx="11" />
  </g>
);

// ── Shape renderer ────────────────────────────────────────────────────────────
function renderShape(s: ShapeDef, fill: string, opacity: number, key: number) {
  const style = { fill, opacity, cursor: 'pointer', transition: 'opacity 0.15s, fill 0.15s' };
  if (s.type === 'ellipse')
    return <ellipse key={key} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} style={style} />;
  if (s.type === 'rect')
    return <rect key={key} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx ?? 0} style={style} />;
  return <path key={key} d={s.d} style={style} />;
}

// ── Main component ────────────────────────────────────────────────────────────
interface MuscleSelectorProps {
  selected: string[];
  onChange: (selected: string[]) => void;
  readOnly?: boolean;
  className?: string;
}

export function MuscleSelector({ selected, onChange, readOnly = false, className = '' }: MuscleSelectorProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const toggle = (id: string) => {
    if (readOnly) return;
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);
  };

  const renderMuscle = (m: MuscleDef) => {
    const isSelected = selected.includes(m.id);
    const isHovered  = hoveredId === m.id;
    const fill    = isSelected ? '#10b981' : isHovered ? '#6366f1' : '#94a3b8';
    const opacity = isSelected ? 0.8 : isHovered ? 0.5 : 0.25;
    return (
      <g
        key={m.id}
        onClick={() => toggle(m.id)}
        onMouseEnter={() => !readOnly && setHoveredId(m.id)}
        onMouseLeave={() => setHoveredId(null)}
        style={{ cursor: readOnly ? 'default' : 'pointer' }}
      >
        {m.shapes.map((s, i) => renderShape(s, fill, opacity, i))}
        {isSelected && (
          <title>{m.label} ✓</title>
        )}
        {!isSelected && <title>{m.label}</title>}
      </g>
    );
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Labels strip */}
      {!readOnly && (
        <div className="flex flex-wrap gap-1.5">
          {[...FRONT, ...BACK].map(m => {
            const isSelected = selected.includes(m.id);
            return (
              <button
                key={m.id}
                onClick={() => toggle(m.id)}
                className={`text-xs px-2 py-0.5 rounded-full border transition-colors
                  ${isSelected
                    ? 'bg-emerald-500 border-emerald-500 text-white font-semibold'
                    : 'bg-muted border-border text-muted-foreground hover:border-primary/50'}`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      )}

      {/* SVG bodies */}
      <div className="flex gap-4 justify-center items-start">
        {/* FRONT */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Fronte</span>
          <svg
            viewBox="0 0 120 260"
            className="w-28 h-auto"
            role="img"
            aria-label="Corpo umano frontale"
          >
            <BodyOutline />
            {FRONT.map(m => renderMuscle(m))}
          </svg>
        </div>

        {/* BACK */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Retro</span>
          <svg
            viewBox="0 0 120 260"
            className="w-28 h-auto"
            role="img"
            aria-label="Corpo umano posteriore"
          >
            <BodyOutline />
            {BACK.map(m => renderMuscle(m))}
          </svg>
        </div>
      </div>

      {/* Selection summary */}
      {selected.length > 0 && (
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-emerald-600">{selected.length} muscol{selected.length === 1 ? 'o' : 'i'} selezionat{selected.length === 1 ? 'o' : 'i'}: </span>
          {[...FRONT, ...BACK].filter(m => selected.includes(m.id)).map(m => m.label).join(', ')}
        </div>
      )}
    </div>
  );
}

// Helper: get display label for a muscle id
export function getMuscleLabel(id: string): string {
  return [...FRONT, ...BACK].find(m => m.id === id)?.label ?? id;
}

export const ALL_MUSCLES = [...FRONT, ...BACK];
