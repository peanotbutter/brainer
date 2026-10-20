// New Pack screen.
// Step 1: describe the pack and copy a prompt for Claude.
// Step 2: paste Claude's reply, check it, preview it, save it.

import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { savePack } from '../db/packs';
import { buildPrompt } from '../lib/prompt';
import { parsePack, type ParseResult } from '../lib/parsePack';
import { copyText } from '../lib/clipboard';
import { clearDrafts, useDraft } from '../lib/useDraft';
import Icon from '../components/Icon';

const NEW_TRACK = '__new__'; // special value for "+ Create new track"

export default function NewPackScreen() {
  const tracks = useLiveQuery(() => db.tracks.toArray());
  const packs = useLiveQuery(() => db.packs.toArray());

  // Form fields (remembered as drafts in case you leave the app).
  const [topic, setTopic] = useDraft('topic', '');
  const [trackChoice, setTrackChoice] = useDraft('track', '');
  const [newTrackName, setNewTrackName] = useDraft('newTrack', '');
  const [lessonCount, setLessonCount] = useDraft('count', 8);
  const [notes, setNotes] = useDraft('notes', '');
  const [pasted, setPasted] = useDraft('pasted', '');

  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [savedTitle, setSavedTitle] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Oldest track first. ([...x] makes a copy so we don't change the original.)
  const sortedTracks = [...(tracks ?? [])].sort((a, b) => a.createdAt - b.createdAt);
  const firstTrackName = sortedTracks[0]?.name;

  // Pick the first track automatically once the tracks have loaded.
  useEffect(() => {
    if (!trackChoice && firstTrackName) setTrackChoice(firstTrackName);
  }, [trackChoice, firstTrackName, setTrackChoice]);

  const trackName = trackChoice === NEW_TRACK ? newTrackName.trim() : trackChoice;
  const canCopy = topic.trim() !== '' && trackName !== '';

  async function handleCopy() {
    const prompt = buildPrompt({ topic, track: trackName, lessonCount, notes });
    const ok = await copyText(prompt);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } else {
      alert('Copy failed. Open "Show the prompt" below and copy it by hand.');
    }
  }

  function handleCheck(text = pasted) {
    setSavedTitle(null);
    setResult(parsePack(text));
  }

  // Reads the clipboard directly (works on https and localhost only).
  async function handlePasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      setPasted(text);
      handleCheck(text);
    } catch {
      alert('Could not read the clipboard. Long-press the box below and choose Paste instead.');
    }
  }

  async function handleSave() {
    if (!result?.ok) return;
    setSaving(true);
    try {
      await savePack(result.pack);
      setSavedTitle(result.pack.packTitle);
      // Clear the form for the next pack.
      clearDrafts();
      setTopic('');
      setNotes('');
      setPasted('');
      setNewTrackName('');
      setTrackChoice('');
      setLessonCount(8);
      setResult(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      alert(`Saving failed: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  // Extra info for the preview.
  const existingTrack =
    result?.ok &&
    sortedTracks.some((t) => t.name.toLowerCase() === result.pack.track.toLowerCase());
  const duplicate =
    result?.ok &&
    (packs ?? []).some((p) => p.title.toLowerCase() === result.pack.packTitle.toLowerCase());

  return (
    <>
      <span className="eyebrow">Create</span>
      <h1>
        New <span className="mark">pack</span>
      </h1>

      {savedTitle && (
        <div className="card success">
          Saved <strong>{savedTitle}</strong>! <a href="#/">Go to Home</a>
        </div>
      )}

      {/* ---------------- STEP 1 ---------------- */}
      <section className="card">
        <h2 className="step-title">
          <span className="step-num">1</span> Describe the pack
        </h2>

        <label>
          Topic
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. MikroTik firewall basics"
          />
        </label>

        <label>
          Track
          <select value={trackChoice} onChange={(e) => setTrackChoice(e.target.value)}>
            {sortedTracks.map((t) => (
              <option key={t.id} value={t.name}>
                {t.name}
              </option>
            ))}
            <option value={NEW_TRACK}>+ Create new track…</option>
          </select>
        </label>

        {trackChoice === NEW_TRACK && (
          <label>
            New track name
            <input
              value={newTrackName}
              onChange={(e) => setNewTrackName(e.target.value)}
              placeholder="e.g. Cooking"
            />
          </label>
        )}

        <div className="field">
          <span>Number of lessons</span>
          <div className="stepper">
            <button
              className="btn"
              onClick={() => setLessonCount(Math.max(5, lessonCount - 1))}
              disabled={lessonCount <= 5}
              aria-label="Fewer lessons"
            >
              −
            </button>
            <output>{lessonCount}</output>
            <button
              className="btn"
              onClick={() => setLessonCount(Math.min(10, lessonCount + 1))}
              disabled={lessonCount >= 10}
              aria-label="More lessons"
            >
              +
            </button>
          </div>
        </div>

        <label>
          Notes about your level (optional)
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. I run a small ISP and know basic IP addressing"
          />
        </label>

        <button className="btn btn-primary btn-big" onClick={handleCopy} disabled={!canCopy}>
          <span className="btn-label">
            <Icon name={copied ? 'check' : 'copy'} />
            {copied ? 'Copied! Now paste it into Claude' : 'Copy prompt for Claude'}
          </span>
        </button>

        {canCopy && (
          <details className="prompt-preview">
            <summary>Show the prompt</summary>
            <textarea
              readOnly
              rows={10}
              value={buildPrompt({ topic, track: trackName, lessonCount, notes })}
            />
          </details>
        )}
      </section>

      {/* ---------------- STEP 2 ---------------- */}
      <section className="card">
        <h2 className="step-title">
          <span className="step-num">2</span> Paste Claude's reply
        </h2>

        {'readText' in (navigator.clipboard ?? {}) && (
          <button className="btn" onClick={handlePasteFromClipboard}>
            <span className="btn-label">
              <Icon name="clipboard" /> Paste from clipboard &amp; check
            </span>
          </button>
        )}

        <textarea
          rows={6}
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          placeholder="Long-press here and choose Paste"
        />

        <button className="btn btn-primary" onClick={() => handleCheck()}>
          <span className="btn-label">
            <Icon name="search" /> Check pack
          </span>
        </button>

        {/* Problems found */}
        {result && !result.ok && (
          <div className="alert error">
            <strong>Something's not right:</strong>
            <ul>
              {result.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
            <p>
              Tip: you can reply to Claude with "Please fix these problems and return only the JSON"
              and paste the errors above.
            </p>
          </div>
        )}

        {/* Preview of a good pack */}
        {result?.ok && (
          <div className="preview">
            <h3>{result.pack.packTitle}</h3>
            <p className="muted">
              Track: <strong>{result.pack.track}</strong>
              {!existingTrack && ' (new track will be created)'}
              <br />
              Topic: {result.pack.topic}
            </p>

            <ol>
              {result.pack.lessons.map((l, i) => (
                <li key={i}>
                  {l.title} <span className="muted">· {l.cards.length} cards</span>
                </li>
              ))}
            </ol>

            {(duplicate || result.warnings.length > 0) && (
              <div className="alert warn">
                {duplicate && <p>You already have a pack called "{result.pack.packTitle}".</p>}
                {result.warnings.length > 0 && (
                  <>
                    <p>Small things (you can still save):</p>
                    <ul>
                      {result.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}

            <button className="btn btn-gold btn-big" onClick={handleSave} disabled={saving}>
              <span className="btn-label">
                <Icon name="save" /> Save pack ({result.pack.lessons.length} lessons)
              </span>
            </button>
          </div>
        )}
      </section>
    </>
  );
}
