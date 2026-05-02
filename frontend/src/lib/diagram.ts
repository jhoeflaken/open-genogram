import { type Edge } from '@xyflow/react';
import type { CSSProperties } from 'react';
import { symbolToSex } from './genogramSymbols';
import type { PersonFlowNode, PersonNodeData, PersonSymbol, RelationEdgeData, RelationType } from '../types/genogram';

export function createPersonNode(id: string, symbol: PersonSymbol, x: number, y: number, firstName?: string, lastName?: string): PersonFlowNode {
  const sex = symbolToSex(symbol);
  const uid = crypto.randomUUID();
  const first = firstName?.trim() ?? '';
  const last = lastName?.trim() ?? '';
  const name = first || last ? `${first} ${last}`.trim() : uid.slice(0, 8);
  return {
    id,
    type: 'person',
    position: { x, y },
    data: {
      uid,
      name,
      firstName: first,
      lastName: last,
      sex,
      symbol,
      deceased: false,
      notes: ''
    }
  };
}

export function createRelationEdge(
  source: string,
  target: string,
  relation: RelationType = 'parent-child',
  options?: { sourceHandle?: string; targetHandle?: string }
): Edge<RelationEdgeData> {
  return {
    id: `${source}-${target}-${relation}-${crypto.randomUUID().slice(0, 6)}`,
    source,
    target,
    sourceHandle: options?.sourceHandle,
    targetHandle: options?.targetHandle,
    type: relation === 'partner' ? 'straight' : 'smoothstep',
    style: relationStyle(relation),
    data: { relation },
    animated: relation === 'adoption'
  };
}

export function relationStyle(relation: RelationType): CSSProperties {
  switch (relation) {
    case 'partner':
      return { stroke: '#333', strokeWidth: 2 };
    case 'divorce':
      return { stroke: '#e03131', strokeWidth: 2, strokeDasharray: '5 3' };
    case 'adoption':
      return { stroke: '#1c7ed6', strokeWidth: 2, strokeDasharray: '4 4' };
    default:
      return { stroke: '#333', strokeWidth: 2 };
  }
}

export function updateEdgeRelation<T extends RelationEdgeData>(edge: Edge<T>, relation: RelationType): Edge<T> {
  return {
    ...edge,
    data: { ...edge.data, relation } as T,
    type: relation === 'partner' ? 'straight' : 'smoothstep',
    style: relationStyle(relation),
    markerEnd: undefined,
    animated: relation === 'adoption'
  };
}



