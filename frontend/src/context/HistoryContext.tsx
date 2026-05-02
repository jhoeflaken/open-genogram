import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import type { Edge } from "@xyflow/react";
import type { PersonFlowNode, RelationEdgeData } from "../types/genogram";
type Snapshot = { nodes: PersonFlowNode[]; edges: Edge<RelationEdgeData>[] };
type Setters  = { setNodes: (ns: PersonFlowNode[]) => void; setEdges: (es: Edge<RelationEdgeData>[]) => void };
type HistoryCtx = {
  pushSnapshot : (nodes: PersonFlowNode[], edges: Edge<RelationEdgeData>[]) => void;
  undo         : () => void;
  redo         : () => void;
  canUndo      : boolean;
  canRedo      : boolean;
  register     : (s: Setters) => void;
};
const HistoryContext = createContext<HistoryCtx>({
  pushSnapshot: () => {},
  undo: () => {}, redo: () => {},
  canUndo: false, canRedo: false,
  register: () => {},
});
const MAX = 100;
export function HistoryProvider({ children }: { children: ReactNode }) {
  const stack    = useRef<Snapshot[]>([]);
  const pos      = useRef(-1);
  const setters  = useRef<Setters | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const sync = () => {
    setCanUndo(pos.current > 0);
    setCanRedo(pos.current < stack.current.length - 1);
  };
  const register = useCallback((s: Setters) => { setters.current = s; }, []);
  const pushSnapshot = useCallback((nodes: PersonFlowNode[], edges: Edge<RelationEdgeData>[]) => {
    stack.current = stack.current.slice(0, pos.current + 1);
    stack.current.push({ nodes, edges });
    if (stack.current.length > MAX) stack.current.shift();
    pos.current = stack.current.length - 1;
    sync();
  }, []);
  const undo = useCallback(() => {
    if (pos.current <= 0) return;
    pos.current--;
    const s = stack.current[pos.current];
    setters.current?.setNodes(s.nodes);
    setters.current?.setEdges(s.edges);
    sync();
  }, []);
  const redo = useCallback(() => {
    if (pos.current >= stack.current.length - 1) return;
    pos.current++;
    const s = stack.current[pos.current];
    setters.current?.setNodes(s.nodes);
    setters.current?.setEdges(s.edges);
    sync();
  }, []);
  return (
    <HistoryContext.Provider value={{ pushSnapshot, undo, redo, canUndo, canRedo, register }}>
      {children}
    </HistoryContext.Provider>
  );
}
export function useHistory() { return useContext(HistoryContext); }