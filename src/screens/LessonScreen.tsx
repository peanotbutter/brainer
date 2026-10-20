// One lesson: picture, then its cards from top to bottom, then "Mark as done".

import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { Card } from '../db/types';
import { cleanSvg, markdownToHtml } from '../lib/markdown';
import Icon from '../components/Icon';

/** Shows markdown text as formatted HTML. */
function Markdown({ text }: { text: string }) {
  return <div className="md" dangerouslySetInnerHTML={{ __html: markdownToHtml(text) }} />;
}

/** A question with its answer hidden until you tap "Show answer". */
function Reveal({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button className="btn" onClick={() => setOpen(true)}>
        Show answer
      </button>
    );
  }
  return <div className="answer">{children}</div>;
}

function CardView({ card }: { card: Card }) {
  switch (card.type) {
    case 'hook':
      return <p className="hook">{card.text}</p>;
    case 'concept':
      return (
        <section className="card">
          <h2>{card.title}</h2>
          <Markdown text={card.text} />
        </section>
      );
    case 'example':
      return (
        <section className="card">
          <h2>Example</h2>
          <Markdown text={card.text} />
        </section>
      );
    case 'task':
      return (
        <section className="card card-task">
          <h2>{card.title ?? 'Your task'}</h2>
          <Markdown text={card.text} />
        </section>
      );
    case 'challenge':
      return (
        <section className="card card-challenge">
          <h2>{card.title ?? 'Challenge'}</h2>
          <Markdown text={card.text} />
        </section>
      );
    case 'check':
      return (
        <section className="card">
          <h2>{card.title ?? 'Check'}</h2>
          <p className="question">{card.question}</p>
          <Reveal>
            <Markdown text={card.answer} />
          </Reveal>
        </section>
      );
    case 'quiz':
      return (
        <section className="card">
          <h2>Quiz</h2>
          <p className="question">{card.question}</p>
          <ol type="A">
            {card.choices.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ol>
          <Reveal>
            <p>
              <strong>Answer: {card.choices[card.answerIndex]}</strong>
            </p>
            <Markdown text={card.explanation} />
          </Reveal>
        </section>
      );
  }
}

export default function LessonScreen({ id }: { id: string }) {
  // Remember that you opened this lesson, so it loses its "New" badge.
  useEffect(() => {
    db.lessons
      .where('id')
      .equals(id)
      .filter((l) => !l.openedAt)
      .modify({ openedAt: Date.now() })
      .catch(() => {});
  }, [id]);

  const data = useLiveQuery(async () => {
    const lesson = await db.lessons.get(id);
    if (!lesson) return { lesson: null };
    const [cards, pack, siblings] = await Promise.all([
      db.cards.where('lessonId').equals(id).sortBy('order'),
      db.packs.get(lesson.packId),
      db.lessons.where('packId').equals(lesson.packId).sortBy('order'),
    ]);
    const next = siblings[siblings.findIndex((l) => l.id === id) + 1];
    return { lesson, cards, pack, next };
  }, [id]);

  if (!data) return null; // still loading
  if (!data.lesson) {
    return (
      <div className="card empty muted">
        Lesson not found. <a href="#/">Go to Home</a>
      </div>
    );
  }

  const { lesson, cards, pack, next } = data;
  const done = !!lesson.completedAt;

  async function toggleDone() {
    await db.lessons.update(id, { completedAt: done ? undefined : Date.now() });
    if (!done) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <article className="lesson">
      <a href="#/" className="back">
        ← {pack?.title ?? 'Home'}
      </a>

      <div className="lesson-meta">
        {lesson.weekTheme && (
          <span className="eyebrow">
            {lesson.week ? `Week ${lesson.week} · ` : ''}
            {lesson.weekTheme}
          </span>
        )}
        {lesson.minutes && <span className="eyebrow eyebrow-plain">≈ {lesson.minutes} min</span>}
        {done && (
          <span className="eyebrow eyebrow-done">
            <Icon name="tick" /> Done
          </span>
        )}
      </div>

      <h1>{lesson.title}</h1>

      {lesson.illustration && (
        <div
          className="illustration"
          role="img"
          aria-label={lesson.illustration.alt}
          dangerouslySetInnerHTML={{ __html: cleanSvg(lesson.illustration.svg) }}
        />
      )}

      {cards.map((card) => (
        <CardView key={card.id} card={card} />
      ))}

      <button className={done ? 'btn btn-big' : 'btn btn-gold btn-big'} onClick={toggleDone}>
        <span className="btn-label">
          <Icon name="tick" /> {done ? 'Done — tap to undo' : 'Mark as done'}
        </span>
      </button>

      {next && (
        <a href={`#/lesson/${next.id}`} className="btn btn-primary btn-big btn-link">
          <span className="btn-label">
            Next: {next.title} <Icon name="play" />
          </span>
        </a>
      )}
    </article>
  );
}
