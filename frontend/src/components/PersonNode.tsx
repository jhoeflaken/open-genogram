import { Box, Text } from '@mantine/core';
import type { NodeProps } from '@xyflow/react';
import type { PersonFlowNode } from '../types/genogram';

export function PersonNode({ data, selected }: NodeProps<PersonFlowNode>) {
  const shared = {
    border: selected ? '2px solid #228be6' : '2px solid #1f1f1f',
    backgroundColor: '#fff',
    display: 'grid',
    placeItems: 'center',
    color: '#1f1f1f',
    position: 'relative' as const
  };

  const label = (
    <Text size="xs" style={{ position: 'absolute', top: '110%', whiteSpace: 'nowrap' }}>
      {data.name || 'Unnamed person'}
    </Text>
  );

  if (data.sex === 'female') {
    return (
      <Box style={{ ...shared, width: 72, height: 72, borderRadius: '999px' }}>
        {data.deceased && <Box style={{ position: 'absolute', width: 84, borderTop: '2px solid #e03131', transform: 'rotate(45deg)' }} />}
        {label}
      </Box>
    );
  }

  if (data.sex === 'unknown') {
    return (
      <Box style={{ ...shared, width: 64, height: 64, transform: 'rotate(45deg)' }}>
        <Box style={{ transform: 'rotate(-45deg)' }}>
          {data.deceased && <Box style={{ position: 'absolute', width: 84, borderTop: '2px solid #e03131', transform: 'rotate(45deg)' }} />}
          {label}
        </Box>
      </Box>
    );
  }

  return (
    <Box style={{ ...shared, width: 72, height: 72 }}>
      {data.deceased && <Box style={{ position: 'absolute', width: 84, borderTop: '2px solid #e03131', transform: 'rotate(45deg)' }} />}
      {label}
    </Box>
  );
}


