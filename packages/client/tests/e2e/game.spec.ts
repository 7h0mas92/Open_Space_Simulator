import { expect, test, type Page } from '@playwright/test';

interface DebugInfo {
  items: number;
  characters: number;
  visible: number;
  drawCalls: number;
  zoom: number;
  target: { x: number; z: number };
  pixelRatio: number;
  ghost: { x: number; y: number } | null;
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

/** Prend un niveau de l'arbre R&D (4 points au départ : un niveau 1), puis referme le panneau. */
async function research(page: Page, nodeId: string) {
  await page.locator('[data-tutorial="panel-research"]').click();
  await page.getByTestId(`research-tab-${nodeId.split('-')[0]}`).click();
  await page.getByTestId(`research-take-${nodeId}`).click();
  await expect(page.getByTestId(`research-node-${nodeId}`)).toContainText('Débloqué');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('research-panel')).toBeHidden();
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

test('la bande des jauges et le dock ne se chevauchent pas, même panneau ouvert', async ({
  page,
}) => {
  await startAsGuest(page);
  const top = (await page.locator('.hud-top').boundingBox())!;
  const dock = (await page.locator('.command-dock').boundingBox())!;
  expect(top.y + top.height).toBeLessThan(dock.y);
  // Toutes les actions de jeu sont dans le dock, la commande de l'étape aussi.
  await expect(page.locator('.command-dock button')).toHaveCount(10);

  await page.locator('[data-tutorial="panel-team"]').click();
  const sheet = page.getByRole('dialog', { name: 'Équipe' });
  await expect(sheet).toBeVisible();
  const viewport = page.viewportSize()!;
  if (viewport.width >= 1024 && viewport.height > 500) {
    // Sur ordinateur, le panneau se glisse entre les jauges et le dock : tout reste visible.
    const box = (await sheet.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(top.y + top.height);
    expect(box.y + box.height).toBeLessThanOrEqual(dock.y);
    await expect(page.getByTestId('gauge-treasury')).toBeVisible();
  }
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

test('Kanban : le bouton « Tout en À faire » vide le backlog', async ({ page }) => {
  await startAsGuest(page);
  await page.getByRole('button', { name: /Kanban/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Kanban' });
  const backlog = sheet.locator('[data-column="BACKLOG"] [data-task-id]');
  const count = await backlog.count();
  expect(count).toBeGreaterThan(0);
  // Chaque carte affiche son métier ; au départ, l'équipe ne fait que du code.
  await expect(backlog.first().locator('.tag-trade')).toHaveText(/Code/);

  const button = sheet.getByRole('button', { name: `Tout en À faire (${count})` });
  const box = (await button.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  await button.click();
  await expect(backlog).toHaveCount(0);
  await expect(sheet.locator('[data-column="TODO"] [data-task-id]')).toHaveCount(count);
  await expect(button).toBeHidden();
});

test('mode construction : le catalogue se replie quand on prend un objet', async ({ page }) => {
  await startAsGuest(page);
  await page.getByRole('button', { name: /Construction/ }).click();
  // Le HUD habituel laisse la place au mode construction.
  await expect(page.getByTestId('build-mode')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Actions du jeu' })).toBeHidden();

  // Tout tient dans l'écran, avec des cibles tactiles de 44 px.
  const tooSmall = await page.evaluate(() =>
    [...document.querySelectorAll('.build-hud button')]
      .map((element) => element.getBoundingClientRect())
      .filter(({ width, height }) => width > 0 && (width < 44 || height < 44)),
  );
  expect(tooSmall).toEqual([]);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  await page.getByRole('tab', { name: /Déco/ }).click();
  await page.getByTestId('catalog-plant').click();
  await expect(page.getByTestId('catalog')).toBeHidden();
  await expect(page.getByTestId('placement-bar')).toContainText('Plante verte');
  // L'aperçu démarre sur une case libre : on peut poser tout de suite.
  const place = page.getByTestId('place');
  await expect(place).toBeEnabled();

  const count = async () => (await debug(page))!.items;
  const items = await count();
  await place.click();
  await expect.poll(count).toBe(items + 1);
  await expect(page.getByText('Plante verte : posé !')).toBeVisible();
  // L'objet reste en main pour en poser d'autres, jusqu'à « Annuler » ou « Terminer ».
  await expect(page.getByTestId('placed-count')).toHaveText(/1 posé/);
  await expect(place).toBeEnabled();
  await place.click();
  await expect.poll(count).toBe(items + 2);
  await page.getByRole('button', { name: /Annuler/ }).click();
  await expect(page.getByTestId('catalog')).toBeVisible();

  await page.getByRole('button', { name: /Terminer/ }).click();
  await expect(page.getByTestId('build-mode')).toBeHidden();
  await expect(page.getByRole('navigation', { name: 'Actions du jeu' })).toBeVisible();
});

test('mode construction : la souris pose au clic, le doigt vise au tap', async ({
  page,
  hasTouch,
}) => {
  await startAsGuest(page);
  await page.getByRole('button', { name: /Construction/ }).click();
  await page.getByRole('tab', { name: /Déco/ }).click();
  await page.getByTestId('catalog-plant').click();
  await expect(page.getByTestId('place')).toBeEnabled();

  const count = async () => (await debug(page))!.items;
  const items = await count();
  const canvas = page.getByTestId('scene');
  const box = (await canvas.boundingBox())!;
  const status = page.locator('.placement-status');
  // On essaie quelques points autour du centre jusqu'à trouver une case libre.
  for (const [dx, dy] of [
    [0, 0],
    [30, 30],
    [-40, 20],
    [40, -30],
    [0, 60],
    [-60, -20],
  ] as const) {
    const position = { x: box.width / 2 + dx, y: box.height / 2 - 40 + dy };
    if (hasTouch) {
      await canvas.tap({ position });
      // Le tap déplace seulement l'aperçu : rien n'est acheté sans « Poser ».
      await page.waitForTimeout(150);
      expect(await count()).toBe(items);
      if (await page.getByTestId('place').isEnabled()) break;
    } else {
      await canvas.click({ position });
      for (let wait = 0; wait < 10 && (await count()) === items; wait++)
        await page.waitForTimeout(100);
      if ((await count()) > items) break;
    }
  }
  if (hasTouch) {
    await expect(status).not.toHaveClass(/invalid/);
    await page.getByTestId('place').click();
  }
  await expect.poll(count).toBe(items + 1);
});

test('mode construction : au doigt, on fait glisser l’aperçu sans bouger la caméra', async ({
  page,
  hasTouch,
}) => {
  test.skip(!hasTouch, 'Glisser au doigt : écrans tactiles uniquement');
  await startAsGuest(page);
  await page.getByRole('button', { name: /Construction/ }).click();
  await page.getByRole('tab', { name: /Déco/ }).click();
  await page.getByTestId('catalog-plant').click();
  await expect.poll(async () => (await debug(page))?.ghost ?? null).not.toBeNull();
  const start = (await debug(page))!.ghost!;
  const zoom = (await debug(page))!.zoom;
  const items = (await debug(page))!.items;
  const box = (await page.getByTestId('scene').boundingBox())!;

  // Glisser au doigt (événements tactiles bruts) depuis l'aperçu.
  const client = await page.context().newCDPSession(page);
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) =>
    client.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x: box.x + x, y: box.y + y }],
    });
  await touch('touchStart', start.x, start.y);
  for (let step = 1; step <= 6; step++) await touch('touchMove', start.x + step * 12, start.y);
  await touch('touchEnd', start.x + 72, start.y);

  await expect.poll(async () => (await debug(page))!.ghost!.x).toBeGreaterThan(start.x + 20);
  const after = (await debug(page))!;
  expect(after.items).toBe(items);
  expect(after.zoom).toBe(zoom);
});

test('inventaire : ranger un objet posé puis le reposer gratuitement', async ({ page }) => {
  // Long parcours (poser, ranger, reposer) : il frôlait déjà les 30 s par défaut en 1440 px.
  test.slow();
  await startAsGuest(page);
  await page.getByRole('button', { name: /Construction/ }).click();
  await page.getByRole('tab', { name: /Déco/ }).click();
  await page.getByTestId('catalog-plant').click();
  await expect.poll(async () => (await debug(page))?.ghost ?? null).not.toBeNull();
  const spot = (await debug(page))!.ghost!;
  const count = async () => (await debug(page))!.items;
  const items = await count();
  await page.getByTestId('place').click();
  await expect.poll(count).toBe(items + 1);
  await page.getByRole('button', { name: /Annuler/ }).click();
  // Le rayon Déco, bien garni, cache le bas de l'écran : l'onglet Inventaire, vide, le libère.
  await page.getByTestId('catalog-tab-inventory').click();

  // Toucher l'objet posé le sélectionne : « Ranger » le met dans l'inventaire.
  await page.getByTestId('scene').click({ position: spot });
  await page.getByTestId('store-item').click();
  await expect(page.getByText('Plante verte : rangé dans l’inventaire.')).toBeVisible();
  await expect.poll(count).toBe(items);
  await expect(page.getByTestId('inventory-count')).toHaveText('1');

  await page.getByTestId('catalog-tab-inventory').click();
  await expect(page.getByTestId('inventory')).toContainText('1 en stock');
  const tooSmall = await page.evaluate(() =>
    [...document.querySelectorAll('.build-hud button')]
      .map((element) => element.getBoundingClientRect())
      .filter(({ width, height }) => width > 0 && (width < 44 || height < 44)),
  );
  expect(tooSmall).toEqual([]);
  const treasury = await page.getByTestId('build-money').textContent();
  await page.getByTestId('stored-plant').click();
  await expect(page.getByTestId('stock-count')).toContainText('Gratuit');
  await page.getByTestId('place').click();
  await expect.poll(count).toBe(items + 1);
  await expect(page.getByTestId('build-money')).toHaveText(treasury!);
  await expect(page.getByTestId('inventory')).toContainText('L’inventaire est vide');
});

test('mode construction : choisir l’écran des bureaux', async ({ page }) => {
  // Vignettes 3D des écrans redessinées en WebGL logiciel : plus lent sur les runners.
  test.slow();
  await startAsGuest(page);
  // Les écrans gaming sont au niveau 1 de la branche Tech de l'arbre R&D.
  await research(page, 'tech-1');
  await page.getByRole('button', { name: /Construction/ }).click();
  // Au garage, il n'y a que des bureaux IKEA (portable) : on pose un bureau de dev.
  await page.getByTestId('catalog-desk').click();
  await page.getByTestId('place').click();
  await page.getByRole('button', { name: /Annuler/ }).click();

  await page.getByTestId('catalog-tab-monitors').click();
  await expect(page.getByTestId('monitors')).toBeVisible();
  await expect(page.getByTestId('monitor-curved')).toContainText('Débloqué en');
  await page.getByTestId('monitor-gaming').click();
  await page.getByTestId('monitor-size-large').click();
  // Le bras articulé attend le niveau 2 de Tech.
  await expect(page.getByTestId('monitor-mount-arm')).toContainText('🔬');

  // Cibles tactiles de 44 px, rien ne déborde.
  const tooSmall = await page.evaluate(() =>
    [...document.querySelectorAll('.monitors-panel button')]
      .map((element) => element.getBoundingClientRect())
      .filter(({ width, height }) => width > 0 && (width < 44 || height < 44)),
  );
  expect(tooSmall).toEqual([]);

  const all = page.getByTestId('monitor-install-all');
  await expect(all).toContainText('Équiper 1 poste');
  await all.click();
  // Le bureau a son nouvel écran : plus rien à équiper.
  await expect(all).toBeDisabled();
  await expect(all).toContainText('Équiper 0 poste');
});

test('mode construction : peindre un mur, puis tous les murs', async ({ page }) => {
  await startAsGuest(page);
  // Les peintures sont au niveau 1 de la branche Ambiance de l'arbre R&D.
  await research(page, 'ambiance-1');
  await page.getByRole('button', { name: /Construction/ }).click();
  await page.getByTestId('catalog-family-layout').click();
  await page.getByTestId('catalog-tab-walls').click();
  await expect(page.getByTestId('walls')).toBeVisible();

  // Une peinture : le mur du fond de l'open space passe en bleu canard.
  await page.getByTestId('wall-finish-teal').click();
  await expect(page.getByTestId('wall-finish-teal')).toHaveAttribute('aria-pressed', 'true');
  const zone = page.getByTestId('wall-zone-back-open');
  await zone.click();
  // Le mur est couvert : le même revêtement n'y est plus proposé.
  await expect(zone).toBeDisabled();
  await expect(zone).toHaveAccessibleName(/déjà en Bleu canard/);

  // Les papiers peints attendent le niveau 2 d'Ambiance (en Seed).
  await expect(page.getByTestId('wall-finish-brick')).toContainText('🔬 R&D : Ambiance, niveau 2');
  // Une autre peinture sur tous les murs.
  await page.getByTestId('wall-finish-sage').click();
  await expect(zone).toBeEnabled();
  await page.getByTestId('wall-zone-all').click();
  await expect(page.getByTestId('wall-zone-left-open')).toBeDisabled();
  await expect(page.getByTestId('wall-zone-all')).toBeDisabled();

  const tooSmall = await page.evaluate(() =>
    [...document.querySelectorAll('.build-hud button')]
      .map((element) => element.getBoundingClientRect())
      .filter(({ width, height }) => width > 0 && (width < 44 || height < 44)),
  );
  expect(tooSmall).toEqual([]);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('mode construction : changer la matière et la couleur du sol', async ({ page }) => {
  test.slow();
  await startAsGuest(page);
  // Vinyle et moquette sont au niveau 1 de la branche Ambiance de l'arbre R&D.
  await research(page, 'ambiance-1');
  await page.getByRole('button', { name: /Construction/ }).click();
  await page.getByTestId('catalog-family-layout').click();
  await page.getByTestId('catalog-tab-floors').click();
  await expect(page.getByTestId('floors')).toBeVisible();

  // Une moquette bleu ardoise dans l'open space du garage.
  await page.getByTestId('floor-material-carpet').click();
  await expect(page.getByTestId('floor-material-carpet')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('floor-tint-slate').click();
  const zone = page.getByTestId('floor-zone-open');
  await zone.click();
  await expect(zone).toBeDisabled();
  await expect(zone).toHaveAccessibleName(/déjà en Moquette en dalles bleu ardoise/);

  // Une autre teinte de la même matière se pose à nouveau ; le parquet ne propose que du bois.
  await page.getByTestId('floor-tint-charcoal').click();
  await expect(zone).toBeEnabled();
  await page.getByTestId('floor-material-planks').click();
  await expect(page.getByTestId('floor-tint-charcoal')).toHaveCount(0);
  await expect(page.getByTestId('floor-tint-oak')).toBeVisible();
  // Matière pas encore débloquée au garage.
  await expect(page.getByTestId('floor-material-marble')).toContainText('Débloqué en Licorne');

  const tooSmall = await page.evaluate(() =>
    [...document.querySelectorAll('.build-hud button')]
      .map((element) => element.getBoundingClientRect())
      .filter(({ width, height }) => width > 0 && (width < 44 || height < 44)),
  );
  expect(tooSmall).toEqual([]);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
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

test('le panneau Business change le modèle économique', async ({ page }) => {
  await startAsGuest(page);
  await page.getByRole('button', { name: 'Business', exact: true }).click();
  await expect(page.getByTestId('pricing-current')).toContainText('Freemium');
  await page.getByTestId('pricing-model-SUBSCRIPTION').click();
  await expect(page.getByTestId('pricing-preview')).toBeVisible();
  await page.getByTestId('pricing-apply').click();
  await expect(page.getByTestId('pricing-current')).toContainText('Abonnement');
  // Un seul changement par sprint.
  await page.getByTestId('pricing-model-FREE_ADS').click();
  await expect(page.getByTestId('pricing-apply')).toBeDisabled();
});

test('le panneau Business signe un contrat avec un client B2B', async ({ page }) => {
  await startAsGuest(page);
  await page.getByRole('button', { name: 'Business', exact: true }).click();
  await page.getByTestId('business-tab-clients').click();
  await expect(page.getByTestId('clients-summary')).toContainText('0/1');
  await page.locator('[data-testid^="client-sign-"]').first().click();
  await expect(page.getByTestId('clients-summary')).toContainText('1/1');
  await expect(page.locator('[data-testid^="client-contract-"]')).toHaveCount(1);
});

test('le panneau Business embauche un agent de support', async ({ page }) => {
  await startAsGuest(page);
  await page.getByRole('button', { name: 'Business', exact: true }).click();
  await page.getByTestId('business-tab-support').click();
  const support = page.locator('.support-stepper');
  await expect(support).toContainText('0');
  await page.getByTestId('support-hire').click();
  await expect(support).toContainText('1');
  await expect(page.getByTestId('support-hire')).toBeDisabled();
  await page.getByTestId('support-fire').click();
  await expect(support).toContainText('0');
});

test('mode Carrière : choisir une légende, suivre ses jalons depuis le HUD', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('oss.language', 'fr');
    localStorage.setItem('oss.settings', JSON.stringify({ tutorialDone: true }));
  });
  await page.goto('/');
  await page.getByTestId('mode-CAREER').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Carrière' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Relever le défi' })).toHaveCount(8);
  // La page des légendes tient en largeur, sans défilement horizontal.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  await page.getByTestId('legend-pepin').getByRole('button', { name: 'Relever le défi' }).click();
  await expect(page.getByTestId('game')).toBeVisible();
  const career = page.getByRole('button', { name: /Carrière : 0 jalons tenus sur 4/ });
  await expect(career).toBeVisible();
  const box = await career.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(box?.height).toBeGreaterThanOrEqual(44);
  // Le cofondateur de la légende est là dès le garage.
  await expect.poll(async () => (await debug(page))?.characters ?? 0).toBe(2);

  await career.click();
  await expect(page.getByText('Pépin Computer')).toBeVisible();
  await expect(page.getByText('Échéance : démo du sprint 6')).toBeVisible();
});
