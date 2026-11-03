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
  await expect(page.getByTestId('campaign-deadline')).toContainText('sprint 12');
  await expect(page.getByTestId('side-first-commit')).toContainText('Livrer 3 features');
  expect(errors).toEqual([]);
});

test('l’arbre R&D débloque le catalogue de l’histoire', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('oss.language', 'fr');
    localStorage.setItem('oss.settings', JSON.stringify({ tutorialDone: true }));
  });
  await page.goto('/');
  await page.getByTestId('mode-STORY').click();
  await page.getByTestId('campaign-start').click();
  await page.getByTestId('story-scene-skip').click();
  // Sur téléphone, le panneau de l'acte s'ouvre en plein écran : on le ferme d'abord.
  await expect(page.getByTestId('campaign-panel')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('campaign-panel')).toBeHidden();
  // Les règles du mode Histoire s'ouvrent dans le guide : sur tablette, il recouvre le panneau.
  const guide = page.getByTestId('guide');
  await expect(guide).toBeVisible();
  await guide.locator('.guide-minimize').click();
  await expect(guide).toBeHidden();

  await page.locator('[data-tutorial="panel-research"]').click();
  const panel = page.getByTestId('research-panel');
  await expect(panel).toBeVisible();
  await expect(page.getByTestId('research-points')).toContainText('4 points d’innovation');
  await expect(page.getByTestId('research-node-comfort-2')).toContainText('Niveau précédent');
  await page.getByTestId('research-take-comfort-1').click();
  await expect(page.getByTestId('research-node-comfort-1')).toContainText('Débloqué');
  await expect(page.getByTestId('research-points')).toContainText('0 points d’innovation');
  expect(errors).toEqual([]);
});
