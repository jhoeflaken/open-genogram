import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DragEvent } from 'react';
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
  type OnSelectionChangeParams
} from '@xyflow/react';
import { ActionIcon, AppShell, Button, Divider, Group, Loader, Menu, Modal, Select, Stack, Text, TextInput, Title, Tooltip } from '@mantine/core';
import { IconArrowBackUp, IconArrowForwardUp, IconChevronDown, IconDeviceFloppy, IconFilePlus, IconFolderOpen, IconSettings, IconTrash } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { DetailsPanel } from './components/DetailsPanel';
import { Palette } from './components/Palette';
import { PersonNode } from './components/PersonNode';
import { createDiagram, getDiagram, listDiagrams, updateDiagram } from './api/client';
import type { DiagramSummary } from './api/client';
import { createPersonNode, createRelationEdge, relationStyle, updateEdgeRelation } from './lib/diagram';
import { SYMBOL_DEFINITIONS, symbolToSex } from './lib/genogramSymbols';
import { DATE_FORMAT_OPTIONS } from './lib/dateFormat';
import { useAppSettings } from './context/AppSettingsContext';
import { useHistory } from './context/HistoryContext';
import type { DateFormat } from './lib/dateFormat';
import type { Diagram, PersonFlowNode, PersonNodeData, PersonSymbol, RelationEdgeData } from './types/genogram';

const nodeTypes: NodeTypes = { person: PersonNode };

export function App() {
  const { dateFormat, setDateFormat } = useAppSettings();
  const { pushSnapshot, undo, redo, canUndo, canRedo, register } = useHistory();
  const [configOpen, setConfigOpen] = useState(false);
  const [configDateFormat, setConfigDateFormat] = useState<DateFormat>(dateFormat);
  const [nodes, setNodes, onNodesChange] = useNodesState<PersonFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<RelationEdgeData>>([]);

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
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance<PersonFlowNode, Edge<RelationEdgeData>> | null>(null);
  const [nodeDialogOpen, setNodeDialogOpen] = useState(false);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [pendingNode, setPendingNode] = useState<{ symbol: PersonSymbol; x: number; y: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null);
  const [relationDraft, setRelationDraft] = useState<{ sourceId: string; side: 'left' | 'right' } | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const selectedNode = useMemo(() => nodes.find((n) => n.id === selectedNodeId) ?? null, [nodes, selectedNodeId]);
  const selectedEdge = useMemo(() => edges.find((e) => e.id === selectedEdgeId) ?? null, [edges, selectedEdgeId]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      pushSnapshot(nodes, edges);

      if (relationDraft && (connection.source === relationDraft.sourceId || connection.target === relationDraft.sourceId)) {
        const otherId = connection.source === relationDraft.sourceId ? connection.target : connection.source;
        if (!otherId) return;

        if (relationDraft.side === 'left') {
          // Left side relation: visually left->right by swapping source/target
          const edge = createRelationEdge(otherId, relationDraft.sourceId, 'partner', {
            sourceHandle: 'right-source',
            targetHandle: 'left-target'
          });
          setEdges((eds) => addEdge(edge, eds));
        } else {
          const edge = createRelationEdge(relationDraft.sourceId, otherId, 'partner', {
            sourceHandle: 'right-source',
            targetHandle: 'left-target'
          });
          setEdges((eds) => addEdge(edge, eds));
        }

        setRelationDraft(null);
        return;
      }

      const edge = createRelationEdge(connection.source, connection.target, 'parent-child');
      setEdges((eds) => addEdge(edge, eds));
    },
    [edges, nodes, pushSnapshot, relationDraft, setEdges]
  );

  const onSelectionChange = useCallback((selection: OnSelectionChangeParams) => {
    setSelectedNodeId(selection.nodes[0]?.id ?? null);
    setSelectedEdgeId(selection.edges[0]?.id ?? null);
  }, []);

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
        const isPartner = rel === 'partner';
        return {
          ...edge,
          type: isPartner ? 'straight' : 'smoothstep',
          style: relationStyle(rel),
          animated: rel === 'adoption',
          sourceHandle: isPartner ? (edge.sourceHandle || 'right-source') : edge.sourceHandle,
          targetHandle: isPartner ? (edge.targetHandle || 'left-target') : edge.targetHandle,
          markerEnd: undefined,
        };
      });
      setEdges(edgesRestored);
      setDiagramName(loaded.name);
      setDiagramId(loaded.id);
      setSelectedNodeId(null);
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
        if (selectedNodeId) {
          removeNodeByID(selectedNodeId);
        } else if (selectedEdgeId) {
          pushSnapshot(nodes, edges);
          setEdges((prev) => prev.filter((e) => e.id !== selectedEdgeId));
          setSelectedEdgeId(null);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [edges, nodes, pushSnapshot, redo, removeNodeByID, selectedEdgeId, selectedNodeId, setEdges, undo]);

  return (
    <AppShell
      header={{ height: 64 }}
      navbar={{ width: 210, breakpoint: 'sm' }}
      aside={{ width: 340, breakpoint: 'sm' }}
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
          </Group>
          <div className="flow-wrapper" onDrop={handleDrop} onDragOver={handleDragOver}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onInit={setReactFlowInstance}
            fitView
            deleteKeyCode={null}
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

      <AppShell.Aside>
        <DetailsPanel
          node={selectedNode}
          edge={selectedEdge}
          onNodeChange={handleNodePatch}
          onEdgeRelationChange={handleEdgeRelationPatch}
        />
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
    </AppShell>
  );
}



