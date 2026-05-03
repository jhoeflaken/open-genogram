import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useAppSettings } from '../context/AppSettingsContext';
import { calculateAgeInYears, extractYear, parseConfiguredDate } from '../lib/dateFormat';
import { createPersonNode, createRelationEdge } from '../lib/diagram';
import { useHistory } from '../context/HistoryContext';
import { PartnerSymbolIcon, SymbolChip, SymbolIcon } from './SymbolIcons';
import type { PersonFlowNode, RelationEdge } from '../types/genogram';

// ── name formatting ───────────────────────────────────────────────────────────
const THREE_LINE_CHARS = 42;

function formatNodeName(firstName: string, lastName: string): string {
  const full = [firstName, lastName].filter(Boolean).join(' ');
  if (full.length <= THREE_LINE_CHARS) return full;

  const parts = firstName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return full;

  const firstWord = parts[0];
  const otherInitials = parts.slice(1).map((p) => p.charAt(0).toUpperCase() + '.').join(' ');
  return [firstWord, otherInitials, lastName].filter(Boolean).join(' ');
}


// ── Card node ─────────────────────────────────────────────────────────────────
// Height: 3 name lines (13 × 1.35 × 3 ≈ 53 px) + dates (16 px) + padding (18)
// = 87 px → use 96 px for comfortable breathing room.
const CARD_W = 240;
const CARD_H = 120;
const NAME_LINE_H = Math.round(13 * 1.35);
const NAME_LINES = 3;

// Shared style for the action handle boxes (+ and empty side handles)
export const actionHandleBase: CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: 4,
  border: '1.5px solid #364fc7',
  background: '#ffffff',
  color: '#364fc7',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 14,
  fontWeight: 700,
  lineHeight: 0,
  boxShadow: '0 2px 6px rgba(54,79,199,0.15)',
  cursor: 'crosshair',
  userSelect: 'none',
};

export const plusGlyphStyle: CSSProperties = {
  display: 'block',
  lineHeight: 1,
  transform: 'translateY(-0.5px)',
  pointerEvents: 'none',
  userSelect: 'none',
};

// Sibling picker popup anchored to left or right of card
export function MenuBtn({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button className="sibling-menu-btn" style={siblingBtnStyle} onClick={onClick}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 30, minWidth: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </span>
        <span style={{ fontSize: 12 }}>{label}</span>
      </span>
    </button>
  );
}

export function siblingMenuStyle(anchor: { side: 'left' | 'right' | 'bottom'; x: number; y: number }): CSSProperties {
  let transform = '';
  let left = anchor.x;
  if (anchor.side === 'left') {
    transform = 'translate(-100%, -50%)';
    left -= 8;
  } else if (anchor.side === 'right') {
    transform = 'translate(0, -50%)';
    left += 8;
  } else {
    // bottom
    transform = 'translate(-50%, 0)';
  }

  return {
    position: 'fixed',
    top: anchor.y + (anchor.side === 'bottom' ? 8 : 0),
    left: left,
    transform,
    background: '#fff',
    border: '1.5px solid #bfcbff',
    borderRadius: 8,
    boxShadow: '0 4px 16px rgba(15,23,42,0.14)',
    padding: '4px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    zIndex: 2147483647,
    minWidth: 102,
  };
}

const siblingBtnStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  borderRadius: 6,
  padding: '4px 6px',
  cursor: 'pointer',
  fontSize: 13,
  textAlign: 'left',
  color: '#1a1a2e',
  transition: 'background 100ms',
  whiteSpace: 'nowrap',
};

export function PersonNode({ id, data, selected }: NodeProps<PersonFlowNode>) {
  const reactFlow = useReactFlow<PersonFlowNode, RelationEdge>();
  const { pushSnapshot } = useHistory();
  const { dateFormat } = useAppSettings();
  const [siblingMenu, setSiblingMenu] = useState<{ side: 'left' | 'right'; x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const isDeceased = data.deceased || data.symbol === 'stillbirth';
  const birthYear = extractYear(data.birthDate, dateFormat);
  const deathYear = extractYear(data.deathDate, dateFormat);
  const displayName = formatNodeName(data.firstName ?? '', data.lastName ?? '');
  const birthDate = parseConfiguredDate(data.birthDate, dateFormat);
  const deathDate = parseConfiguredDate(data.deathDate, dateFormat);
  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const referenceDate = isDeceased ? deathDate : today;
  const ageYears = birthDate && referenceDate ? calculateAgeInYears(birthDate, referenceDate) : null;
  const ageLabel = ageYears !== null ? `${ageYears}y` : '';

  const card: CSSProperties = {
    background: 'linear-gradient(160deg, #ffffff 0%, #eef2ff 100%)',
    border: selected ? '2px solid #5c7cfa' : '1.5px solid #bfcbff',
    borderRadius: 10,
    boxShadow: selected
      ? '0 0 0 4px rgba(92,124,250,0.18), 0 8px 28px rgba(15,23,42,0.18)'
      : '0 4px 16px rgba(15,23,42,0.10)',
    padding: '18px 20px 18px 16px',
    width: CARD_W,
    height: CARD_H,
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    position: 'relative',
    zIndex: siblingMenu ? 5000 : undefined,
    overflow: 'visible',
    transition: 'box-shadow 140ms ease, border-color 140ms ease',
    cursor: 'default',
  };

  const nameStyle: CSSProperties = {
    fontWeight: 700,
    fontSize: 13,
    lineHeight: 1.35,
    color: '#1a1a2e',
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: NAME_LINES,
    overflow: 'hidden',
    wordBreak: 'break-word',
    height: NAME_LINE_H * NAME_LINES,
  };

  const datesStyle: CSSProperties = {
    display: 'flex', gap: 8, marginTop: 3,
    flexWrap: 'nowrap', overflow: 'hidden', height: 16, alignItems: 'center',
  };

  const symbolColumnStyle: CSSProperties = {
    flexShrink: 0,
    width: 58,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  };

  const ageStyle: CSSProperties = {
    fontSize: 14,
    fontWeight: 600,
    lineHeight: 1,
    color: '#1a1a2e',
  };

  const isPrimarySymbol = data.symbol === 'male' || data.symbol === 'female' || data.symbol === 'unknown';

  useEffect(() => {
    if (!siblingMenu) return;

    const onDocPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (menuRef.current?.contains(target)) return;
      setSiblingMenu(null);
    };

    const onEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSiblingMenu(null);
    };

    window.addEventListener('pointerdown', onDocPointerDown, true);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('pointerdown', onDocPointerDown, true);
      window.removeEventListener('keydown', onEsc);
    };
  }, [siblingMenu]);

  // ── action handlers ────────────────────────────────────────────────────────
  const addParents = () => {
    const current = reactFlow.getNode(id);
    if (!current) return;
    pushSnapshot(reactFlow.getNodes(), reactFlow.getEdges());

    const fatherID = crypto.randomUUID();
    const motherID = crypto.randomUUID();
    const fatherNode = createPersonNode(fatherID, 'male', current.position.x - 200, current.position.y - 200, 'Father', '');
    const motherNode = createPersonNode(motherID, 'female', current.position.x + 200, current.position.y - 200, 'Mother', '');

    const edgeId = crypto.randomUUID();
    const partnerEdge = createRelationEdge(fatherID, motherID, 'partner', {
      id: edgeId,
      sourceHandle: 'bottom-source',
      targetHandle: 'bottom-target'
    });

    const anchorNode: PersonFlowNode = {
      id: `anchor-${edgeId}`,
      type: 'anchor',
      position: { x: current.position.x + 120 - 10, y: current.position.y - 120 - 40 },
      data: { name: '', sex: 'unknown', symbol: 'unknown', deceased: false, isAnchor: true },
      draggable: false,
    };

    reactFlow.setNodes((prev) => [...prev, fatherNode, motherNode, anchorNode]);
    reactFlow.setEdges((prev) => [
      ...prev,
      partnerEdge,
      createRelationEdge(anchorNode.id, id, 'parent-child'),
    ]);
  };

  const addChild = () => {
    const current = reactFlow.getNode(id);
    if (!current) return;
    pushSnapshot(reactFlow.getNodes(), reactFlow.getEdges());

    const existingChildren = reactFlow.getEdges()
      .filter((e) => e.source === id && (e.data?.relation === 'parent-child' || e.data?.relation === 'adoption'))
      .map((e) => reactFlow.getNode(e.target))
      .filter((n): n is PersonFlowNode => Boolean(n));

    const x = existingChildren.length > 0
      ? Math.max(...existingChildren.map((n) => n.position.x)) + 220
      : current.position.x;
    const y = existingChildren.length > 0
      ? Math.max(current.position.y + 180, ...existingChildren.map((n) => n.position.y))
      : current.position.y + 180;

    const childID = crypto.randomUUID();
    reactFlow.setNodes((prev) => [...prev, createPersonNode(childID, 'unknown', x, y, 'Child', '')]);
    reactFlow.setEdges((prev) => [...prev, createRelationEdge(id, childID, 'parent-child')]);
  };

  const addSibling = (side: 'left' | 'right', symbol: 'male' | 'female', isPartner = false) => {
    const current = reactFlow.getNode(id);
    if (!current) return;
    pushSnapshot(reactFlow.getNodes(), reactFlow.getEdges());

    // Find parents of the current node (only needed for siblings, not partners)
    const parentIDs = !isPartner
      ? reactFlow.getEdges()
          .filter((e) => e.target === id && e.data?.relation === 'parent-child')
          .map((e) => e.source)
      : [];

    // Find all siblings (other children of the same parents) for positioning
    const siblingNodes = parentIDs.length > 0
      ? reactFlow.getEdges()
          .filter((e) => parentIDs.includes(e.source) && e.data?.relation === 'parent-child' && e.target !== id)
          .map((e) => reactFlow.getNode(e.target))
          .filter((n): n is PersonFlowNode => Boolean(n))
      : [];

    const STEP = CARD_W + 40;
    let x: number;
    if (side === 'left') {
      x = siblingNodes.length > 0
        ? Math.min(current.position.x, ...siblingNodes.map((n) => n.position.x)) - STEP
        : current.position.x - STEP;
    } else {
      x = siblingNodes.length > 0
        ? Math.max(current.position.x, ...siblingNodes.map((n) => n.position.x)) + STEP
        : current.position.x + STEP;
    }

    const newID = crypto.randomUUID();
    const defaultLabel = isPartner ? (symbol === 'male' ? 'Partner' : 'Partner') : (symbol === 'male' ? 'Brother' : 'Sister');
    reactFlow.setNodes((prev) => [...prev, createPersonNode(newID, symbol, x, current.position.y, defaultLabel, '')]);

    if (isPartner) {
      // Partner: horizontal side-to-side edge, no parent connection
      const edgeId = crypto.randomUUID();
      let sourceId: string;
      let targetId: string;

      if (side === 'left') {
        sourceId = newID;
        targetId = id;
      } else {
        sourceId = id;
        targetId = newID;
      }

      const edge = createRelationEdge(sourceId, targetId, 'partner', {
        id: edgeId,
        sourceHandle: 'bottom-source',
        targetHandle: 'bottom-target'
      });

      reactFlow.setEdges((prev) => [...prev, edge]);

      // Create anchor node
      const anchorX = (x + current.position.x) / 2 + 120 - 10;
      const anchorY = current.position.y + 120 + 20;
      const anchorNode: PersonFlowNode = {
        id: `anchor-${edgeId}`,
        type: 'anchor',
        position: { x: anchorX, y: anchorY },
        data: { name: '', sex: 'unknown', symbol: 'unknown', deceased: false, isAnchor: true },
        draggable: false,
      };
      reactFlow.setNodes((prev) => [...prev, anchorNode]);
    } else {
      // Sibling: connect same parents
      reactFlow.setEdges((prev) => [
        ...prev,
        ...parentIDs.map((pid) => createRelationEdge(pid, newID, 'parent-child')),
      ]);
    }

    setSiblingMenu(null);
  };

  // ── handle elements ─────────────────────────────────────────────────────────
  const handles = isPrimarySymbol ? (
    <>
      {/* Top + : click adds parents, drag to connect manually */}
      <Handle
        type="target"
        id="top-target"
        position={Position.Top}
        className="action-handle"
        style={{ ...actionHandleBase, top: 0, transform: 'translate(-50%, -50%)' }}
        onClick={(e) => { e.stopPropagation(); addParents(); }}
      >
        <span style={plusGlyphStyle}>+</span>
      </Handle>

      {/* Bottom handle: drag to connect manually (defaults to partner link) */}
      <Handle
        type="source"
        id="bottom-source"
        position={Position.Bottom}
        className="action-handle"
        style={{ ...actionHandleBase, bottom: 0, transform: 'translate(-50%, 50%)' }}
      />

      <Handle
        type="target"
        id="bottom-target"
        position={Position.Bottom}
        style={{ ...actionHandleBase, bottom: 0, transform: 'translate(-50%, 50%)', opacity: 1 }}
      />

      {/* Left + : click shows sibling menu (add left sibling), drag to connect */}
      <Handle
        type="target"
        id="left-target"
        position={Position.Left}
        className="action-handle"
        style={{ ...actionHandleBase, left: 0, transform: 'translate(-50%, -50%)' }}
        onClick={(e) => {
          e.stopPropagation();
          const next = { side: 'left' as const, x: e.clientX, y: e.clientY };
          setSiblingMenu((prev) => (prev?.side === 'left' ? null : next));
        }}
      >
        <span style={plusGlyphStyle}>+</span>
      </Handle>

      {/* Right + : click shows sibling menu (add right sibling), drag to connect */}
      <Handle
        type="source"
        id="right-source"
        position={Position.Right}
        className="action-handle"
        style={{ ...actionHandleBase, right: 0, transform: 'translate(50%, -50%)' }}
        onClick={(e) => {
          e.stopPropagation();
          const next = { side: 'right' as const, x: e.clientX, y: e.clientY };
          setSiblingMenu((prev) => (prev?.side === 'right' ? null : next));
        }}
      >
        <span style={plusGlyphStyle}>+</span>
      </Handle>

      {/* Sibling popups – rendered via portal so position:fixed works outside ReactFlow transforms */}
      {siblingMenu && createPortal(
        <div ref={menuRef} style={siblingMenuStyle(siblingMenu)} onClick={(e) => e.stopPropagation()}>
          <MenuBtn icon={<SymbolChip symbol="male"   size={20} />} label="Brother"         onClick={() => addSibling(siblingMenu.side, 'male')} />
          <MenuBtn icon={<SymbolChip symbol="female" size={20} />} label="Sister"          onClick={() => addSibling(siblingMenu.side, 'female')} />
          <hr style={{ margin: '4px 6px', border: 'none', borderTop: '1px solid #e9ecef' }} />
          <MenuBtn icon={<PartnerSymbolIcon sex="male"   size={22} />} label="Partner male"   onClick={() => addSibling(siblingMenu.side, 'male',   true)} />
          <MenuBtn icon={<PartnerSymbolIcon sex="female" size={22} />} label="Partner female" onClick={() => addSibling(siblingMenu.side, 'female', true)} />
        </div>,
        document.body
      )}
    </>
  ) : (
    <>
      <Handle type="target" position={Position.Top}    style={{ width: 8, height: 8, background: '#364fc7' }} />
      <Handle type="source" position={Position.Bottom} style={{ width: 8, height: 8, background: '#364fc7' }} />
    </>
  );

  return (
    <div style={card} onClick={() => setSiblingMenu(null)}>
      {handles}

      {/* left: centered symbol + computed age */}
      <div style={symbolColumnStyle}>
        <div style={{ lineHeight: 0 }}>
          <SymbolIcon symbol={data.symbol} deceased={isDeceased} />
        </div>
        {ageLabel && <div style={ageStyle}>{ageLabel}</div>}
      </div>

      {/* right: name + dates */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={nameStyle} title={data.name || undefined}>
          {displayName || 'Unnamed'}
        </div>

        {(birthYear || deathYear || isDeceased) && (
          <div style={datesStyle}>
            {birthYear && (
              <span style={{ fontSize: 11, color: '#555', display: 'flex', alignItems: 'center', gap: 2, whiteSpace: 'nowrap' }}>
                <span style={{ fontSize: 10 }}>✦</span> {birthYear}
              </span>
            )}
            {deathYear && (
              <span style={{ fontSize: 11, color: '#555', display: 'flex', alignItems: 'center', gap: 2, whiteSpace: 'nowrap' }}>
                <span style={{ fontSize: 12 }}>†</span> {deathYear}
              </span>
            )}
            {isDeceased && !deathYear && (
              <span style={{ fontSize: 11, color: '#777', display: 'flex', alignItems: 'center', gap: 2, whiteSpace: 'nowrap' }}>
                <span style={{ fontSize: 12 }}>†</span> (unknown)
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
