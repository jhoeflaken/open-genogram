import { useCallback, useMemo, useState } from 'react';
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
  type NodeTypes,
  type OnSelectionChangeParams
} from '@xyflow/react';
import { ActionIcon, AppShell, Button, Group, Loader, TextInput, Title } from '@mantine/core';
import { IconDownload, IconUpload } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { DetailsPanel } from './components/DetailsPanel';
import { Palette } from './components/Palette';
import { PersonNode } from './components/PersonNode';
import { createDiagram, getDiagram, updateDiagram } from './api/client';
import { createPersonNode, createRelationEdge, updateEdgeRelation } from './lib/diagram';
import type { Diagram, PersonFlowNode, PersonNodeData, RelationEdgeData, Sex } from './types/genogram';

const nodeTypes: NodeTypes = { person: PersonNode };

export function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState<PersonFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<RelationEdgeData>>([]);
  const [diagramId, setDiagramId] = useState('');
  const [diagramName, setDiagramName] = useState('Family Diagram');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const selectedNode = useMemo(() => nodes.find((n) => n.id === selectedNodeId) ?? null, [nodes, selectedNodeId]);
  const selectedEdge = useMemo(() => edges.find((e) => e.id === selectedEdgeId) ?? null, [edges, selectedEdgeId]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      const edge = createRelationEdge(connection.source, connection.target, 'parent-child');
      setEdges((eds) => addEdge(edge, eds));
    },
    [setEdges]
  );

  const onSelectionChange = useCallback((selection: OnSelectionChangeParams) => {
    setSelectedNodeId(selection.nodes[0]?.id ?? null);
    setSelectedEdgeId(selection.edges[0]?.id ?? null);
  }, []);

  const handleAddPerson = useCallback(
    (sex: Sex) => {
      const id = crypto.randomUUID();
      const node = createPersonNode(id, sex, 140 + nodes.length * 40, 120 + nodes.length * 20);
      setNodes((prev) => [...prev, node]);
    },
    [nodes.length, setNodes]
  );

  const handleNodePatch = useCallback(
    (patch: Partial<PersonNodeData>) => {
      if (!selectedNodeId) return;
      setNodes((prev) =>
        prev.map((n) => {
          if (n.id !== selectedNodeId) return n;
          return { ...n, data: { ...n.data, ...patch } };
        })
      );
    },
    [selectedNodeId, setNodes]
  );

  const handleEdgeRelationPatch = useCallback(
    (relation: RelationEdgeData['relation']) => {
      if (!selectedEdgeId) return;
      setEdges((prev) => prev.map((e) => (e.id === selectedEdgeId ? updateEdgeRelation(e, relation) : e)));
    },
    [selectedEdgeId, setEdges]
  );

  const handleLoad = useCallback(async () => {
    if (!diagramId) {
      notifications.show({ color: 'yellow', message: 'Enter a diagram ID first.' });
      return;
    }
    setIsBusy(true);
    try {
      const loaded = await getDiagram(diagramId);
      setNodes(loaded.nodes);
      setEdges(loaded.edges);
      setDiagramName(loaded.name);
      notifications.show({ color: 'green', message: 'Diagram loaded.' });
    } catch (err) {
      notifications.show({ color: 'red', message: `Load failed: ${String(err)}` });
    } finally {
      setIsBusy(false);
    }
  }, [diagramId, setEdges, setNodes]);

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

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 260, breakpoint: 'sm' }}
      aside={{ width: 340, breakpoint: 'sm' }}
      padding="xs"
    >
      <AppShell.Header p="sm">
        <Group justify="space-between" align="center" h="100%">
          <Title order={3}>Genogram Editor</Title>
          <Group>
            <TextInput label="Diagram Name" value={diagramName} onChange={(e) => setDiagramName(e.currentTarget.value)} />
            <TextInput label="Diagram ID" value={diagramId} onChange={(e) => setDiagramId(e.currentTarget.value)} placeholder="Saved ID" />
            <Button leftSection={<IconDownload size={16} />} onClick={handleLoad} variant="light">
              Load
            </Button>
            <Button leftSection={<IconUpload size={16} />} onClick={handleSave}>
              Save
            </Button>
            {isBusy && <ActionIcon variant="subtle" aria-label="loading"><Loader size="sm" /></ActionIcon>}
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar>
        <Palette onAddPerson={handleAddPerson} />
      </AppShell.Navbar>

      <AppShell.Main>
        <div style={{ height: 'calc(100vh - 100px)' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onSelectionChange={onSelectionChange}
          >
            <MiniMap />
            <Controls />
            <Background />
          </ReactFlow>
        </div>
      </AppShell.Main>

      <AppShell.Aside>
        <DetailsPanel node={selectedNode} edge={selectedEdge} onNodeChange={handleNodePatch} onEdgeRelationChange={handleEdgeRelationPatch} />
      </AppShell.Aside>
    </AppShell>
  );
}



