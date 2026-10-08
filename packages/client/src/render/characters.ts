/**
 * Les personnages dans la scène : look choisi selon le profil du dev (personnage Kenney ou
 * construit en Three.js, voir `officeCharacters.ts`), animé par les clips des GLB Kenney, ou
 * personnage de secours animé de façon procédurale (bob, rotation, petits sauts).
 */
import type { CharacterPackId } from '@oss/shared';
import * as THREE from 'three';
import type { AgentPose, AgentSnapshot } from '../ai/agents';
import type { DevRole } from '../view/types';
import type { CharacterClip } from './assetManifest';
import type { AssetLibrary } from './assets';
import { fallbackCharacter, PALETTE, ROLE_COLORS } from './primitives';

/** Clip du GLB joué pour chaque posture. */
export const POSE_CLIPS: Readonly<Record<AgentPose, CharacterClip>> = {
  idle: 'idle',
  walk: 'walk',
  work: 'sit',
  drink: 'holding-right',
  meeting: 'sit',
  talk: 'emote-yes',
  argue: 'emote-no',
  sleep: 'sit',
  yell: 'emote-no',
  play: 'interact-right',
  eat: 'holding-both',
};

const CROSSFADE_SECONDS = 0.2;

export class CharacterView {
  readonly root = new THREE.Group();
  /** Boîte invisible pour la sélection au clic (plus fiable que le maillage animé). */
  readonly hitBox: THREE.Mesh;
  private body: THREE.Object3D;
  private mixer: THREE.AnimationMixer | null = null;
  private actions = new Map<string, THREE.AnimationAction>();
  private current: THREE.AnimationAction | null = null;
  private pose: AgentPose = 'idle';
  private time = 0;
  private disposed = false;

  constructor(
    readonly id: string,
    role: DevRole,
    look: number,
    assets: AssetLibrary,
    packs: readonly CharacterPackId[] = [],
  ) {
    this.body = fallbackCharacter(ROLE_COLORS[look % ROLE_COLORS.length] ?? PALETTE.blue);
    this.root.add(this.body);
    this.hitBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 1.3, 0.6),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    this.hitBox.position.y = 0.65;
    this.hitBox.userData.devId = id;
    this.root.add(this.hitBox);
    this.root.name = `dev:${id}`;

    void assets.character(role, look, packs).then((asset) => {
      if (!asset || this.disposed) return;
      this.root.remove(this.body);
      this.body = asset.scene;
      this.root.add(this.body);
      if (asset.animations.length === 0) return;
      this.mixer = new THREE.AnimationMixer(asset.scene);
      for (const clip of asset.animations) this.actions.set(clip.name, this.mixer.clipAction(clip));
      this.playPose(this.pose, true);
    });
  }

  /** Applique un instantané interpolé. */
  update(agent: AgentSnapshot, deltaSeconds: number, reducedMotion: boolean): void {
    this.root.visible = agent.visible;
    this.root.position.set(agent.x, 0, agent.z);
    this.root.rotation.y = agent.facing;
    if (agent.pose !== this.pose) this.playPose(agent.pose, false);
    this.time += deltaSeconds;
    this.mixer?.update(reducedMotion ? 0 : deltaSeconds);
    this.procedural(reducedMotion);
  }

  /** Objet à entourer quand le personnage est sélectionné. */
  get outlineTarget(): THREE.Object3D {
    return this.body;
  }

  dispose(): void {
    this.disposed = true;
    this.mixer?.stopAllAction();
    this.hitBox.geometry.dispose();
  }

  private playPose(pose: AgentPose, immediate: boolean): void {
    this.pose = pose;
    const next = this.actions.get(POSE_CLIPS[pose]);
    if (!next || next === this.current) return;
    next.reset().play();
    if (this.current && !immediate) this.current.crossFadeTo(next, CROSSFADE_SECONDS, false);
    else this.current?.stop();
    this.current = next;
  }

  /** Petits mouvements ajoutés par-dessus les clips (ou à la place, sans GLB). */
  private procedural(reducedMotion: boolean): void {
    const t = reducedMotion ? 0 : this.time;
    const hasClips = this.mixer !== null;
    this.body.position.y = 0;
    this.body.rotation.set(0, 0, 0);
    switch (this.pose) {
      case 'walk':
        if (!hasClips) this.body.position.y = Math.abs(Math.sin(t * 10)) * 0.08;
        break;
      case 'talk':
      case 'play':
        if (!hasClips) this.body.position.y = Math.max(0, Math.sin(t * 8)) * 0.06;
        break;
      case 'yell':
        this.body.rotation.y = Math.sin(t * 30) * 0.12;
        break;
      case 'sleep':
        // Endormi sur le clavier : penché vers l'avant, respiration lente.
        this.body.rotation.x = 0.35 + Math.sin(t * 1.5) * 0.03;
        break;
      case 'eat':
        // On mâche : petit hochement de tête.
        this.body.rotation.x = Math.max(0, Math.sin(t * 5)) * 0.06;
        break;
      case 'work':
        if (!hasClips) this.body.position.y = Math.sin(t * 6) * 0.01;
        break;
      default:
        break;
    }
  }
}
