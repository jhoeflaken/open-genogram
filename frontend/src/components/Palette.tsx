import { Button, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import type { DragEvent } from 'react';
import { SymbolIcon } from './SymbolIcons';
import { SYMBOL_DEFINITIONS } from '../lib/genogramSymbols';
import type { PersonSymbol } from '../types/genogram';

type PaletteProps = {
  onAddPerson: (symbol: PersonSymbol) => void;
};

export function Palette({ onAddPerson }: PaletteProps) {
  const handleDragStart = (event: DragEvent<HTMLButtonElement>, symbol: PersonSymbol) => {
    event.dataTransfer.setData('application/genogram-symbol', symbol);
    event.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <Stack p="xs" gap="xs" style={{ borderRight: '1px solid #e9ecef', height: '100%', overflowY: 'auto' }}>
      <Title order={5}>Palette</Title>
      <SimpleGrid cols={1} spacing="xs">
        {SYMBOL_DEFINITIONS.map((item) => (
          <Button
            key={item.symbol}
            variant="light"
            h={42}
            fullWidth
            draggable
            onDragStart={(event) => handleDragStart(event, item.symbol)}
            onClick={() => onAddPerson(item.symbol)}
            styles={{
              inner: {
                justifyContent: 'flex-start'
              }
            }}
          >
            <Group gap="sm" wrap="nowrap" style={{ width: '100%', justifyContent: 'flex-start', alignItems: 'center' }}>
              <span style={{ width: 28, minWidth: 28, display: 'inline-flex', justifyContent: 'center', alignItems: 'center' }}>
                <SymbolIcon symbol={item.symbol} size={26} />
              </span>
              <Text fw={600} size="sm" ta="left" style={{ whiteSpace: 'nowrap' }}>{item.label}</Text>
            </Group>
          </Button>
        ))}
      </SimpleGrid>
    </Stack>
  );
}
