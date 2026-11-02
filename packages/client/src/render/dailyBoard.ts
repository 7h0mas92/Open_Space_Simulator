/**
 * Le Daily dans la salle de réunion : un écran déroulant au milieu du mur du fond et un
 * vidéoprojecteur suspendu au-dessus de la table. Pendant la réunion (`DailyView.live`), la
 * toile se déroule, toute blanche, puis l'appli de tickets « Kanbanana » s'y allume : colonnes
 * À faire / En cours / Terminé, tickets avec leur clé, leur type, leurs points et l'avatar du dev,
 * et le point de chaque participant (hier → aujourd'hui). Après la réunion, l'image s'éteint et
 * la toile, blanche, s'enroule.
 *
 * Le rendu ne décide de rien : le tableau vient de `view/ticketBoard.ts`, le moment de la
 * réunion de la simulation. Le dessin se fait sur un canvas 2D (repli : toile blanche, en test).
 */
import * as THREE from 'three';
import type { MeetingPlan } from '../view/decor';
import {
  TICKET_APP,
  TICKET_TYPE_COLORS,
  type BoardColumn,
  type TicketBoard,
  type TicketCard,
} from '../view/ticketBoard';
import {
  CASE_TOP,
  CEILING_LENS,
  FABRIC_Z,
  SCREEN_SIZES,
  ceilingProjector,
  projectionScreenMedium,
  projectionScreenSmall,
  type ScreenSize,
} from './projectionModels';

/** Temps pour dérouler ou enrouler la toile, puis pour que l'image apparaisse (secondes). */
const UNROLL_SECONDS = 1.4;
const GLOW_SECONDS = 0.5;
/** Largeur du canvas de l'appli (la hauteur suit les proportions de la toile). */
const CANVAS_WIDTH = 1024;

const WHITE = 0xffffff;

type Lang = 'fr' | 'en';

const LABELS: Record<
  Lang,
  Record<BoardColumn | 'daily' | 'board' | 'none' | 'focus' | 'useless', string>
> = {
  fr: {
    TODO: 'À FAIRE',
    DOING: 'EN COURS',
    DONE: 'TERMINÉ',
    daily: 'Daily',
    board: 'Tableau du sprint',
    none: 'pas de ticket',
    focus: 'Daily utile : +{focus} % jusqu’au soir',
    useless: 'Daily qui aurait pu être un mail',
  },
  en: {
    TODO: 'TO DO',
    DOING: 'IN PROGRESS',
    DONE: 'DONE',
    daily: 'Daily',
    board: 'Sprint board',
    none: 'no ticket',
    focus: 'Useful Daily: +{focus}% until tonight',
    useless: 'Daily that could have been an email',
  },
};

// --- Dessin de l'appli -----------------------------------------------------------------------

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Logo de l'appli : une banane jaune dans un carré arrondi (aucune marque réelle). */
export function drawLogo(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.fillStyle = '#ffd23f';
  roundRect(ctx, x, y, size, size, size * 0.22);
  ctx.fill();
  ctx.strokeStyle = '#6b4a00';
  ctx.lineWidth = size * 0.11;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(x + size * 0.38, y + size * 0.36, size * 0.36, Math.PI * 0.1, Math.PI * 0.75);
  ctx.stroke();
}

function avatar(
  ctx: CanvasRenderingContext2D,
  card: TicketCard,
  cx: number,
  cy: number,
  r: number,
) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = card.assignee?.color ?? '#9aa3b5';
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.round(r * 0.95)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(card.assignee?.initials ?? '?', cx, cy + 1);
}

function ellipsis(ctx: CanvasRenderingContext2D, text: string, width: number): string {
  if (ctx.measureText(text).width <= width) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > width) cut = cut.slice(0, -1);
  return `${cut}…`;
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  card: TicketCard,
  lang: Lang,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, x, y, w, h, 6);
  ctx.fill();
  ctx.strokeStyle = card.daily ? '#2f6fd8' : '#d7dbe3';
  ctx.lineWidth = card.daily ? 3 : 1.5;
  ctx.stroke();
  if (card.kind === 'URGENT') {
    ctx.fillStyle = '#d9453a';
    ctx.fillRect(x, y + 6, 4, h - 12);
  }
  // Titre sur une ligne, puis type, clé, points et avatar en bas, comme dans les vrais outils.
  ctx.fillStyle = '#172033';
  ctx.font = '600 19px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(ellipsis(ctx, card.title[lang], w - 24), x + 12, y + 10);
  const bottom = y + h - 22;
  ctx.fillStyle = TICKET_TYPE_COLORS[card.type];
  roundRect(ctx, x + 12, bottom - 8, 16, 16, 3);
  ctx.fill();
  ctx.fillStyle = '#4c5466';
  ctx.font = '600 16px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(card.key, x + 36, bottom);
  ctx.fillStyle = '#e4e7ee';
  roundRect(ctx, x + w - 84, bottom - 11, 30, 22, 11);
  ctx.fill();
  ctx.fillStyle = '#2c3446';
  ctx.textAlign = 'center';
  ctx.fillText(String(card.size), x + w - 69, bottom);
  avatar(ctx, card, x + w - 26, bottom, 13);
  // Avancement : la barre, et ce qui a avancé depuis le Daily d'hier.
  if (card.column === 'DOING') {
    const barX = x + 12;
    const barW = w - 24;
    const barY = y + 40;
    ctx.fillStyle = '#e4e7ee';
    ctx.fillRect(barX, barY, barW, 7);
    const before = card.daily?.before ?? null;
    const now = card.daily?.progress ?? card.progress;
    if (before !== null) {
      ctx.fillStyle = '#9db8e8';
      ctx.fillRect(barX, barY, barW * before, 7);
    }
    ctx.fillStyle = '#2f6fd8';
    ctx.fillRect(barX + barW * (before ?? 0), barY, barW * Math.max(0, now - (before ?? 0)), 7);
  }
}

/**
 * Dessine l'appli de tickets sur un canvas : barre du haut avec le logo, tableau du sprint en
 * trois colonnes, puis le bandeau du Daily (qui parle de quel ticket).
 */
export function drawTicketBoard(
  ctx: CanvasRenderingContext2D,
  board: TicketBoard,
  lang: Lang,
  width: number,
  height: number,
): void {
  const labels = LABELS[lang];
  ctx.fillStyle = '#f4f5f7';
  ctx.fillRect(0, 0, width, height);
  // Barre du haut.
  ctx.fillStyle = '#1d3f73';
  ctx.fillRect(0, 0, width, 56);
  drawLogo(ctx, 16, 10, 36);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(TICKET_APP.name, 62, 28);
  ctx.font = '500 20px system-ui, sans-serif';
  ctx.fillStyle = '#c8d6ee';
  const points = `${board.donePoints}/${board.totalPoints} pts`;
  ctx.fillText(`${TICKET_APP.project} · ${labels.board} · Sprint ${board.sprint}`, 230, 28);
  ctx.textAlign = 'right';
  ctx.fillText(points, width - 18, 28);

  // Colonnes.
  const footer = board.daily ? 92 : 0;
  const top = 70;
  const gap = 14;
  const colW = (width - gap * 4) / 3;
  const cardH = 76;
  board.columns.forEach((column, index) => {
    const x = gap + index * (colW + gap);
    ctx.fillStyle = '#e9ebf0';
    roundRect(ctx, x, top, colW, height - top - footer - gap, 8);
    ctx.fill();
    ctx.fillStyle = '#5e6678';
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${labels[column.id]}  ${column.cards.length}`, x + 12, top + 20);
    const room = Math.max(0, Math.floor((height - top - footer - gap - 44) / (cardH + 8)));
    const shown = column.cards.length > room ? Math.max(0, room - 1) : room;
    column.cards.slice(0, shown).forEach((card, row) => {
      drawCard(ctx, card, lang, x + 8, top + 40 + row * (cardH + 8), colW - 16, cardH);
    });
    if (column.cards.length > shown) {
      ctx.fillStyle = '#5e6678';
      ctx.font = '600 17px system-ui, sans-serif';
      ctx.fillText(`+ ${column.cards.length - shown}`, x + 14, top + 40 + shown * (cardH + 8) + 18);
    }
  });

  // Bandeau du Daily : les participants et leur ticket.
  const daily = board.daily;
  if (!daily) return;
  const y = height - footer;
  ctx.fillStyle = daily.useful ? '#e3f1e7' : '#fbe9e7';
  ctx.fillRect(0, y, width, footer);
  ctx.fillStyle = '#172033';
  ctx.font = 'bold 19px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const verdict = daily.useful
    ? labels.focus.replace('{focus}', String(daily.focus))
    : labels.useless;
  ctx.fillText(`${labels.daily} · ${verdict}`, 16, y + 22);
  ctx.font = '500 16px system-ui, sans-serif';
  let x = 16;
  for (const speaker of daily.speakers) {
    const label = `${speaker.name.split(' ')[0] ?? speaker.name} → ${speaker.ticket?.key ?? labels.none}`;
    const w = ctx.measureText(label).width + 44;
    if (x + w > width - 8) break;
    ctx.beginPath();
    ctx.arc(x + 13, y + 62, 13, 0, Math.PI * 2);
    ctx.fillStyle = speaker.color;
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(speaker.initials, x + 13, y + 63);
    ctx.fillStyle = '#2c3446';
    ctx.font = '500 16px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, x + 32, y + 62);
    x += w;
  }
}

/** Clé de dessin : on ne redessine le canvas que si le tableau affiché change. */
export function boardKey(board: TicketBoard, lang: Lang): string {
  const cards = board.columns
    .map((column) =>
      column.cards
        .map((card) => `${card.id}:${Math.round(card.progress * 50)}:${card.assignee?.id ?? ''}`)
        .join(','),
    )
    .join('|');
  const daily = board.daily
    ? `${board.daily.useful}:${board.daily.focus}:${board.daily.speakers.map((s) => s.id).join(',')}`
    : '-';
  return `${lang}#${board.sprint}#${cards}#${daily}`;
}

// --- Scène -----------------------------------------------------------------------------------

export class DailyBoardView {
  readonly root = new THREE.Group();
  private planKey = '';
  private drawKey = '';
  private size: ScreenSize | null = null;
  private fabric: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial> | null = null;
  private beam: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private texture: THREE.CanvasTexture | null = null;
  private live = false;
  /** Part de la toile sortie (0 à 1), puis intensité de l'image (0 à 1). */
  private unroll = 0;
  private glow = 0;

  constructor() {
    this.root.name = 'daily-board';
  }

  /** L'écran est-il déroulé avec l'appli affichée ? (tests) */
  get showing(): boolean {
    return this.glow > 0;
  }

  /** Place l'écran et le projecteur selon le plan de la salle (rien sans salle aménagée). */
  setPlan(plan: MeetingPlan | null): void {
    const screen = plan?.screen ?? null;
    const key =
      plan && screen
        ? `${screen.x},${screen.z},${screen.cells}|${plan.table.x},${plan.table.z},${plan.table.width},${plan.table.depth}`
        : '';
    if (key === this.planKey) return;
    this.planKey = key;
    this.clear();
    if (!plan || !screen) return;
    const size = SCREEN_SIZES[
      screen.cells >= 3 ? 'projection-screen-medium' : 'projection-screen-small'
    ] as ScreenSize;
    this.size = size;
    const holder = (screen.cells >= 3 ? projectionScreenMedium : projectionScreenSmall)();
    holder.position.set(screen.x, 0, screen.z);
    this.root.add(holder);

    // Toile : un plan blanc qui grandit vers le haut depuis la fente du caisson.
    const fabric = new THREE.Mesh(
      new THREE.PlaneGeometry(size.width, size.height).translate(0, size.height / 2, 0),
      new THREE.MeshStandardMaterial({
        color: WHITE,
        roughness: 0.9,
        emissive: WHITE,
        emissiveIntensity: 0,
      }),
    );
    fabric.position.set(screen.x, CASE_TOP, screen.z + FABRIC_Z + 0.01);
    fabric.scale.y = 0.001;
    fabric.visible = false;
    this.fabric = fabric;
    this.root.add(fabric);

    // Projecteur suspendu au-dessus de la table, tourné vers l'écran (vers -z).
    const projector = ceilingProjector();
    const tableX = plan.table.x + (plan.table.width - 1) / 2;
    const tableZ = plan.table.z + (plan.table.depth - 1) / 2;
    projector.position.set(tableX, 0, tableZ);
    projector.rotation.y = Math.PI;
    this.root.add(projector);

    // Faisceau : de l'objectif aux quatre coins de la toile.
    const lens = new THREE.Vector3(
      tableX - CEILING_LENS[0],
      CEILING_LENS[1],
      tableZ - CEILING_LENS[2],
    );
    const left = screen.x - size.width / 2;
    const right = screen.x + size.width / 2;
    const z = screen.z + FABRIC_Z + 0.02;
    const bottom = CASE_TOP + 0.02;
    const top = CASE_TOP + size.height;
    const geometry = new THREE.BufferGeometry();
    const corners = [
      [left, bottom, z],
      [right, bottom, z],
      [right, top, z],
      [left, top, z],
    ];
    const vertices: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      const a = corners[i] as number[];
      const b = corners[(i + 1) % 4] as number[];
      vertices.push(lens.x, lens.y, lens.z, ...a, ...b);
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    const beam = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color: 0xfff6dc,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    );
    beam.visible = false;
    this.beam = beam;
    this.root.add(beam);
    this.drawKey = '';
  }

  /** Le tableau à projeter et le moment de la réunion. */
  setBoard(board: TicketBoard, lang: Lang): void {
    this.live = board.daily?.live === true;
    if (!this.live || !this.size) return;
    const key = boardKey(board, lang);
    if (key === this.drawKey) return;
    this.drawKey = key;
    if (!this.canvas) {
      if (typeof document === 'undefined') return;
      this.canvas = document.createElement('canvas');
      this.canvas.width = CANVAS_WIDTH;
    }
    this.canvas.height = Math.round((CANVAS_WIDTH * this.size.height) / this.size.width);
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    drawTicketBoard(ctx, board, lang, this.canvas.width, this.canvas.height);
    if (!this.texture) {
      this.texture = new THREE.CanvasTexture(this.canvas);
      this.texture.colorSpace = THREE.SRGBColorSpace;
    }
    this.texture.needsUpdate = true;
  }

  update(delta: number, motion: boolean): void {
    const fabric = this.fabric;
    if (!fabric) return;
    const step = (seconds: number) => (motion ? delta / seconds : 1);
    if (this.live) {
      this.unroll = Math.min(1, this.unroll + step(UNROLL_SECONDS));
      if (this.unroll >= 1) this.glow = Math.min(1, this.glow + step(GLOW_SECONDS));
    } else {
      // L'image s'éteint d'abord, puis la toile, toute blanche, rentre dans son caisson.
      this.glow = Math.max(0, this.glow - step(GLOW_SECONDS));
      if (this.glow <= 0) this.unroll = Math.max(0, this.unroll - step(UNROLL_SECONDS));
    }
    fabric.visible = this.unroll > 0;
    fabric.scale.y = Math.max(0.001, this.unroll);
    const material = fabric.material;
    const image = this.glow > 0 && this.texture ? this.texture : null;
    if (material.map !== image) {
      material.map = image;
      material.emissiveMap = image;
      material.needsUpdate = true;
    }
    material.emissiveIntensity = this.glow * 0.85;
    if (this.beam) {
      this.beam.visible = this.glow > 0;
      this.beam.material.opacity = this.glow * 0.1;
    }
  }

  dispose(): void {
    this.clear();
    this.texture?.dispose();
    this.texture = null;
  }

  private clear(): void {
    for (const child of [...this.root.children]) {
      this.root.remove(child);
      child.traverse((node) => {
        if (node instanceof THREE.Mesh) node.geometry.dispose();
      });
    }
    this.fabric?.material.dispose();
    this.beam?.material.dispose();
    this.fabric = null;
    this.beam = null;
    this.size = null;
    this.unroll = 0;
    this.glow = 0;
  }
}
