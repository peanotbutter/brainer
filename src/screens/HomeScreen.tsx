// Home screen: start buttons and your tracks with progress.
// Inside each track: packs, then weeks, then lessons (tap one to open it).

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { Lesson } from '../db/types';
import Icon from '../components/Icon';
import ImportLessonPack from '../components/ImportLessonPack';
import LessonFeed from '../components/LessonFeed';
import PullToRefresh from '../components/PullToRefresh';
import { getLastSync, newSince, syncLessons, useSyncing, useSyncOutcome } from '../lib/sync';

/** "just now", "5 min ago", "3 h ago", or a date. */
function timeAgo(ms: number): string {
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  if (min < 24 * 60) return `${Math.round(min / 60)} h ago`;
  return new Date(ms).toLocaleDateString();
}

/** Splits lessons into weeks. Lessons without a week go in one group. */
function groupByWeek(lessons: Lesson[]) {
  const groups: { key: string; label: string | null; lessons: Lesson[] }[] = [];
  for (const l of lessons) {
    const key = l.week ? `w${l.week}` : 'none';
    let group = groups.find((g) => g.key === key);
    if (!group) {
      const label = l.week ? `Week ${l.week}${l.weekTheme ? ` · ${l.weekTheme}` : ''}` : null;
      group = { key, label, lessons: [] };
      groups.push(group);
    }
    group.lessons.push(l);
  }
  return groups;
}

export default function HomeScreen() {
  const syncing = useSyncing();
  const outcome = useSyncOutcome();
  // useLiveQuery reads from the database and automatically re-renders
  // the screen whenever that data changes.
  const data = useLiveQuery(async () => {
    const [tracks, packs, lessons, lastSync, since] = await Promise.all([
      db.tracks.toArray(),
      db.packs.orderBy('createdAt').toArray(),
      db.lessons.toArray(),
      getLastSync(),
      newSince,
    ]);
    tracks.sort((a, b) => a.createdAt - b.createdAt);
    lessons.sort((a, b) => a.order - b.order);
    return { tracks, packs, lessons, lastSync, since };
  });

  if (!data) return null; // still loading (takes a split second)
  const { tracks, packs, lessons, lastSync, since } = data;
  // "New" = arrived after the previous time you opened the app, and not opened yet.
  const isNew = (l: Lesson) => !l.openedAt && !l.completedAt && (l.addedAt ?? 0) > since;

  const doneLessons = lessons.filter((l) => l.completedAt).length;

  // The next lesson = the first one not done yet, in pack order.
  const nextLesson = packs
    .flatMap((p) => lessons.filter((l) => l.packId === p.id))
    .find((l) => !l.completedAt);

  return (
    <PullToRefresh onRefresh={syncLessons} busy={syncing}>
      <section className="hero">
        <span className="eyebrow">
          <Icon name="sparkle" /> Bite-sized learning
        </span>
        <h1>
          Learn anything in <span className="mark">5 minutes</span>.
        </h1>
        <p className="muted">Short lessons from your own packs. One small step a day.</p>

        <div className="stats">
          <div className="stat">
            <strong>{tracks.length}</strong>
            <span>Tracks</span>
          </div>
          <div className="stat">
            <strong>{packs.length}</strong>
            <span>Packs</span>
          </div>
          <div className="stat">
            <strong>
              {doneLessons}
              <span className="muted">/{lessons.length}</span>
            </strong>
            <span>Lessons done</span>
          </div>
        </div>
      </section>

      {nextLesson ? (
        <a href={`#/lesson/${nextLesson.id}`} className="btn btn-primary btn-big btn-link">
          <span className="btn-label">
            <Icon name="play" /> Start next lesson
          </span>
          <small>{nextLesson.title}</small>
        </a>
      ) : (
        <button className="btn btn-primary btn-big" disabled>
          <span className="btn-label">
            <Icon name="play" /> Start next lesson
          </span>
          <small>{lessons.length ? 'All lessons done!' : 'Import or create a pack first'}</small>
        </button>
      )}
      {/* This button comes alive in Phase 3. */}
      <button className="btn btn-big" disabled>
        <span className="btn-label">
          <Icon name="repeat" /> Daily review
        </span>
        <small>Coming in Phase 3</small>
      </button>

      <LessonFeed />

      <h2>Your tracks</h2>

      <p className="sync-line muted">
        {syncing
          ? 'Syncing lessons…'
          : lastSync
            ? `Last synced: ${timeAgo(lastSync)}`
            : 'Not synced yet'}
        {!syncing && (
          <>
            {' · '}
            <button className="link-btn" onClick={() => syncLessons()}>
              Check for lessons
            </button>
          </>
        )}
      </p>
      {!syncing && outcome.message && (
        <p className={outcome.failed ? 'alert error' : 'alert success'} role="status">
          {outcome.message}
        </p>
      )}

      <ImportLessonPack />

      {packs.length === 0 && (
        <div className="card empty muted">
          No packs yet. Tap <a href="#/new">New</a> to create your first one.
        </div>
      )}

      {tracks.map((track) => {
        const trackPacks = packs.filter((p) => p.trackId === track.id);
        const trackLessons = lessons.filter((l) => l.trackId === track.id);
        const done = trackLessons.filter((l) => l.completedAt).length;
        const total = trackLessons.length;

        return (
          <details key={track.id} className="card track" open={trackPacks.length > 0}>
            <summary>
              <span className="track-icon" aria-hidden="true">
                {track.name.charAt(0).toUpperCase()}
              </span>
              <span>
                <span className="track-name">{track.name}</span>
                <br />
                <span className="muted">
                  {trackPacks.length} {trackPacks.length === 1 ? 'pack' : 'packs'}
                </span>
              </span>
              <span className="track-count">
                {done}/{total}
              </span>
              <span className="progress">
                <span style={{ width: total ? `${(done / total) * 100}%` : '0%' }} />
              </span>
            </summary>

            {trackPacks.length === 0 && (
              <p className="muted">
                No packs in this track yet. <a href="#/new">Create one</a> or import a lesson pack.
              </p>
            )}

            {trackPacks.map((pack) => (
              <div key={pack.id} className="pack">
                <h3>{pack.title}</h3>
                {groupByWeek(trackLessons.filter((l) => l.packId === pack.id)).map((group) => (
                  <div key={group.key} className="week">
                    {group.label && <p className="week-label">{group.label}</p>}
                    <ul className="lesson-list">
                      {group.lessons.map((l) => (
                        <li key={l.id}>
                          <a
                            href={`#/lesson/${l.id}`}
                            className={l.completedAt ? 'lesson-row done' : 'lesson-row'}
                          >
                            <span className="lesson-check" aria-label={l.completedAt ? 'Done' : 'Not done'}>
                              {l.completedAt && <Icon name="tick" />}
                            </span>
                            <span className="lesson-title">
                              {l.title}
                              {isNew(l) && <span className="badge-new">New</span>}
                            </span>
                            {l.minutes && <span className="muted lesson-min">{l.minutes} min</span>}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ))}
          </details>
        );
      })}
    </PullToRefresh>
  );
}
