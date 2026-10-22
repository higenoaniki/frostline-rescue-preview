import { AnimationMixer, AnimationClip, VectorKeyframeTrack, QuaternionKeyframeTrack, Quaternion, Euler, LoopOnce } from './vendor/three.module.js';
import {portraitBlink}from'./portrait-motion.js';

const lowerBodyJoints = new Set(['leg-left', 'leg-right', 'shin-left', 'shin-right']);
const isLowerBodyTrack = track => lowerBodyJoints.has(track.name.split('.')[0]);

export function createActorClips(data) {
  return new Map(Object.entries(data.clips).map(([name, spec]) => {
    const tracks = [];
    for (const [joint, frames] of Object.entries(spec.positions ?? {})) tracks.push(new VectorKeyframeTrack(`${joint}.position`, spec.times, frames.flat()));
    for (const [joint, frames] of Object.entries(spec.rotations ?? {})) {
      const values = frames.flatMap(frame => new Quaternion().setFromEuler(new Euler(...frame)).toArray());
      tracks.push(new QuaternionKeyframeTrack(`${joint}.quaternion`, spec.times, values));
    }
    return [name, new AnimationClip(name, spec.duration, tracks)];
  }));
}

export function beastAttackTime(motion) {
  const windup = motion.windup ?? .46, strike = .22, duration = motion.duration ?? windup + .5;
  if (motion.time <= windup) return Math.max(0, motion.time / windup) * .58;
  if (motion.time <= windup + strike) return .58 + (motion.time - windup) / strike * .2;
  return Math.min(1, .78 + (motion.time - windup - strike) / Math.max(.01, duration - windup - strike) * .22);
}

export class ActorAnimation {
  constructor(root, clips, family) {
    this.mixer = new AnimationMixer(root); this.actions = new Map(); this.family = family; this.clock = 0;
    this.portrait=[];root.traverse(node=>{if(node.isMesh&&node.morphTargetDictionary?.blink!==undefined)this.portrait.push(node);});
    const actorClips = new Map(['idle','walk','attack'].map(mode => [mode, clips.get(`${family}-${mode}`)]));
    if (family === 'human') {
      const walk = actorClips.get('walk'), attack = actorClips.get('attack');
      // Disjoint track masks keep the walking legs independent of the axe swing.
      actorClips.set('stride', new AnimationClip('human-stride', walk.duration, walk.tracks.filter(isLowerBodyTrack)));
      actorClips.set('moving-attack', new AnimationClip('human-moving-attack', attack.duration, attack.tracks.filter(track => !isLowerBodyTrack(track))));
    }
    for (const [mode, clip] of actorClips) {
      const action = this.mixer.clipAction(clip);
      action.setLoop(LoopOnce, 1); action.clampWhenFinished = true; action.play(); action.paused = true; action.setEffectiveWeight(0);
      this.actions.set(mode, action);
    }
  }
  sample(mode, time, moving = false) {
    const layered = mode === 'attack' && moving && this.family === 'human';
    for (const [name, action] of this.actions) {
      const active = layered ? name === 'stride' || name === 'moving-attack' : name === mode;
      action.enabled = true; action.paused = true; action.setEffectiveWeight(active ? 1 : 0);
      if (active) {
        const duration = action.getClip().duration, sampleTime = name === 'stride' ? this.clock % duration : time;
        action.time = Math.max(0, Math.min(duration - .000001, sampleTime));
      }
    }
    this.mixer.update(0); this.mode = mode; this.movingAttack = layered;
  }
  locomotion(amount, dt) {
    this.clock += dt;
    for(const mesh of this.portrait)mesh.morphTargetInfluences[mesh.morphTargetDictionary.blink]=portraitBlink(this.clock);
    const mode = amount > .1 ? 'walk' : 'idle', action = this.actions.get(mode);
    this.sample(mode, this.clock % action.getClip().duration);
  }
}
