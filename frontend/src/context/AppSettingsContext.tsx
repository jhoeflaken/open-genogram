import { createContext, useContext, useState, type ReactNode } from 'react';
import type { DateFormat } from '../lib/dateFormat';
type AppSettings = {
  dateFormat: DateFormat;
  setDateFormat: (f: DateFormat) => void;
};
const AppSettingsContext = createContext<AppSettings>({
  dateFormat: 'dd-MM-yyyy',
  setDateFormat: () => {}
});
export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [dateFormat, setDateFormat] = useState<DateFormat>(() => {
    return (localStorage.getItem('genogram.dateFormat') as DateFormat) ?? 'dd-MM-yyyy';
  });
  const set = (f: DateFormat) => {
    setDateFormat(f);
    localStorage.setItem('genogram.dateFormat', f);
  };
  return (
    <AppSettingsContext.Provider value={{ dateFormat, setDateFormat: set }}>
      {children}
    </AppSettingsContext.Provider>
  );
}
export function useAppSettings() {
  return useContext(AppSettingsContext);
}
