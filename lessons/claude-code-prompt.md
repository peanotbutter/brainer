Add lesson-pack support to Brainy.

I added a file `lessons/brainy-business-lessons.json` (format: "brainy-lesson-pack/v1"). Please:

1. Read that file and learn its structure:
   - top level: pack_id, pack_title, category, lessons[]
   - each lesson: id, day, date, week, week_theme, title, minutes,
     illustration { type: "svg", alt, svg }, sections[]
   - sections have type "concept" | "task" | "challenge" (with `markdown`)
     or "check" (with `question` and `answer`).
2. Bundle this file with the app so it works fully OFFLINE, and load all lessons on first run.
3. Lesson screen:
   - Show the SVG illustration at the top (it uses `currentColor`, so set the text color so it looks right in light AND dark mode).
   - Render the markdown sections (bold, lists, tables).
   - For "check": show the question, and hide the answer behind a "Show answer" tap.
   - Show week theme and "≈ N min" at the top.
4. Lesson list grouped by pack, then by week; mark lessons as done.
5. Add an "Import lesson pack" button that opens the phone's file picker, accepts a .json file in this same format, and merges lessons by `id` (new ids are added, same id = replace). This is how I'll add new lessons every day.
6. If the app already has its own lesson format, convert this format into it instead of creating a second one — tell me what you decided.

Keep it simple; I'm a beginner. After you finish, tell me exactly how to test it on my Android phone.
