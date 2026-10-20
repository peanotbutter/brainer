// "Import lesson pack" button: opens the phone's file picker, reads the
// chosen .json file and merges its lessons into the app.

import { useRef, useState } from 'react';
import { mergeLessonPack, parseLessonPack } from '../lib/lessonPack';
import Icon from './Icon';

type Status =
  | { kind: 'ok'; text: string }
  | { kind: 'error'; errors: string[] }
  | null;

export default function ImportLessonPack() {
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // so picking the same file again still works
    if (!file) return;

    setBusy(true);
    setStatus(null);
    try {
      const result = parseLessonPack(await file.text());
      if (!result.ok) {
        setStatus({ kind: 'error', errors: result.errors });
        return;
      }
      const { added, replaced } = await mergeLessonPack(result.pack);
      setStatus({
        kind: 'ok',
        text: `Imported "${result.pack.pack_title}": ${added} new, ${replaced} updated.`,
      });
    } catch (err) {
      setStatus({ kind: 'error', errors: [`Import failed: ${(err as Error).message}`] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept=".json,application/json,text/plain"
        onChange={handleFile}
        hidden
      />
      <button className="btn" onClick={() => input.current?.click()} disabled={busy}>
        <span className="btn-label">
          <Icon name="download" /> {busy ? 'Importing…' : 'Import lesson pack'}
        </span>
      </button>

      {status?.kind === 'ok' && <div className="alert success">{status.text}</div>}
      {status?.kind === 'error' && (
        <div className="alert error">
          <strong>Couldn't import this file:</strong>
          <ul>
            {status.errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
