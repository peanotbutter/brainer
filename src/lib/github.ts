// Where generated lessons live on GitHub, and how to ask for a new one.
//
// The flow:
//  1. You fill the "Ask Claude" form in the app. It opens a pre-filled
//     GitHub issue (you tap "Submit new issue" once).
//  2. A GitHub Action (.github/workflows/generate-lesson.yml) wakes up,
//     asks Claude to write the lesson and saves it in lessons/generated/.
//  3. The app notices the new file and shows "You can download the lessons now".
//
// No passwords or keys are stored in the app: the Claude key lives only in
// GitHub's secret storage.

export const GITHUB_REPO = 'peanotbutter/brainer';
export const GITHUB_BRANCH = 'main';

const RAW = `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/lessons/generated`;

/** The list of generated lesson packs. */
export const INDEX_URL = `${RAW}/index.json`;

export function packFileUrl(file: string): string {
  return `${RAW}/${encodeURIComponent(file)}`;
}

export interface LessonRequest {
  topic: string;
  track: string;
  count: number;
  notes: string;
}

/** The address of a new GitHub issue with everything filled in. */
export function buildIssueUrl({ topic, track, count, notes }: LessonRequest): string {
  const body = [
    `Topic: ${topic.trim()}`,
    `Track: ${track.trim() || 'General'}`,
    `Lessons: ${count}`,
    `Notes: ${notes.trim() || '-'}`,
    '',
    '_Just press "Submit new issue". Claude will write the lesson and the Brainer app will tell you when it is ready._',
  ].join('\n');
  const params = new URLSearchParams({ title: `[Lesson] ${topic.trim()}`, body });
  return `https://github.com/${GITHUB_REPO}/issues/new?${params}`;
}
