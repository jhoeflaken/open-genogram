import React, { useCallback, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react';
import { actionHandleBase, plusGlyphStyle, MenuBtn, siblingMenuStyle } from './PersonNode';
import { SymbolChip } from './SymbolIcons';
import { createPersonNode, createRelationEdge } from '../lib/diagram';
import { useHistory } from '../context/HistoryContext';
import type { PersonFlowNode, PersonSymbol } from '../types/genogram';

export function AnchorNode({ id, data, xPos, yPos }: NodeProps<PersonFlowNode>) {
  const { setNodes, setEdges, getNodes, getEdges } = useReactFlow();
  const { pushSnapshot } = useHistory();
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const onHandleClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    setMenuAnchor({ x: event.clientX, y: event.clientY });
  }, []);

  const onHandleMouseDown = useCallback((event: React.MouseEvent) => {
    // If the click is on the handle background (not the plus text, though plus has pointer-events: none)
    // we want to allow dragging for connection.
    // If we want to support both clicking for menu and dragging for connection,
    // React Flow's Handle usually handles dragging.
    // We just need to make sure we don't preventDefault if we want to allow connection dragging.
  }, []);

  useEffect(() => {
    if (!menuAnchor) return;
    const onDocPointerDown = (event: PointerEvent) => {
      const targetElement = event.target as Node | null;
      if (!targetElement || menuRef.current?.contains(targetElement)) return;
      setMenuAnchor(null);
    };
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuAnchor(null);
    };
    window.addEventListener('pointerdown', onDocPointerDown, true);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('pointerdown', onDocPointerDown, true);
      window.removeEventListener('keydown', onEsc);
    };
  }, [menuAnchor]);

  const addChild = (symbol: PersonSymbol) => {
    const currentNodes = getNodes() as PersonFlowNode[];
    const currentEdges = getEdges();
    pushSnapshot(currentNodes, currentEdges);

    const childID = crypto.randomUUID();
    const x = typeof xPos === 'number' && !isNaN(xPos) ? xPos : 0;
    const y = typeof yPos === 'number' && !isNaN(yPos) ? yPos : 0;

    // Find existing children of this anchor to avoid overlap
    const childEdges = currentEdges.filter(e => e.source === id && e.label !== 'partner');
    const childNodeIds = new Set(childEdges.map(e => e.target));
    const siblingNodes = currentNodes.filter(n => childNodeIds.has(n.id));

    let targetX = x;
    let targetY = y + 100;

    if (siblingNodes.length > 0) {
      // Find the rightmost sibling to place the next one to its left (since we go right-to-left for old-to-young)
      // Actually, user said: "to the left or right of any existing child nodes"
      // Layout usually handles the final order, but for immediate placement:
      const minX = Math.min(...siblingNodes.map(n => n.position.x));
      targetX = minX - 150;
      targetY = siblingNodes[0].position.y;
    }

    const childNode = createPersonNode(
      childID,
      symbol,
      targetX,
      targetY,
      symbol === 'male' ? 'Son' : 'Daughter',
      ''
    );

    setNodes((prev) => [...prev, childNode]);
    
    setEdges((prev) => [
      ...prev,
      createRelationEdge(id, childID, 'parent-child', { sourceHandle: 'anchor-source', targetHandle: 'top-target' }),
    ]);
    setMenuAnchor(null);
  };

  return (
    <div style={{ width: 20, height: 20, position: 'relative' }}>
      <Handle
        type="source"
        position={Position.Bottom}
        id="anchor-source"
        onClick={onHandleClick}
        onMouseDown={onHandleMouseDown}
        style={{
          ...actionHandleBase,
          cursor: 'pointer',
          zIndex: 10,
          width: 20,
          height: 20,
          position: 'absolute',
          top: 0,
          left: 0,
          transform: 'none',
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'all'
        }}
      >
        <span style={{ ...plusGlyphStyle, pointerEvents: 'none', userSelect: 'none' }}>+</span>
      </Handle>

      {menuAnchor && createPortal(
        <div ref={menuRef} style={siblingMenuStyle({ side: 'bottom', x: menuAnchor.x, y: menuAnchor.y })} onClick={(e) => e.stopPropagation()}>
          <MenuBtn icon={<SymbolChip symbol="male" size={20} />} label="Son" onClick={() => addChild('male')} />
          <MenuBtn icon={<SymbolChip symbol="female" size={20} />} label="Daughter" onClick={() => addChild('female')} />
        </div>,
        document.body
      )}
    </div>
  );
}
