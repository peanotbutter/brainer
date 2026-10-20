// Settings: appearance and lesson sync.

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Icon from '../components/Icon';
import { FEED_URL, getLastSync, syncLessons, useSyncing, useSyncOutcome } from '../lib/sync';
import { getTheme, setTheme, type Theme } from '../lib/theme';

const THEMES: { value: Theme; label: string }[] = [
  { value: 'system', label: 'Auto' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export default function SettingsScreen() {
  const [theme, setThemeState] = useState<Theme>(getTheme);
  const syncing = useSyncing();
  const outcome = useSyncOutcome();
  const lastSync = useLiveQuery(getLastSync, [syncing]);

  return (
    <>
      <span className="eyebrow">Preferences</span>
      <h1>Settings</h1>

      <section className="card">
        <h2>Appearance</h2>
        <div className="seg" role="radiogroup" aria-label="Theme">
          {THEMES.map((t) => (
            <button
              key={t.value}
              role="radio"
              aria-checked={theme === t.value}
              className={theme === t.value ? 'seg-on' : ''}
              onClick={() => {
                setTheme(t.value);
                setThemeState(t.value);
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="muted">Auto follows your phone's light or dark setting.</p>
      </section>

      <section className="card">
        <h2>Lesson feed</h2>
        <p className="muted">
          {lastSync ? `Last synced ${new Date(lastSync).toLocaleString()}` : 'Not synced yet.'}
        </p>
        {outcome.message && (
          <p className={outcome.failed ? 'alert error' : 'alert success'} role="status">
            {outcome.message}
          </p>
        )}
        <button className="btn btn-primary" disabled={syncing} onClick={() => syncLessons()}>
          <span className="btn-label">
            <Icon name="repeat" /> {syncing ? 'Checking…' : 'Check for lessons'}
          </span>
        </button>
        <details className="prompt-preview">
          <summary>Feed address (GitHub)</summary>
          <p className="muted" style={{ wordBreak: 'break-all' }}>
            {FEED_URL}
          </p>
        </details>
      </section>
    </>
  );
}
