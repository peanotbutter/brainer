// The starting point of the app: it puts <App /> on the page.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { loadBundledLessonPacks } from './lib/lessonPack';
import { startAutoSync } from './lib/sync';
import { applyTheme, getTheme } from './lib/theme';

applyTheme(getTheme());

// Ask the browser to keep our data even when the phone runs low on space.
// (Without this, a browser may delete data from sites you rarely open.)
navigator.storage?.persist?.().catch(() => {});

// Put the lessons that come with the app into the database (first run only),
// then download new lessons from the Google Sheet (when online).
loadBundledLessonPacks()
  .catch((e) => console.error('Loading bundled lessons failed:', e))
  .finally(startAutoSync);

// Save the app on the phone so it opens without internet.
// Only in the built app ("npm run build"), not while developing,
// and only on https or localhost (browsers require that).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
