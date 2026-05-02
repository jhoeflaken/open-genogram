import { Checkbox, Select, Stack, Text, TextInput, Textarea, Title } from '@mantine/core';
import type { Edge } from '@xyflow/react';
import { useAppSettings } from '../context/AppSettingsContext';
import { SYMBOL_DEFINITIONS } from '../lib/genogramSymbols';
import type { PersonFlowNode, PersonNodeData, RelationEdgeData, RelationType } from '../types/genogram';

type DetailsPanelProps = {
  node: PersonFlowNode | null;
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
  const { dateFormat } = useAppSettings();
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
      <TextInput label="UID" value={node.data.uid ?? ''} readOnly />
      <TextInput
        label="First Name"
        value={node.data.firstName ?? ''}
        onChange={(e) => {
          const firstName = e.currentTarget.value;
          const lastName = node.data.lastName ?? '';
          onNodeChange({ firstName, name: `${firstName} ${lastName}`.trim() });
        }}
      />
      <TextInput
        label="Last Name"
        value={node.data.lastName ?? ''}
        onChange={(e) => {
          const lastName = e.currentTarget.value;
          const firstName = node.data.firstName ?? '';
          onNodeChange({ lastName, name: `${firstName} ${lastName}`.trim() });
        }}
      />
      <Select
        label="Symbol"
        data={SYMBOL_DEFINITIONS.map((item) => ({ value: item.symbol, label: item.label }))}
        value={node.data.symbol}
        onChange={(v) => {
          if (v) onNodeChange({ symbol: v as PersonNodeData['symbol'] });
        }}
      />
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
        placeholder={dateFormat}
        value={node.data.birthDate ?? ''}
        onChange={(e) => onNodeChange({ birthDate: e.currentTarget.value })}
      />
      <TextInput
        label="Death Date"
        placeholder={dateFormat}
        value={node.data.deathDate ?? ''}
        onChange={(e) => {
          const deathDate = e.currentTarget.value;
          // entering any death date automatically marks the person as deceased
          onNodeChange({ deathDate, ...(deathDate.trim() ? { deceased: true } : {}) });
        }}
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

