import { Button, Stack, Text, Title } from '@mantine/core';
import type { Sex } from '../types/genogram';

type PaletteProps = {
  onAddPerson: (sex: Sex) => void;
};

export function Palette({ onAddPerson }: PaletteProps) {
  return (
    <Stack p="sm" gap="sm" style={{ borderRight: '1px solid #e9ecef', height: '100%' }}>
      <Title order={5}>Palette</Title>
      <Text size="sm" c="dimmed">McGoldrick &amp; Gerson symbols</Text>
      <Button variant="light" onClick={() => onAddPerson('male')}>Add Male (Square)</Button>
      <Button variant="light" onClick={() => onAddPerson('female')}>Add Female (Circle)</Button>
      <Button variant="light" onClick={() => onAddPerson('unknown')}>Add Unknown (Diamond)</Button>
    </Stack>
  );
}

