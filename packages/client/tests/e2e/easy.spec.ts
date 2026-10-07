import { expect, test } from '@playwright/test';

test('le mode Facile guide le joueur pas à pas, sur tous les écrans', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('oss.language', 'fr'));
  await page.goto('/');
  await page.getByTestId('mode-EASY').click();

  const guide = page.getByTestId('guide');
  await expect(guide.getByRole('heading', { name: 'Bienvenue, fondateur' })).toBeVisible();
  await expect(page.getByTestId('gauge-treasury')).toContainText('3');

  // Le tutoriel tient dans l'écran et ses boutons restent accessibles.
  const viewport = page.viewportSize()!;
  const box = (await guide.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  const next = guide.getByRole('button', { name: /^(Suivant|Terminer le chapitre)$/ });
  for (let step = 0; step < 9; step++) await next.click(); // 8 étapes de bases, 1 de règles
  await expect(guide.getByRole('heading', { name: 'Un sprint en 4 temps' })).toBeVisible();
  await next.click();

  // Étape interactive : ouvrir le Kanban la valide toute seule.
  await expect(guide.getByText(/À toi/)).toBeVisible();
  await page.locator('[data-tutorial="panel-kanban"]').click();
  await expect(guide.getByRole('heading', { name: 'Les colonnes' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('un joueur qui connaît le jeu ne revoit que les règles de son mode', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('oss.language', 'fr');
    localStorage.setItem('oss.settings', JSON.stringify({ tutorialDone: true }));
  });
  await page.goto('/');
  await page.getByTestId('mode-HARDCORE').click();
  const guide = page.getByTestId('guide');
  await expect(guide.getByRole('heading', { name: 'Le mode Hardcore' })).toBeVisible();
  await guide.getByRole('button', { name: 'Suivant' }).click();
  await expect(guide.getByRole('heading', { name: 'Les crises n’attendent pas' })).toBeVisible();
  await guide.getByRole('button', { name: 'Terminer le chapitre' }).click();
  await expect(guide).toBeHidden();
});
