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
    const { source, target, data, sourceHandle } = edge;
    if (data?.relation === 'parent-child' || data?.relation === 'adoption') {
      // If source is an anchor node, we need to map it back to parents?
      // Actually, if children are drawn from the anchor, the anchor IS the source in the tree.
      // But the anchor itself is linked to a 'partner' edge.
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

  // Identify Anchor nodes and their associated partner edges
  const anchorToEdge = new Map<string, string>();
  const edgeToAnchor = new Map<string, string>();
  nodes.forEach(n => {
    if (n.type === 'anchor' || n.id.startsWith('anchor-')) {
      const edgeId = n.id.replace('anchor-', '');
      anchorToEdge.set(n.id, edgeId);
      edgeToAnchor.set(edgeId, n.id);
    }
  });

  // Re-map parent-child relations that go through anchors to go through parents for generation logic
  edges.forEach(edge => {
    if (edge.data?.relation === 'parent-child' || edge.data?.relation === 'adoption') {
      if (anchorToEdge.has(edge.source)) {
        const pEdgeId = anchorToEdge.get(edge.source)!;
        const pEdge = edges.find(e => e.id === pEdgeId);
        if (pEdge) {
          // Add virtual parent-child links for generation calculation
          const parents = [pEdge.source, pEdge.target];
          parents.forEach(p => {
            if (!childrenOf.has(p)) childrenOf.set(p, []);
            childrenOf.get(p)!.push(edge.target);
            if (!parentsOf.has(edge.target)) parentsOf.set(edge.target, []);
            parentsOf.get(edge.target)!.push(p);
          });
        }
      }
    }
  });

  // 2. Assign generations (levels) using BFS starting from root nodes
  const levels = new Map<string, number>();
  const queue: { id: string; level: number }[] = [];

  const rootNodes = nodes.filter((n) => !parentsOf.has(n.id) && n.type !== 'anchor');
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

  // 3. Recursive positioning to maintain hierarchy
  const finalNodes = [...nodes];
  const nodeMap = new Map(finalNodes.map(n => [n.id, n]));
  const positioned = new Set<string>();

  const getAgeScore = (node: PersonFlowNode): number => {
    const birthDate = parseConfiguredDate(node.data.birthDate, dateFormat);
    return birthDate ? birthDate.getTime() : 0;
  };

  // Function to get "family unit" key for siblings
  const getFamilyKey = (nodeId: string): string => {
    const parents = (parentsOf.get(nodeId) || []).sort();
    return parents.length > 0 ? parents.join('+') : `root-${nodeId}`;
  };

  const positionNode = (nodeId: string, x: number, level: number): number => {
    if (positioned.has(nodeId)) return x;
    
    const node = nodeMap.get(nodeId)!;
    const partners = (partnersOf.get(nodeId) || []).filter(pid => levels.get(pid) === level);
    
    // Group node with its partners
    const familyGroup = [nodeId, ...partners];
    familyGroup.forEach(id => positioned.add(id));

    // Place the group centered around x
    const groupWidth = (familyGroup.length - 1) * HORIZONTAL_SPACING;
    let startX = x + (groupWidth / 2);

    familyGroup.forEach((id, idx) => {
      const n = nodeMap.get(id)!;
      n.position = { x: startX - (idx * HORIZONTAL_SPACING), y: level * VERTICAL_SPACING };
    });

    // Handle anchor nodes for partner edges in this group
    familyGroup.forEach(id => {
      const partners = partnersOf.get(id) || [];
      partners.forEach(partnerId => {
        // Find the edge between id and partnerId
        const pEdge = edges.find(e => 
          (e.source === id && e.target === partnerId) || 
          (e.source === partnerId && e.target === id)
        );
        if (pEdge && edgeToAnchor.has(pEdge.id)) {
          const anchorId = edgeToAnchor.get(pEdge.id)!;
          const anchorNode = nodeMap.get(anchorId);
          if (anchorNode) {
            const sNode = nodeMap.get(pEdge.source)!;
            const tNode = nodeMap.get(pEdge.target)!;
            const anchorX = (sNode.position.x + tNode.position.x) / 2;
            const anchorY = Math.max(sNode.position.y, tNode.position.y) + 40;
            anchorNode.position = { x: anchorX, y: anchorY };
            positioned.add(anchorId);
          }
        }
      });
    });

    // Now position children of this family group
    const allChildren = new Set<string>();
    familyGroup.forEach(id => {
      (childrenOf.get(id) || []).forEach(cid => {
        if (!anchorToEdge.has(cid)) { // Don't treat anchor as a child here
          allChildren.add(cid);
        }
      });
    });

    // Also collect children that come from anchors of edges in this group
    familyGroup.forEach(id => {
      const partners = partnersOf.get(id) || [];
      partners.forEach(partnerId => {
        const pEdge = edges.find(e => 
          (e.source === id && e.target === partnerId) || 
          (e.source === partnerId && e.target === id)
        );
        if (pEdge && edgeToAnchor.has(pEdge.id)) {
          const anchorId = edgeToAnchor.get(pEdge.id)!;
          (childrenOf.get(anchorId) || []).forEach(cid => allChildren.add(cid));
        }
      });
    });

    if (allChildren.size > 0) {
      const childrenList = Array.from(allChildren).map(cid => nodeMap.get(cid)!);
      
      // Sort children by age (oldest right, youngest left)
      // getAgeScore returns timestamp, so smaller timestamp = older
      childrenList.sort((a, b) => getAgeScore(a) - getAgeScore(b));

      // Calculate width for children
      const childrenWidth = (childrenList.length - 1) * HORIZONTAL_SPACING;
      // Center children under the family group
      // The family group is centered at 'x'
      let childX = x + (childrenWidth / 2);

      // If there's a partnership, children should "spin off" from it.
      // This means childX is relative to the center of parents.
      // We already use 'x' as the center of the family group.

      childrenList.forEach(child => {
        positionNode(child.id, childX, level + 1);
        childX -= HORIZONTAL_SPACING;
      });
    }

    return x;
  };

  // Start positioning from root nodes, but grouped by "family" if they are siblings
  const rootsByFamily = new Map<string, string[]>();
  rootNodes.forEach(node => {
    const key = getFamilyKey(node.id);
    if (!rootsByFamily.has(key)) rootsByFamily.set(key, []);
    rootsByFamily.get(key)!.push(node.id);
  });

  let currentRootX = 0;
  rootsByFamily.forEach((rootIds) => {
    const rootFamilyNodes = rootIds.map(id => nodeMap.get(id)!);
    rootFamilyNodes.sort((a, b) => getAgeScore(a) - getAgeScore(b));

    rootFamilyNodes.forEach(node => {
      if (!positioned.has(node.id)) {
        positionNode(node.id, currentRootX, levels.get(node.id) || 0);
        currentRootX -= HORIZONTAL_SPACING * 2; // Gap between families
      }
    });
  });

  // Ensure any orphaned nodes are also positioned
  nodes.forEach(node => {
    if (!positioned.has(node.id) && node.type !== 'anchor') {
      positionNode(node.id, currentRootX, levels.get(node.id) || 0);
      currentRootX -= HORIZONTAL_SPACING * 2;
    }
  });

  // Finally position any anchor nodes that weren't positioned by family grouping
  nodes.forEach(node => {
    if (!positioned.has(node.id) && node.type === 'anchor') {
      const edgeId = node.id.replace('anchor-', '');
      const pEdge = edges.find(e => e.id === edgeId);
      if (pEdge) {
        const sNode = nodeMap.get(pEdge.source);
        const tNode = nodeMap.get(pEdge.target);
        if (sNode && tNode) {
          const anchorX = (sNode.position.x + tNode.position.x) / 2;
          const anchorY = Math.max(sNode.position.y, tNode.position.y) + 40;
          node.position = { x: anchorX, y: anchorY };
        }
      }
      positioned.add(node.id);
    }
  });

  // 4. Update edge types and handles
  const finalEdges = edges.map((edge) => {
    const isPartner = edge.data?.relation === 'partner' || edge.data?.relation === 'divorce';
    
    if (isPartner) {
      return {
        ...edge,
        type: 'partner',
        sourceHandle: 'bottom-source',
        targetHandle: 'bottom-target',
        style: { ...edge.style, strokeWidth: 2 },
        data: { ...edge.data, anchor: edge.data?.anchor ?? 0.5 },
      };
    }

    // Check if this edge is between two parents and a child
    // In our new model, parent-child edges can come from anchor nodes
    if (anchorToEdge.has(edge.source) || edge.sourceHandle === 'partner-anchor' || edge.sourceHandle === 'anchor-source') {
      return {
        ...edge,
        sourceHandle: 'anchor-source',
        targetHandle: 'top-target',
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
