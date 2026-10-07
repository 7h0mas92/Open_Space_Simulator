/**
 * Mathématiques de la caméra isométrique (sans Three.js, donc testables).
 *
 * La caméra orthographique regarde un point cible du sol depuis une direction fixe
 * (élévation de l'isométrie vraie ≈ 35,26°), tournée par quarts de tour.
 */
export const ISO_ELEVATION = Math.atan(1 / Math.SQRT2); // ≈ 35,26°
export const MIN_ZOOM = 0.35;
export const MAX_ZOOM = 3;
/** Hauteur visible (en unités monde) au zoom 1, sur l'axe vertical de l'écran. */
export const BASE_VIEW_HEIGHT = 14;

export interface IsoCameraState {
  /** Point visé sur le sol. */
  readonly targetX: number;
  readonly targetZ: number;
  readonly zoom: number;
  /** Rotation par quarts de tour (0 à 3). */
  readonly quarter: number;
}

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** Réglage joueur de la vitesse du zoom (molette, trackpad, pincement). */
export const ZOOM_SPEEDS = ['slow', 'normal', 'fast'] as const;
export type ZoomSpeed = (typeof ZOOM_SPEEDS)[number];
const ZOOM_SPEED_MULTIPLIER: Record<ZoomSpeed, number> = { slow: 0.5, normal: 1, fast: 2 };

/** Un cran de molette (≈ 100 px) zoome de 12 %, comme avant. */
const WHEEL_STEP = 1.12;
const WHEEL_NOTCH_PIXELS = 100;
/** Pincement trackpad (molette + ctrlKey) : petits deltas, rendus un peu plus réactifs. */
const PINCH_ZOOM_PER_PIXEL = 0.01;
/** Conversion des deltas exprimés en lignes (Firefox) ou en pages vers des pixels. */
const LINE_PIXELS = WHEEL_NOTCH_PIXELS / 3;
const PAGE_PIXELS = 800;

export interface WheelInput {
  readonly deltaY: number;
  /** 0 = pixels, 1 = lignes, 2 = pages (WheelEvent.deltaMode). */
  readonly deltaMode: number;
  /** Les navigateurs signalent le pincement du trackpad par une molette avec ctrlKey. */
  readonly ctrlKey: boolean;
}

/**
 * Facteur de zoom pour un évènement molette, proportionnel à son delta.
 *
 * Une souris envoie peu d'évènements à gros delta (un cran ≈ 100 px), un trackpad en envoie
 * des dizaines par seconde à petit delta : avec un pas fixe par évènement, le trackpad zoomait
 * beaucoup trop vite. Le delta est borné à un cran pour qu'un cran de souris garde le même pas.
 */
export function wheelZoomFactor(input: WheelInput, speed: ZoomSpeed = 'normal'): number {
  const unit = input.deltaMode === 1 ? LINE_PIXELS : input.deltaMode === 2 ? PAGE_PIXELS : 1;
  const pixels = Math.max(-WHEEL_NOTCH_PIXELS, Math.min(WHEEL_NOTCH_PIXELS, input.deltaY * unit));
  const perPixel = input.ctrlKey ? PINCH_ZOOM_PER_PIXEL : Math.log(WHEEL_STEP) / WHEEL_NOTCH_PIXELS;
  return Math.exp(-pixels * perPixel * ZOOM_SPEED_MULTIPLIER[speed]);
}

/** Applique la vitesse de zoom à un facteur de pincement tactile. */
export function scaleZoomFactor(factor: number, speed: ZoomSpeed): number {
  return factor ** ZOOM_SPEED_MULTIPLIER[speed];
}

/** Azimut de la caméra : 45° + un quart de tour par rotation. */
export function azimuth(quarter: number): number {
  return Math.PI / 4 + (quarter * Math.PI) / 2;
}

/** Direction (unitaire) de la cible vers la caméra. */
export function cameraDirection(quarter: number): { x: number; y: number; z: number } {
  const a = azimuth(quarter);
  const horizontal = Math.cos(ISO_ELEVATION);
  return { x: Math.sin(a) * horizontal, y: Math.sin(ISO_ELEVATION), z: Math.cos(a) * horizontal };
}

/** Demi-dimensions du frustum orthographique pour un rapport largeur/hauteur. */
export function frustum(aspect: number, zoom: number): { halfWidth: number; halfHeight: number } {
  const halfHeight = BASE_VIEW_HEIGHT / 2 / zoom;
  return { halfWidth: halfHeight * aspect, halfHeight };
}

/**
 * Déplacement du point visé quand on fait glisser l'écran de (dx, dy) pixels.
 * Le sol « suit le doigt » : glisser vers la droite déplace la vue vers la gauche.
 */
export function panDelta(
  state: IsoCameraState,
  dxPixels: number,
  dyPixels: number,
  viewportHeight: number,
): { dx: number; dz: number } {
  const { halfHeight } = frustum(1, state.zoom);
  const unitsPerPixel = (2 * halfHeight) / Math.max(1, viewportHeight);
  const a = azimuth(state.quarter);
  // Axes du sol vus depuis la caméra : « droite » et « haut de l'écran » projeté sur le sol.
  const rightX = Math.cos(a);
  const rightZ = -Math.sin(a);
  const upX = -Math.sin(a) / Math.sin(ISO_ELEVATION);
  const upZ = -Math.cos(a) / Math.sin(ISO_ELEVATION);
  const sx = -dxPixels * unitsPerPixel;
  const sy = dyPixels * unitsPerPixel;
  return { dx: rightX * sx + upX * sy, dz: rightZ * sx + upZ * sy };
}

/** Garde la cible au-dessus du bureau (avec une marge). */
export function clampTarget(
  state: IsoCameraState,
  width: number,
  depth: number,
  margin = 2,
): IsoCameraState {
  return {
    ...state,
    targetX: Math.min(width - 1 + margin, Math.max(-margin, state.targetX)),
    targetZ: Math.min(depth - 1 + margin, Math.max(-margin, state.targetZ)),
  };
}

/** Zoom qui fait tenir tout le bureau à l'écran. */
export function fitZoom(width: number, depth: number, aspect: number): number {
  // Diagonale du bureau projetée : largeur à l'écran ≈ (w + d) / √2, hauteur ≈ moitié.
  const screenWidth = ((width + depth) / Math.SQRT2) * 1.1;
  const screenHeight = ((width + depth) / Math.SQRT2) * Math.sin(ISO_ELEVATION) * 1.1 + 3;
  const zoomForWidth = BASE_VIEW_HEIGHT / (screenWidth / Math.max(aspect, 0.1));
  const zoomForHeight = BASE_VIEW_HEIGHT / screenHeight;
  return clampZoom(Math.min(zoomForWidth, zoomForHeight));
}
