import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import { initErrorReporter } from './error-reporter';

Sentry.init({
  dsn: 'https://b1879cadb2059cf258e73c3d1db2cfbd@o4511162586759168.ingest.us.sentry.io/4511162670383104',
  integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  environment: import.meta.env.MODE,
});

initErrorReporter('McCulloch-Valuation');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
