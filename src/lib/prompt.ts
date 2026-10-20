// Builds the prompt you paste into Claude to generate a new pack.

export interface PromptOptions {
  topic: string;
  track: string;
  lessonCount: number;
  notes: string;
}

// An example of the exact JSON shape we expect back.
const SCHEMA_EXAMPLE = `{
  "schemaVersion": 1,
  "packTitle": "string",
  "track": "string",
  "topic": "string",
  "lessons": [
    {
      "title": "string",
      "cards": [
        { "type": "hook", "text": "string" },
        { "type": "concept", "title": "string", "text": "string" },
        { "type": "example", "text": "string" },
        { "type": "quiz", "question": "string", "choices": ["string", "string", "string", "string"], "answerIndex": 0, "explanation": "string" },
        { "type": "task", "text": "string" }
      ]
    }
  ]
}`;

export function buildPrompt({ topic, track, lessonCount, notes }: PromptOptions): string {
  const about = notes.trim() || 'Not specified. Assume a motivated beginner.';

  return `You are creating a micro-learning pack for my phone app "Brainer". I read one lesson in 2-3 minutes as swipeable cards, instead of scrolling social media.

Topic: ${topic.trim()}
Track: ${track.trim()}
Number of lessons: ${lessonCount}
About me / my level: ${about}

CONTENT RULES
- Practical and concrete: real examples, commands, numbers, names and situations. No fluff, no generic advice.
- Lessons build on each other, from basics to more advanced.
- Every "concept" card text is under 60 words. Hook, example and task texts are under 50 words.
- hook: a surprising fact, question or problem that makes me want to keep reading.
- concept: one idea per card, with a short title.
- example: a concrete real-world example (optional).
- quiz: tests understanding, not memorized wording. Exactly 4 choices, one clearly correct, three plausible wrong ones. "answerIndex" is the 0-based position of the correct choice. Vary the position of the correct answer across lessons. "explanation" is 1-2 sentences on why the answer is right.
- task: one small, real action I can do today in under 15 minutes.

STRUCTURE RULES (the app rejects packs that break these)
- Exactly ${lessonCount} lessons.
- Each lesson has 4 to 6 cards, in exactly this order: 1 "hook", then 1 to 3 "concept", then 0 or 1 "example", then exactly 1 "quiz", then exactly 1 "task".
- "schemaVersion" must be 1.
- "track" must be exactly "${track.trim()}".
- "topic" must be exactly "${topic.trim()}".

OUTPUT FORMAT
Return ONLY valid JSON. No markdown, no code fences, no comments, no text before or after the JSON. Use straight double quotes and escape any double quotes inside strings.

The JSON must match this shape:
${SCHEMA_EXAMPLE}`;
}
