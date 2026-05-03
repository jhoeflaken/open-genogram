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
    pushSnapshot(getNodes() as PersonFlowNode[], getEdges());

    const childID = crypto.randomUUID();
    const childNode = createPersonNode(
      childID,
      symbol,
      xPos,
      yPos + 100,
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
          justifyContent: 'center'
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
