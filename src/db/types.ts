// =====================================================================
// Part 1: The Pack JSON — the shape of what Claude sends us.
// =====================================================================

export type HookCardData = { type: 'hook'; text: string };
export type ConceptCardData = { type: 'concept'; title: string; text: string };
export type ExampleCardData = { type: 'example'; text: string };
export type QuizCardData = {
  type: 'quiz';
  question: string;
  choices: string[]; // always exactly 4
  answerIndex: number; // 0-3, which choice is correct
  explanation: string;
};
export type TaskCardData = { type: 'task'; text: string; title?: string };
// The next two come from imported lesson packs (see lib/lessonPack.ts).
export type CheckCardData = { type: 'check'; question: string; answer: string; title?: string };
export type ChallengeCardData = { type: 'challenge'; text: string; title?: string };

// A card is ONE of the kinds above. The "type" field tells us which.
// Card "text" may contain markdown (**bold**, lists, tables).
export type CardData =
  | HookCardData
  | ConceptCardData
  | ExampleCardData
  | QuizCardData
  | TaskCardData
  | CheckCardData
  | ChallengeCardData;

export interface LessonJson {
  title: string;
  cards: CardData[];
}

export interface PackJson {
  schemaVersion: 1;
  packTitle: string;
  track: string;
  topic: string;
  lessons: LessonJson[];
}

// =====================================================================
// Part 2: What we store on the phone (IndexedDB tables).
// Every row gets a unique "id" that we generate on import.
// =====================================================================

/** A track groups packs by subject, e.g. "Networking". */
export interface Track {
  id: string;
  name: string;
  createdAt: number; // timestamp in milliseconds
}

/** One imported pack, e.g. "MikroTik firewall basics". */
export interface Pack {
  id: string;
  trackId: string;
  title: string;
  topic: string;
  createdAt: number;
}

/** One lesson inside a pack. */
export interface Lesson {
  id: string;
  packId: string;
  trackId: string;
  order: number; // 0 = first lesson of the pack
  title: string;
  completedAt?: number; // set when the lesson is finished
  addedAt?: number; // when this lesson first arrived on the phone (for the "New" badge)
  openedAt?: number; // first time you opened it (then it's no longer "New")
  // Extra details. Only lessons from an imported lesson pack have these.
  day?: number;
  date?: string; // "2026-10-09"
  week?: number;
  weekTheme?: string;
  minutes?: number;
  illustration?: { svg: string; alt: string };
}

/** One card inside a lesson: the card content plus where it belongs. */
export type Card = CardData & {
  id: string;
  lessonId: string;
  packId: string;
  order: number; // 0 = first card of the lesson
};

/** A starred card saved to Notes, with my own one-line takeaway. */
export interface Star {
  cardId: string;
  starredAt: number;
  takeaway: string;
}

/** Spaced-repetition state of one quiz card (Leitner box 1-6). */
export interface ReviewItem {
  cardId: string;
  box: number;
  due: string; // date like "2026-10-14" when it should be reviewed next
  lastReviewed?: string;
}

/** Status of one "task" card. */
export interface TaskState {
  cardId: string;
  status: 'todo' | 'committed' | 'done'; // committed = "I'll do it"
  updatedAt: number;
}

/** What I did on one day. Used to calculate the streak. */
export interface DayLog {
  date: string; // "2026-10-14"
  lessons: number;
  reviewDone: boolean;
}

/** Simple key/value settings, e.g. { key: 'theme', value: 'dark' }. */
export interface Setting {
  key: string;
  value: unknown;
}
