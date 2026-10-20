// Turns the text you paste from Claude into a checked, clean PackJson.
// If something is wrong, it returns friendly error messages instead.

import type { CardData, LessonJson, PackJson } from '../db/types';

export type ParseResult =
  | { ok: true; pack: PackJson; warnings: string[] }
  | { ok: false; errors: string[] };

const MAX_ERRORS = 8; // don't overwhelm you with 50 errors at once

/**
 * Step 1: cut the JSON out of the pasted text.
 * Claude sometimes wraps it in ```json fences or adds a sentence before
 * or after it, so we remove the fences and keep only the part from the
 * first "{" to the last "}".
 */
export function extractJson(raw: string): string | null {
  const noFences = raw.replace(/```[a-zA-Z]*/g, '');
  const start = noFences.indexOf('{');
  const end = noFences.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  return noFences.slice(start, end + 1);
}

/** Step 2 + 3: parse the JSON text and check it against the Pack schema. */
export function parsePack(raw: string): ParseResult {
  if (!raw.trim()) {
    return { ok: false, errors: ['The paste box is empty. Paste the reply from Claude first.'] };
  }

  const jsonText = extractJson(raw);
  if (!jsonText) {
    return {
      ok: false,
      errors: ["I couldn't find any JSON in what you pasted. Make sure you copied Claude's whole reply."],
    };
  }

  let data: unknown;
  try {
    data = JSON.parse(jsonText);
  } catch (e) {
    return {
      ok: false,
      errors: [
        "The reply isn't valid JSON. It may have been cut off. Try copying it again, or ask Claude to \"return the complete JSON again\".",
        `Details: ${(e as Error).message}`,
      ],
    };
  }

  return validatePack(data);
}

// ---------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isText(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).length;
}

// The allowed card order, written as a pattern:
// hook, then 1-3 concept, then optional example, then quiz, then task.
const CARD_ORDER = /^hook( concept){1,3}( example)? quiz task$/;

// ---------------------------------------------------------------------
// The actual checking
// ---------------------------------------------------------------------

export function validatePack(data: unknown): ParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isObject(data)) {
    return { ok: false, errors: ['The JSON should be one object that starts with "{".'] };
  }

  if (data.schemaVersion !== 1) errors.push('"schemaVersion" must be 1.');
  if (!isText(data.packTitle)) errors.push('"packTitle" is missing or empty.');
  if (!isText(data.track)) errors.push('"track" is missing or empty.');
  if (!isText(data.topic)) errors.push('"topic" is missing or empty.');

  if (!Array.isArray(data.lessons) || data.lessons.length === 0) {
    errors.push('"lessons" must be a list with at least one lesson.');
    return { ok: false, errors };
  }

  const lessons: LessonJson[] = [];

  data.lessons.forEach((lessonRaw: unknown, li: number) => {
    const where = `Lesson ${li + 1}`;
    if (!isObject(lessonRaw)) {
      errors.push(`${where} is not an object.`);
      return;
    }
    const title = isText(lessonRaw.title) ? lessonRaw.title.trim() : '';
    if (!title) errors.push(`${where} has no "title".`);
    const label = title ? `${where} ("${title}")` : where;

    if (!Array.isArray(lessonRaw.cards)) {
      errors.push(`${label} has no "cards" list.`);
      return;
    }
    if (lessonRaw.cards.length < 4 || lessonRaw.cards.length > 6) {
      errors.push(`${label} has ${lessonRaw.cards.length} cards. It needs 4 to 6.`);
    }

    const cards: CardData[] = [];
    lessonRaw.cards.forEach((cardRaw: unknown, ci: number) => {
      const card = checkCard(cardRaw, `${label}, card ${ci + 1}`, errors);
      if (card) cards.push(card);
    });

    // Only check the order if every card was valid (otherwise it's noise).
    if (cards.length === lessonRaw.cards.length) {
      const order = cards.map((c) => c.type).join(' ');
      if (!CARD_ORDER.test(order)) {
        errors.push(
          `${label} has its cards in the wrong order: ${order.replaceAll(' ', ' → ')}. ` +
            'Expected: hook → 1-3 concept → optional example → quiz → task.',
        );
      }
    }

    // Long concept cards are allowed, but we mention them.
    cards.forEach((c, ci) => {
      if (c.type === 'concept' && wordCount(c.text) > 60) {
        warnings.push(`${label}, card ${ci + 1} is ${wordCount(c.text)} words (target: under 60).`);
      }
    });

    lessons.push({ title, cards });
  });

  if (errors.length > 0) {
    const shown = errors.slice(0, MAX_ERRORS);
    if (errors.length > MAX_ERRORS) shown.push(`…and ${errors.length - MAX_ERRORS} more problems.`);
    return { ok: false, errors: shown };
  }

  const pack: PackJson = {
    schemaVersion: 1,
    packTitle: (data.packTitle as string).trim(),
    track: (data.track as string).trim(),
    topic: (data.topic as string).trim(),
    lessons,
  };
  return { ok: true, pack, warnings };
}

/**
 * Checks one card. Returns a clean copy (only the fields we know about,
 * with spaces trimmed) or null if it has problems.
 */
function checkCard(raw: unknown, where: string, errors: string[]): CardData | null {
  if (!isObject(raw)) {
    errors.push(`${where} is not an object.`);
    return null;
  }
  const before = errors.length;
  const need = (field: string) => {
    if (!isText(raw[field])) errors.push(`${where} (${String(raw.type)}) is missing "${field}".`);
  };
  const text = (field: string) => String(raw[field] ?? '').trim();

  switch (raw.type) {
    case 'hook':
      need('text');
      return errors.length > before ? null : { type: 'hook', text: text('text') };

    case 'concept':
      need('title');
      need('text');
      return errors.length > before ? null : { type: 'concept', title: text('title'), text: text('text') };

    case 'example':
      need('text');
      return errors.length > before ? null : { type: 'example', text: text('text') };

    case 'task':
      need('text');
      return errors.length > before ? null : { type: 'task', text: text('text') };

    case 'quiz': {
      need('question');
      need('explanation');
      const choices = raw.choices;
      if (!Array.isArray(choices) || choices.length !== 4 || !choices.every(isText)) {
        errors.push(`${where} (quiz) must have exactly 4 non-empty "choices".`);
      }
      const ai = raw.answerIndex;
      if (typeof ai !== 'number' || !Number.isInteger(ai) || ai < 0 || ai > 3) {
        errors.push(`${where} (quiz) "answerIndex" must be 0, 1, 2 or 3.`);
      }
      if (errors.length > before) return null;
      return {
        type: 'quiz',
        question: text('question'),
        choices: (choices as string[]).map((c) => c.trim()),
        answerIndex: ai as number,
        explanation: text('explanation'),
      };
    }

    default:
      errors.push(
        `${where} has an unknown type "${String(raw.type)}". Allowed: hook, concept, example, quiz, task.`,
      );
      return null;
  }
}
