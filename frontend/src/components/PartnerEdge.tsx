import React, { useCallback, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  BaseEdge,
  EdgeLabelRenderer,
  useReactFlow,
  type EdgeProps,
} from '@xyflow/react';
import type { RelationEdge } from '../types/genogram';
import { actionHandleBase } from './PersonNode';
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
  const { setEdges, setNodes, getNode, getNodes, getEdges } = useReactFlow();
  const { pushSnapshot } = useHistory();

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

  // Sync anchor node position
  useEffect(() => {
    const anchorNodeId = `anchor-${id}`;
    setNodes((nds) => nds.map((n) => {
      if (n.id === anchorNodeId) {
        return {
          ...n,
          position: { x: anchorX - 10, y: anchorY - 10 },
        };
      }
      return n;
    }));
  }, [id, anchorX, anchorY, setNodes]);

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
          {/* Draggable handle for moving anchor node along the edge */}
          <div
            onMouseDown={onHandleMouseDown}
            style={{
              ...actionHandleBase,
              cursor: 'grab',
              zIndex: 5,
              width: 20,
              height: 20,
              background: 'transparent',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          />
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
