import { expect, test } from '@playwright/test';

test('le mode Histoire ouvre la campagne, puis la première mission avec son briefing', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('oss.language', 'fr');
    localStorage.setItem('oss.settings', JSON.stringify({ tutorialDone: true }));
  });
  await page.goto('/');
  await page.getByTestId('mode-STORY').click();

  await expect(page.getByTestId('story-page')).toBeVisible();
  await page.getByTestId('story-tab-missions').click();
  await expect(page.getByTestId('mission-first-commit')).toContainText('À jouer');
  await expect(page.getByTestId('mission-coffee-first')).toContainText('Verrouillée');
  await expect(page.getByTestId('reward-wall-blueprint')).toContainText('Premier commit');

  await page.getByTestId('play-first-commit').click();
  const panel = page.getByTestId('mission-panel');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Livrer 3 features');
  await expect(panel).toContainText('sprint 1 sur 3');
  expect(errors).toEqual([]);
});

test('l’histoire en 5 actes commence au prologue, avec sa date limite', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('oss.language', 'fr');
    localStorage.setItem('oss.settings', JSON.stringify({ tutorialDone: true }));
  });
  await page.goto('/');
  await page.getByTestId('mode-STORY').click();

  await expect(page.getByTestId('story-page')).toContainText('Ctrl+Alt+Fonder');
  await expect(page.getByTestId('act-bell')).toContainText('La cloche');
  await page.getByTestId('campaign-start').click();
  // Scène du prologue : le temps est arrêté, les répliques défilent, puis les objectifs.
  const scene = page.getByTestId('story-scene');
  await expect(scene).toContainText('Synergix');
  await page.getByTestId('story-scene-next').click();
  await expect(scene).toContainText('Bastien Lemaître');
  await page.getByTestId('story-scene-skip').click();
  await expect(scene).toBeHidden();
  const panel = page.getByTestId('campaign-panel');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Le garage');
  await expect(page.getByTestId('campaign-deadline')).toContainText('sprint 8');
  await expect(page.getByTestId('side-first-commit')).toContainText('Livrer 3 features');
  expect(errors).toEqual([]);
});
