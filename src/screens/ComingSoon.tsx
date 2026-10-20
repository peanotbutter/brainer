// Placeholder for screens we build in later phases.
export default function ComingSoon({ title, phase }: { title: string; phase: number }) {
  return (
    <>
      <h1>{title}</h1>
      <div className="card empty muted">
        <span className="eyebrow">Phase {phase}</span>
        <p>This screen is coming soon.</p>
      </div>
    </>
  );
}
