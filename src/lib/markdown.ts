// Turns markdown text (**bold**, lists, tables) into safe HTML.
// DOMPurify removes anything dangerous (like <script>), because lesson
// files can come from anywhere.

import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({ gfm: true, breaks: true });

/**
 * A table needs a "| --- |" line under its header. Lesson files sometimes
 * give only the header row as a template to fill in, so we add that line.
 */
function fixHeaderOnlyTables(md: string): string {
  const lines = md.split('\n');
  const out: string[] = [];
  const isRow = (l: string | undefined) => !!l && /^\s*\|.*\|\s*$/.test(l);
  const isDivider = (l: string | undefined) => !!l && /^\s*\|?\s*:?-{3,}/.test(l);
  for (let i = 0; i < lines.length; i++) {
    out.push(lines[i]);
    if (isRow(lines[i]) && !isRow(lines[i - 1]) && !isDivider(lines[i + 1])) {
      const cols = lines[i].trim().replace(/^\||\|$/g, '').split('|').length;
      out.push('|' + ' --- |'.repeat(cols));
    }
  }
  return out.join('\n');
}

export function markdownToHtml(md: string): string {
  const html = marked.parse(fixHeaderOnlyTables(md), { async: false });
  return DOMPurify.sanitize(html);
}

/** Cleans an SVG picture so it can't run scripts. */
export function cleanSvg(svg: string): string {
  return DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } });
}
