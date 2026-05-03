import React, { useCallback, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  useReactFlow,
} from '@xyflow/react';
import type { RelationEdge, PersonSymbol, PersonFlowNode } from '../types/genogram';
import { actionHandleBase, plusGlyphStyle, MenuBtn, siblingMenuStyle } from './PersonNode';
import { SymbolChip } from './SymbolIcons';
import { createPersonNode, createRelationEdge } from '../lib/diagram';
import { useHistory } from '../context/HistoryContext';

export function PartnerEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style = {},
  markerEnd,
  data,
  selected,
}: EdgeProps<RelationEdge>) {
  const { setEdges, setNodes, getNode } = useReactFlow();
  const { pushSnapshot, getNodes, getEdges } = useHistory();
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // U-shape logic
  const drop = 40;
  const baseY = Math.max(sourceY, targetY) + drop;

  const edgePath = `M ${sourceX},${sourceY} 
                    L ${sourceX},${baseY} 
                    L ${targetX},${baseY} 
                    L ${targetX},${targetY}`;

  const anchor = data?.anchor ?? 0.5;
  const anchorX = sourceX + (targetX - sourceX) * anchor;
  const anchorY = baseY;

  const onHandleMouseDown = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    const startX = event.clientX;
    const startAnchor = anchor;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const lineLength = targetX - sourceX;
      if (Math.abs(lineLength) < 1) return;

      const deltaAnchor = deltaX / lineLength;
      const nextAnchor = Math.min(1, Math.max(0, startAnchor + deltaAnchor));

      setEdges((eds) =>
        eds.map((e) => {
          if (e.id === id) {
            return {
              ...e,
              data: { ...e.data, anchor: nextAnchor },
            };
          }
          return e;
        })
      );
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [id, anchor, sourceX, targetX, setEdges]);

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
    pushSnapshot(getNodes(), getEdges());

    const childID = crypto.randomUUID();
    const childNode = createPersonNode(
      childID,
      symbol,
      anchorX,
      anchorY + 100,
      symbol === 'male' ? 'Son' : 'Daughter',
      ''
    );

    setNodes((prev) => [...prev, childNode]);
    setEdges((prev) => [
      ...prev,
      createRelationEdge(source, childID, 'parent-child'),
      createRelationEdge(target, childID, 'parent-child'),
    ]);
    setMenuAnchor(null);
  };

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={{ ...style, strokeWidth: selected ? 3 : 2 }} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${anchorX}px, ${anchorY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          {/* Draggable and clickable action handle */}
          <div
            onMouseDown={onHandleMouseDown}
            onClick={onHandleClick}
            style={{
              ...actionHandleBase,
              cursor: 'pointer',
              zIndex: 10,
              width: 20,
              height: 20,
            }}
          >
            <span style={plusGlyphStyle}>+</span>
          </div>

          {menuAnchor && createPortal(
            <div ref={menuRef} style={siblingMenuStyle({ side: 'bottom', x: menuAnchor.x, y: menuAnchor.y })} onClick={(e) => e.stopPropagation()}>
              <MenuBtn icon={<SymbolChip symbol="male" size={20} />} label="Son" onClick={() => addChild('male')} />
              <MenuBtn icon={<SymbolChip symbol="female" size={20} />} label="Daughter" onClick={() => addChild('female')} />
            </div>,
            document.body
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
