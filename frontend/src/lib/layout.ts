import { Edge, XYPosition } from '@xyflow/react';
import { PersonFlowNode, PersonNodeData, RelationEdgeData } from '../types/genogram';
import { parseConfiguredDate, DateFormat } from './dateFormat';

const HORIZONTAL_SPACING = 300;
const VERTICAL_SPACING = 300;

export function performLayout(
  nodes: PersonFlowNode[],
  edges: Edge<RelationEdgeData>[],
  dateFormat: DateFormat
): { nodes: PersonFlowNode[]; edges: Edge<RelationEdgeData>[] } {
  if (nodes.length === 0) return { nodes, edges };

  // 1. Build adjacency list and find root nodes (those without parents)
  const childrenOf = new Map<string, string[]>();
  const parentsOf = new Map<string, string[]>();
  const partnersOf = new Map<string, string[]>();

  edges.forEach((edge) => {
    const { source, target, data } = edge;
    if (data?.relation === 'parent-child' || data?.relation === 'adoption') {
      if (!childrenOf.has(source)) childrenOf.set(source, []);
      childrenOf.get(source)!.push(target);
      if (!parentsOf.has(target)) parentsOf.set(target, []);
      parentsOf.get(target)!.push(source);
    } else if (data?.relation === 'partner' || data?.relation === 'divorce') {
      if (!partnersOf.has(source)) partnersOf.set(source, []);
      partnersOf.get(source)!.push(target);
      if (!partnersOf.has(target)) partnersOf.set(target, []);
      partnersOf.get(target)!.push(source);
    }
  });

  // 2. Assign generations (levels) using BFS starting from root nodes
  const levels = new Map<string, number>();
  const queue: { id: string; level: number }[] = [];

  const rootNodes = nodes.filter((n) => !parentsOf.has(n.id));
  rootNodes.forEach((n) => {
    queue.push({ id: n.id, level: 0 });
    levels.set(n.id, 0);
  });

  // Fallback for disconnected components that might have cycles or be oddly linked
  if (queue.length === 0 && nodes.length > 0) {
    queue.push({ id: nodes[0].id, level: 0 });
    levels.set(nodes[0].id, 0);
  }

  let head = 0;
  while (head < queue.length) {
    const { id, level } = queue[head++];
    
    // Process children
    const children = childrenOf.get(id) || [];
    children.forEach((childId) => {
      if (!levels.has(childId)) {
        levels.set(childId, level + 1);
        queue.push({ id: childId, level: level + 1 });
      }
    });

    // Process partners (same generation)
    const partners = partnersOf.get(id) || [];
    partners.forEach((partnerId) => {
      if (!levels.has(partnerId)) {
        levels.set(partnerId, level);
        queue.push({ id: partnerId, level });
      }
    });
  }

  // Ensure all nodes have a level
  nodes.forEach(n => {
    if (!levels.has(n.id)) levels.set(n.id, 0);
  });

  // 3. Group nodes by generation and order by age (old to young -> Right to Left)
  const nodesByLevel = new Map<number, PersonFlowNode[]>();
  nodes.forEach((node) => {
    const level = levels.get(node.id) || 0;
    if (!nodesByLevel.has(level)) nodesByLevel.set(level, []);
    nodesByLevel.get(level)!.push(node);
  });

  const getAgeScore = (node: PersonFlowNode): number => {
    const birthDate = parseConfiguredDate(node.data.birthDate, dateFormat);
    return birthDate ? birthDate.getTime() : 0;
  };

  const sortedLevels = Array.from(nodesByLevel.keys()).sort((a, b) => a - b);
  
  const finalNodes = [...nodes];
  const nodeMap = new Map(finalNodes.map(n => [n.id, n]));

  sortedLevels.forEach((level) => {
    const levelNodes = nodesByLevel.get(level)!;
    
    // Sort siblings by age: Oldest should be on the RIGHT
    // "brother and sisters should be from right to left in order from age old to young"
    // Right = Old, Left = Young.
    
    levelNodes.sort((a, b) => {
      const ageA = getAgeScore(a);
      const ageB = getAgeScore(b);
      return ageA - ageB; // Oldest first (will get largest X)
    });

    // We want to try to center children under their parents
    // and keep partners together.
    // For now, let's just group partners and their children.
    
    // Grouping nodes by partnership
    const processed = new Set<string>();
    const groups: string[][] = [];

    levelNodes.forEach(node => {
      if (processed.has(node.id)) return;
      
      const group = [node.id];
      processed.add(node.id);
      
      const partners = (partnersOf.get(node.id) || []).filter(pid => levels.get(pid) === level);
      partners.forEach(pid => {
        if (!processed.has(pid)) {
          group.push(pid);
          processed.add(pid);
        }
      });
      groups.push(group);
    });

    // Simple horizontal placement of groups
    let currentX = 0;
    // We reverse groups because the requirement is right-to-left for age.
    // Actually if we iterate normally but assign decreasing X, it works.
    
    // Calculate total width first to center
    let totalWidth = 0;
    groups.forEach((group, gIdx) => {
      totalWidth += (group.length * HORIZONTAL_SPACING);
      if (gIdx < groups.length - 1) totalWidth += HORIZONTAL_SPACING; // gap between sibling groups
    });

    let x = totalWidth / 2;
    groups.forEach((group) => {
      group.forEach((nodeId) => {
        const n = nodeMap.get(nodeId)!;
        n.position = {
          x: x,
          y: level * VERTICAL_SPACING
        };
        x -= HORIZONTAL_SPACING;
      });
      x -= HORIZONTAL_SPACING / 2; // Extra gap between groups
    });
  });

  // 4. Update edge types and handles
  const finalEdges = edges.map((edge) => {
    const isPartner = edge.data?.relation === 'partner' || edge.data?.relation === 'divorce';
    
    if (isPartner) {
      return {
        ...edge,
        type: 'smoothstep',
        sourceHandle: 'bottom-source',
        targetHandle: 'bottom-target',
        style: { ...edge.style, strokeWidth: 2 },
        pathOptions: { borderRadius: 40 }
      };
    }
    
    return {
      ...edge,
      sourceHandle: 'bottom-source',
      targetHandle: 'top-target',
    };
  });

  return { nodes: finalNodes, edges: finalEdges };
}
