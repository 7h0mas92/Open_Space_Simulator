/**
 * Image partageable de fin de partie, dessinée dans un canvas 2D (aucun asset requis).
 * Exemple de phrase : « Ma startup a été rachetée 400 M€ et 7 devs ont fait un burn-out ».
 */
export interface ShareCard {
  readonly title: string;
  readonly headline: string;
  readonly lines: readonly string[];
  readonly footer: string;
}

export const SHARE_WIDTH = 1200;
export const SHARE_HEIGHT = 630;

/** Coupe un texte en lignes qui tiennent dans la largeur donnée. */
export function wrapText(
  measure: (text: string) => number,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && measure(candidate) > maxWidth) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  return lines;
}

export function drawShareCard(ctx: CanvasRenderingContext2D, card: ShareCard): void {
  const gradient = ctx.createLinearGradient(0, 0, SHARE_WIDTH, SHARE_HEIGHT);
  gradient.addColorStop(0, '#1d2340');
  gradient.addColorStop(1, '#3b2f63');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SHARE_WIDTH, SHARE_HEIGHT);

  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.fillText(card.title, 64, 90);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 54px system-ui, sans-serif';
  let y = 190;
  for (const line of wrapText((t) => ctx.measureText(t).width, card.headline, 1070).slice(0, 4)) {
    ctx.fillText(line, 64, y);
    y += 66;
  }

  ctx.fillStyle = '#c9d1f5';
  ctx.font = '30px system-ui, sans-serif';
  y += 20;
  for (const line of card.lines.slice(0, 4)) {
    ctx.fillText(line, 64, y);
    y += 44;
  }

  ctx.fillStyle = '#8f9bd6';
  ctx.font = '24px system-ui, sans-serif';
  ctx.fillText(card.footer, 64, SHARE_HEIGHT - 48);
}

/** Dessine la carte et renvoie un PNG. */
export async function renderShareImage(card: ShareCard): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = SHARE_WIDTH;
  canvas.height = SHARE_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d unavailable');
  drawShareCard(ctx, card);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob'))), 'image/png'),
  );
}

/** Partage natif (mobile) si possible, sinon téléchargement du PNG. */
export async function shareImage(blob: Blob, text: string): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], 'open-space-simulator.png', { type: 'image/png' });
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return 'shared';
    } catch (error) {
      if ((error as Error).name === 'AbortError') return 'shared';
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
