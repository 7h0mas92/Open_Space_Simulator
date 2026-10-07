import { expect, test, type Page } from '@playwright/test';

interface DebugInfo {
  items: number;
  characters: number;
  visible: number;
  drawCalls: number;
  zoom: number;
  target: { x: number; z: number };
  pixelRatio: number;
}

const debug = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __oss?: { debug(): DebugInfo } }).__oss?.debug() ?? null,
  );

async function startAsGuest(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('oss.language', 'fr');
    localStorage.setItem('oss.settings', JSON.stringify({ tutorialDone: true }));
  });
  await page.goto('/');
  await page.getByTestId('mode-NORMAL').click();
  await expect(page.getByTestId('game')).toBeVisible();
}

test('une partie en invité affiche la scène 3D, les personnages et le HUD', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await startAsGuest(page);

  await expect(page.getByTestId('scene')).toBeVisible();
  await expect(page.getByTestId('gauge-treasury')).toContainText('2');
  await expect.poll(async () => (await debug(page))?.drawCalls ?? 0).toBeGreaterThan(5);
  const info = await debug(page);
  // Une vraie partie commence au garage, avec un premier dev.
  expect(info?.characters).toBe(1);
  await expect.poll(async () => (await debug(page))?.visible ?? 0).toBe(1);
  expect(info?.pixelRatio).toBeLessThanOrEqual(2);

  await page.getByRole('button', { name: /Lancer le sprint/ }).click();
  await page.getByRole('button', { name: 'Vitesse x4' }).click();
  const clock = page.locator('.clock');
  const before = await clock.textContent();
  await expect.poll(() => clock.textContent()).not.toBe(before);
  expect(errors).toEqual([]);
});

test('le HUD tient dans l’écran, sans défilement, avec des cibles de 44 px', async ({ page }) => {
  await startAsGuest(page);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  const tooSmall = await page.evaluate(() =>
    [...document.querySelectorAll('.hud button, .hud select')]
      .map((element) => {
        const { width, height } = element.getBoundingClientRect();
        return { label: element.textContent?.trim(), width, height };
      })
      .filter(({ width, height }) => width > 0 && (width < 44 || height < 44)),
  );
  expect(tooSmall).toEqual([]);

  const offscreen = await page.evaluate(() =>
    [...document.querySelectorAll('.hud button')]
      .map((element) => element.getBoundingClientRect())
      .filter(
        (r) =>
          r.width > 0 && (r.right > window.innerWidth + 1 || r.bottom > window.innerHeight + 1),
      ),
  );
  expect(offscreen).toEqual([]);
});

test('glisser-déposer une tâche dans le Kanban', async ({ page }) => {
  await startAsGuest(page);
  await page.getByRole('button', { name: /Kanban/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Kanban' });
  await expect(sheet).toBeVisible();

  const card = sheet.locator('[data-column="BACKLOG"] [data-task-id]').first();
  const title = await card.getAttribute('aria-label');
  const target = sheet.locator('[data-column="TODO"]');
  await target.scrollIntoViewIfNeeded();
  const handle = card.locator('.task-drag');
  await handle.scrollIntoViewIfNeeded();
  const from = (await handle.boundingBox())!;
  await page.mouse.move(from.x + 20, from.y + from.height / 2);
  await page.mouse.down();
  await target.scrollIntoViewIfNeeded();
  const to = (await target.boundingBox())!;
  await page.mouse.move(to.x + to.width / 2, to.y + 40, { steps: 12 });
  await page.mouse.up();

  await expect(
    sheet.locator('[data-column="TODO"]').getByRole('article', { name: title! }),
  ).toBeVisible();
});

test('mode construction : poser une plante dans le bureau', async ({ page }) => {
  await startAsGuest(page);
  await page.getByRole('button', { name: /Construction/ }).click();
  await page.getByRole('tab', { name: 'Déco' }).click();
  await page.getByRole('button', { name: /^Plante/ }).click();
  // Sur ordinateur le panneau reste ouvert : on le ferme pour cliquer dans la scène.
  if (await page.getByRole('dialog').isVisible())
    await page.getByRole('button', { name: 'Fermer' }).click();
  await expect(page.getByText(/Pose : Plante/)).toBeVisible();

  const count = async () => (await debug(page))!.items;
  const items = await count();
  const canvas = page.getByTestId('scene');
  const box = (await canvas.boundingBox())!;
  // On essaie quelques points autour du centre jusqu'à trouver une case libre. L'achat passe
  // par le worker de la simulation : on attend sa réponse avant d'essayer ailleurs.
  for (const [dx, dy] of [
    [0, 0],
    [30, 30],
    [-40, 20],
    [40, -30],
    [0, 60],
    [-60, -20],
  ] as const) {
    await canvas.click({ position: { x: box.width / 2 + dx, y: box.height / 2 + dy } });
    for (let wait = 0; wait < 10 && (await count()) === items; wait++)
      await page.waitForTimeout(100);
    if ((await count()) > items) break;
  }
  expect(await count()).toBe(items + 1);
});

test('la caméra zoome à la molette et au clavier', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Molette et clavier : ordinateur uniquement');
  await startAsGuest(page);
  const canvas = page.getByTestId('scene');
  await expect.poll(async () => (await debug(page))?.zoom ?? 0).toBeGreaterThan(0);
  const before = (await debug(page))!.zoom;
  await canvas.hover();
  await page.mouse.wheel(0, -300);
  await expect.poll(async () => (await debug(page))!.zoom).toBeGreaterThan(before);
  await canvas.focus();
  await page.keyboard.press('-');
  await page.keyboard.press('-');
  await page.keyboard.press('-');
  await expect.poll(async () => (await debug(page))!.zoom).toBeLessThan(before * 1.2);
});

test('la caméra défile quand la souris atteint le bord de l’écran', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Souris : ordinateur uniquement');
  await startAsGuest(page);
  await expect.poll(async () => (await debug(page))?.drawCalls ?? 0).toBeGreaterThan(5);
  const target = async () => (await debug(page))!.target;
  const viewport = page.viewportSize()!;
  const center = { x: viewport.width / 2, y: viewport.height / 2 };

  // Au bord haut : la vue défile, puis s'arrête dès que la souris revient au centre.
  const start = await target();
  await page.mouse.move(center.x, center.y);
  await page.mouse.move(center.x, 1, { steps: 5 });
  await expect.poll(async () => (await target()).z).toBeLessThan(start.z - 0.5);
  await page.mouse.move(center.x, center.y);
  const stopped = await target();
  await page.waitForTimeout(300);
  expect(await target()).toEqual(stopped);

  // Sortie de la fenêtre par la gauche : le défilement continue.
  await page.mouse.move(30, center.y);
  await page.evaluate(
    ([y]) =>
      document.querySelector('canvas')!.dispatchEvent(
        new MouseEvent('mouseout', {
          bubbles: true,
          clientX: 0,
          clientY: y,
          relatedTarget: null,
        }),
      ),
    [center.y],
  );
  await expect.poll(async () => (await target()).x).toBeLessThan(stopped.x - 0.5);
});

test('un panneau se ferme avec Échap et rend le focus', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Clavier physique : ordinateur uniquement');
  await startAsGuest(page);
  const button = page.getByRole('button', { name: /Équipe/ });
  await button.click();
  await expect(page.getByRole('dialog', { name: 'Équipe' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(button).toBeFocused();
});
