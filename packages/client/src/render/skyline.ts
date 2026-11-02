/**
 * La vue sur New York : le bureau est au dernier étage d'une tour, au milieu d'une ville
 * inspirée de Manhattan (grille d'avenues et de rues, tours à gradins, immeubles de brique à
 * réservoirs d'eau, brownstones, parc, fleuve, taxis). Aucun bâtiment réel n'est reproduit :
 * la ville est générique, faite de boîtes Three.js et de shaders procéduraux.
 *
 * - `planSkyline` est une fonction pure (layout → liste de volumes), testable sans WebGL.
 *   Son hasard vient d'un générateur à graine fixe (une graine par pâté de maisons) : la ville
 *   est la même à chaque partie et ne touche jamais au RNG de la simulation.
 * - `SkylineView` fusionne les volumes en quelques maillages (une quinzaine d'appels de dessin
 *   pour toute la ville). Les façades sont dessinées par `skylineShaders.ts` : fenêtres selon
 *   le style de l'immeuble, reflets du ciel, et lumières qui s'allument et s'éteignent une à
 *   une selon l'heure du jeu (`cityLights.ts`).
 *
 * Contrainte de lisibilité : la caméra isométrique regarde le bureau de haut, depuis l'un des
 * quatre côtés. Un immeuble ne doit jamais cacher la salle : près de la tour, les toits restent
 * sous le plancher ; seules les tours éloignées dépassent (voir `maxTop`).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { OfficeLayout } from '../view/layout';
import { litShare, type BuildingUse } from './cityLights';
import type { LightingState } from './lighting';
import { pseudoRandom, radialGlowTexture } from './pixels';
import type { QualityLevel } from './quality';
import {
  cityUniforms,
  FACADE_GRID,
  FACADE_STYLES,
  facadeMaterial,
  solidMaterial,
  streetMaterial,
  waterMaterial,
  type FacadeStyle,
} from './skylineShaders';

/** Niveau de la rue, sous le plancher du bureau (y = 0) : on est en haut d'une tour. */
export const STREET_LEVEL = -45;
/** Rayon de la ville autour du bureau, en cases : couvre l'écran au zoom minimal. */
export const CITY_RADIUS = 120;
/** Les avenues (axe z) et les rues (axe x) de la grille de Manhattan. */
const AVENUE_SPACING = 16;
const AVENUE_WIDTH = 3.6;
const STREET_SPACING = 9;
const STREET_WIDTH = 2.2;
/** Haut du trottoir : le pied des immeubles. */
const BASE = STREET_LEVEL + 0.25;
/** Recul des immeubles au bord du pâté : le trottoir reste visible. */
const SIDEWALK = 0.7;
/** Muret qui borde chaque toit. */
const PARAPET = 0.35;
/** Place gardée au-dessus des toits proches pour les climatiseurs et les édicules. */
const ROOFTOP_ROOM = 1.5;
/** Graine de la ville : fixe, indépendante de la partie. */
const CITY_SEED = 0x6e7963;

/** Un volume de la ville, aligné sur les axes ; `top` et `bottom` en hauteur monde. */
export interface CityBox {
  readonly x: number;
  readonly z: number;
  readonly width: number;
  readonly depth: number;
  readonly bottom: number;
  readonly top: number;
  readonly color: number;
  /** Façade à fenêtres (immeubles seulement). */
  readonly style?: FacadeStyle;
  /** Rythme d'allumage des fenêtres. */
  readonly use?: BuildingUse;
  /** Graine de l'immeuble (0 à 1) : ordre d'allumage, teintes des lampes. */
  readonly seed?: number;
  /** Couleur du toit ; sans elle, le volume n'a pas de toit à muret (notre tour). */
  readonly roof?: number;
}

/** Une voie de circulation à sens unique, d'un bout à l'autre de la ville. */
export interface Lane {
  readonly x: number;
  readonly z: number;
  /** Axe de la voie : le long de x (rue) ou de z (avenue). */
  readonly axis: 'x' | 'z';
  readonly length: number;
  readonly direction: 1 | -1;
  /** Vitesse des voitures, en cases par seconde. */
  readonly speed: number;
}

export interface Point3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface Tree extends Point3 {
  readonly scale: number;
  readonly color: number;
}

export interface SkylinePlan {
  /** Volumes à fenêtres : immeubles, gradins des tours et notre propre tour (en premier). */
  readonly towers: readonly CityBox[];
  /** Volumes unis : trottoirs, corniche, parc, édicules, climatiseurs, flèches. */
  readonly solids: readonly CityBox[];
  /** Sommets des tours éclairés la nuit. */
  readonly crowns: readonly CityBox[];
  /** Réservoirs d'eau en bois sur les toits (centre de la base). */
  readonly tanks: readonly Point3[];
  /** Arbres du parc et des trottoirs. */
  readonly trees: readonly Tree[];
  /** Feux rouges d'obstacle au sommet des plus hautes tours. */
  readonly beacons: readonly Point3[];
  readonly streetLamps: readonly Point3[];
  readonly lanes: readonly Lane[];
  /** Le fleuve : rectangle d'eau au niveau de la rue. */
  readonly river: { readonly x0: number; readonly x1: number };
  /** Emprise de notre tour (sous le bureau). */
  readonly footprint: { x0: number; z0: number; x1: number; z1: number };
}

/** Couleurs de mur par style : verre teinté, briques, pierre calcaire, béton, grès brun. */
const WALLS: Readonly<Record<FacadeStyle, readonly number[]>> = {
  glass: [0x33475c, 0x3d5266, 0x2f4450, 0x4a4238, 0x445a6e],
  brick: [0x8e4a36, 0x9c5a40, 0x7d3f30, 0xa8694c, 0x6e4535, 0xb4815f],
  limestone: [0xd6cdb8, 0xc9bea6, 0xe0d8c6, 0xbfb39a, 0xcfc4ae],
  ribbon: [0xd9d9d6, 0xbfc3c7, 0xa9adb2, 0xc8c2b6],
  brownstone: [0x6d4636, 0x7a5040, 0x5e3b2e, 0x84584a],
};
/** Toits : bitume, gravier, membrane blanche ; parfois un toit végétalisé. */
const ROOFS = [0x4f5257, 0x5f6267, 0x7b7e82, 0x9a9c9c, 0xb7b8b5, 0x55575b];
const GREEN_ROOF = 0x667f4b;
const CROWN_LIGHTS = [0xfff1d6, 0xcfe4ff, 0xffd27a, 0xb9d7ff];
const HVAC = [0xb8bcc0, 0x9ea3a8, 0xc9cbcc];
const SOLAR = 0x26324a;
const SPIRE = 0xb9c0c8;
const SIDEWALK_COLOR = 0xa9a59c;
const PARK = 0x5f9e57;
const CORNICE = 0xd9d4c8;
const TREE_GREENS = [0x3f8a4a, 0x4b9550, 0x357a42, 0x5a9a4c, 0x447f3c];

/** Distance d'un point au rectangle de notre tour (0 dedans). */
function distanceToRect(
  x: number,
  z: number,
  rect: { x0: number; z0: number; x1: number; z1: number },
): number {
  const dx = Math.max(rect.x0 - x, 0, x - rect.x1);
  const dz = Math.max(rect.z0 - z, 0, z - rect.z1);
  return Math.hypot(dx, dz);
}

/** Toit d'une tour rivale du mode Histoire et hauteur maximale de son enseigne. */
export interface RivalSpot extends Point3 {
  /** Haut de l'enseigne : sous la ligne `maxTop`, elle ne masque jamais le bureau. */
  readonly limit: number;
}

/**
 * Mode Histoire : les toits des tours rivales (Synergix, Pivotly, Gigacorp), choisis parmi les
 * plus hautes tours sur les côtés de l'écran (derrière un mur du fond et devant l'autre), à 14
 * à 32 cases et à au moins 8 cases les unes des autres. L'enseigne reste sous la ligne `maxTop` :
 * elle ne masque jamais le bureau. Les plus proches d'abord.
 */
export function rivalTowerSpots(plan: SkylinePlan, layout: OfficeLayout, count = 3): RivalSpot[] {
  const cx = (layout.width - 1) / 2;
  const cz = (layout.depth - 1) / 2;
  const candidates = plan.towers
    .slice(1)
    .filter((box) => box.roof !== undefined)
    .map((box) => ({ box, distance: Math.hypot(box.x - cx, box.z - cz) }))
    .filter(
      ({ box, distance }) =>
        // Sur les côtés de l'écran : derrière un mur du fond, devant l'autre.
        box.x < cx - 4 !== box.z < cz - 4 && distance >= 14 && distance <= 32,
    )
    .sort((a, b) => b.box.top - a.box.top);
  const spots: { spot: RivalSpot; distance: number }[] = [];
  for (const { box, distance } of candidates) {
    if (spots.length >= count) break;
    if (spots.some(({ spot }) => Math.hypot(spot.x - box.x, spot.z - box.z) < 8)) continue;
    const limit = Math.min(maxTop(distance - Math.max(box.width, box.depth) / 2), 4);
    if (limit <= box.top + 2) continue;
    spots.push({ spot: { x: box.x, y: box.top, z: box.z, limit }, distance });
  }
  return spots.sort((a, b) => a.distance - b.distance).map(({ spot }) => spot);
}

/**
 * Hauteur maximale d'un toit à `distance` cases de la tour : la caméra plonge à 35°, donc un
 * toit sous cette ligne ne masque jamais le bureau, quel que soit le côté d'où on le regarde.
 */
export function maxTop(distance: number): number {
  return Math.min(30, 0.6 * distance - 8);
}

/**
 * Haut d'un immeuble posé au pied de la rue : un nombre entier d'étages, plus le muret du
 * toit, sans dépasser `limit`. Les fenêtres tombent ainsi juste sous la corniche.
 */
export function snapTop(style: FacadeStyle, wanted: number, limit: number): number {
  const floor = FACADE_GRID[style].floor;
  const floors = Math.max(1, Math.floor((Math.min(wanted, limit) - BASE - PARAPET) / floor));
  return BASE + floors * floor + PARAPET;
}

function lowStyle(roll: number, height: number): FacadeStyle {
  if (roll < 0.4) return 'brick';
  if (roll < 0.56) return height < 14 ? 'brownstone' : 'brick';
  if (roll < 0.82) return 'limestone';
  return 'ribbon';
}

function tallStyle(roll: number): FacadeStyle {
  if (roll < 0.55) return 'glass';
  if (roll < 0.8) return 'limestone';
  return 'ribbon';
}

function buildingUse(style: FacadeStyle, roll: number): BuildingUse {
  if (style === 'glass' || style === 'ribbon') return 'office';
  if (style === 'limestone') return roll < 0.5 ? 'office' : 'home';
  return 'home';
}

export function planSkyline(layout: OfficeLayout): SkylinePlan {
  const cx = (layout.width - 1) / 2;
  const cz = (layout.depth - 1) / 2;
  // Les murs du bureau vont de -0,7 à largeur - 0,3 : la tour les déborde un peu.
  const footprint = {
    x0: -0.8,
    z0: -0.8,
    x1: layout.width - 0.2,
    z1: layout.depth - 0.2,
  };
  const towers: CityBox[] = [];
  const solids: CityBox[] = [];
  const crowns: CityBox[] = [];
  const tanks: Point3[] = [];
  const trees: Tree[] = [];
  const beacons: Point3[] = [];
  const streetLamps: Point3[] = [];
  const lanes: Lane[] = [];

  // Notre tour : un mur-rideau de verre jusqu'à la rue, et une corniche sous le plancher.
  const ownWidth = footprint.x1 - footprint.x0;
  const ownDepth = footprint.z1 - footprint.z0;
  const ownX = (footprint.x0 + footprint.x1) / 2;
  const ownZ = (footprint.z0 + footprint.z1) / 2;
  towers.push({
    x: ownX,
    z: ownZ,
    width: ownWidth,
    depth: ownDepth,
    bottom: STREET_LEVEL,
    top: -0.5,
    color: 0x3d5266,
    style: 'glass',
    use: 'office',
    seed: 0.5,
  });
  solids.push({
    x: ownX,
    z: ownZ,
    width: ownWidth + 0.5,
    depth: ownDepth + 0.5,
    bottom: -0.5,
    top: -0.1,
    color: CORNICE,
  });

  // Le fleuve longe un côté de la ville (à gauche de la vue de départ).
  const river = { x0: cx - CITY_RADIUS - 40, x1: cx - CITY_RADIUS * 0.62 };
  // Un parc de 2 x 4 pâtés de maisons, derrière la tour (visible à travers les baies).
  const park = { i0: -3, i1: -2, j0: -6, j1: -3 };
  const plaza = 6; // dégagement autour de notre tour

  const half = Math.ceil(CITY_RADIUS / AVENUE_SPACING);
  const halfStreets = Math.ceil(CITY_RADIUS / STREET_SPACING);
  for (let i = -half; i <= half; i++) {
    for (let j = -halfStreets; j <= halfStreets; j++) {
      // Une graine par pâté : la ville ne dépend ni de la phase ni des pâtés ignorés.
      const random = pseudoRandom(CITY_SEED + (i + 64) * 7919 + (j + 64) * 104729);
      const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)] as T;
      const blockX0 = cx + i * AVENUE_SPACING + AVENUE_WIDTH / 2;
      const blockX1 = cx + (i + 1) * AVENUE_SPACING - AVENUE_WIDTH / 2;
      const blockZ0 = cz + j * STREET_SPACING + STREET_WIDTH / 2;
      const blockZ1 = cz + (j + 1) * STREET_SPACING - STREET_WIDTH / 2;
      const blockCx = (blockX0 + blockX1) / 2;
      const blockCz = (blockZ0 + blockZ1) / 2;
      const fromCenter = Math.hypot(blockCx - cx, blockCz - cz);
      if (fromCenter > CITY_RADIUS) continue;
      if (blockX1 > river.x0 && blockX0 < river.x1) continue;
      const nearOwn =
        blockX1 > footprint.x0 - plaza &&
        blockX0 < footprint.x1 + plaza &&
        blockZ1 > footprint.z0 - plaza &&
        blockZ0 < footprint.z1 + plaza;
      if (nearOwn) continue;
      const sidewalk: CityBox = {
        x: blockCx,
        z: blockCz,
        width: blockX1 - blockX0,
        depth: blockZ1 - blockZ0,
        bottom: STREET_LEVEL,
        top: BASE,
        color: SIDEWALK_COLOR,
      };
      if (i >= park.i0 && i <= park.i1 && j >= park.j0 && j <= park.j1) {
        solids.push({ ...sidewalk, color: PARK, top: STREET_LEVEL + 0.35 });
        for (let t = 0; t < 12; t++)
          trees.push({
            x: blockX0 + 0.8 + random() * (blockX1 - blockX0 - 1.6),
            y: STREET_LEVEL + 0.35,
            z: blockZ0 + 0.8 + random() * (blockZ1 - blockZ0 - 1.6),
            scale: 0.9 + random() * 0.5,
            color: pick(TREE_GREENS),
          });
        continue;
      }
      solids.push(sidewalk);

      // Arbres d'alignement le long des rues proches.
      if (fromCenter < 90)
        for (let x = blockX0 + 1.2; x < blockX1 - 1; x += 2.6)
          for (const z of [blockZ0 + 0.35, blockZ1 - 0.35])
            if (random() < 0.45)
              trees.push({
                x,
                y: BASE,
                z,
                scale: 0.5 + random() * 0.25,
                color: pick(TREE_GREENS),
              });

      const x0 = blockX0 + SIDEWALK;
      const x1 = blockX1 - SIDEWALK;
      const z0 = blockZ0 + SIDEWALK;
      const z1 = blockZ1 - SIDEWALK;
      const distance = distanceToRect(blockCx, blockCz, footprint);
      if (distance > 55 && random() < 0.17) {
        skyscraper({ x0, x1, z0, z1 }, distance, random);
        continue;
      }
      // Pâté ordinaire : 2 à 5 immeubles mitoyens de largeurs variées.
      const lots = 2 + Math.floor(random() * 4);
      const weights = Array.from({ length: lots }, () => 0.6 + random() * 0.8);
      const total = weights.reduce((sum, weight) => sum + weight, 0);
      let start = x0;
      for (const weight of weights) {
        const end = start + ((x1 - x0) * weight) / total;
        // Parfois deux immeubles dos à dos, l'un sur chaque rue.
        if (end - start > 2.6 && random() < 0.3) {
          const mid = (z0 + z1) / 2;
          building({ x0: start, x1: end, z0, z1: mid - 0.03 }, random);
          building({ x0: start, x1: end, z0: mid + 0.03, z1 }, random);
        } else building({ x0: start, x1: end, z0, z1 }, random);
        start = end;
      }
    }
  }

  /** Un immeuble ordinaire sur sa parcelle, avec ses équipements de toit. */
  function building(lot: { x0: number; x1: number; z0: number; z1: number }, random: () => number) {
    const x0 = lot.x0 + 0.03;
    const x1 = lot.x1 - 0.03;
    const midX = (x0 + x1) / 2;
    const midZ = (lot.z0 + lot.z1) / 2;
    const distance = distanceToRect(midX, midZ, footprint);
    const extent = Math.max(x1 - x0, lot.z1 - lot.z0);
    const limit = Math.max(BASE + 4, Math.min(maxTop(distance - extent), -2));
    const wanted = BASE + 4 + Math.pow(random(), 1.8) * 30;
    const style = lowStyle(random(), wanted - BASE);
    const top = snapTop(style, wanted, limit - ROOFTOP_ROOM);
    const box: CityBox = {
      x: midX,
      z: midZ,
      width: x1 - x0,
      depth: lot.z1 - lot.z0,
      bottom: BASE,
      top,
      color: WALLS[style][Math.floor(random() * WALLS[style].length)] ?? 0x9c5a40,
      style,
      use: buildingUse(style, random()),
      seed: random(),
      roof: random() < 0.06 ? GREEN_ROOF : (ROOFS[Math.floor(random() * ROOFS.length)] ?? 0x5f6267),
    };
    towers.push(box);
    rooftop(box, limit, random, style !== 'glass' && style !== 'ribbon');
  }

  /** Une tour : socle de pierre, puis un fût de verre ou des gradins Art déco. */
  function skyscraper(
    lot: { x0: number; x1: number; z0: number; z1: number },
    distance: number,
    random: () => number,
  ) {
    const style = tallStyle(random());
    const podiumStyle: FacadeStyle =
      style === 'glass' ? 'ribbon' : random() < 0.5 ? 'limestone' : 'brick';
    const crowned = random() < 0.45;
    const spire = !crowned && random() < 0.55;
    const limit = maxTop(distance - 6.5) - (crowned ? 3 : 0);
    const top = snapTop(style, BASE + 35 + random() * 45, limit);
    const podiumTop = snapTop(podiumStyle, BASE + 7 + random() * 8, top - 10);
    const width = lot.x1 - lot.x0;
    const depth = lot.z1 - lot.z0;
    const cx = (lot.x0 + lot.x1) / 2;
    const czz = (lot.z0 + lot.z1) / 2;
    const color = WALLS[style][Math.floor(random() * WALLS[style].length)] ?? 0x3d5266;
    const roof = ROOFS[Math.floor(random() * ROOFS.length)] ?? 0x5f6267;
    const seed = random();
    const use = buildingUse(style, random());
    const tier = (insetX: number, insetZ: number, bottom: number, boxTop: number): CityBox => ({
      x: cx,
      z: czz,
      width: Math.max(1.6, width - insetX * 2),
      depth: Math.max(1.6, depth - insetZ * 2),
      bottom,
      top: boxTop,
      color,
      style,
      use,
      seed,
      roof,
    });
    towers.push({
      x: cx,
      z: czz,
      width,
      depth,
      bottom: BASE,
      top: podiumTop,
      color: WALLS[podiumStyle][Math.floor(random() * WALLS[podiumStyle].length)] ?? 0xc9bea6,
      style: podiumStyle,
      use: 'office',
      seed: random(),
      roof,
    });
    const shaftBottom = podiumTop - PARAPET;
    const steps =
      style === 'limestone'
        ? [
            [1.2, 0.5, 0.62],
            [2.2, 0.9, 0.85],
            [3.0, 1.3, 1],
          ]
        : random() < 0.4
          ? [
              [1.0, 0.5, 0.7],
              [2.0, 0.9, 1],
            ]
          : [[1.2, 0.6, 1]];
    let bottom = shaftBottom;
    let last = tier(0, 0, 0, 0);
    for (const [insetX = 1, insetZ = 0.5, share = 1] of steps) {
      const boxTop =
        share >= 1 ? top : snapTop(style, shaftBottom + (top - shaftBottom) * share, top - 3);
      last = tier(Math.min(insetX, width * 0.3), Math.min(insetZ, depth * 0.2), bottom, boxTop);
      towers.push(last);
      bottom = boxTop - PARAPET;
    }
    const floor = FACADE_GRID[style].floor;
    if (crowned) {
      // Les derniers étages illuminés, comme les couronnes des tours de Manhattan la nuit.
      crowns.push({
        ...last,
        width: last.width * 0.7,
        depth: last.depth * 0.7,
        bottom: top - PARAPET,
        top: top + Math.min(3, floor * 1.2),
        color: CROWN_LIGHTS[Math.floor(random() * CROWN_LIGHTS.length)] ?? 0xfff1d6,
      });
      beacons.push({ x: cx, y: top + 3.3, z: czz });
    } else if (spire) {
      solids.push({
        x: cx,
        z: czz,
        width: 0.3,
        depth: 0.3,
        bottom: top,
        top: top + 6,
        color: SPIRE,
      });
      beacons.push({ x: cx, y: top + 6.2, z: czz });
    } else {
      rooftop(last, top + ROOFTOP_ROOM, random, false);
      beacons.push(
        { x: last.x - last.width / 2 + 0.3, y: top + 0.3, z: last.z - last.depth / 2 + 0.3 },
        { x: last.x + last.width / 2 - 0.3, y: top + 0.3, z: last.z + last.depth / 2 - 0.3 },
      );
    }
  }

  /** Climatiseurs, édicule d'ascenseur, panneaux solaires et réservoir d'eau sur un toit. */
  function rooftop(box: CityBox, limit: number, random: () => number, tanksAllowed: boolean) {
    const room = limit - box.top;
    const inner = { w: box.width - 1, d: box.depth - 1 };
    if (room < 0.5 || inner.w < 1.2 || inner.d < 1.2) return;
    const roofY = box.top - PARAPET;
    const spot = (w: number, d: number) => ({
      x: box.x - inner.w / 2 + w / 2 + random() * Math.max(0, inner.w - w),
      z: box.z - inner.d / 2 + d / 2 + random() * Math.max(0, inner.d - d),
    });
    const units = 1 + Math.floor(random() * 3);
    for (let unit = 0; unit < units; unit++) {
      const w = 0.6 + random() * 0.8;
      const d = 0.5 + random() * 0.5;
      const h = Math.min(room, 0.45 + random() * 0.35);
      solids.push({
        ...spot(w, d),
        width: w,
        depth: d,
        bottom: roofY,
        top: roofY + h,
        color: HVAC[Math.floor(random() * HVAC.length)] ?? 0xb8bcc0,
      });
    }
    if (random() < 0.45)
      solids.push({
        ...spot(1.1, 1.1),
        width: 1.1,
        depth: 1.1,
        bottom: roofY,
        top: roofY + Math.min(room, 1.3),
        color: box.color,
      });
    if (box.use === 'office' && random() < 0.15)
      solids.push({
        ...spot(2, 1.2),
        width: Math.min(2, inner.w),
        depth: Math.min(1.2, inner.d),
        bottom: roofY,
        top: roofY + 0.12,
        color: SOLAR,
      });
    // Les vieux immeubles new-yorkais portent un réservoir d'eau en bois sur le toit.
    if (tanksAllowed && random() < 0.4 && box.top + 2.2 - PARAPET <= limit)
      tanks.push({ ...spot(1.2, 1.2), y: roofY });
  }

  // Lampadaires sur les avenues ; voies à sens unique, alternées comme à Manhattan.
  for (let i = -half; i <= half; i++) {
    const x = cx + i * AVENUE_SPACING;
    if (x > river.x0 && x < river.x1) continue;
    const direction = i % 2 === 0 ? 1 : -1;
    const speed = 8 + ((i + half) % 3);
    for (const offset of [-1.2, -0.4, 0.4, 1.2])
      lanes.push({ x: x + offset, z: cz, axis: 'z', length: CITY_RADIUS * 2, direction, speed });
    for (let z = cz - CITY_RADIUS; z <= cz + CITY_RADIUS; z += 6)
      if (Math.hypot(x - cx, z - cz) < CITY_RADIUS)
        streetLamps.push({ x: x - AVENUE_WIDTH / 2 + 0.2, y: STREET_LEVEL + 1.2, z });
  }
  // Les rues s'arrêtent au fleuve.
  const streetStart = river.x1;
  const streetEnd = cx + CITY_RADIUS;
  for (let j = -halfStreets; j <= halfStreets; j++) {
    const z = cz + j * STREET_SPACING;
    const direction = j % 2 === 0 ? 1 : -1;
    for (const offset of [-0.5, 0.5])
      lanes.push({
        x: (streetStart + streetEnd) / 2,
        z: z + offset,
        axis: 'x',
        length: streetEnd - streetStart,
        direction,
        speed: 5 + ((j + halfStreets) % 3),
      });
  }

  return {
    towers,
    solids,
    crowns,
    tanks,
    trees,
    beacons,
    streetLamps,
    lanes,
    river,
    footprint,
  };
}

// --- Géométrie -------------------------------------------------------------------------------

type Vec3 = readonly [number, number, number];

/**
 * Accumule des faces dans un seul tampon (une géométrie pour toute la ville). Les façades ont
 * en plus des UV en travées et étages et l'attribut `facade` (style, graine, usage).
 */
class BoxBatch {
  private readonly positions: number[] = [];
  private readonly normals: number[] = [];
  private readonly uvs: number[] = [];
  private readonly colors: number[] = [];
  private readonly facades: number[] = [];
  private readonly color = new THREE.Color();
  private facade: readonly number[] = [0, 0, 0, 0];

  /** Les quatre côtés d'un immeuble, fenêtres comptées depuis `base` (pied de l'immeuble). */
  facadeSides(box: CityBox, base: number): void {
    const style = box.style ?? 'glass';
    const grid = FACADE_GRID[style];
    this.color.setHex(box.color);
    this.facade = [FACADE_STYLES.indexOf(style), box.seed ?? 0, box.use === 'home' ? 1 : 0, 0];
    this.sides(box, (length) => Math.max(1, Math.round(length / grid.bay)), base, grid.floor);
  }

  /** Une boîte unie : côtés et dessus. */
  solid(box: CityBox): void {
    this.color.setHex(box.color);
    this.sides(box, () => 1, box.bottom, 1);
    const [x0, x1, z0, z1] = this.extent(box);
    this.flat(x0, x1, z0, z1, box.top);
  }

  /** Toit à muret : dalle en contrebas, faces intérieures et dessus du muret. */
  roof(box: CityBox): void {
    const [x0, x1, z0, z1] = this.extent(box);
    const rim = Math.min(0.2, box.width / 6, box.depth / 6);
    const y0 = box.top - PARAPET;
    const y1 = box.top;
    this.color.setHex(box.roof ?? 0x5f6267);
    this.flat(x0 + rim, x1 - rim, z0 + rim, z1 - rim, y0);
    this.color.setHex(box.color).multiplyScalar(0.92);
    this.flat(x0, x1, z0, z0 + rim, y1);
    this.flat(x0, x1, z1 - rim, z1, y1);
    this.flat(x0, x0 + rim, z0 + rim, z1 - rim, y1);
    this.flat(x1 - rim, x1, z0 + rim, z1 - rim, y1);
    const a = x0 + rim;
    const b = x1 - rim;
    const c = z0 + rim;
    const d = z1 - rim;
    // Faces intérieures du muret, tournées vers le toit.
    this.quad([a, y0, c], [b, y0, c], [b, y1, c], [a, y1, c], [0, 0, 1], 0, 0);
    this.quad([b, y0, d], [a, y0, d], [a, y1, d], [b, y1, d], [0, 0, -1], 0, 0);
    this.quad([a, y0, d], [a, y0, c], [a, y1, c], [a, y1, d], [1, 0, 0], 0, 0);
    this.quad([b, y0, c], [b, y0, d], [b, y1, d], [b, y1, c], [-1, 0, 0], 0, 0);
  }

  private extent(box: CityBox): [number, number, number, number] {
    return [
      box.x - box.width / 2,
      box.x + box.width / 2,
      box.z - box.depth / 2,
      box.z + box.depth / 2,
    ];
  }

  private flat(x0: number, x1: number, z0: number, z1: number, y: number): void {
    this.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], [0, 1, 0], 0, 0);
  }

  /**
   * Les quatre côtés (le dessous n'est jamais visible). `bays` donne le nombre de travées d'une
   * face selon sa longueur : un nombre entier, pour que les fenêtres tombent juste aux angles.
   */
  private sides(box: CityBox, bays: (length: number) => number, base: number, floor: number) {
    const [x0, x1, z0, z1] = this.extent(box);
    const y0 = box.bottom;
    const y1 = box.top;
    const v0 = (y0 - base) / floor;
    const v1 = (y1 - base) / floor;
    // Chaque face : 4 coins (bas-gauche, bas-droite, haut-droite, haut-gauche) vus de dehors.
    const faces: [Vec3, Vec3, Vec3, Vec3, Vec3, number][] = [
      [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], box.width],
      [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], box.width],
      [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], box.depth],
      [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], box.depth],
    ];
    for (const [a, b, c, d, normal, length] of faces)
      this.quad(a, b, c, d, normal, bays(length), v1, v0);
  }

  private quad(
    a: Vec3,
    b: Vec3,
    c: Vec3,
    d: Vec3,
    normal: Vec3,
    uMax: number,
    vMax: number,
    vMin = 0,
  ): void {
    const corners = [a, b, c, a, c, d];
    const uv = [
      [0, vMin],
      [uMax, vMin],
      [uMax, vMax],
      [0, vMin],
      [uMax, vMax],
      [0, vMax],
    ];
    corners.forEach((corner, index) => {
      this.positions.push(...corner);
      this.normals.push(...normal);
      this.uvs.push(...(uv[index] ?? [0, 0]));
      this.colors.push(this.color.r, this.color.g, this.color.b);
      this.facades.push(...this.facade);
    });
  }

  get vertexCount(): number {
    return this.positions.length / 3;
  }

  build(withFacade = false): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    if (withFacade)
      geometry.setAttribute('facade', new THREE.Float32BufferAttribute(this.facades, 4));
    geometry.computeBoundingSphere();
    return geometry;
  }
}

/** Fusionne des formes simples (indexées ou non) en une seule géométrie. */
function merged(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  return (
    mergeGeometries(parts.map((part) => (part.index ? part.toNonIndexed() : part))) ??
    new THREE.BufferGeometry()
  );
}

function instancedAt(
  geometry: THREE.BufferGeometry,
  mat: THREE.Material,
  points: readonly (Point3 & { scale?: number; color?: number })[],
  name: string,
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, mat, Math.max(1, points.length));
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();
  points.forEach((point, index) => {
    const scale = point.scale ?? 1;
    matrix.makeScale(scale, scale, scale).setPosition(point.x, point.y, point.z);
    mesh.setMatrixAt(index, matrix);
    if (point.color !== undefined) mesh.setColorAt(index, color.setHex(point.color));
  });
  mesh.count = points.length;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.name = name;
  return mesh;
}

function glowPoints(points: readonly Point3[], mat: THREE.PointsMaterial, name: string) {
  const object = new THREE.Points(
    new THREE.BufferGeometry().setFromPoints(points.map((p) => new THREE.Vector3(p.x, p.y, p.z))),
    mat,
  );
  object.name = name;
  object.frustumCulled = false;
  return object;
}

/** Voitures selon la qualité : la circulation coûte peu, mais chaque voiture a ses phares. */
const CAR_COUNT: Readonly<Record<QualityLevel, number>> = { low: 90, medium: 160, high: 220 };
const MAX_CARS = 220;
/** Taxis jaunes pour près de la moitié, puis noir, blanc, gris, bleu nuit, rouge. */
const CAR_COLORS = [0xf2c230, 0xf2c230, 0xf2c230, 0x1f2328, 0xe8e8e4, 0x9aa1a8, 0x23324f, 0x9b2d2a];
/** Deux avions qui croisent au loin, feux de navigation allumés. */
const PLANES = [
  { distance: 78, angle: 0.6, altitude: 24, period: 46 },
  { distance: 92, angle: 2.4, altitude: 27, period: 58 },
];

export class SkylineView {
  readonly root = new THREE.Group();
  private readonly uniforms = cityUniforms();
  private readonly crownLight = { value: 0 };
  private readonly glow = radialGlowTexture(32, 1.6);
  private readonly facadeMaterial = facadeMaterial(this.uniforms);
  private readonly solidMaterial = solidMaterial(this.uniforms);
  private readonly crownMaterial = solidMaterial(
    { ...this.uniforms, selfLit: this.crownLight },
    'skyline-crown',
  );
  private readonly streetMaterial = streetMaterial(this.uniforms, {
    avenueSpacing: AVENUE_SPACING,
    avenueWidth: AVENUE_WIDTH,
    streetSpacing: STREET_SPACING,
    streetWidth: STREET_WIDTH,
  });
  private readonly waterMaterial = waterMaterial(this.uniforms);
  private readonly sunColor = new THREE.Color();
  private readonly tankMaterial = new THREE.MeshLambertMaterial({
    color: 0x7a5233,
    flatShading: true,
  });
  private readonly treeMaterial = new THREE.MeshLambertMaterial({ flatShading: true });
  private readonly carMaterial = new THREE.MeshLambertMaterial({ flatShading: true });
  private readonly lampMaterial: THREE.PointsMaterial;
  private readonly beaconMaterial: THREE.PointsMaterial;
  /** Phares, feux arrière et feux des avions : des points colorés un par un. */
  private readonly signalMaterial: THREE.PointsMaterial;
  private cars: THREE.InstancedMesh | null = null;
  private carLights: THREE.Points | null = null;
  private planes: THREE.Points | null = null;
  private lanes: readonly Lane[] = [];
  private carCount = CAR_COUNT.medium;
  private clock = 0;
  private key = '';
  /** Toits où s'affichent les enseignes des rivaux du mode Histoire (`rivalTowerSpots`). */
  rivalSpots: readonly RivalSpot[] = [];

  constructor() {
    const points = (color: number, vertexColors = false) =>
      new THREE.PointsMaterial({
        map: this.glow,
        color,
        vertexColors,
        size: 12,
        sizeAttenuation: false,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });
    this.lampMaterial = points(0xffc978);
    this.beaconMaterial = points(0xff3b30);
    this.signalMaterial = points(0xffffff, true);
    this.root.name = 'skyline';
  }

  /** Qualité basse : moins de voitures et pas de reflets fins sur les vitres et l'eau. */
  setQuality(level: QualityLevel): void {
    this.uniforms.detail.value = level === 'low' ? 0 : 1;
    this.carCount = CAR_COUNT[level];
    if (this.cars) this.cars.count = this.carCount;
    this.carLights?.geometry.setDrawRange(0, this.carCount * 2);
  }

  /** Reconstruit la ville quand le bureau change de taille (la tour suit son emprise). */
  setLayout(layout: OfficeLayout): void {
    const key = `${layout.width}x${layout.depth}`;
    if (key === this.key) return;
    this.key = key;
    this.clear();
    const plan = planSkyline(layout);
    this.rivalSpots = rivalTowerSpots(plan, layout);
    const cx = (layout.width - 1) / 2;
    const cz = (layout.depth - 1) / 2;
    this.uniforms.center.value.set(cx, cz);

    const facades = new BoxBatch();
    const plain = new BoxBatch();
    const crowns = new BoxBatch();
    // Du plus proche au plus loin : les immeubles proches masquent les lointains, que la carte
    // graphique n'a alors pas à colorier (test de profondeur précoce).
    const near = (box: CityBox) => Math.hypot(box.x - cx, box.z - cz);
    [...plan.towers]
      .sort((a, b) => near(a) - near(b))
      .forEach((box) => {
        facades.facadeSides(box, box.bottom === STREET_LEVEL ? STREET_LEVEL : BASE);
        if (box.roof !== undefined) plain.roof(box);
      });
    for (const box of plan.solids) plain.solid(box);
    for (const box of plan.crowns) crowns.solid(box);
    const facadeMesh = new THREE.Mesh(facades.build(true), this.facadeMaterial);
    facadeMesh.name = 'skyline-facades';
    const plainMesh = new THREE.Mesh(plain.build(), this.solidMaterial);
    plainMesh.name = 'skyline-roofs';
    const crownMesh = new THREE.Mesh(crowns.build(), this.crownMaterial);
    crownMesh.name = 'skyline-crowns';

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(CITY_RADIUS * 4, CITY_RADIUS * 4).rotateX(-Math.PI / 2),
      this.streetMaterial,
    );
    ground.position.set(cx, STREET_LEVEL, cz);
    ground.name = 'skyline-street';
    const riverWidth = plan.river.x1 - plan.river.x0;
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(riverWidth, CITY_RADIUS * 4).rotateX(-Math.PI / 2),
      this.waterMaterial,
    );
    water.position.set((plan.river.x0 + plan.river.x1) / 2, STREET_LEVEL + 0.05, cz);
    water.name = 'skyline-river';

    // Réservoir d'eau : une cuve en bois sur ses pieds, coiffée d'un toit conique.
    const tank = merged([
      new THREE.CylinderGeometry(0.55, 0.55, 1, 10).translate(0, 1.2, 0),
      new THREE.BoxGeometry(0.9, 0.7, 0.9).translate(0, 0.35, 0),
      new THREE.ConeGeometry(0.62, 0.45, 10).translate(0, 1.92, 0),
    ]);
    // Arbre : un houppier arrondi sur un tronc court.
    const tree = merged([
      new THREE.IcosahedronGeometry(0.75, 0).scale(1, 0.9, 1).translate(0, 1.35, 0),
      new THREE.CylinderGeometry(0.1, 0.12, 0.8, 5).translate(0, 0.4, 0),
    ]);
    // Voiture : caisse et habitacle.
    const car = merged([
      new THREE.BoxGeometry(0.95, 0.3, 0.44).translate(0, 0.3, 0),
      new THREE.BoxGeometry(0.5, 0.22, 0.4).translate(-0.05, 0.56, 0),
    ]);
    this.lanes = plan.lanes;
    this.cars = new THREE.InstancedMesh(car, this.carMaterial, MAX_CARS);
    const color = new THREE.Color();
    for (let index = 0; index < MAX_CARS; index++)
      this.cars.setColorAt(index, color.setHex(CAR_COLORS[(index * 7) % CAR_COLORS.length] ?? 0));
    this.cars.count = this.carCount;
    this.cars.name = 'skyline-cars';
    this.cars.frustumCulled = false;
    this.carLights = this.signalPoints(MAX_CARS * 2, (index) =>
      index % 2 === 0 ? [1, 0.95, 0.8] : [1, 0.12, 0.08],
    );
    this.carLights.name = 'skyline-car-lights';
    this.carLights.geometry.setDrawRange(0, this.carCount * 2);
    this.planes = this.signalPoints(PLANES.length * 3, (index) =>
      index % 3 === 0 ? [1, 0.1, 0.1] : index % 3 === 1 ? [0.1, 1, 0.3] : [1, 1, 1],
    );
    this.planes.name = 'skyline-planes';
    this.placeTraffic();

    this.root.add(
      ground,
      water,
      facadeMesh,
      plainMesh,
      crownMesh,
      instancedAt(tank, this.tankMaterial, plan.tanks, 'skyline-tanks'),
      instancedAt(tree, this.treeMaterial, plan.trees, 'skyline-trees'),
      this.cars,
      this.carLights,
      this.planes,
      glowPoints(plan.streetLamps, this.lampMaterial, 'skyline-lamps'),
      glowPoints(plan.beacons, this.beaconMaterial, 'skyline-beacons'),
    );
    // La ville se dessine après le bureau, et la rue en dernier : tout ce qui est caché derrière
    // la salle ou sous les immeubles est éliminé avant d'être colorié.
    for (const child of this.root.children) child.renderOrder = 1;
    ground.renderOrder = 2;
    water.renderOrder = 2;
  }

  /**
   * Suit l'heure du jeu (`minute`, 0 à 1439) : lumière du ciel et du soleil sur les façades,
   * fenêtres qui s'allument et s'éteignent, couronnes des tours et lampadaires la nuit. Les
   * balises clignotent, les voitures roulent et les avions passent, sauf si l'option « réduire
   * les animations » est active.
   */
  update(
    light: LightingState,
    minute: number,
    delta: number,
    pixelsPerUnit: number,
    animate: boolean,
  ): void {
    const night = 1 - light.daylight;
    const hour = minute / 60;
    const u = this.uniforms;
    u.skyLight.value.setHex(light.skyColor).multiplyScalar(0.62 * light.ambient);
    u.sunLight.value.copy(this.sunColor.setHex(light.sunColor)).multiplyScalar(0.34 * light.sun);
    // Même course du soleil que la lumière du bureau (GameRenderer.applyLighting).
    u.sunDir.value
      .set(Math.cos(light.sunAzimuth), 1.2, Math.sin(light.sunAzimuth) * 0.6 + 0.5)
      .normalize();
    u.horizon.value.setHex(light.background);
    u.night.value = night;
    u.officeShare.value = litShare(hour, 'office');
    u.homeShare.value = litShare(hour, 'home');
    u.glow.value = 0.06 + 1.0 * night;
    if (animate) this.clock += delta;
    u.clock.value = this.clock;
    this.crownLight.value = 0.85 * Math.max(0, night - 0.2);
    this.lampMaterial.opacity = Math.max(0, night - 0.15);
    this.lampMaterial.size = 0.7 * pixelsPerUnit;
    // Les feux d'obstacle s'allument ensemble, une seconde sur deux.
    const pulse = animate ? Math.pow(Math.max(0, Math.sin(this.clock * Math.PI)), 0.5) : 1;
    this.beaconMaterial.opacity = (0.2 + 0.8 * night) * (0.12 + 0.88 * pulse);
    this.beaconMaterial.size = 1.3 * pixelsPerUnit;
    this.signalMaterial.opacity = Math.min(1, Math.max(0, 1.25 * night - 0.1));
    this.signalMaterial.size = 0.45 * pixelsPerUnit;
    if (animate) this.placeTraffic();
  }

  dispose(): void {
    this.clear();
    this.glow.dispose();
    for (const mat of [
      this.facadeMaterial,
      this.solidMaterial,
      this.crownMaterial,
      this.streetMaterial,
      this.waterMaterial,
      this.tankMaterial,
      this.treeMaterial,
      this.carMaterial,
      this.lampMaterial,
      this.beaconMaterial,
      this.signalMaterial,
    ])
      mat.dispose();
  }

  private signalPoints(count: number, colorOf: (index: number) => number[]): THREE.Points {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(count * 3, 3));
    geometry.setAttribute(
      'color',
      new THREE.Float32BufferAttribute(
        Array.from({ length: count }, (_, index) => colorOf(index)).flat(),
        3,
      ),
    );
    const points = new THREE.Points(geometry, this.signalMaterial);
    points.frustumCulled = false;
    return points;
  }

  /**
   * Chaque voiture suit sa voie à la vitesse de la voie (pas de dépassement), et réapparaît à
   * l'autre bout ; phares blancs devant, feux rouges derrière. Les avions décrivent une corde
   * loin du bureau, sous la ligne `maxTop` : ils ne passent jamais devant la salle.
   */
  private placeTraffic(): void {
    const cars = this.cars;
    const lights = this.carLights?.geometry.getAttribute('position');
    if (!cars || !lights || this.lanes.length === 0) return;
    const matrix = new THREE.Matrix4();
    for (let index = 0; index < MAX_CARS; index++) {
      const lane = this.lanes[(index * 37) % this.lanes.length];
      if (!lane) continue;
      const offset = ((index * 0.618034) % 1) * lane.length;
      const travelled = ((offset + this.clock * lane.speed) % lane.length) - lane.length / 2;
      const along = travelled * lane.direction;
      const x = lane.axis === 'x' ? lane.x + along : lane.x;
      const z = lane.axis === 'z' ? lane.z + along : lane.z;
      // La voiture regarde dans son sens de marche (son avant est vers +x).
      const angle =
        lane.axis === 'x'
          ? lane.direction > 0
            ? 0
            : Math.PI
          : lane.direction > 0
            ? -Math.PI / 2
            : Math.PI / 2;
      cars.setMatrixAt(index, matrix.makeRotationY(angle).setPosition(x, STREET_LEVEL, z));
      const dx = lane.axis === 'x' ? 0.5 * lane.direction : 0;
      const dz = lane.axis === 'z' ? 0.5 * lane.direction : 0;
      lights.setXYZ(index * 2, x + dx, STREET_LEVEL + 0.32, z + dz);
      lights.setXYZ(index * 2 + 1, x - dx, STREET_LEVEL + 0.32, z - dz);
    }
    cars.instanceMatrix.needsUpdate = true;
    lights.needsUpdate = true;

    const planes = this.planes?.geometry.getAttribute('position');
    const colors = this.planes?.geometry.getAttribute('color');
    if (!planes || !colors) return;
    const [cx, cz] = [this.uniforms.center.value.x, this.uniforms.center.value.y];
    PLANES.forEach((plane, index) => {
      const t = ((this.clock / plane.period + index * 0.37) % 1) * 2 - 1;
      const half = Math.sqrt(140 * 140 - plane.distance * plane.distance);
      const normal = { x: Math.cos(plane.angle), z: Math.sin(plane.angle) };
      const dir = { x: -normal.z, z: normal.x };
      const x = cx + normal.x * plane.distance + dir.x * t * half;
      const z = cz + normal.z * plane.distance + dir.z * t * half;
      const wing = 0.7;
      planes.setXYZ(index * 3, x + normal.x * wing, plane.altitude, z + normal.z * wing);
      planes.setXYZ(index * 3 + 1, x - normal.x * wing, plane.altitude, z - normal.z * wing);
      planes.setXYZ(index * 3 + 2, x - dir.x * 0.8, plane.altitude, z - dir.z * 0.8);
      // Flash blanc bref, une fois par seconde environ.
      const strobe = (this.clock * 1.1 + index * 0.4) % 1 < 0.12 ? 1 : 0;
      colors.setXYZ(index * 3 + 2, strobe, strobe, strobe);
    });
    planes.needsUpdate = true;
    colors.needsUpdate = true;
  }

  private clear(): void {
    for (const child of [...this.root.children]) {
      this.root.remove(child);
      if (child instanceof THREE.InstancedMesh) child.dispose();
      if (child instanceof THREE.Mesh || child instanceof THREE.Points) child.geometry.dispose();
    }
    this.cars = null;
    this.carLights = null;
    this.planes = null;
  }
}
