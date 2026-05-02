import React from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@xyflow/react/dist/style.css';
import './styles.css';
import { App } from './App';
import { AppSettingsProvider } from './context/AppSettingsContext';
import { HistoryProvider } from './context/HistoryContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HistoryProvider>
      <AppSettingsProvider>
        <MantineProvider>
          <Notifications />
          <App />
        </MantineProvider>
      </AppSettingsProvider>
    </HistoryProvider>
  </React.StrictMode>
);


