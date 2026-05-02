import type { Diagram, PersonNodeData } from '../types/genogram';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8080/api';

async function expectJSON<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export interface DiagramSummary {
  id: string;
  name: string;
  updatedAt: string;
}

export async function listDiagrams(nameFilter?: string): Promise<DiagramSummary[]> {
  const params = nameFilter ? `?name=${encodeURIComponent(nameFilter)}` : '';
  const res = await fetch(`${API_BASE}/diagrams${params}`);
  return expectJSON<DiagramSummary[]>(res);
}

export async function createDiagram(diagram: Omit<Diagram, 'id'> & { id?: string }): Promise<Diagram> {
  const res = await fetch(`${API_BASE}/diagrams`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(diagram)
  });
  return expectJSON<Diagram>(res);
}

export async function getDiagram(id: string): Promise<Diagram> {
  const res = await fetch(`${API_BASE}/diagrams/${id}`);
  return expectJSON<Diagram>(res);
}

export async function updateDiagram(id: string, diagram: Diagram): Promise<Diagram> {
  const res = await fetch(`${API_BASE}/diagrams/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(diagram)
  });
  return expectJSON<Diagram>(res);
}

export async function updatePerson(diagramId: string, personId: string, person: PersonNodeData): Promise<Diagram> {
  const res = await fetch(`${API_BASE}/diagrams/${diagramId}/persons/${personId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(person)
  });
  return expectJSON<Diagram>(res);
}

