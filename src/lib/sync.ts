// Lesson feed: lessons that Claude generated and saved on GitHub.
//
// Two steps, so you stay in control:
//  1. CHECK (automatic): is there a new or changed lesson pack on GitHub?
//     If yes, the app shows "You can download the lessons now".
//  2. DOWNLOAD (your tap): merges those packs into the phone's database,
//     so they keep working offline.
//
// Merges by lesson id: new id = add, same id = update. Never deletes.
// If anything goes wrong the app shows a short message (no popups).

import { useSyncExternalStore } from 'react';
import { db } from '../db/db';
import { INDEX_URL, packFileUrl } from './github';
import { mergeLessonPack, parseLessonPack } from './lessonPack';

export const FEED_URL = INDEX_URL;

const LAST_SYNC_KEY = 'lastSync';
const LAST_OPENED_KEY = 'lastOpened';
const feedKey = (file: string) => `feed:${file}`;

/** One entry of lessons/generated/index.json */
export interface FeedEntry {
  file: string;
  title?: string;
  updated: string;
  lessons?: number;
}

// ---------------------------------------------------------------------
// Shared status, so any screen can show it
// ---------------------------------------------------------------------

interface State {
  busy: boolean;
  pending: FeedEntry[];
  message: string;
  failed: boolean;
  /** Changes whenever the saved "waiting for Claude" request changes. */
  requestTick: number;
}

let state: State = { busy: false, pending: [], message: '', failed: false, requestTick: 0 };
const listeners = new Set<() => void>();

function update(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
}

function useSyncState(): State {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => state,
  );
}

/** True while checking or downloading. */
export function useSyncing(): boolean {
  return useSyncState().busy;
}

/** The last result: a message and whether it was a problem. */
export function useSyncOutcome(): { message: string; failed: boolean } {
  const { message, failed } = useSyncState();
  return { message, failed };
}

/** Lesson packs waiting to be downloaded. */
export function usePendingLessons(): FeedEntry[] {
  return useSyncState().pending;
}

/** The lesson you asked for and are still waiting on, or null. */
export function useLessonRequest(): { topic: string; at: number } | null {
  useSyncState(); // re-render when the request changes
  return getLessonRequest();
}

/** What went wrong, in words a person understands. */
function explain(e: unknown, status?: number): string {
  if (!navigator.onLine) return 'You are offline. The app will check again when internet is back.';
  if ((e as Error)?.name === 'AbortError') return 'That took too long. Try again on a better connection.';
  if (status === 404) return 'No generated lessons yet. Ask Claude for one from the Home screen.';
  if (status) return `Could not read the lesson list (GitHub answered ${status}).`;
  return 'Could not reach GitHub. Check your internet and try again.';
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    return await fetch(url, { cache: 'no-store', signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------
// Step 1: check
// ---------------------------------------------------------------------

/** Looks for new lesson packs on GitHub. Returns how many are waiting, or null if it failed. */
export async function syncLessons(): Promise<number | null> {
  if (state.busy) return null;
  if (!navigator.onLine) {
    update({ message: explain(null), failed: true });
    return null;
  }
  update({ busy: true });
  let status: number | undefined;
  try {
    const res = await fetchWithTimeout(INDEX_URL);
    status = res.status;
    if (!res.ok) throw new Error(`Feed answered ${res.status}`);
    const index = (await res.json()) as { packs?: FeedEntry[] };
    const pending: FeedEntry[] = [];
    for (const entry of index.packs ?? []) {
      if (!entry?.file || !entry.updated) continue;
      const seen = await db.settings.get(feedKey(entry.file));
      if (seen?.value !== entry.updated) pending.push(entry);
    }
    await db.settings.put({ key: LAST_SYNC_KEY, value: Date.now() });
    update({ pending, failed: false, message: pending.length ? '' : 'You are up to date.' });
    return pending.length;
  } catch (e) {
    console.warn('Lesson check skipped:', (e as Error).message);
    // A 404 just means nothing was generated yet: not a real problem.
    update({ failed: status !== 404, message: explain(e, status) });
    return null;
  } finally {
    update({ busy: false });
  }
}

// ---------------------------------------------------------------------
// Step 2: download
// ---------------------------------------------------------------------

/** Downloads every waiting pack into the app. */
export async function downloadPending(): Promise<{ added: number; updated: number } | null> {
  if (state.busy || state.pending.length === 0) return null;
  update({ busy: true });
  let added = 0;
  let updated = 0;
  const failedEntries: FeedEntry[] = [];
  let firstProblem = '';
  try {
    const markNew = (await newSince) !== Number.POSITIVE_INFINITY;
    for (const entry of state.pending) {
      try {
        const res = await fetchWithTimeout(packFileUrl(entry.file));
        if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
        const parsed = parseLessonPack(await res.text());
        if (!parsed.ok) throw new Error(parsed.errors[0]);
        const result = await mergeLessonPack(parsed.pack, { markNew });
        added += result.added;
        updated += result.replaced;
        await db.settings.put({ key: feedKey(entry.file), value: entry.updated });
      } catch (e) {
        failedEntries.push(entry);
        firstProblem ||= `${entry.title ?? entry.file}: ${(e as Error).message}`;
      }
    }
    update({
      pending: failedEntries,
      failed: failedEntries.length > 0,
      message: failedEntries.length
        ? `Some lessons could not be downloaded. ${firstProblem}`
        : `Downloaded: ${added} new, ${updated} updated.`,
    });
    if (failedEntries.length === 0) clearLessonRequest();
    return { added, updated };
  } finally {
    update({ busy: false });
  }
}

// ---------------------------------------------------------------------
// "Waiting for Claude" after you asked for a lesson
// ---------------------------------------------------------------------

const REQUEST_KEY = 'lessonRequest';
export const REQUEST_MAX_WAIT = 30 * 60 * 1000; // stop waiting after 30 minutes

export function saveLessonRequest(topic: string) {
  try {
    localStorage.setItem(REQUEST_KEY, JSON.stringify({ topic, at: Date.now() }));
  } catch {
    // Private mode: we just won't show the waiting message.
  }
  update({ requestTick: state.requestTick + 1 });
}

export function clearLessonRequest() {
  try {
    localStorage.removeItem(REQUEST_KEY);
  } catch {
    // ignore
  }
  update({ requestTick: state.requestTick + 1 });
}

export function getLessonRequest(): { topic: string; at: number } | null {
  try {
    const v = JSON.parse(localStorage.getItem(REQUEST_KEY) ?? 'null');
    if (v && typeof v.at === 'number' && Date.now() - v.at < REQUEST_MAX_WAIT) return v;
  } catch {
    // ignore
  }
  return null;
}

/** Time of the last successful check (milliseconds), or undefined. */
export async function getLastSync(): Promise<number | undefined> {
  return (await db.settings.get(LAST_SYNC_KEY))?.value as number | undefined;
}

// ---------------------------------------------------------------------
// "New" badges: lessons that arrived after the previous time the app opened
// ---------------------------------------------------------------------

/**
 * Remembers when the app was opened before this time, then saves "now".
 * Lessons with addedAt later than this get a "New" badge.
 * On the very first run nothing is "new" (everything is new!).
 */
export const newSince: Promise<number> = (async () => {
  try {
    const previous = (await db.settings.get(LAST_OPENED_KEY))?.value as number | undefined;
    await db.settings.put({ key: LAST_OPENED_KEY, value: Date.now() });
    return previous ?? Number.POSITIVE_INFINITY;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
})();

// ---------------------------------------------------------------------
// When to check
// ---------------------------------------------------------------------

const RECHECK_AFTER = 30 * 60 * 1000; // 30 minutes
const WAITING_POLL = 20 * 1000; // while waiting for Claude: every 20 seconds

/** Checks now, when you return to the app, when internet comes back, and while waiting for Claude. */
export function startAutoSync() {
  syncLessons();

  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return;
    const last = await getLastSync();
    if (getLessonRequest() || !last || Date.now() - last > RECHECK_AFTER) syncLessons();
  });

  window.addEventListener('online', () => syncLessons());

  setInterval(() => {
    if (document.visibilityState === 'visible' && getLessonRequest()) syncLessons();
  }, WAITING_POLL);
}
