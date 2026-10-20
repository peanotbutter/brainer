import Dexie, { type EntityTable } from 'dexie';
import type {
  Card,
  DayLog,
  Lesson,
  Pack,
  ReviewItem,
  Setting,
  Star,
  TaskState,
  Track,
} from './types';
import { newId } from '../lib/id';

// Dexie is a friendly wrapper around IndexedDB, the database built into
// every browser. Everything lives on the phone; nothing is sent anywhere.
class BrainerDB extends Dexie {
  tracks!: EntityTable<Track, 'id'>;
  packs!: EntityTable<Pack, 'id'>;
  lessons!: EntityTable<Lesson, 'id'>;
  cards!: EntityTable<Card, 'id'>;
  stars!: EntityTable<Star, 'cardId'>;
  reviews!: EntityTable<ReviewItem, 'cardId'>;
  tasks!: EntityTable<TaskState, 'cardId'>;
  days!: EntityTable<DayLog, 'date'>;
  settings!: EntityTable<Setting, 'key'>;

  constructor() {
    super('brainer');

    // The database layout. The first name in each string is the primary
    // key; the others are "indexes" we can search by.
    // IMPORTANT: if we ever change this, we add a version(2) below instead
    // of editing version(1). That way your existing data is upgraded,
    // never wiped.
    this.version(1).stores({
      tracks: 'id, &name', // & = names must be unique
      packs: 'id, trackId, createdAt',
      lessons: 'id, packId, trackId, completedAt',
      cards: 'id, lessonId, packId, type',
      stars: 'cardId, starredAt',
      reviews: 'cardId, due, box',
      tasks: 'cardId, status',
      days: 'date',
      settings: 'key',
    });
  }
}

export const db = new BrainerDB();

// "populate" runs only once: the very first time the database is created.
// It sets up the starter tracks.
db.on('populate', (tx) => {
  const now = Date.now();
  tx.table('tracks').bulkAdd(
    ['Business', 'Networking', 'Electronics'].map((name, i) => ({
      id: newId(),
      name,
      createdAt: now + i,
    })),
  );
});
