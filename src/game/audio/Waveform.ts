/** RMS amplitude of equal time slices, including every channel of the track. */
export function getWaveformHeights(channels: readonly Float32Array[], barCount: number): number[] {
  const length = channels[0]?.length ?? 0;
  const levels = Array.from({ length: barCount }, (_, index) => {
    const start = Math.floor(index * length / barCount);
    const end = Math.floor((index + 1) * length / barCount);
    let energy = 0;
    for (const channel of channels) {
      for (let sample = start; sample < end; sample++) {
        energy += channel[sample] * channel[sample];
      }
    }
    const count = (end - start) * channels.length;
    return count ? Math.sqrt(energy / count) : 0;
  });
  const peak = Math.max(...levels);
  return levels.map(level => peak > 0 ? level / peak * 100 : 0);
}
