import type { CSSProperties } from 'react';
import type { PersonSymbol } from '../types/genogram';

type XProps = { s: number; pad: number; color: string; strokeWidth?: number };

function SquareX({ s, pad, color, strokeWidth = 2 }: XProps) {
  return (
    <>
      <line x1={pad} y1={pad} x2={s - pad} y2={s - pad}
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <line x1={s - pad} y1={pad} x2={pad} y2={s - pad}
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </>
  );
}

function CircleX({ cx, cy, r, color, strokeWidth = 2 }: { cx: number; cy: number; r: number; color: string; strokeWidth?: number }) {
  const d = r * 0.707;
  return (
    <>
      <line x1={cx - d} y1={cy - d} x2={cx + d} y2={cy + d}
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <line x1={cx + d} y1={cy - d} x2={cx - d} y2={cy + d}
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </>
  );
}

function DiamondX({ s, pad, cx, cy, color, strokeWidth = 2 }: XProps & { cx: number; cy: number }) {
  return (
    <>
      <line x1={cx} y1={pad} x2={cx} y2={s - pad}
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <line x1={pad} y1={cy} x2={s - pad} y2={cy}
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </>
  );
}

/** Renders the McGoldrick-Gerson genogram symbol as an inline SVG. */
export function SymbolIcon({
  symbol,
  deceased = false,
  size = 46,
}: {
  symbol: PersonSymbol;
  deceased?: boolean;
  size?: number;
}) {
  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const color = '#364fc7';
  const fill = 'rgba(54,79,199,0.10)';
  const pad = s * 0.1;
  const r = s * 0.41;

  if (symbol === 'female' || symbol === 'pregnancy' || symbol === 'stillbirth') {
    return (
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} style={{ display: 'block' }}>
        <circle cx={cx} cy={cy} r={r} stroke={color} strokeWidth="2" fill={fill} />
        {symbol === 'pregnancy' && (
          <circle cx={cx} cy={cy} r={r * 0.48} stroke={color} strokeWidth="1.5" fill="none" />
        )}
        {symbol === 'stillbirth' && (
          <line x1={cx - r * 0.6} y1={cy} x2={cx + r * 0.6} y2={cy} stroke="#fa5252" strokeWidth="2" />
        )}
        {deceased && <CircleX cx={cx} cy={cy} r={r} color={color} />}
      </svg>
    );
  }

  if (symbol === 'unknown') {
    const pts = `${cx},${pad} ${s - pad},${cy} ${cx},${s - pad} ${pad},${cy}`;
    return (
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} style={{ display: 'block' }}>
        <polygon points={pts} stroke={color} strokeWidth="2" fill={fill} />
        {deceased && <DiamondX s={s} pad={pad} cx={cx} cy={cy} color={color} />}
      </svg>
    );
  }

  if (symbol === 'miscarriage' || symbol === 'abortion') {
    const strokeColor = symbol === 'abortion' ? '#fa5252' : color;
    const pts = `${cx},${pad} ${s - pad},${s - pad} ${pad},${s - pad}`;
    return (
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} style={{ display: 'block' }}>
        <polygon points={pts} stroke={strokeColor} strokeWidth="2"
          strokeDasharray={symbol === 'abortion' ? '4 3' : undefined} fill={fill} />
        {deceased && <SquareX s={s} pad={pad + 4} color={strokeColor} />}
      </svg>
    );
  }

  if (symbol === 'pet') {
    const hw = r * 0.95;
    const hh = r * 0.82;
    const pts = [
      [cx - hw / 2, cy - hh], [cx + hw / 2, cy - hh], [cx + hw, cy],
      [cx + hw / 2, cy + hh], [cx - hw / 2, cy + hh], [cx - hw, cy],
    ].map(([x, y]) => `${x!.toFixed(1)},${y!.toFixed(1)}`).join(' ');
    return (
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} style={{ display: 'block' }}>
        <polygon points={pts} stroke={color} strokeWidth="2" fill={fill} />
        {deceased && <SquareX s={s} pad={pad + 2} color={color} />}
      </svg>
    );
  }

  // male (default) — square
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} style={{ display: 'block' }}>
      <rect x={pad} y={pad} width={s - 2 * pad} height={s - 2 * pad}
        stroke={color} strokeWidth="2" fill={fill} />
      {deceased && <SquareX s={s} pad={pad} color={color} />}
    </svg>
  );
}

/**
 * Two interlocking rings — the traditional marriage / partner symbol.
 * Rings are centred with a slight overlap to convey the union.
 */
export function MarriageRingsIcon({ size = 26 }: { size?: number }) {
  const s = size;
  const r = s * 0.3;
  const y = s / 2;
  const left  = s * 0.35;
  const right = s * 0.65;
  const color = '#364fc7';
  const fill  = 'rgba(54,79,199,0.08)';
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} style={{ display: 'block' }}>
      <circle cx={left}  cy={y} r={r} stroke={color} strokeWidth="1.8" fill={fill} />
      <circle cx={right} cy={y} r={r} stroke={color} strokeWidth="1.8" fill={fill} />
    </svg>
  );
}

/** Male/female symbol with marriage rings inside the symbol body. */
export function PartnerSymbolIcon({ sex, size = 22 }: { sex: 'male' | 'female'; size?: number }) {
  const s = size;
  const pad = s * 0.12;
  const color = '#364fc7';
  const fill = 'rgba(54,79,199,0.10)';

  // Center two interlocking wedding rings as a unit inside the symbol.
  const ringR = s * 0.13;
  const ringY = s / 2;
  const overlap = ringR * 0.9;
  const centerGap = ringR * 2 - overlap;
  const ringL = s / 2 - centerGap / 2;
  const ringRcx = s / 2 + centerGap / 2;

  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} style={{ display: 'block' }}>
      {sex === 'male' ? (
        <rect x={pad} y={pad} width={s - 2 * pad} height={s - 2 * pad} stroke={color} strokeWidth="1.8" fill={fill} />
      ) : (
        <circle cx={s / 2} cy={s / 2} r={s * 0.39} stroke={color} strokeWidth="1.8" fill={fill} />
      )}
      <circle cx={ringL} cy={ringY} r={ringR} stroke={color} strokeWidth="1.6" fill="none" />
      <circle cx={ringRcx} cy={ringY} r={ringR} stroke={color} strokeWidth="1.6" fill="none" />
    </svg>
  );
}

/** Tiny inline symbol used in palette buttons and sibling menus. */
export function SymbolChip({
  symbol,
  size = 22,
  style,
}: {
  symbol: PersonSymbol;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', ...style }}>
      <SymbolIcon symbol={symbol} size={size} />
    </span>
  );
}

