"""Build animation-sized attack cues without changing playback speed or pitch.

Run with: python scripts/prepare_enemy_attack_audio.py
Original recordings remain untouched. Times are seconds from the start of
BattleScene.runEnemyAttackAnimation (after the warning prelude).
"""

from pathlib import Path
import math
import wave


ROOT = Path(__file__).resolve().parents[1] / 'public/assets/audio/sfx/attacks'
# source, output, source accent, visual impact, animation end, fade-out
# Zap: flash at 320 ms, end at 570 ms.
# Glitch: burst at 520 ms, end at 820 ms.
# Void: orb arrives at 580 ms, end at 940 ms.
# Lunge: contact at 140 ms, return ends at 440 ms.
CUES = [
    ('white_noise', 'white-noise', .79, .32, .57, .10),
    ('frequency_jab', 'frequency-jab', .06, .32, .57, .06),
    ('Signal_Burst', 'signal-burst', .61, .52, .82, .12),
    ('distortion', 'distortion', .48, .52, .82, .12),
    ('mute', 'mute', .04, .58, .94, .12),
    ('dead_air', 'dead-air', .53, .58, .94, .12),
    ('silence3-wave', 'silence-wave', .46, .58, .94, .14),
    ('void_crush', 'void-crush', .33, .58, .94, .14),
    ('gate_slam', 'gate-slam', .30, .14, .44, .10),
    ('frequency_lock', 'frequency-lock', .05, .32, .57, .06),
]


def prepare_cues():
    output_dir = ROOT / 'synced'
    output_dir.mkdir(exist_ok=True)
    for source, output, accent, impact, duration, fade_out in CUES:
        with wave.open(str(ROOT / f'{source}.wav'), 'rb') as recording:
            channels = recording.getnchannels()
            width = recording.getsampwidth()
            rate = recording.getframerate()
            source_frames = recording.getnframes()
            assert width == 3, f'Expected 24-bit PCM: {source}'
            raw = recording.readframes(source_frames)

        frames = round(duration * rate)
        # Negative offset inserts silence for short, immediate-hit recordings;
        # positive offset trims the lead-in of recordings with a long buildup.
        offset = round((accent - impact) * rate)
        first_frame = max(0, -offset)
        last_frame = min(frames, source_frames - offset)
        result = bytearray(frames * channels * width)
        fade_in_frames = round(.008 * rate)
        fade_out_frames = round(fade_out * rate)
        for frame in range(first_frame, last_frame):
            envelope = min(1.0, (frame - first_frame) / fade_in_frames,
                           (last_frame - 1 - frame) / fade_out_frames)
            gain = .5 - .5 * math.cos(math.pi * envelope)
            for channel in range(channels):
                src = ((frame + offset) * channels + channel) * width
                dst = (frame * channels + channel) * width
                sample = int.from_bytes(raw[src:src + width], 'little', signed=True)
                result[dst:dst + width] = round(sample * gain).to_bytes(width, 'little', signed=True)

        with wave.open(str(output_dir / f'{output}.wav'), 'wb') as cue:
            cue.setparams((channels, width, rate, frames, 'NONE', 'not compressed'))
            cue.writeframes(result)
        print(f'{output}: impact {impact:.3f}s, end {duration:.3f}s')


if __name__ == '__main__':
    prepare_cues()
