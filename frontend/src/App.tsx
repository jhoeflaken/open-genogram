import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DragEvent, MouseEvent as ReactMouseEvent } from 'react';
import {
  addEdge,
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type NodeMouseHandler,
  type ReactFlowInstance,
  type NodeTypes,
  type OnSelectionChangeParams,
  type XYPosition
} from '@xyflow/react';
import { getNodesBounds } from '@xyflow/react';
import { ActionIcon, AppShell, Button, Divider, Group, Loader, Menu, Modal, Select, Stack, Text, TextInput, Title, Tooltip } from '@mantine/core';
import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconArrowsHorizontal,
  IconArrowsVertical,
  IconChevronLeft,
  IconChevronRight,
  IconChevronDown,
  IconDeviceFloppy,
  IconFilePlus,
  IconFolderOpen,
  IconHandMove,
  IconLayoutAlignBottom,
  IconLayoutAlignLeft,
  IconLayoutAlignRight,
  IconLayoutAlignTop,
  IconPointer,
  IconPrinter,
  IconSettings,
  IconTournament,
  IconTrash
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { DetailsPanel } from './components/DetailsPanel';
import { Palette } from './components/Palette';
import { PersonNode } from './components/PersonNode';
import { PartnerEdge } from './components/PartnerEdge';
import { createDiagram, getDiagram, listDiagrams, updateDiagram } from './api/client';
import type { DiagramSummary } from './api/client';
import { createPersonNode, createRelationEdge, relationStyle, updateEdgeRelation } from './lib/diagram';
import { performLayout } from './lib/layout';
import { SYMBOL_DEFINITIONS, symbolToSex } from './lib/genogramSymbols';
import { DATE_FORMAT_OPTIONS } from './lib/dateFormat';
import { useAppSettings } from './context/AppSettingsContext';
import { useHistory } from './context/HistoryContext';
import { AnchorNode } from './components/AnchorNode';
import type { DateFormat } from './lib/dateFormat';
import type { Diagram, PersonFlowNode, PersonNodeData, PersonSymbol, RelationEdgeData } from './types/genogram';

const nodeTypes: NodeTypes = {
  person: PersonNode,
  anchor: AnchorNode,
};
const edgeTypes = {
  partner: PartnerEdge,
};
const ASIDE_EXPANDED_WIDTH = 340;
const ASIDE_COLLAPSED_WIDTH = 0;
const ASIDE_MIN_WIDTH = 260;
const ASIDE_MAX_WIDTH = 720;

export function App() {
  const { dateFormat, setDateFormat } = useAppSettings();
  const { pushSnapshot, undo, redo, canUndo, canRedo, register } = useHistory();
  const [configOpen, setConfigOpen] = useState(false);
  const [configDateFormat, setConfigDateFormat] = useState<DateFormat>(dateFormat);
  const [nodes, setNodes, onNodesChangeOriginal] = useNodesState<PersonFlowNode>([]);
  const [edges, setEdges, onEdgesChangeOriginal] = useEdgesState<Edge<RelationEdgeData>>([]);

  const onNodesChange = useCallback((changes: any) => {
    onNodesChangeOriginal(changes);
  }, [onNodesChangeOriginal]);

  const onEdgesChange = useCallback((changes: any) => {
    // If a partner edge is deleted, delete its associated anchor node
    changes.forEach((change: any) => {
      if (change.type === 'remove') {
        const edge = edges.find(e => e.id === change.id);
        if (edge?.type === 'partner') {
          const anchorId = `anchor-${edge.id}`;
          setNodes(nds => nds.filter(n => n.id !== anchorId));
        }
      }
    });
    onEdgesChangeOriginal(changes);
  }, [edges, onEdgesChangeOriginal, setNodes]);

  // Register setters with history context once
  useEffect(() => {
    register({ setNodes, setEdges });
  }, [register, setNodes, setEdges]);
  const [diagramId, setDiagramId] = useState('');
  const [diagramName, setDiagramName] = useState('Family Diagram');
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [loadNameFilter, setLoadNameFilter] = useState('');
  const [diagramList, setDiagramList] = useState<DiagramSummary[]>([]);
  const [diagramListBusy, setDiagramListBusy] = useState(false);
  const [selectedLoadId, setSelectedLoadId] = useState<string | null>(null);
  const [newNameDraft, setNewNameDraft] = useState('Family Diagram');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [interactionMode, setInteractionMode] = useState<'select' | 'move'>('select');
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance<PersonFlowNode, Edge<RelationEdgeData>> | null>(null);
  const [nodeDialogOpen, setNodeDialogOpen] = useState(false);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [pendingNode, setPendingNode] = useState<{ symbol: PersonSymbol; x: number; y: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null);
  const [relationDraft, setRelationDraft] = useState<{ sourceId: string; side: 'left' | 'right' } | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [asideCollapsed, setAsideCollapsed] = useState(false);
  const [asideWidth, setAsideWidth] = useState(ASIDE_EXPANDED_WIDTH);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printPaperSize, setPrintPaperSize] = useState<'A4' | 'A3' | 'A0'>('A4');
  const [printOrientation, setPrintOrientation] = useState<'portrait' | 'landscape'>('landscape');
  const [printScale, setPrintScale] = useState(1.0);
  const [highlightLineage, setHighlightLineage] = useState(false);

  const selectedNode = useMemo(() => nodes.find((n) => n.id === selectedNodeId) ?? null, [nodes, selectedNodeId]);
  const selectedEdge = useMemo(() => edges.find((e) => e.id === selectedEdgeId) ?? null, [edges, selectedEdgeId]);
  const selectedNodes = useMemo(() => nodes.filter((n) => selectedNodeIds.includes(n.id)), [nodes, selectedNodeIds]);

  const selectedNodeIdsSet = useMemo(() => new Set(selectedNodeIds), [selectedNodeIds]);

  const lineageData = useMemo(() => {
    if (!highlightLineage || !selectedNodeId) return null;

    const predecessors = new Set<string>();
    const successors = new Set<string>();
    const highlightedEdges = new Set<string>();

    const findPredecessors = (nodeId: string) => {
      edges.forEach((edge) => {
        if (edge.target === nodeId) {
          if (!predecessors.has(edge.source)) {
            predecessors.add(edge.source);
            highlightedEdges.add(edge.id);
            findPredecessors(edge.source);
          }
        }
      });
    };

    const findSuccessors = (nodeId: string) => {
      edges.forEach((edge) => {
        if (edge.source === nodeId) {
          if (!successors.has(edge.target)) {
            successors.add(edge.target);
            highlightedEdges.add(edge.id);
            findSuccessors(edge.target);
          }
        }
      });
    };

    findPredecessors(selectedNodeId);
    findSuccessors(selectedNodeId);

    return {
      nodes: new Set([...predecessors, ...successors, selectedNodeId]),
      edges: highlightedEdges
    };
  }, [highlightLineage, selectedNodeId, edges]);

  const styledNodes = useMemo(() => {
    if (!lineageData) return nodes;
    return nodes.map((n) => ({
      ...n,
      style: {
        ...n.style,
        opacity: lineageData.nodes.has(n.id) ? 1 : 0.25,
        transition: 'opacity 200ms'
      }
    }));
  }, [nodes, lineageData]);

  const styledEdges = useMemo(() => {
    if (!lineageData) return edges;
    return edges.map((e) => ({
      ...e,
      style: {
        ...e.style,
        opacity: lineageData.edges.has(e.id) ? 1 : 0.1,
        transition: 'opacity 200ms'
      }
    }));
  }, [edges, lineageData]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      pushSnapshot(nodes as PersonFlowNode[], edges);

      // Handle connection from PartnerEdge anchor
      const isAnchorSource = connection.source.startsWith('anchor-');
      if (isAnchorSource || connection.sourceHandle === 'partner-anchor') {
        const childId = connection.target;
        const sourceNodeId = isAnchorSource ? connection.source : `anchor-${connection.source}`;
        setEdges((eds) => [
          ...eds,
          createRelationEdge(sourceNodeId, childId, 'parent-child', {
            sourceHandle: 'anchor-source',
            targetHandle: 'top-target'
          }),
        ]);
        return;
      }

      if (relationDraft && (connection.source === relationDraft.sourceId || connection.target === relationDraft.sourceId)) {
        const otherId = connection.source === relationDraft.sourceId ? connection.target : connection.source;
        if (!otherId) return;

        if (relationDraft.side === 'left') {
          // Left side relation: visually left->right by swapping source/target
          const edgeId = crypto.randomUUID();
          const edge = createRelationEdge(otherId, relationDraft.sourceId, 'partner', {
            id: edgeId,
            sourceHandle: 'bottom-source',
            targetHandle: 'bottom-target'
          });
          setEdges((eds) => addEdge(edge, eds));

          // Create anchor node
          const sourceNode = nodes.find(n => n.id === otherId);
          const targetNode = nodes.find(n => n.id === relationDraft.sourceId);
          if (sourceNode && targetNode) {
            const anchorX = (sourceNode.position.x + targetNode.position.x) / 2;
            const anchorY = Math.max(sourceNode.position.y, targetNode.position.y) + 40;
            const anchorNode: PersonFlowNode = {
              id: `anchor-${edgeId}`,
              type: 'anchor',
              position: { x: anchorX, y: anchorY },
              data: { name: '', sex: 'unknown', symbol: 'unknown', deceased: false, isAnchor: true },
              draggable: false,
            };
            setNodes(nds => [...nds, anchorNode]);
          }
        } else {
          const edgeId = crypto.randomUUID();
          const edge = createRelationEdge(relationDraft.sourceId, otherId, 'partner', {
            id: edgeId,
            sourceHandle: 'bottom-source',
            targetHandle: 'bottom-target'
          });
          setEdges((eds) => addEdge(edge, eds));

          // Create anchor node
          const sourceNode = nodes.find(n => n.id === relationDraft.sourceId);
          const targetNode = nodes.find(n => n.id === otherId);
          if (sourceNode && targetNode) {
            const anchorX = (sourceNode.position.x + targetNode.position.x) / 2;
            const anchorY = Math.max(sourceNode.position.y, targetNode.position.y) + 40;
            const anchorNode: PersonFlowNode = {
              id: `anchor-${edgeId}`,
              type: 'anchor',
              position: { x: anchorX, y: anchorY },
              data: { name: '', sex: 'unknown', symbol: 'unknown', deceased: false, isAnchor: true },
              draggable: false,
            };
            setNodes(nds => [...nds, anchorNode]);
          }
        }

        setRelationDraft(null);
        return;
      }

      if (connection.sourceHandle === 'bottom-source') {
        const edgeId = crypto.randomUUID();
        const edge = createRelationEdge(connection.source, connection.target, 'partner', {
          id: edgeId,
          sourceHandle: 'bottom-source',
          targetHandle: 'bottom-target'
        });
        setEdges((eds) => addEdge(edge, eds));

        // Create anchor node for this edge
        const sourceNode = nodes.find(n => n.id === connection.source);
        const targetNode = nodes.find(n => n.id === connection.target);
        if (sourceNode && targetNode) {
          const anchorX = (sourceNode.position.x + targetNode.position.x) / 2;
          const anchorY = Math.max(sourceNode.position.y, targetNode.position.y) + 40;
          const anchorNode: PersonFlowNode = {
            id: `anchor-${edgeId}`,
            type: 'anchor',
            position: { x: anchorX, y: anchorY },
            data: { name: '', sex: 'unknown', symbol: 'unknown', deceased: false, isAnchor: true },
            draggable: false,
          };
          setNodes(nds => [...nds, anchorNode]);
        }
        return;
      }

      const edge = createRelationEdge(connection.source, connection.target, 'parent-child');
      setEdges((eds) => addEdge(edge, eds));
    },
    [edges, nodes, pushSnapshot, relationDraft, setEdges]
  );

  const onSelectionChange = useCallback((selection: OnSelectionChangeParams) => {
    setSelectedNodeIds(selection.nodes.map((n) => n.id));
    setSelectedNodeId(selection.nodes[0]?.id ?? null);
    setSelectedEdgeId(selection.edges[0]?.id ?? null);
  }, []);

  const applySelectedNodePositions = useCallback((nextById: Record<string, XYPosition>) => {
    pushSnapshot(nodes, edges);
    setNodes((prev) => prev.map((n) => (nextById[n.id] ? { ...n, position: nextById[n.id] } : n)));
  }, [edges, nodes, pushSnapshot, setNodes]);

  const alignSelectedNodes = useCallback((dir: 'left' | 'right' | 'top' | 'bottom') => {
    if (selectedNodes.length < 2) return;
    const xs = selectedNodes.map((n) => n.position.x);
    const ys = selectedNodes.map((n) => n.position.y);
    const targetX = dir === 'left' ? Math.min(...xs) : Math.max(...xs);
    const targetY = dir === 'top' ? Math.min(...ys) : Math.max(...ys);

    const nextById: Record<string, XYPosition> = {};
    selectedNodes.forEach((n) => {
      nextById[n.id] = {
        x: dir === 'left' || dir === 'right' ? targetX : n.position.x,
        y: dir === 'top' || dir === 'bottom' ? targetY : n.position.y,
      };
    });
    applySelectedNodePositions(nextById);
  }, [applySelectedNodePositions, selectedNodes]);

  const distributeSelectedNodes = useCallback((axis: 'horizontal' | 'vertical') => {
    if (selectedNodes.length < 3) return;
    const sorted = [...selectedNodes].sort((a, b) => (axis === 'horizontal'
      ? a.position.x - b.position.x
      : a.position.y - b.position.y));

    const first = axis === 'horizontal' ? sorted[0].position.x : sorted[0].position.y;
    const last = axis === 'horizontal'
      ? sorted[sorted.length - 1].position.x
      : sorted[sorted.length - 1].position.y;
    const step = (last - first) / (sorted.length - 1);

    const nextById: Record<string, XYPosition> = {};
    sorted.forEach((n, idx) => {
      nextById[n.id] = axis === 'horizontal'
        ? { x: first + step * idx, y: n.position.y }
        : { x: n.position.x, y: first + step * idx };
    });
    applySelectedNodePositions(nextById);
  }, [applySelectedNodePositions, selectedNodes]);

  useEffect(() => {
    const onStartRelation = (event: Event) => {
      const detail = (event as CustomEvent<{ sourceId: string; side: 'left' | 'right' }>).detail;
      if (!detail?.sourceId) return;
      setRelationDraft(detail);
      notifications.show({ color: 'blue', message: 'Relation mode active: drag from a + handle to another node.' });
    };
    window.addEventListener('genogram:start-relation', onStartRelation as EventListener);
    return () => window.removeEventListener('genogram:start-relation', onStartRelation as EventListener);
  }, []);

  const openNodeDialog = useCallback((symbol: PersonSymbol, x: number, y: number) => {
    setPendingNode({ symbol, x, y });
    setNewFirstName('');
    setNewLastName('');
    setNodeDialogOpen(true);
  }, []);

  const handleAddPerson = useCallback(
    (symbol: PersonSymbol) => {
      openNodeDialog(symbol, 140 + nodes.length * 40, 120 + nodes.length * 20);
    },
    [nodes.length, openNodeDialog]
  );

  const removeNodeByID = useCallback(
    (nodeID: string) => {
      pushSnapshot(nodes, edges);
      setNodes((prev) => prev.filter((node) => node.id !== nodeID));
      setEdges((prev) => prev.filter((edge) => edge.source !== nodeID && edge.target !== nodeID));
      if (selectedNodeId === nodeID) setSelectedNodeId(null);
      setSelectedNodeIds((prev) => prev.filter((id) => id !== nodeID));
      setSelectedEdgeId(null);
      setContextMenu(null);
    },
    [edges, nodes, pushSnapshot, selectedNodeId, setEdges, setNodes]
  );

  const handleNodePatch = useCallback(
    (patch: Partial<PersonNodeData>) => {
      if (!selectedNodeId) return;
      pushSnapshot(nodes, edges);
      setNodes((prev) =>
        prev.map((n) => {
          if (n.id !== selectedNodeId) return n;
          const firstName = patch.firstName ?? n.data.firstName ?? n.data.name?.split(' ')[0] ?? '';
          const lastName = patch.lastName ?? n.data.lastName ?? n.data.name?.split(' ').slice(1).join(' ') ?? '';
          const nextData = {
            ...n.data,
            uid: n.data.uid ?? crypto.randomUUID(),
            ...patch,
            firstName,
            lastName,
            name: `${firstName} ${lastName}`.trim() || n.data.name,
          };
          if (patch.symbol) nextData.sex = symbolToSex(patch.symbol);
          return { ...n, data: nextData };
        })
      );
    },
    [edges, nodes, pushSnapshot, selectedNodeId, setNodes]
  );

  const handleEdgeRelationPatch = useCallback(
    (relation: RelationEdgeData['relation']) => {
      if (!selectedEdgeId) return;
      pushSnapshot(nodes, edges);
      setEdges((prev) => prev.map((e) => (e.id === selectedEdgeId ? updateEdgeRelation(e, relation) : e)));
    },
    [edges, nodes, pushSnapshot, selectedEdgeId, setEdges]
  );

  const fetchDiagramList = useCallback(async (filter: string) => {
    setDiagramListBusy(true);
    try {
      const items = await listDiagrams(filter || undefined);
      setDiagramList(items);
    } catch (err) {
      notifications.show({ color: 'red', message: `Failed to load diagram list: ${String(err)}` });
    } finally {
      setDiagramListBusy(false);
    }
  }, []);

  const openLoadDialog = useCallback(() => {
    setLoadNameFilter('');
    setSelectedLoadId(null);
    setLoadDialogOpen(true);
    void fetchDiagramList('');
  }, [fetchDiagramList]);

  const handleLoad = useCallback(async (id: string) => {
    if (!id) {
      notifications.show({ color: 'yellow', message: 'Enter a diagram ID first.' });
      return;
    }
    setIsBusy(true);
    try {
      const loaded = await getDiagram(id);
      const nodesWithUID = loaded.nodes.map((node) => {
        const uid = node.data.uid || crypto.randomUUID();
        const firstName = node.data.firstName || node.data.name?.split(' ')[0] || '';
        const lastName = node.data.lastName || node.data.name?.split(' ').slice(1).join(' ') || '';
        return {
          ...node,
          data: { ...node.data, uid, firstName, lastName }
        };
      });
      setNodes(nodesWithUID);
      // Re-apply style, type, handles and animated based on relation — these are not stored by backend
      const edgesRestored = loaded.edges.map((edge) => {
        const rel = edge.data?.relation ?? 'parent-child';
        const isPartner = rel === 'partner' || rel === 'divorce';
        return {
          ...edge,
          type: isPartner ? 'partner' : 'smoothstep',
          style: relationStyle(rel),
          animated: rel === 'adoption',
          sourceHandle: isPartner ? (edge.sourceHandle || 'bottom-source') : edge.sourceHandle,
          targetHandle: isPartner ? (edge.targetHandle || 'bottom-target') : edge.targetHandle,
          markerEnd: undefined,
        };
      });
      setEdges(edgesRestored);
      setDiagramName(loaded.name);
      setDiagramId(loaded.id);
      setSelectedNodeId(null);
      setSelectedNodeIds([]);
      setSelectedEdgeId(null);
      notifications.show({ color: 'green', message: 'Diagram loaded.' });
    } catch (err) {
      notifications.show({ color: 'red', message: `Load failed: ${String(err)}` });
    } finally {
      setIsBusy(false);
    }
  }, [setEdges, setNodes]);

  const handleSave = useCallback(async () => {
    setIsBusy(true);
    const payload: Diagram = {
      id: diagramId,
      name: diagramName,
      nodes,
      edges
    };

    try {
      if (!diagramId) {
        const created = await createDiagram({ ...payload, id: undefined });
        setDiagramId(created.id);
        notifications.show({ color: 'green', message: `Created diagram ${created.id}` });
      } else {
        await updateDiagram(diagramId, payload);
        notifications.show({ color: 'green', message: 'Diagram saved.' });
      }
    } catch (err) {
      notifications.show({ color: 'red', message: `Save failed: ${String(err)}` });
    } finally {
      setIsBusy(false);
    }
  }, [diagramId, diagramName, edges, nodes]);

  const handleCreateNew = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setDiagramId('');
    setDiagramName(newNameDraft.trim() || 'Family Diagram');
    setSelectedNodeId(null);
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    setNewDialogOpen(false);
  }, [newNameDraft, setEdges, setNodes]);

  useEffect(() => {
    document.title = `${diagramName} - Genogram Editor`;
  }, [diagramName]);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (!reactFlowInstance) return;

      const raw = event.dataTransfer.getData('application/genogram-symbol');
      const isKnownSymbol = SYMBOL_DEFINITIONS.some((item) => item.symbol === raw);
      if (!isKnownSymbol) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY
      });

      openNodeDialog(raw as PersonSymbol, position.x, position.y);
    },
    [openNodeDialog, reactFlowInstance]
  );

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleNodeContextMenu: NodeMouseHandler<PersonFlowNode> = useCallback((event, node) => {
    event.preventDefault();
    setSelectedNodeId(node.id);
    setSelectedNodeIds([node.id]);
    setSelectedEdgeId(null);
    setContextMenu({
      nodeId: node.id,
      x: event.clientX,
      y: event.clientY
    });
  }, []);

  const handleCreateNodeWithName = useCallback(() => {
    if (!pendingNode || !newFirstName.trim() || !newLastName.trim()) return;
    pushSnapshot(nodes, edges);
    const id = crypto.randomUUID();
    const node = createPersonNode(id, pendingNode.symbol, pendingNode.x, pendingNode.y, newFirstName.trim(), newLastName.trim());
    setNodes((prev) => [...prev, node]);
    setNodeDialogOpen(false);
    setPendingNode(null);
    setNewFirstName('');
    setNewLastName('');
  }, [edges, newFirstName, newLastName, nodes, pendingNode, pushSnapshot, setNodes]);

  useEffect(() => {
    const isEditable = (el: Element | null) => {
      if (!el) return false;
      const tag = (el as HTMLElement).tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
        || (el as HTMLElement).isContentEditable;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditable(document.activeElement)) return;

      // Undo / Redo
      if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
        event.preventDefault();
        undo();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && (event.key === 'y' || (event.shiftKey && event.key === 'z'))) {
        event.preventDefault();
        redo();
        return;
      }

      // Delete
      if (event.key === 'Delete') {
        if (selectedNodeIds.length > 1) {
          pushSnapshot(nodes, edges);
          const ids = new Set(selectedNodeIds);
          setNodes((prev) => prev.filter((n) => !ids.has(n.id)));
          setEdges((prev) => prev.filter((e) => !ids.has(e.source) && !ids.has(e.target)));
          setSelectedNodeId(null);
          setSelectedNodeIds([]);
          setSelectedEdgeId(null);
        } else if (selectedNodeId) {
          removeNodeByID(selectedNodeId);
        } else if (selectedEdgeId) {
          pushSnapshot(nodes, edges);
          setEdges((prev) => prev.filter((e) => e.id !== selectedEdgeId));
          setSelectedEdgeId(null);
        }
        return;
      }

      if (!reactFlowInstance) return;
      const step = event.shiftKey ? 120 : 80;
      const viewport = reactFlowInstance.getViewport();
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        void reactFlowInstance.setViewport({ ...viewport, x: viewport.x + step });
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        void reactFlowInstance.setViewport({ ...viewport, x: viewport.x - step });
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        void reactFlowInstance.setViewport({ ...viewport, y: viewport.y + step });
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        void reactFlowInstance.setViewport({ ...viewport, y: viewport.y - step });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [edges, nodes, pushSnapshot, reactFlowInstance, redo, removeNodeByID, selectedEdgeId, selectedNodeId, selectedNodeIds, setEdges, setNodes, undo]);

  const toggleAside = useCallback(() => {
    setAsideCollapsed((prev) => !prev);
  }, []);

  const handleAutoLayout = useCallback(() => {
    pushSnapshot(nodes, edges);
    const { nodes: nextNodes, edges: nextEdges } = performLayout(nodes, edges, dateFormat);
    setNodes(nextNodes);
    setEdges(nextEdges);
    
    notifications.show({
      title: 'Layout Applied',
      message: 'Diagram has been automatically laid out.',
      color: 'green'
    });
  }, [nodes, edges, dateFormat, pushSnapshot, setNodes, setEdges]);

  const handlePrint = useCallback(() => {
    if (!reactFlowInstance) { window.print(); return; }

    const allNodes = reactFlowInstance.getNodes();
    const wrapperEl = document.querySelector('.flow-wrapper') as HTMLElement | null;
    if (!wrapperEl) { window.print(); return; }

    // Paper dimensions in mm
    const PAPER_SIZES = {
      A4: { width: 210, height: 297 },
      A3: { width: 297, height: 420 },
      A0: { width: 841, height: 1189 },
    };

    const paperDim = PAPER_SIZES[printPaperSize];
    const marginMm = 8;
    const pWmm = printOrientation === 'landscape' ? paperDim.height : paperDim.width;
    const pHmm = printOrientation === 'landscape' ? paperDim.width : paperDim.height;

    // Convert mm to pixels (approx 3.78 px/mm for 96dpi)
    const pxPerMm = 3.78;
    const pWpx = Math.floor((pWmm - 2 * marginMm) * pxPerMm);
    const pHpx = Math.floor((pHmm - 2 * marginMm) * pxPerMm);

    const bounds = allNodes.length > 0 ? getNodesBounds(allNodes) : { x: 0, y: 0, width: 0, height: 0 };
    const padding = 20;
    const diagramW = (bounds.width + padding * 2) * printScale;
    const diagramH = (bounds.height + padding * 2) * printScale;

    const cols = Math.ceil(diagramW / pWpx);
    const rows = Math.ceil(diagramH / pHpx);

    // Snapshot the canvas HTML
    const canvasHTML = wrapperEl.outerHTML;

    // Collect all styles
    const styleLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .map((el) => el.outerHTML).join('\n');
    const inlineStyles = Array.from(document.querySelectorAll('style'))
      .map((el) => el.outerHTML).join('\n');
    const rootStyle = document.documentElement.getAttribute('style') ?? '';

    const printWindow = window.open('', '_blank', 'width=1200,height=900');
    if (!printWindow) { window.print(); return; }

    let pagesHTML = '';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const tx = (-bounds.x + padding) * printScale - (c * pWpx);
        const ty = (-bounds.y + padding) * printScale - (r * pHpx);

        pagesHTML += `
          <div class="page">
            <div class="flow-container">
              <div class="flow-wrapper-print" style="transform: translate(${tx}px, ${ty}px) scale(${printScale}); transform-origin: top left;">
                ${canvasHTML}
              </div>
            </div>
          </div>
        `;
      }
    }

    printWindow.document.write(`<!DOCTYPE html>
<html style="${rootStyle}">
<head>
  <meta charset="utf-8">
  <title>Print Diagram</title>
  ${styleLinks}
  ${inlineStyles}
  <style>
    *, *::before, *::after { print-color-adjust: exact; -webkit-print-color-adjust: exact; box-sizing: border-box; }
    @page { size: ${printPaperSize} ${printOrientation}; margin: 0; }
    html, body { margin: 0; padding: 0; background: #fff; }
    .page {
      width: ${pWmm}mm;
      height: ${pHmm}mm;
      position: relative;
      overflow: hidden;
      page-break-after: always;
      margin: 0;
      padding: ${marginMm}mm;
    }
    .flow-container {
      width: ${pWpx}px;
      height: ${pHpx}px;
      position: relative;
      overflow: hidden;
    }
    .flow-wrapper-print {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    }
    .flow-wrapper {
      width: 10000px !important;
      height: 10000px !important;
      background: transparent !important;
    }
    .react-flow__viewport { transform: none !important; }
    .react-flow, .react-flow__container, .react-flow__renderer, .react-flow__pane { overflow: visible !important; }
    .action-handle, .react-flow__minimap, .react-flow__controls, .react-flow__background { display: none !important; }
  </style>
</head>
<body>${pagesHTML}</body>
</html>`);
    printWindow.document.close();

    const doprint = () => { printWindow.print(); printWindow.close(); };
    if (printWindow.document.readyState === 'complete') {
      doprint();
    } else {
      printWindow.addEventListener('load', doprint, { once: true });
    }
  }, [reactFlowInstance, printPaperSize, printOrientation, printScale]);

  const onAsideResizeMouseDown = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (asideCollapsed) return;
    event.preventDefault();

    const startX = event.clientX;
    const startWidth = asideWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX;
      const nextWidth = Math.max(ASIDE_MIN_WIDTH, Math.min(ASIDE_MAX_WIDTH, startWidth + delta));
      setAsideWidth(nextWidth);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [asideCollapsed, asideWidth]);

  return (
    <AppShell
      header={{ height: 64 }}
      navbar={{ width: 210, breakpoint: 'sm' }}
      aside={{ width: asideCollapsed ? ASIDE_COLLAPSED_WIDTH : asideWidth, breakpoint: 'sm' }}
      padding={0}
    >
      <AppShell.Header p="sm" style={{ borderBottom: '1px solid #e9ecef' }}>
        <Group justify="space-between" align="center" h="100%">
          <Group gap="md" align="center">
            <Menu shadow="md" width={220}>
              <Menu.Target>
                <Button variant="light" rightSection={<IconChevronDown size={14} />}>File</Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item leftSection={<IconFilePlus size={14} />} onClick={() => setNewDialogOpen(true)}>
                  New Diagram
                </Menu.Item>
                <Menu.Item leftSection={<IconFolderOpen size={14} />} onClick={openLoadDialog}>
                  Load Existing Diagram
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item leftSection={<IconSettings size={14} />} onClick={() => { setConfigDateFormat(dateFormat); setConfigOpen(true); }}>
                  Configuration
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
            <Title order={4}>{diagramName}</Title>
            {diagramId && <Text size="sm" c="dimmed">ID: {diagramId}</Text>}
          </Group>
          <Group>
            {isBusy && <Loader size="sm" />}
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar>
        <Palette onAddPerson={handleAddPerson} />
      </AppShell.Navbar>

      <AppShell.Main onClick={() => setContextMenu(null)}>
        <div className="diagram-main">
          <Group justify="flex-start" className="diagram-toolbar" gap={4}>
            <Tooltip label="Save">
              <ActionIcon variant="subtle" aria-label="Save" onClick={handleSave}>
                <IconDeviceFloppy size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Print">
              <ActionIcon variant="subtle" aria-label="Print" onClick={() => setPrintModalOpen(true)}>
                <IconPrinter size={18} />
              </ActionIcon>
            </Tooltip>
            <Divider orientation="vertical" mx={4} />
            <Tooltip label="Move mode (pan by drag)">
              <ActionIcon
                variant={interactionMode === 'move' ? 'filled' : 'subtle'}
                aria-label="Move mode"
                onClick={() => setInteractionMode('move')}
              >
                <IconHandMove size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Selection mode (click/drag-select)">
              <ActionIcon
                variant={interactionMode === 'select' ? 'filled' : 'subtle'}
                aria-label="Selection mode"
                onClick={() => setInteractionMode('select')}
              >
                <IconPointer size={18} />
              </ActionIcon>
            </Tooltip>
            <Divider orientation="vertical" mx={4} />
            <Tooltip label="Auto Layout">
              <ActionIcon variant="subtle" aria-label="Auto Layout" onClick={() => handleAutoLayout()}>
                <IconLayoutAlignLeft size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Highlight Lineage (toggle)">
              <ActionIcon
                variant={highlightLineage ? 'filled' : 'subtle'}
                aria-label="Highlight Lineage"
                onClick={() => setHighlightLineage((v) => !v)}
              >
                <IconTournament size={18} />
              </ActionIcon>
            </Tooltip>
            <Divider orientation="vertical" mx={4} />
            <Tooltip label="Undo (Ctrl+Z)">
              <ActionIcon variant="subtle" aria-label="Undo" disabled={!canUndo} onClick={undo}>
                <IconArrowBackUp size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Redo (Ctrl+Y)">
              <ActionIcon variant="subtle" aria-label="Redo" disabled={!canRedo} onClick={redo}>
                <IconArrowForwardUp size={18} />
              </ActionIcon>
            </Tooltip>
            <Divider orientation="vertical" mx={4} />
            <Tooltip label="Align left">
              <ActionIcon variant="subtle" aria-label="Align left" disabled={selectedNodeIds.length < 2} onClick={() => alignSelectedNodes('left')}>
                <IconLayoutAlignLeft size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Align top">
              <ActionIcon variant="subtle" aria-label="Align top" disabled={selectedNodeIds.length < 2} onClick={() => alignSelectedNodes('top')}>
                <IconLayoutAlignTop size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Align bottom">
              <ActionIcon variant="subtle" aria-label="Align bottom" disabled={selectedNodeIds.length < 2} onClick={() => alignSelectedNodes('bottom')}>
                <IconLayoutAlignBottom size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Align right">
              <ActionIcon variant="subtle" aria-label="Align right" disabled={selectedNodeIds.length < 2} onClick={() => alignSelectedNodes('right')}>
                <IconLayoutAlignRight size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Distribute horizontally">
              <ActionIcon variant="subtle" aria-label="Distribute horizontally" disabled={selectedNodeIds.length < 3} onClick={() => distributeSelectedNodes('horizontal')}>
                <IconArrowsHorizontal size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Distribute vertically">
              <ActionIcon variant="subtle" aria-label="Distribute vertically" disabled={selectedNodeIds.length < 3} onClick={() => distributeSelectedNodes('vertical')}>
                <IconArrowsVertical size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
          <div className="flow-wrapper" onDrop={handleDrop} onDragOver={handleDragOver}>
          <ReactFlow
            nodes={styledNodes}
            edges={styledEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onInit={setReactFlowInstance}
            fitView
            deleteKeyCode={null}
            multiSelectionKeyCode={['Control', 'Meta', 'Shift']}
            elementsSelectable
            selectionOnDrag={interactionMode === 'select'}
            nodesDraggable={interactionMode === 'select'}
            panOnDrag={interactionMode === 'move'}
            panOnScroll={interactionMode === 'move'}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onSelectionChange={onSelectionChange}
            onNodeContextMenu={handleNodeContextMenu}
            onPaneClick={() => {
              setContextMenu(null);
              setRelationDraft(null);
            }}
          >
            <MiniMap />
            <Controls />
            <Background />
          </ReactFlow>

          {contextMenu && (
            <Menu
              opened
              onClose={() => setContextMenu(null)}
              position="bottom-start"
            >
              <Menu.Target>
                <div
                  className="node-context-menu"
                  style={{ top: contextMenu.y, left: contextMenu.x }}
                />
              </Menu.Target>
              <Menu.Dropdown onClick={(e) => e.stopPropagation()}>
                <Menu.Item
                  color="red"
                  leftSection={<IconTrash size={14} />}
                  onClick={() => removeNodeByID(contextMenu.nodeId)}
                >
                  Remove node
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          )}
          </div>
        </div>
      </AppShell.Main>

      <AppShell.Aside className="details-aside-shell">
        <div className="details-aside-root">
          {!asideCollapsed && <div className="details-aside-resize-strip" onMouseDown={onAsideResizeMouseDown} />}
          <button
            type="button"
            className="details-aside-toggle"
            onClick={toggleAside}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggleAside();
              }
            }}
            aria-label={asideCollapsed ? 'Expand details panel' : 'Collapse details panel'}
            title={asideCollapsed ? 'Expand panel' : 'Collapse panel'}
          >
            {asideCollapsed ? <IconChevronLeft size={20} /> : <IconChevronRight size={20} />}
          </button>
          {!asideCollapsed && (
            <DetailsPanel
              node={selectedNode}
              edge={selectedEdge}
              onNodeChange={handleNodePatch}
              onEdgeRelationChange={handleEdgeRelationPatch}
            />
          )}
        </div>
      </AppShell.Aside>

      <Modal opened={nodeDialogOpen} onClose={() => setNodeDialogOpen(false)} title="Add Node" centered>
        <Stack>
          <TextInput
            label="First Name"
            placeholder="Required"
            required
            autoFocus
            value={newFirstName}
            onChange={(e) => setNewFirstName(e.currentTarget.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateNodeWithName(); }}
          />
          <TextInput
            label="Last Name"
            placeholder="Required"
            required
            value={newLastName}
            onChange={(e) => setNewLastName(e.currentTarget.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateNodeWithName(); }}
          />
          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={() => setNodeDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCreateNodeWithName}
              disabled={!newFirstName.trim() || !newLastName.trim()}
            >
              OK
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={newDialogOpen} onClose={() => setNewDialogOpen(false)} title="Create New Diagram" centered>
        <Stack>
          <TextInput label="Diagram name" value={newNameDraft} onChange={(e) => setNewNameDraft(e.currentTarget.value)} />
          <Button onClick={handleCreateNew}>Create</Button>
        </Stack>
      </Modal>

      <Modal opened={loadDialogOpen} onClose={() => setLoadDialogOpen(false)} title="Load Diagram" size="md" centered>
        <Stack>
          <TextInput
            label="Filter by name"
            placeholder="Type to filter…"
            value={loadNameFilter}
            onChange={(e) => {
              const v = e.currentTarget.value;
              setLoadNameFilter(v);
              void fetchDiagramList(v);
            }}
          />
          {diagramListBusy ? (
            <Group justify="center" py="md"><Loader size="sm" /></Group>
          ) : diagramList.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="md">No diagrams found.</Text>
          ) : (
            <Stack gap={4} style={{ maxHeight: 320, overflowY: 'auto' }}>
              {diagramList.map((d) => (
                <div
                  key={d.id}
                  onClick={() => setSelectedLoadId(d.id)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: selectedLoadId === d.id ? '#e7f0ff' : 'transparent',
                    border: selectedLoadId === d.id ? '1.5px solid #5c7cfa' : '1.5px solid transparent',
                    transition: 'background 120ms',
                  }}
                  onDoubleClick={async () => {
                    await handleLoad(d.id);
                    setLoadDialogOpen(false);
                  }}
                >
                  <Text size="sm" fw={500}>{d.name}</Text>
                </div>
              ))}
            </Stack>
          )}
          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={() => setLoadDialogOpen(false)}>Cancel</Button>
            <Button
              leftSection={<IconFolderOpen size={16} />}
              disabled={!selectedLoadId}
              onClick={async () => {
                if (selectedLoadId) {
                  await handleLoad(selectedLoadId);
                  setLoadDialogOpen(false);
                }
              }}
            >
              Load
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={configOpen} onClose={() => setConfigOpen(false)} title="Configuration" centered>
        <Stack>
          <Select
            label="Date format"
            description="Format used to parse and display birth and death dates on nodes"
            data={DATE_FORMAT_OPTIONS}
            value={configDateFormat}
            onChange={(v) => { if (v) setConfigDateFormat(v as DateFormat); }}
          />
          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={() => setConfigOpen(false)}>Cancel</Button>
            <Button onClick={() => { setDateFormat(configDateFormat); setConfigOpen(false); }}>OK</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={printModalOpen} onClose={() => setPrintModalOpen(false)} title="Print Diagram" centered>
        <Stack>
          <Select
            label="Paper Size"
            data={[
              { value: 'A4', label: 'A4' },
              { value: 'A3', label: 'A3' },
              { value: 'A0', label: 'A0' },
            ]}
            value={printPaperSize}
            onChange={(v) => { if (v) setPrintPaperSize(v as any); }}
          />
          <Select
            label="Orientation"
            data={[
              { value: 'portrait', label: 'Portrait' },
              { value: 'landscape', label: 'Landscape' },
            ]}
            value={printOrientation}
            onChange={(v) => { if (v) setPrintOrientation(v as any); }}
          />
          <Stack gap={4}>
            <Text size="sm" fw={500}>Scale</Text>
            <Group gap="xs">
              <Button size="compact-xs" variant="outline" onClick={() => setPrintScale(s => Math.max(0.1, s - 0.1))}>-0.1</Button>
              <Text size="sm" style={{ minWidth: 40, textAlign: 'center' }}>{(printScale * 100).toFixed(0)}%</Text>
              <Button size="compact-xs" variant="outline" onClick={() => setPrintScale(s => Math.min(2.0, s + 0.1))}>+0.1</Button>
              <Button size="compact-xs" variant="subtle" onClick={() => setPrintScale(1.0)}>Reset</Button>
            </Group>
          </Stack>

          {reactFlowInstance && (
            <Text size="xs" c="dimmed">
              {(() => {
                const PAPER_SIZES = {
                  A4: { width: 210, height: 297 },
                  A3: { width: 297, height: 420 },
                  A0: { width: 841, height: 1189 },
                };
                const paperDim = PAPER_SIZES[printPaperSize];
                const marginMm = 8;
                const pWmm = printOrientation === 'landscape' ? paperDim.height : paperDim.width;
                const pHmm = printOrientation === 'landscape' ? paperDim.width : paperDim.height;
                const pxPerMm = 3.78;
                const pWpx = Math.floor((pWmm - 2 * marginMm) * pxPerMm);
                const pHpx = Math.floor((pHmm - 2 * marginMm) * pxPerMm);

                const allNodes = reactFlowInstance.getNodes();
                const bounds = allNodes.length > 0 ? getNodesBounds(allNodes) : { x: 0, y: 0, width: 0, height: 0, right: 0, bottom: 0 };
                const padding = 20;
                const diagramW = (bounds.width + padding * 2) * printScale;
                const diagramH = (bounds.height + padding * 2) * printScale;

                const cols = Math.ceil(diagramW / pWpx);
                const rows = Math.ceil(diagramH / pHpx);
                return `Estimated pages: ${cols * rows} (${cols} x ${rows})`;
              })()}
            </Text>
          )}

          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={() => setPrintModalOpen(false)}>Cancel</Button>
            <Button onClick={() => { handlePrint(); setPrintModalOpen(false); }}>Print</Button>
          </Group>
        </Stack>
      </Modal>
    </AppShell>
  );
}



