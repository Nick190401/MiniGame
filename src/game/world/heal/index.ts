import Phaser from 'phaser';
import { FX } from '../../art/fx';
import { HFX, createHealFxTextures } from '../../art/healFx';
import { RENDER_SCALE, WORLD_ZOOM } from '../../render/RenderScale';
import { kianOpening } from './kian';
import {
  CUBIC_O, EXPO_O, FALL_MS, QUAD_I, QUAD_O, SINE_I, SINE_IO, SINE_O, T, Track, WARM, clamp01, createHealKit, lerp, lerpColor,
  scaleColor,
  type NpcHealHandle, type NpcHealOptions, type Opening,
} from './kit';
import { krysOpening } from './krys';
import { quincyOpening } from './quincy';
import { createRim } from './rim';
import { createSpectacle } from './spectacle';
import { planStaging } from './staging';

/**
 * The NPC heal. The heal sound starts with the sequence and every visual beat
 * sits on one of its onsets: the gather over the build-up (0-1350 ms), the
 * release on the sound's peak (1435 ms, where the HP are restored), the
 * step-down on the drop (1700 ms) and an afterglow through the sound's tail.
 * This file runs the sequence and owns everything bound to the hero, the
 * healer and the camera, all of it put back exactly at T.handBack; the shared
 * light is spectacle.ts, the hero's coloured rim is rim.ts and each healer's
 * signature is its own file. The light runs on to T.end while the dialog is
 * already open. Everything is driven by one counter tween, paused with the
 * scene; the only other tweens are the healer's walk to its place beside the
 * hero (staging.ts) and, for a long walk, the wait for it.
 */

export type { NpcHealHandle, NpcHealOptions } from './kit';

/** Moves the visuals against the sound if a device's output latency needs it. */
const HEAL_AV_OFFSET_MS = 0;
const SHAKE_MS = 300;
/** The healer stands in place by this time of the sequence, ahead of the first onset (215), while the sound is still near silent. */
const STAGED_BY = 180;
/** The hero is back on the ground. */
const LANDED = 2230;
const TURN_BACK = 2480;

export function playNpcHeal(scene: Phaser.Scene, opts: NpcHealOptions): NpcHealHandle {
  createHealFxTextures(scene);
  // The healer walks to a place beside the hero; everything is laid out for where it will stand.
  const staging = planStaging(scene, opts.npc, opts.player);
  const kit = createHealKit(scene, opts, staging);
  const {
    npc, player, cam, calm, pX, pY, nX, nY, s0x, s0y, hD, C, heroK, liftMax, labelY, pal, Lc, Le, SELF, CHEST, TICK, LABEL,
    own, image, shot, glint, at, heroY,
  } = kit;
  const zoom0 = cam.zoom;
  const scrollX0 = cam.scrollX;
  const scrollY0 = cam.scrollY;
  const shadow = opts.playerShadow;
  const shadowState = shadow ? { x: shadow.x, y: shadow.y, w: shadow.displayWidth, h: shadow.displayHeight, a: shadow.alpha } : undefined;
  let lastClock = 0;
  let hpApplied = false;
  let handedBack = false;
  let done = false;
  let tornDown = false;

  // ── Tracks of hero and camera (multipliers of the captured state) ───────
  // A slow push in over the gather, then the view snaps wide as the light lands; never wider than at t = 0.
  const zoomTrack = new Track(1, calm ? [] : [
    [0, 1195, 1.05, SINE_IO], [1195, 240, 1.09, QUAD_I], [T.peak, 130, 1, EXPO_O], [1565, 700, 1.025, SINE_IO], [2265, T.handBack - 2265, 1, SINE_IO],
  ]);
  // One slow motion: the light lifts him as it lands and sets him down after the drop, a little stretched on the way.
  // Every key starts and ends at rest, so nothing pops at this size.
  const scaleXTrack = new Track(1, calm ? [] : [[1405, 295, 0.975, SINE_IO], [T.drop, LANDED - T.drop, 1, SINE_IO]]);
  const scaleYTrack = new Track(1, calm ? [] : [[1405, 295, 1.03, SINE_IO], [T.drop, LANDED - T.drop, 1, SINE_IO]]);
  const liftTrack = new Track(0, calm ? [] : [[1405, 295, -liftMax, SINE_IO], [T.drop, LANDED - T.drop, 0, SINE_IO]]);
  // Weary: the hero drained of colour until the peak gives it back.
  const wearyTrack = new Track(0, calm ? [[0, 600, 1, SINE_IO], [1435, 400, 0, SINE_IO]] : [[0, 400, 1, SINE_IO], [1435, 265, 0, SINE_IO]]);
  const WEARY_END = calm ? 1900 : 1760;
  // Self-light: gain g, climb h (feet to cap) and evening-out e.
  const gainTrack = new Track(0, calm ? [[1435, 200, 0.2, SINE_IO], [1700, 500, 0, SINE_I]] : [[1435, 60, 0.18, QUAD_O], [T.fall, FALL_MS, 0.12, QUAD_O], [1760, 440, 0, SINE_I]]);
  const climbTrack = new Track(calm ? 1 : 0, calm ? [] : [[1435, 265, 1, SINE_IO]]);
  const evenTrack = new Track(calm ? 1 : 0, calm ? [] : [[1700, 200, 1, SINE_IO]]);
  // Lit through for the loudest moment, then his colours come back. A touch only: more, and with the light around
  // him he stands there as a pale ghost. He and his rim stay readable.
  const blazeAlpha = new Track(0, calm ? [[1435, 215, 0.18, SINE_O], [1700, 500, 0, SINE_IO]] : [[1435, 40, 0.12, QUAD_O], [1485, 110, 0, QUAD_O]]);
  const BLAZE_END = calm ? 2210 : 1640;
  const emberSize = new Track(calm ? 8 : 10, calm ? [] : [[1350, 80, 6, SINE_I], [1435, 160, 16, QUAD_O]]);
  const emberAlpha = new Track(0, calm
    ? [[1350, 150, 0.4, SINE_IO], [1435, 200, 0, SINE_IO]]
    : [[1350, 60, 0.6, QUAD_O], [1410, 20, 0.5, SINE_I], [1435, 20, 0.8, QUAD_O], [1455, 140, 0, QUAD_O]]);
  const labelScale = new Track(calm ? 1 : 1.9, calm ? [] : [[1435, 110, 0.92, CUBIC_O], [1545, 90, 1.05, SINE_O], [1635, 110, 1, SINE_IO], [2250, 250, 1.04, SINE_I]]);
  const labelAlpha = new Track(0, [[1435, calm ? 200 : 50, 1, SINE_IO], [2250, 250, 0, QUAD_I]]);
  const labelLift = new Track(0, calm ? [[2250, 250, -2, SINE_I]] : [[1435, 325, -1.5, SINE_O], [2250, 250, -6, QUAD_I]]);
  const LABEL_END = 2500;

  // ── The shared light, created before the healer's own so that draws over it ──
  const spectacle = createSpectacle(kit);
  const rim = createRim(kit);

  // ── Objects bound to the hero (created hidden, now) ─────────────────────
  const ember = image(FX.glow, C.x, C.y, 10 * heroK, 10 * heroK, Le, CHEST, 'screen').setAlpha(0);
  // The hero's own pixels, added on top: an exposure gain that keeps his shading.
  // Hidden rather than alpha 0, which would clear the render flag the tint never sets again.
  const copy = own(scene.add.image(pX, pY, player.texture.key, player.frame.name)
    .setOrigin(player.originX, player.originY).setScale(s0x, s0y).setBlendMode(Phaser.BlendModes.ADD).setDepth(SELF).setVisible(false));
  // And his silhouette filled with light. A plain tinted sprite, so it is the same on the path without the FX pipeline.
  const blaze = own(scene.add.image(pX, pY, player.texture.key, player.frame.name)
    .setOrigin(player.originX, player.originY).setScale(s0x, s0y).setTintFill(pal.core).setDepth(SELF + 1e-5).setVisible(false));
  const labelStyle = { fontFamily: 'Sora', fontStyle: 'bold', color: '#d6ffe7', stroke: '#0a2416' };
  // setResolution is relative to the logical board (installHiDpiText); this is WORLD_ZOOM at the 1.09 peak.
  const labelResolution = Math.ceil(WORLD_ZOOM * 1.1) / RENDER_SCALE;
  const plusText = scene.add.text(0, 0, `+${opts.amount}`, { ...labelStyle, fontSize: '13px', strokeThickness: 2.2 }).setResolution(labelResolution);
  const hpText = scene.add.text(0, 0, 'HP', { ...labelStyle, fontSize: '7px', strokeThickness: 1.6 }).setResolution(labelResolution);
  const labelWidth = plusText.width + 1.5 + hpText.width;
  // Both baselines on the container's origin.
  plusText.setPosition(-labelWidth / 2, -(1 + plusText.getTextMetrics().ascent));
  hpText.setPosition(plusText.x + plusText.width + 1.5, -(1 + hpText.getTextMetrics().ascent));
  // A soft dark plate: the number stands in front of the pillar's white core.
  const labelPlate = scene.add.image(0, -6.5, FX.glow).setDisplaySize(labelWidth + 28, 28).setTint(0x04140c).setAlpha(0.6);
  const label = own(scene.add.container(pX, labelY, [labelPlate, plusText, hpText]).setDepth(LABEL).setVisible(false));

  // ── Per-NPC openings ────────────────────────────────────────────────────
  const opening: Opening = npc.npcId === 'professor' ? krysOpening(kit)
    : npc.npcId === 'guard' ? quincyOpening(kit)
      : kianOpening(kit);

  // ── Cues ────────────────────────────────────────────────────────────────
  spectacle.cues();
  at(1350, () => {
    player.faceToward(pX, pY + 10);
    opts.syncHeroShadow();
    copy.setTint(0).setVisible(true);
  });
  at(T.peak, () => {
    hpApplied = true;
    opts.onRestoreHp();
    label.setVisible(true);
    blaze.setVisible(true);
    if (!calm) {
      shot(HFX.flare, pX, labelY - 6.5, {
        size: [24, 96], height: [5, 7], alpha: 0.8, duration: 320, rise: 30, grow: 140, color: 0xa6f5c6, depth: LABEL - 0.01, blend: 'add', ease: EXPO_O,
      });
    }
  });
  at(1600, () => ember.setVisible(false));
  if (!calm) at(1675, () => glint(pX + 1.5 * heroK, heroY() - 27.5 * heroK, 6, 0.85, WARM, TICK, 180, 0, 0.8));
  at(BLAZE_END, () => blaze.setVisible(false));
  at(WEARY_END, releaseWeary);
  at(1890, () => opts.onNotice());
  at(LANDED, restoreShadow);
  at(2200, () => copy.setVisible(false));
  // He turns back to the healer once he stands again and the number has gone: a turn on its own, not part of the landing.
  at(TURN_BACK, () => {
    player.faceToward(nX, nY);
    opts.syncHeroShadow();
  });
  at(LABEL_END, () => label.setVisible(false));
  at(T.handBack, handBack);
  at(T.dialog, () => {
    done = true;
    opts.onDone();
  });

  // ── Hero colour: a ColorMatrix pre-FX where available, else a tint ──────
  // With disablePreFX (iOS) sprites still have a preFX component but there is no
  // FX pipeline: adding an effect would leave the hero without any pipeline.
  const fxPipeline = 'pipelines' in scene.renderer ? scene.renderer.pipelines.FX_PIPELINE : undefined;
  let colorMatrix: Phaser.FX.ColorMatrix | undefined;
  let wearyOn = true;
  if (fxPipeline && player.preFX) {
    colorMatrix = player.preFX.addColorMatrix();
    colorMatrix.saturate(-0.6);
    colorMatrix.brightness(0.88, true);
    colorMatrix.alpha = 0;
  }

  /** Back to the plain sprite: off the FX pipeline (not just an empty list), or the tint cleared. */
  function releaseWeary() {
    if (!wearyOn) return;
    wearyOn = false;
    if (colorMatrix) {
      colorMatrix = undefined;
      player.preFX?.disable(true);
    } else {
      player.clearTint();
    }
  }

  function restoreShadow() {
    if (!shadow || !shadowState) return;
    shadow.setPosition(shadowState.x, shadowState.y).setDisplaySize(shadowState.w, shadowState.h).setAlpha(shadowState.a);
  }

  /** Everything bound to the hero, the healer or the camera goes back to exactly how it was. */
  function handBack() {
    if (handedBack) return;
    handedBack = true;
    kit.lift = 0;
    releaseWeary();
    player.setScale(s0x, s0y).setY(pY).setDepth(hD);
    player.unfreeze();
    restoreShadow();
    opts.syncHeroShadow();
    npc.setAngle(0);
    cam.setZoom(zoom0);
    cam.setScroll(scrollX0, scrollY0);
    cam.startFollow(player, true, 1, 1);
    copy.setVisible(false);
    blaze.setVisible(false);
    ember.setVisible(false);
    label.setVisible(false);
  }

  // ── Per-frame update ────────────────────────────────────────────────────
  function frame(t: number, dt: number) {
    kit.runCues(t);
    if (tornDown) return;

    if (!handedBack) {
      kit.lift = liftTrack.at(t);
      player.setScale(s0x * scaleXTrack.at(t), s0y * scaleYTrack.at(t)).setY(pY + kit.lift);
      if (wearyOn) {
        const mix = wearyTrack.at(t);
        if (colorMatrix) colorMatrix.alpha = mix;
        else player.setTint(lerpColor(0xffffff, 0xb4b9c4, mix));
      }
      if (!calm && shadow && shadowState && t < LANDED) {
        const f = clamp01(-kit.lift / liftMax);
        shadow.setDisplaySize(lerp(shadowState.w, (shadowState.w * 13) / 16, f), lerp(shadowState.h, (shadowState.h * 4.6) / 5.6, f))
          .setAlpha(lerp(shadowState.a, 0.32, f));
      }
      npc.setAngle(opening.angle(t));
      cam.setZoom(zoom0 * zoomTrack.at(t));
      // The landing shakes the view: two decaying sines on the master clock.
      const age = t - T.peak;
      const shake = !calm && age >= 0 && age < SHAKE_MS ? (1 - age / SHAKE_MS) ** 2 : 0;
      cam.setScroll(scrollX0 + 1.6 * shake * Math.sin(age * 0.105), scrollY0 + 1.2 * shake * Math.sin(age * 0.133 + 1.3));
    }

    spectacle.frame(t, dt);
    rim.frame(t);
    opening.frame(t, dt);

    if (ember.visible && t >= 1350) {
      const size = emberSize.at(t) * heroK;
      ember.setPosition(C.x, heroY() - 14 * heroK).setDisplaySize(size, size).setAlpha(emberAlpha.at(t));
    }
    if (copy.visible || blaze.visible) {
      if (copy.texture.key !== player.texture.key || copy.frame.name !== player.frame.name) {
        copy.setTexture(player.texture.key, player.frame.name);
        blaze.setTexture(player.texture.key, player.frame.name);
      }
      copy.setPosition(player.x, player.y).setScale(player.scaleX, player.scaleY).setFlipX(player.flipX);
      blaze.setPosition(player.x, player.y).setScale(player.scaleX, player.scaleY).setFlipX(player.flipX).setAlpha(blazeAlpha.at(t));
      const g = gainTrack.at(t);
      const h = climbTrack.at(t);
      const e = evenTrack.at(t);
      const col = lerpColor(Lc, WARM, e);
      const top = scaleColor(col, g * lerp(0.8 * h, 0.7, e));
      const bottom = scaleColor(col, g * lerp(1 - 0.6 * h, 0.7, e));
      copy.setTint(top, top, bottom, bottom);
    }
    if (label.visible) {
      label.setScale(labelScale.at(t)).setY(labelY + labelLift.at(t)).setAlpha(labelAlpha.at(t));
    }

    kit.updateShots(t);
  }

  // ── Teardown ────────────────────────────────────────────────────────────
  function teardown() {
    if (tornDown) return;
    // The sound already promised the heal.
    if (!hpApplied) {
      hpApplied = true;
      opts.onRestoreHp();
    }
    // On scene shutdown the display list has already destroyed hero and NPC.
    if (player.scene) handBack();
    else {
      handedBack = true;
      wearyOn = false;
      colorMatrix = undefined;
    }
    tornDown = true;
    lead?.stop();
    master?.stop();
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, teardown);
    scene.events.off(Phaser.Scenes.Events.PAUSE, endAfterglow);
    scene.events.off(Phaser.Scenes.Events.SLEEP, endAfterglow);
    kit.destroyAll();
  }
  /** Once the dialog has the hero, only light is left: it does not wait frozen for a paused or sleeping scene. */
  function endAfterglow() {
    if (done) teardown();
  }

  // ── Start ───────────────────────────────────────────────────────────────
  player.freeze();
  cam.stopFollow();
  let master: Phaser.Tweens.Tween | undefined;
  let lead: Phaser.Tweens.Tween | undefined;
  /** The sound and the sequence start together. */
  const begin = () => {
    lead = undefined;
    opts.onSound();
    master = scene.tweens.addCounter({
      from: 0,
      to: T.end,
      duration: T.end,
      delay: HEAL_AV_OFFSET_MS,
      onUpdate: tween => {
        const t = tween.getValue() ?? 0;
        kit.clock = t;
        const dt = Math.max(0, t - lastClock);
        lastClock = t;
        frame(t, dt);
      },
      onComplete: () => teardown(),
    });
  };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, teardown);
  scene.events.on(Phaser.Scenes.Events.PAUSE, endAfterglow);
  scene.events.on(Phaser.Scenes.Events.SLEEP, endAfterglow);
  frame(0, 0);
  if (staging) {
    player.faceToward(staging.x, pY);
    opts.syncHeroShadow();
  }
  if (staging && staging.walkMs > 0) npc.walkScriptedTo(staging.x, staging.y, staging.walkMs, () => npc.faceToward(pX, pY));
  else if (staging) npc.faceToward(pX, pY);
  // A short step is over within the sound's near-silent start; a longer walk gets the time it needs before the sound.
  const wait = staging ? staging.walkMs - STAGED_BY : 0;
  if (wait > 0) lead = scene.tweens.addCounter({ from: 0, to: 1, duration: wait, onComplete: begin });
  else begin();

  return {
    get busy() { return !done && !tornDown; },
    destroy: teardown,
  };
}
