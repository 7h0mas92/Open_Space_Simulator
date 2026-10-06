import { expect, test } from '@playwright/test';

// Ce test a besoin du service worker, bloqué par défaut dans la configuration.
test.use({ serviceWorkers: 'allow' });

test('la PWA se lance et se joue hors ligne en invité', async ({ page, context, isMobile }) => {
  test.skip(isMobile, 'Un seul viewport suffit pour le cache hors ligne');
  await page.addInitScript(() => {
    localStorage.setItem('oss.language', 'fr');
    localStorage.setItem('oss.settings', JSON.stringify({ tutorialDone: true }));
  });
  await page.goto('/');
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);

  // On attend que le service worker ait mis le jeu en cache et contrôle la page.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);

  await context.setOffline(true);
  await page.reload();
  await page.getByTestId('mode-NORMAL').click();
  await expect(page.getByTestId('game')).toBeVisible();
  await expect(page.getByTestId('gauge-treasury')).toContainText('2');
});
