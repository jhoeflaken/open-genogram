import type { PersonSymbol, Sex } from '../types/genogram';

export type SymbolDefinition = {
  symbol: PersonSymbol;
  label: string;
  description: string;
  sex: Sex;
};

export const SYMBOL_DEFINITIONS: SymbolDefinition[] = [
  { symbol: 'male', label: 'Male', description: 'Square', sex: 'male' },
  { symbol: 'female', label: 'Female', description: 'Circle', sex: 'female' },
  { symbol: 'unknown', label: 'Unknown Sex', description: 'Diamond', sex: 'unknown' },
  { symbol: 'pregnancy', label: 'Pregnancy', description: 'Circle with inner marker', sex: 'female' },
  { symbol: 'stillbirth', label: 'Stillbirth', description: 'Circle with cross marker', sex: 'unknown' },
  { symbol: 'miscarriage', label: 'Miscarriage', description: 'Triangle', sex: 'unknown' },
  { symbol: 'abortion', label: 'Abortion', description: 'Dashed triangle', sex: 'unknown' },
  { symbol: 'pet', label: 'Pet', description: 'Hexagon', sex: 'unknown' }
];

export function symbolToSex(symbol: PersonSymbol): Sex {
  return SYMBOL_DEFINITIONS.find((item) => item.symbol === symbol)?.sex ?? 'unknown';
}

