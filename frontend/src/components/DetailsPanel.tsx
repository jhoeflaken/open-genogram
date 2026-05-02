import { Checkbox, Select, Stack, Text, TextInput, Textarea, Title } from '@mantine/core';
import type { Edge, Node } from '@xyflow/react';
import type { PersonNodeData, RelationEdgeData, RelationType } from '../types/genogram';

type DetailsPanelProps = {
  node: Node<PersonNodeData> | null;
  edge: Edge<RelationEdgeData> | null;
  onNodeChange: (patch: Partial<PersonNodeData>) => void;
  onEdgeRelationChange: (relation: RelationType) => void;
};

const relationOptions = [
  { label: 'Partner', value: 'partner' },
  { label: 'Divorce', value: 'divorce' },
  { label: 'Parent-Child', value: 'parent-child' },
  { label: 'Adoption', value: 'adoption' }
];

export function DetailsPanel({ node, edge, onNodeChange, onEdgeRelationChange }: DetailsPanelProps) {
  if (edge) {
    return (
      <Stack p="sm" gap="sm" style={{ borderLeft: '1px solid #e9ecef', height: '100%' }}>
        <Title order={5}>Relation Details</Title>
        <Text size="sm">Edge: {edge.id}</Text>
        <Select
          label="Relation"
          data={relationOptions}
          value={edge.data?.relation ?? 'parent-child'}
          onChange={(v) => {
            if (v) onEdgeRelationChange(v as RelationType);
          }}
        />
      </Stack>
    );
  }

  if (!node) {
    return (
      <Stack p="sm" gap="sm" style={{ borderLeft: '1px solid #e9ecef', height: '100%' }}>
        <Title order={5}>Details</Title>
        <Text size="sm" c="dimmed">Select a person or relation to edit details.</Text>
      </Stack>
    );
  }

  return (
    <Stack p="sm" gap="sm" style={{ borderLeft: '1px solid #e9ecef', height: '100%', overflowY: 'auto' }}>
      <Title order={5}>Person Details</Title>
      <TextInput label="Name" value={node.data.name} onChange={(e) => onNodeChange({ name: e.currentTarget.value })} />
      <Select
        label="Sex"
        data={[
          { label: 'Male', value: 'male' },
          { label: 'Female', value: 'female' },
          { label: 'Unknown', value: 'unknown' }
        ]}
        value={node.data.sex}
        onChange={(v) => {
          if (v) onNodeChange({ sex: v as PersonNodeData['sex'] });
        }}
      />
      <TextInput
        label="Birth Date"
        placeholder="YYYY-MM-DD"
        value={node.data.birthDate ?? ''}
        onChange={(e) => onNodeChange({ birthDate: e.currentTarget.value })}
      />
      <TextInput
        label="Death Date"
        placeholder="YYYY-MM-DD"
        value={node.data.deathDate ?? ''}
        onChange={(e) => onNodeChange({ deathDate: e.currentTarget.value })}
      />
      <Checkbox checked={node.data.deceased} label="Deceased" onChange={(e) => onNodeChange({ deceased: e.currentTarget.checked })} />
      <Textarea
        minRows={5}
        label="Notes"
        value={node.data.notes ?? ''}
        onChange={(e) => onNodeChange({ notes: e.currentTarget.value })}
      />
    </Stack>
  );
}

