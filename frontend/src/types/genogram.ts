import type { Edge, Node } from '@xyflow/react';

export type Sex = 'male' | 'female' | 'unknown';
export type RelationType = 'partner' | 'divorce' | 'parent-child' | 'adoption';

export type PersonNodeData = {
  name: string;
  sex: Sex;
  birthDate?: string;
  deathDate?: string;
  deceased: boolean;
  notes?: string;
};

export type RelationEdgeData = {
  relation: RelationType;
};

export type PersonNode = Node<PersonNodeData, 'person'>;
export type RelationEdge = Edge<RelationEdgeData>;
export type PersonFlowNode = PersonNode;

export type Diagram = {
  id: string;
  name: string;
  nodes: PersonNode[];
  edges: RelationEdge[];
  updatedAt?: string;
};



