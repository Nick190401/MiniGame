// A single, quiet waveform drawn once: it runs behind the wordmark like a
// signal trace, swelling in the middle where the title sits.
const WAVE_PATH = (() => {
  const points: string[] = [];
  for (let i = 0; i <= 120; i++) {
    const x = (i / 120) * 400;
    const env = Math.sin((i / 120) * Math.PI);
    const y = 30 + Math.sin(i * 0.62) * 12 * env * env + Math.sin(i * 1.7) * 5 * env;
    points.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return points.join(' ');
})();

export function GameLogo({ compact = false }: { compact?: boolean }) {
  return (
    <h1 className={`game-logo${compact ? ' game-logo--compact' : ''}`} aria-label="Sound Quest">
      <svg className="game-logo__wave" viewBox="0 0 400 60" preserveAspectRatio="none" aria-hidden="true">
        <path d={WAVE_PATH} />
      </svg>
      <span className="game-logo__word" aria-hidden="true">Sound</span>
      <span className="game-logo__word game-logo__word--accent" aria-hidden="true">Quest</span>
      <span className="game-logo__tagline" aria-hidden="true">Find the lost track</span>
    </h1>
  );
}
