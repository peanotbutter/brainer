// "Ask Claude for a lesson" + the "You can download the lessons now" button.
//
// Ask: opens a pre-filled GitHub issue. A GitHub Action then has Claude write
// the lesson and save it in the repo. The app checks every 20 seconds while
// you wait, and shows the download button when the lesson is ready.

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { buildIssueUrl } from '../lib/github';
import {
  clearLessonRequest,
  downloadPending,
  saveLessonRequest,
  syncLessons,
  useLessonRequest,
  usePendingLessons,
  useSyncing,
} from '../lib/sync';
import Icon from './Icon';

export default function LessonFeed() {
  const pending = usePendingLessons();
  const request = useLessonRequest();
  const busy = useSyncing();
  const tracks = useLiveQuery(() => db.tracks.toArray(), []) ?? [];

  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState('');
  const [track, setTrack] = useState('');
  const [count, setCount] = useState(1);
  const [notes, setNotes] = useState('');

  function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim()) return;
    saveLessonRequest(topic.trim());
    window.open(buildIssueUrl({ topic, track, count, notes }), '_blank', 'noopener');
    setOpen(false);
    setTopic('');
    setNotes('');
    setTimeout(syncLessons, 5000);
  }

  return (
    <>
      {pending.length > 0 && (
        <button className="btn btn-gold btn-big ready" disabled={busy} onClick={() => downloadPending()}>
          <span className="btn-label">
            <Icon name="download" /> {busy ? 'Downloading…' : 'You can download the lessons now'}
          </span>
          <small>
            {pending.length === 1
              ? (pending[0].title ?? 'New lessons are ready')
              : `${pending.length} lesson packs are ready`}
          </small>
        </button>
      )}

      {request && pending.length === 0 && (
        <div className="card waiting" role="status">
          <span className="spinner" aria-hidden="true" />
          <div>
            <strong>Claude is writing “{request.topic}”</strong>
            <p className="muted">
              Press “Submit new issue” on the GitHub page if you haven't yet. This takes about a
              minute, and I check every 20 seconds.
            </p>
            <button className="link-btn" onClick={clearLessonRequest}>
              Stop waiting
            </button>
          </div>
        </div>
      )}

      {!open ? (
        <button className="btn" onClick={() => setOpen(true)}>
          <span className="btn-label">
            <Icon name="sparkle" /> Ask Claude for a lesson
          </span>
        </button>
      ) : (
        <form className="card" onSubmit={ask}>
          <h2>Ask Claude for a lesson</h2>
          <label>
            Topic
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. How to price pisowifi vouchers"
              required
              autoFocus
            />
          </label>
          <label>
            Track
            <input
              list="track-names"
              value={track}
              onChange={(e) => setTrack(e.target.value)}
              placeholder="e.g. Business"
            />
            <datalist id="track-names">
              {tracks.map((t) => (
                <option key={t.id} value={t.name} />
              ))}
            </datalist>
          </label>
          <label>
            How many lessons
            <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {[1, 2, 3, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            Notes (optional)
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Your level, goals, local examples…"
            />
          </label>
          <div className="btn-row">
            <button type="button" className="btn" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Ask Claude
            </button>
          </div>
          <p className="muted">
            This opens GitHub with your request filled in. Press “Submit new issue” once — then
            come back here.
          </p>
        </form>
      )}
    </>
  );
}
