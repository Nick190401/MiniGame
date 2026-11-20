"""Builds the event sounds that had no recording yet, from the game's own samples.

  python scripts/build_event_sfx.py

Writes into public/assets/audio:
  sfx/battle/boss-phase-change.wav  Gatekeeper, phase I -> II (enrage)
  sfx/battle/boss-phase-final.wav   Gatekeeper, phase II -> III (unleash)
  sfx/world/gate-blocked.wav        Frequency Gate refuses a hero below level 2

The phase sounds start with the phase animation, so their beats sit where the
animation's beats are (src/game/battle/bossPhases.ts): enrage ignites at
1150 ms; unleash strikes at 0, beats its heart at 1330 and 1580 ms and
detonates at 1800 ms. WAV, not MP3: an MP3 encoder delay would move the beats.
Peaks are normalised to the level of the existing battle effects.
Needs ffmpeg on PATH.
"""
from pathlib import Path
import re
import subprocess
import tempfile

AUDIO = Path(__file__).resolve().parent.parent / 'public' / 'assets' / 'audio'
SLAM = AUDIO / 'sfx/attacks/gate_slam.wav'
DAMAGE = AUDIO / 'sfx/battle/damage.wav'
GRIND = AUDIO / 'sfx/attacks/distortion.wav'
COLLAPSE = AUDIO / 'sfx/battle/boss-defeated.wav'

RATE = 44100
MONO = f'aresample={RATE},aformat=sample_fmts=fltp:sample_rates={RATE}:channel_layouts=mono'
# The slam's attack starts 140 ms in and is loudest at 370 ms; reversed, that
# loudest point sits here, so a reversed slam cut at it swells into a hit.
SLAM_REVERSED_PEAK = 1.6825 - 0.370
# Trimming 0.12 s leaves the slam's attack 20 ms into the clip.
SLAM_LEAD = 0.12
ATTACK_AT = 0.02


def src(expr: str, seconds: float) -> str:
    return f"aevalsrc='{expr}':s={RATE}:d={seconds}"


def delay(seconds: float) -> str:
    return f'adelay={round(seconds * 1000)}:all=1'


def reversed_swell(index: int, length: float, start: float, label: str, fade: float, gain: float = 0.9) -> str:
    return (f'[{index}:a]{MONO},areverse,atrim=start={SLAM_REVERSED_PEAK - length:.4f}:end={SLAM_REVERSED_PEAK:.4f},'
            f'asetpts=PTS-STARTPTS,afade=t=in:d={fade}:curve=exp,volume={gain},{delay(start)}[{label}]')


def slam_at(index: int, time: float, label: str, gain: float = 1.0) -> str:
    return f'[{index}:a]{MONO},atrim=start={SLAM_LEAD},asetpts=PTS-STARTPTS,volume={gain},{delay(time - ATTACK_AT)}[{label}]'


def sweep(f0: float, f1: float, seconds: float, gain: float) -> str:
    # Rising pitch with rising level: tension that ends on the hit.
    return src(f'{gain}*pow(t/{seconds},2)*sin(2*PI*({f0}*t+{(f1 - f0) / (2 * seconds):.4f}*t*t))', seconds)


def sub_boom(gain: float, decay: float, base: float, drop: float, seconds: float) -> str:
    # A low sine that falls in pitch as it fades, driven into soft clipping:
    # the overtones keep it audible on phone and laptop speakers.
    return (src(f'exp(-{decay}*t)*sin(2*PI*({base}*t+{drop}*(1-exp(-5*t))/5))', seconds)
            + f',volume=2.5,asoftclip=type=tanh,volume={gain}')


def pulses(index: int, beats: list[tuple[float, float]], prefix: str) -> list[str]:
    """The body of the hit sample, muffled, once per beat: thumps with some mid range."""
    names = ''.join(f'[{prefix}s{i}]' for i in range(len(beats)))
    graph = [f'[{index}:a]{MONO},atrim=start=0.235:end=0.6,asetpts=PTS-STARTPTS,lowpass=f=900,'
             f'afade=t=out:st=0.15:d=0.2,asplit={len(beats)}{names}']
    graph += [f'[{prefix}s{i}]volume={gain},{delay(time - ATTACK_AT)}[{prefix}{i}]' for i, (time, gain) in enumerate(beats)]
    return graph


def mix(labels: list[str], length: float, fade_out: float) -> str:
    joined = ''.join(f'[{label}]' for label in labels)
    return (f'{joined}amix=inputs={len(labels)}:normalize=0:duration=longest,'
            f'atrim=end={length},afade=t=out:st={length - fade_out}:d={fade_out}[out]')


def phase_change() -> tuple[list[Path], str]:
    ignite = 1.15
    # The rings pulse out at 300, 520, 740 and 900 ms: the charge beats with them.
    charge = [(0.30, 0.6), (0.52, 0.7), (0.74, 0.75), (0.90, 0.85)]
    graph = [
        reversed_swell(0, ignite, 0, 'rise', 0.5, 0.75),
        f"{src('(random(0)*2-1)*exp(-55*t)', 0.09)},highpass=f=1200,lowpass=f=6000,volume=0.45,{delay(0.09)}[tick]",
        f'{sweep(80, 220, ignite, 0.3)}[sweep]',
        f'[3:a]{MONO},atrim=start=0.3:end=1.3,asetpts=PTS-STARTPTS,highpass=f=300,lowpass=f=2400,'
        f'tremolo=f=8:d=0.5,afade=t=in:d=1.0,volume=0.6,{delay(0.15)}[build]',
        *pulses(4, charge, 'p'),
        slam_at(1, ignite, 'hit'),
        f'{sub_boom(0.8, 3.2, 45, 60, 1.4)},{delay(ignite)}[sub]',
        f'[2:a]{MONO},atrim=end=1.4,asetpts=PTS-STARTPTS,lowpass=f=1500,afade=t=in:d=0.04,'
        f'afade=t=out:st=0.5:d=0.9,volume=0.6,{delay(ignite + 0.02)}[roar]',
        mix(['rise', 'tick', 'sweep', 'build', *[f'p{i}' for i in range(len(charge))], 'hit', 'sub', 'roar'], 2.6, 0.5),
    ]
    return [SLAM, SLAM, GRIND, GRIND, DAMAGE], ';'.join(graph)


def phase_final() -> tuple[list[Path], str]:
    collapse, detonate = 1.1, 1.8
    cracks = [f'[k{i}]volume={0.5 - i * 0.02:.2f},{delay(0.3 + i * 0.08)}[c{i}]' for i in range(8)]
    graph = [
        slam_at(0, ATTACK_AT, 'impact'),
        # It convulses: a torn, trembling grind until the collapse.
        f'[4:a]{MONO},atrim=end=0.98,asetpts=PTS-STARTPTS,highpass=f=250,tremolo=f=11:d=0.7,'
        f'afade=t=in:d=0.15,afade=t=out:st=0.78:d=0.2,volume=0.6,{delay(0.12)}[convulse]',
        # The ground ruptures: eight dry cracks, 80 ms apart, as in the visuals.
        f"{src('(random(0)*2-1)*exp(-55*t)', 0.09)},highpass=f=1200,lowpass=f=6000,asplit=8{''.join(f'[k{i}]' for i in range(8))}",
        *cracks,
        # The arena starts to shake at 700 ms.
        f'anoisesrc=d={detonate - 0.7}:c=brown:r={RATE}:a=0.9,lowpass=f=450,tremolo=f=6:d=0.5,'
        f'afade=t=in:d=0.4,volume=3.0,{delay(0.7)}[rumble]',
        # Everything is pulled into the core, then two heartbeats, the second harder.
        reversed_swell(1, detonate - collapse, collapse, 'implode', 0.4, 0.75),
        f'{sweep(90, 260, detonate - collapse, 0.25)},{delay(collapse)}[sweep]',
        *pulses(6, [(1.33, 0.5), (1.58, 0.7)], 'h'),
        f"{src('exp(-20*t)*sin(2*PI*(48*t+30*(1-exp(-20*t))/20))', 0.3)},volume=2,asoftclip=type=tanh,asplit=2[t0][t1]",
        f'[t0]volume=0.4,{delay(1.33)}[beat0]',
        f'[t1]volume=0.5,{delay(1.58)}[beat1]',
        # Detonation into the final form.
        slam_at(2, detonate, 'det'),
        f'[3:a]{MONO},atrim=start=0.235,asetpts=PTS-STARTPTS,volume=0.7,{delay(detonate - ATTACK_AT)}[crack]',
        f'{sub_boom(0.8, 1.6, 35, 70, 2.0)},{delay(detonate)}[boom]',
        f'[5:a]{MONO},atrim=start=0.78:end=2.78,asetpts=PTS-STARTPTS,lowpass=f=3200,'
        f'afade=t=out:st=1.1:d=0.9,volume=0.9,{delay(detonate - ATTACK_AT)}[tail]',
        mix(['impact', 'convulse', *[f'c{i}' for i in range(8)], 'rumble', 'implode', 'sweep',
             'h0', 'h1', 'beat0', 'beat1', 'det', 'crack', 'boom', 'tail'], 3.8, 0.6),
    ]
    return [SLAM, SLAM, SLAM, DAMAGE, GRIND, COLLAPSE, DAMAGE], ';'.join(graph)


def gate_blocked() -> tuple[list[Path], str]:
    # A dull knock on the gate and a two-tone "denied" buzz, falling.
    buzz = ('0.5*(lt(t,0.14)*min(1,t/0.004)*min(1,(0.14-t)/0.01)*sgn(sin(2*PI*196*t))'
            '+gte(t,0.17)*lt(t,0.42)*min(1,(t-0.17)/0.004)*min(1,(0.42-t)/0.03)*sgn(sin(2*PI*147*t)))')
    graph = [
        f"{src('0.8*exp(-22*t)*sin(2*PI*(55*t+40*(1-exp(-30*t))/30))', 0.35)}[thud]",
        f'{src(buzz, 0.45)},lowpass=f=1400,volume=0.5[buzz]',
        f"{src('0.08*(random(0)*2-1)*exp(-7*t)', 0.45)},highpass=f=2500[static]",
        mix(['thud', 'buzz', 'static'], 0.5, 0.08),
    ]
    return [], ';'.join(graph)


def max_volume(path: Path) -> float:
    # astats reads float samples as they are; volumedetect would clip them at 0 dB first.
    out = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', str(path), '-af', 'astats', '-f', 'null', '-'],
                         capture_output=True, text=True, check=True).stderr
    return float(re.findall(r'Peak level dB: (-?[\d.]+)', out)[-1])


def render(name: str, build, peak_db: float) -> None:
    inputs, graph = build()
    target = AUDIO / name
    with tempfile.TemporaryDirectory() as tmp:
        raw = Path(tmp) / 'raw.wav'
        args = ['ffmpeg', '-v', 'error', '-y']
        for path in inputs:
            args += ['-i', str(path)]
        args += ['-filter_complex', graph, '-map', '[out]', '-c:a', 'pcm_f32le', str(raw)]
        subprocess.run(args, check=True)
        gain = peak_db - max_volume(raw)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(raw), '-af', f'volume={gain:.2f}dB',
                        '-ac', '1', '-ar', str(RATE), '-c:a', 'pcm_s16le', str(target)], check=True)
    print(f'{name}: peak {max_volume(target):.1f} dB')


if __name__ == '__main__':
    render('sfx/battle/boss-phase-change.wav', phase_change, -1.5)
    render('sfx/battle/boss-phase-final.wav', phase_final, -1.5)
    render('sfx/world/gate-blocked.wav', gate_blocked, -4.0)
