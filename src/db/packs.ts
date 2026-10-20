// Functions that save or look up packs and tracks in the database.

import { db } from './db';
import type { Card, PackJson, Track } from './types';
import { newId } from '../lib/id';

/** Finds a track by name (ignoring upper/lower case). */
export async function findTrackByName(name: string): Promise<Track | undefined> {
  const wanted = name.trim().toLowerCase();
  const all = await db.tracks.toArray();
  return all.find((t) => t.name.toLowerCase() === wanted);
}

/** Returns the id of the track with this name, creating it if needed. */
export async function findOrCreateTrack(name: string): Promise<string> {
  const existing = await findTrackByName(name);
  if (existing) return existing.id;
  const id = newId();
  await db.tracks.add({ id, name: name.trim(), createdAt: Date.now() });
  return id;
}

/**
 * Saves a checked pack: the pack, its lessons and all their cards.
 * Every item gets a brand-new unique ID.
 * A "transaction" means: either everything is saved, or nothing is.
 */
export async function savePack(pack: PackJson): Promise<string> {
  return db.transaction('rw', [db.tracks, db.packs, db.lessons, db.cards], async () => {
    const trackId = await findOrCreateTrack(pack.track);
    const packId = newId();

    await db.packs.add({
      id: packId,
      trackId,
      title: pack.packTitle,
      topic: pack.topic,
      createdAt: Date.now(),
    });

    for (const [lessonOrder, lesson] of pack.lessons.entries()) {
      const lessonId = newId();
      await db.lessons.add({
        id: lessonId,
        packId,
        trackId,
        order: lessonOrder,
        title: lesson.title,
      });

      const cards: Card[] = lesson.cards.map((card, cardOrder) => ({
        ...card,
        id: newId(),
        lessonId,
        packId,
        order: cardOrder,
      }));
      await db.cards.bulkAdd(cards);
    }

    return packId;
  });
}
