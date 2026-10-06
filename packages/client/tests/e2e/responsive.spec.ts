import { expect, test } from '@playwright/test';

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

test('toutes les cibles tactiles font au moins 44 px', async ({ page }) => {
  await expect(page.getByRole('button', { name: /Se connecter|Log in/ })).toBeVisible();
  const tooSmall = await page.evaluate(() =>
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
  expect(tooSmall).toEqual([]);
});

test('navigation complète au clavier', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Pas de clavier physique sur mobile');
  await expect(page.getByRole('button', { name: /Se connecter|Log in/ })).toBeVisible();
  const focused: string[] = [];
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press('Tab');
    focused.push(await page.evaluate(() => document.activeElement?.tagName ?? ''));
  }
  expect(focused).toEqual(expect.arrayContaining(['BUTTON', 'INPUT']));
});
