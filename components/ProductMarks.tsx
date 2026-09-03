/**
 * Card visuals for the two Arc products. Launchpad uses a real screenshot;
 * these two have no single screen that represents them, so they get a
 * diagram of what the product actually does.
 *
 * Both are inline SVG - no image requests, correct in either theme, and they
 * animate with CSS so there is nothing to hydrate. Motion is suppressed under
 * prefers-reduced-motion via the media query in the <style> block.
 */

const GRID = 'rgba(148,163,184,0.10)';

function Grid() {
  return (
    <>
      <defs>
        <pattern id="pm-grid" width="22" height="22" patternUnits="userSpaceOnUse">
          <path d="M22 0H0V22" fill="none" stroke={GRID} strokeWidth="1" />
        </pattern>
        <linearGradient id="pm-cyan" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgb(103,232,249)" stopOpacity="0" />
          <stop offset="45%" stopColor="rgb(34,211,238)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="rgb(56,189,248)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#pm-grid)" />
    </>
  );
}

/** Ingest stream landing in ordered columnar blocks. */
export function ArcMark() {
  return (
    <svg
      viewBox="0 0 320 144"
      className="h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label="Incoming writes landing as columnar blocks"
    >
      <style>{`
        @keyframes pm-flow { to { stroke-dashoffset: -220; } }
        @keyframes pm-rise { 0%,100% { opacity:.35 } 50% { opacity:1 } }
        .pm-stream { stroke-dasharray: 10 14; animation: pm-flow 3.2s linear infinite; }
        .pm-bar { animation: pm-rise 3.2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .pm-stream, .pm-bar { animation: none; }
        }
      `}</style>
      <Grid />

      {/* incoming writes */}
      {[42, 62, 82].map((y, i) => (
        <path
          key={y}
          className="pm-stream"
          d={`M14 ${y} H150`}
          stroke="url(#pm-cyan)"
          strokeWidth="2"
          fill="none"
          style={{ animationDelay: `${i * 0.45}s` }}
        />
      ))}

      {/* the columnar files they land in */}
      {[
        { x: 176, h: 54 },
        { x: 200, h: 74 },
        { x: 224, h: 40 },
        { x: 248, h: 66 },
        { x: 272, h: 48 },
      ].map((bar, i) => (
        <rect
          key={bar.x}
          className="pm-bar"
          x={bar.x}
          y={112 - bar.h}
          width="14"
          height={bar.h}
          rx="3"
          fill="rgb(34,211,238)"
          opacity="0.55"
          style={{ animationDelay: `${i * 0.28}s` }}
        />
      ))}
      <line x1="168" y1="114" x2="296" y2="114" stroke={GRID} strokeWidth="1.5" />
    </svg>
  );
}

/** Writer fanning out to reader nodes, over tiered storage. */
export function EnterpriseMark() {
  const readers = [
    { x: 226, y: 40 },
    { x: 258, y: 72 },
    { x: 226, y: 104 },
  ];

  return (
    <svg
      viewBox="0 0 320 144"
      className="h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label="A writer node replicating to reader nodes across tiers"
    >
      <style>{`
        @keyframes pm-pulse { 0%,100% { opacity:.25 } 50% { opacity:.85 } }
        @keyframes pm-dash  { to { stroke-dashoffset: -60; } }
        .pm-node { animation: pm-pulse 2.8s ease-in-out infinite; }
        .pm-link { stroke-dasharray: 5 7; animation: pm-dash 2.4s linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          .pm-node, .pm-link { animation: none; }
        }
      `}</style>
      <Grid />

      {readers.map((reader, i) => (
        <path
          key={`l-${reader.x}-${reader.y}`}
          className="pm-link"
          d={`M104 72 C 160 72, 170 ${reader.y}, ${reader.x - 12} ${reader.y}`}
          stroke="rgb(34,211,238)"
          strokeOpacity="0.5"
          strokeWidth="1.5"
          fill="none"
          style={{ animationDelay: `${i * 0.3}s` }}
        />
      ))}

      {/* writer */}
      <rect x="64" y="56" width="40" height="32" rx="6" fill="rgb(34,211,238)" opacity="0.75" />
      <text x="84" y="76" textAnchor="middle" fontSize="10" fill="rgb(8,12,20)" fontWeight="600">
        W
      </text>

      {/* readers */}
      {readers.map((reader, i) => (
        <rect
          key={`r-${reader.x}-${reader.y}`}
          className="pm-node"
          x={reader.x}
          y={reader.y - 12}
          width="34"
          height="24"
          rx="5"
          fill="rgb(217,70,239)"
          opacity="0.5"
          style={{ animationDelay: `${i * 0.4}s` }}
        />
      ))}
    </svg>
  );
}
