import { describe, expect, it } from 'vitest';
import { createPersonNode, createRelationEdge, updateEdgeRelation } from './diagram';

describe('diagram utilities', () => {
  it('creates a person node with requested sex', () => {
    const node = createPersonNode('abc-1234', 'female', 10, 20);
    expect(node.data.sex).toBe('female');
    expect(node.position.x).toBe(10);
  });

  it('updates edge relation style and metadata', () => {
    const edge = createRelationEdge('a', 'b', 'partner');
    const updated = updateEdgeRelation(edge, 'divorce');
    expect(updated.data?.relation).toBe('divorce');
    expect(String(updated.style?.stroke)).toContain('#e03131');
  });
});

