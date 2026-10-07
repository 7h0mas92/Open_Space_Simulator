import { expect, test, type Locator, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('aucun défilement horizontal', async ({ page }) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

/** Attend la fin de l'animation d'ouverture avant de mesurer. */
async function settled(locator: Locator) {
  await locator.evaluate((element) =>
    Promise.all(element.getAnimations().map((animation) => animation.finished)),
  );
}

async function tooSmallTargets(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('button, a, input')]
      .map((element) => {
        const { width, height } = element.getBoundingClientRect();
        return {
          label: element.textContent?.trim() || element.getAttribute('name'),
          width,
          height,
        };
      })
      .filter(({ width, height }) => width > 0 && (width < 44 || height < 44)),
  );
}

test('toutes les cibles tactiles font au moins 44 px', async ({ page }) => {
  await expect(page.getByTestId('mode-NORMAL')).toBeVisible();
  expect(await tooSmallTargets(page)).toEqual([]);
  // Fenêtre de connexion comprise.
  await page.getByRole('button', { name: /Connexion|Sign in/ }).click();
  await expect(page.getByRole('button', { name: /Se connecter|Log in/ })).toBeVisible();
  await settled(page.getByRole('dialog'));
  expect(await tooSmallTargets(page)).toEqual([]);
});

test('la fenêtre de connexion tient dans l’écran', async ({ page }) => {
  await page.getByRole('button', { name: /Connexion|Sign in/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await settled(dialog);
  const viewport = page.viewportSize()!;
  const box = (await dialog.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('navigation complète au clavier', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Pas de clavier physique sur mobile');
  await expect(page.getByTestId('mode-NORMAL')).toBeVisible();
  const tags = async (count: number) => {
    const focused: string[] = [];
    for (let i = 0; i < count; i++) {
      await page.keyboard.press('Tab');
      focused.push(await page.evaluate(() => document.activeElement?.tagName ?? ''));
    }
    return focused;
  };
  expect(await tags(20)).toContain('BUTTON');

  // La fenêtre de connexion s'ouvre au clavier et ses champs sont atteignables.
  await page.getByRole('button', { name: /Connexion|Sign in/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await tags(6)).toContain('INPUT');
});
