import React, { Suspense } from 'react'; // Added React and Suspense
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';
import './i18n'; // Import i18n configuration
import { I18nextProvider } from 'react-i18next'; // Import I18nextProvider
import i18n from './i18n'; // Import your i18n instance

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nextProvider i18n={i18n}>
      <Suspense fallback="loading">
        <App />
      </Suspense>
    </I18nextProvider>
  </React.StrictMode>
);
