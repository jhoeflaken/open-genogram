import { MarkerType, type Edge } from '@xyflow/react';
import type { PersonFlowNode, PersonNodeData, RelationEdgeData, RelationType, Sex } from '../types/genogram';

export function createPersonNode(id: string, sex: Sex, x: number, y: number): PersonFlowNode {
  const label = sex === 'male' ? 'Male' : sex === 'female' ? 'Female' : 'Unknown';
  return {
    id,
    type: 'person',
    position: { x, y },
    data: {
      name: `${label} ${id.slice(0, 4)}`,
      sex,
      deceased: false,
      notes: ''
    }
  };
}

export function createRelationEdge(source: string, target: string, relation: RelationType = 'parent-child'): Edge<RelationEdgeData> {
  return {
    id: `${source}-${target}-${relation}`,
    source,
    target,
    type: 'smoothstep',
    markerEnd: relation === 'parent-child' || relation === 'adoption' ? { type: MarkerType.ArrowClosed } : undefined,
    style: relationStyle(relation),
    data: { relation },
    animated: relation === 'adoption'
  };
}

export function relationStyle(relation: RelationType): React.CSSProperties {
  switch (relation) {
    case 'partner':
      return { strokeWidth: 2 };
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
    style: relationStyle(relation),
    markerEnd: relation === 'parent-child' || relation === 'adoption' ? { type: MarkerType.ArrowClosed } : undefined,
    animated: relation === 'adoption'
  };
}



