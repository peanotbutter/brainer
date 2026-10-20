// Lesson packs: ready-made lessons in a .json file
// (format "brainy-lesson-pack/v1").
//
// We do NOT keep a second lesson format in the database. A lesson pack is
// converted into the app's normal format on import:
//   category        -> Track (found by name, created if missing)
//   pack_id         -> Pack   (the pack_id becomes the pack's id)
//   lessons[].id    -> Lesson (the lesson id becomes the lesson's id)
//   sections[]      -> Cards  (concept / task / challenge / check)
// Because the ids come from the file, importing the same lesson again
// REPLACES it (and keeps your "done" mark) instead of adding a copy.

import { db } from '../db/db';
import { findOrCreateTrack } from '../db/packs';
import type { Card, CardData, Lesson } from '../db/types';
import bundledBusiness from '../../lessons/brainy-business-lessons.json';

export const LESSON_PACK_SCHEMA = 'brainy-lesson-pack/v1';

// ---------------------------------------------------------------------
// The shape of the file
// ---------------------------------------------------------------------

type Section =
  | { type: 'concept' | 'task' | 'challenge'; heading?: string; minutes?: number; markdown: string }
  | { type: 'check'; heading?: string; minutes?: number; question: string; answer: string };

interface LessonPackLesson {
  id: string;
  day?: number;
  date?: string;
  week?: number;
  week_theme?: string;
  title: string;
  minutes?: number;
  illustration?: { type: 'svg'; alt?: string; svg: string };
  sections: Section[];
}

export interface LessonPack {
  schema?: string;
  pack_id: string;
  pack_title: string;
  category?: string;
  generated?: string;
  lessons: LessonPackLesson[];
}

export type LessonPackResult = { ok: true; pack: LessonPack } | { ok: false; errors: string[] };

// ---------------------------------------------------------------------
// Checking a file
// ---------------------------------------------------------------------

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isText(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/** Reads the text of a .json file and checks it is a lesson pack. */
export function parseLessonPack(text: string): LessonPackResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return {
      ok: false,
      errors: ["This file isn't valid JSON.", `Details: ${(e as Error).message}`],
    };
  }
  return validateLessonPack(data);
}

export function validateLessonPack(data: unknown): LessonPackResult {
  const errors: string[] = [];
  if (!isObject(data)) return { ok: false, errors: ["This file isn't a lesson pack."] };

  if (data.schema !== undefined && data.schema !== LESSON_PACK_SCHEMA) {
    errors.push(`Unknown format "${String(data.schema)}". Expected "${LESSON_PACK_SCHEMA}".`);
  }
  if (!isText(data.pack_id)) errors.push('Missing "pack_id".');
  if (!isText(data.pack_title)) errors.push('Missing "pack_title".');
  if (!Array.isArray(data.lessons) || data.lessons.length === 0) {
    errors.push('"lessons" must be a list with at least one lesson.');
    return { ok: false, errors };
  }

  data.lessons.forEach((lesson: unknown, i: number) => {
    const where = `Lesson ${i + 1}`;
    if (!isObject(lesson)) return errors.push(`${where} is not an object.`);
    if (!isText(lesson.id)) errors.push(`${where}: missing "id".`);
    if (!isText(lesson.title)) errors.push(`${where}: missing "title".`);
    if (lesson.illustration !== undefined) {
      if (!isObject(lesson.illustration) || !isText(lesson.illustration.svg)) {
        errors.push(`${where}: "illustration" needs an "svg".`);
      }
    }
    if (!Array.isArray(lesson.sections) || lesson.sections.length === 0) {
      return errors.push(`${where}: "sections" must be a non-empty list.`);
    }
    lesson.sections.forEach((s: unknown, j: number) => {
      const w = `${where}, section ${j + 1}`;
      if (!isObject(s)) return errors.push(`${w} is not an object.`);
      if (s.type === 'check') {
        if (!isText(s.question) || !isText(s.answer)) {
          errors.push(`${w}: a "check" needs "question" and "answer".`);
        }
      } else if (s.type === 'concept' || s.type === 'task' || s.type === 'challenge') {
        if (!isText(s.markdown)) errors.push(`${w}: missing "markdown".`);
      } else {
        errors.push(`${w}: unknown type "${String(s.type)}".`);
      }
    });
  });

  const ids = data.lessons.map((l: { id?: unknown }) => l?.id);
  const dupes = ids.filter((id: unknown, i: number) => ids.indexOf(id) !== i);
  if (dupes.length) errors.push(`The same lesson id is used twice: ${[...new Set(dupes)].join(', ')}`);

  if (errors.length) return { ok: false, errors: errors.slice(0, 8) };
  return { ok: true, pack: data as unknown as LessonPack };
}

// ---------------------------------------------------------------------
// Saving (merging) into the database
// ---------------------------------------------------------------------

function sectionToCard(s: Section): CardData {
  switch (s.type) {
    case 'concept':
      return { type: 'concept', title: s.heading ?? 'Concept', text: s.markdown };
    case 'task':
      return { type: 'task', title: s.heading, text: s.markdown };
    case 'challenge':
      return { type: 'challenge', title: s.heading, text: s.markdown };
    case 'check':
      return { type: 'check', title: s.heading, question: s.question, answer: s.answer };
  }
}

/**
 * Merges a lesson pack into the database.
 * New lesson ids are added; an existing id is replaced (your "done" mark stays).
 * markNew: false = don't give new lessons a "New" badge (e.g. bundled lessons).
 */
export async function mergeLessonPack(
  pack: LessonPack,
  { markNew = true }: { markNew?: boolean } = {},
): Promise<{ added: number; replaced: number }> {
  return db.transaction('rw', [db.tracks, db.packs, db.lessons, db.cards], async () => {
    const oldPack = await db.packs.get(pack.pack_id);
    const oldTrack = oldPack && (await db.tracks.get(oldPack.trackId));
    // If the file has no category, keep the pack in the track it's already in.
    const trackId = await findOrCreateTrack(
      pack.category?.trim() || oldTrack?.name || 'General',
    );
    await db.packs.put({
      id: pack.pack_id,
      trackId,
      title: pack.pack_title.trim() || oldPack?.title || pack.pack_id,
      topic: pack.pack_title,
      createdAt: oldPack?.createdAt ?? Date.now(),
    });

    let added = 0;
    let replaced = 0;

    for (const [i, l] of pack.lessons.entries()) {
      const old = await db.lessons.get(l.id);
      if (old) replaced++;
      else added++;

      const lesson: Lesson = {
        id: l.id,
        packId: pack.pack_id,
        trackId,
        order: l.day ?? i,
        title: l.title,
        completedAt: old?.completedAt,
        addedAt: old?.addedAt ?? (markNew ? Date.now() : 0),
        openedAt: old?.openedAt,
        day: l.day,
        date: l.date,
        week: l.week,
        weekTheme: l.week_theme,
        minutes: l.minutes,
        illustration: l.illustration
          ? { svg: l.illustration.svg, alt: l.illustration.alt ?? '' }
          : undefined,
      };
      await db.lessons.put(lesson);

      // Swap the old cards for the new ones.
      await db.cards.where('lessonId').equals(l.id).delete();
      const cards: Card[] = l.sections.map((s, order) => ({
        ...sectionToCard(s),
        id: `${l.id}:${order}`,
        lessonId: l.id,
        packId: pack.pack_id,
        order,
      }));
      await db.cards.bulkAdd(cards);
    }

    return { added, replaced };
  });
}

// ---------------------------------------------------------------------
// Lesson packs that ship inside the app (work offline)
// ---------------------------------------------------------------------

const BUNDLED: unknown[] = [bundledBusiness];

/**
 * Loads the bundled lesson packs. Runs on every start but only does work
 * the first time, or when a bundled file was updated (new "generated" date).
 */
export async function loadBundledLessonPacks(): Promise<void> {
  for (const data of BUNDLED) {
    const result = validateLessonPack(data);
    if (!result.ok) {
      console.error('Bundled lesson pack is broken:', result.errors);
      continue;
    }
    const { pack } = result;
    const key = `bundled:${pack.pack_id}`;
    const version = `${pack.generated ?? ''}/${pack.lessons.length}`;
    const seen = await db.settings.get(key);
    if (seen?.value === version) continue;
    await mergeLessonPack(pack, { markNew: false });
    await db.settings.put({ key, value: version });
  }
}
