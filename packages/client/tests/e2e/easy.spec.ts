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
  for (let step = 0; step < 9; step++) await next.click();
  await expect(guide.getByRole('heading', { name: 'Un sprint en 4 temps' })).toBeVisible();
  await next.click();

  // Étape interactive : ouvrir le Kanban la valide toute seule.
  await expect(guide.getByText(/À toi/)).toBeVisible();
  await page.locator('[data-tutorial="panel-kanban"]').click();
  await expect(guide.getByRole('heading', { name: 'Les colonnes' })).toBeVisible();
  expect(errors).toEqual([]);
});
