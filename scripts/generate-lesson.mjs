// Runs inside GitHub Actions (see .github/workflows/generate-lesson.yml).
// Reads a lesson request (the GitHub issue), asks Claude to write the
// lesson(s), and saves them in lessons/generated/ for the Brainer app.
//
// Needs Node 20+ (built-in fetch). No npm packages.

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const DIR = 'lessons/generated';
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5-5';
const { ANTHROPIC_API_KEY, ISSUE_BODY = '', ISSUE_TITLE = '' } = process.env;

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!ANTHROPIC_API_KEY) fail('ANTHROPIC_API_KEY secret is missing. Add it in Settings > Secrets > Actions.');

// ---------- 1. Read the request ----------
const field = (name) => (ISSUE_BODY.match(new RegExp(`^${name}:[ \\t]*(.*)$`, 'mi'))?.[1] ?? '').trim();
const topic = field('Topic') || ISSUE_TITLE.replace(/^\[Lesson\]\s*/i, '').trim();
const track = field('Track') || 'General';
const count = Math.min(5, Math.max(1, Number.parseInt(field('Lessons'), 10) || 1));
const notes = field('Notes') === '-' ? '' : field('Notes');
if (!topic) fail('The request has no topic.');

const slug =
  topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'lessons';
const file = `${slug}.json`;
const path = `${DIR}/${file}`;

mkdirSync(DIR, { recursive: true });
const existing = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
const oldLessons = existing?.lessons ?? [];

// ---------- 2. Ask Claude ----------
const system = `You write micro-lessons for the phone app "Brainer": one lesson is a 10-20 minute read for a motivated beginner. Reply with ONE JSON object and nothing else (no code fences, no commentary).

Shape:
{
  "pack_title": "string",
  "category": "string",
  "lessons": [
    {
      "title": "string",
      "week_theme": "string (short theme)",
      "minutes": 15,
      "illustration": { "alt": "string", "svg": "<svg ...>" },
      "sections": [
        { "type": "concept", "heading": "Concept", "minutes": 5, "markdown": "..." },
        { "type": "task", "heading": "Your task", "minutes": 5, "markdown": "..." },
        { "type": "check", "heading": "Check", "minutes": 2, "question": "...", "answer": "..." },
        { "type": "challenge", "heading": "Challenge", "minutes": 3, "markdown": "..." }
      ]
    }
  ]
}

Rules:
- Write in simple, concrete language with real numbers and local examples when the notes mention a place. Markdown allowed: **bold**, lists, tables.
- Every lesson has the four sections above, in that order.
- Illustration: one small inline SVG, viewBox="0 0 320 180", fill="none" stroke="currentColor" stroke-width="2" on the root, text uses fill="currentColor" with font-size 12-14, under 2500 characters, no scripts, no images, no external links. It must explain the idea (a diagram), not decorate.
- Produce exactly the requested number of lessons. Each must be different from the lessons already in the pack.`;

const user = `Topic: ${topic}
Track: ${track}
Number of lessons: ${count}
About me / notes: ${notes || 'Not specified. Assume a motivated beginner.'}
${oldLessons.length ? `Lessons already in this pack (do not repeat, continue the progression):\n${oldLessons.map((l) => `- ${l.title}`).join('\n')}` : ''}`;

async function askClaude() {
  const res = await fetch(process.env.ANTHROPIC_API_URL || 'https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 12000,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${data?.error?.message ?? 'unknown error'}`);
  if (data.stop_reason === 'max_tokens') throw new Error('Claude ran out of space; ask for fewer lessons.');
  const text = data.content?.filter((b) => b.type === 'text').map((b) => b.text).join('') ?? '';
  const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  return JSON.parse(json);
}

const TYPES = new Set(['concept', 'task', 'challenge', 'check']);
function validate(out) {
  if (!Array.isArray(out?.lessons) || out.lessons.length === 0) throw new Error('No lessons in the answer.');
  for (const [i, l] of out.lessons.entries()) {
    if (!l.title || !Array.isArray(l.sections) || l.sections.length === 0) throw new Error(`Lesson ${i + 1} is incomplete.`);
    for (const s of l.sections) {
      if (!TYPES.has(s.type)) throw new Error(`Lesson ${i + 1}: unknown section type ${s.type}.`);
      if (s.type === 'check' ? !s.question || !s.answer : !s.markdown) throw new Error(`Lesson ${i + 1}: empty ${s.type} section.`);
    }
    if (l.illustration && (!l.illustration.svg || /<script|onload=|onerror=|javascript:/i.test(l.illustration.svg))) {
      delete l.illustration; // drop an unsafe or empty picture, keep the lesson
    }
  }
}

let out;
for (let attempt = 1; attempt <= 2; attempt++) {
  try {
    out = await askClaude();
    validate(out);
    break;
  } catch (e) {
    console.error(`Attempt ${attempt} failed: ${e.message}`);
    if (attempt === 2) fail(`Could not generate a valid lesson: ${e.message}`);
  }
}

// ---------- 3. Save ----------
const today = new Date().toISOString().slice(0, 10);
const lastN = oldLessons.reduce((m, l) => Math.max(m, Number.parseInt(l.id.split('-').pop(), 10) || 0), 0);
const lessons = out.lessons.slice(0, count).map((l, i) => {
  const n = lastN + i + 1;
  return {
    id: `${slug}-${String(n).padStart(3, '0')}`,
    day: n,
    date: today,
    week: Math.ceil(n / 5),
    week_theme: l.week_theme || undefined,
    title: l.title,
    minutes: l.minutes || undefined,
    illustration: l.illustration ? { type: 'svg', alt: l.illustration.alt ?? '', svg: l.illustration.svg } : undefined,
    sections: l.sections,
  };
});

const pack = {
  schema: 'brainy-lesson-pack/v1',
  pack_id: slug,
  pack_title: existing?.pack_title ?? out.pack_title ?? topic,
  category: existing?.category ?? (track !== 'General' ? track : out.category) ?? 'General',
  language: 'en',
  generated: new Date().toISOString(),
  lessons: [...oldLessons, ...lessons],
};
writeFileSync(path, JSON.stringify(pack, null, 2) + '\n');

const indexPath = `${DIR}/index.json`;
const index = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, 'utf8')) : { packs: [] };
index.packs = (index.packs ?? []).filter((p) => p.file !== file);
index.packs.push({ file, title: pack.pack_title, updated: pack.generated, lessons: pack.lessons.length });
writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n');

console.log(`Saved ${lessons.length} lesson(s) to ${path}`);
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `summary=${lessons.map((l) => l.title).join('; ')}\nfile=${path}\n`);
}
