import { CardSetResponseSchema, type LoggedCommand } from '@oss/shared';
import { expect, test, type Page } from '@playwright/test';
import { CardLibrary, createBot, playWithBot, Simulation } from '../../src/simulation';

/** Compte unique par test : les parcours tournent en parallèle sur la même base. */
function uniqueAccount() {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return {
    email: `meta-${suffix}@startup.io`,
    pseudo: `meta_${suffix}`.slice(0, 24),
    password: 'ninja-du-code',
  };
}

async function register(page: Page) {
  const account = uniqueAccount();
  await page.getByRole('tab', { name: 'Inscription' }).click();
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel(/Pseudo/).fill(account.pseudo);
  await page.getByLabel(/Mot de passe/).fill(account.password);
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page.getByText(`Bienvenue, ${account.pseudo} !`)).toBeVisible();
  return account;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('oss.language', 'fr');
    localStorage.setItem('oss.settings', JSON.stringify({ tutorialDone: true }));
  });
  await page.goto('/');
});

test('un score publié apparaît au classement et se revoit en replay', async ({ page }) => {
  const account = await register(page);

  // Une partie complète jouée par un bot, avec les cartes servies par le serveur, comme le
  // ferait le navigateur. Le serveur la rejoue pour vérifier le score (anti-triche).
  const set = CardSetResponseSchema.parse(await (await page.request.get('/api/events')).json());
  const seed = `e2e-${account.pseudo}`;
  const cards = new CardLibrary(set.cards);
  const simulation = Simulation.create({ seed, mode: 'SHIP_IN_3' }, cards);
  playWithBot(simulation, createBot('balanced', seed), cards);
  const submit = await page.request.post('/api/scores', {
    data: {
      mode: 'SHIP_IN_3',
      seed,
      commands: simulation.commands as LoggedCommand[],
      cardsVersion: set.version,
    },
  });
  expect(submit.status()).toBe(201);

  await page.getByRole('button', { name: /Classements/ }).click();
  await page.getByRole('tab', { name: 'Défi 3 sprints' }).click();
  const row = page.getByRole('row', { name: new RegExp(account.pseudo) });
  await expect(row).toBeVisible();

  await row.getByRole('button', { name: `Revoir la partie de ${account.pseudo}` }).click();
  await expect(page.getByTestId('game')).toBeVisible();
  await expect(page.getByText(`Replay de ${account.pseudo}`).first()).toBeVisible();
});

test('sauvegarder une partie puis la recharger depuis le menu', async ({ page }) => {
  await page.getByTestId('mode-NORMAL').click();
  await expect(page.getByTestId('game')).toBeVisible();

  await page.getByRole('button', { name: /Sauvegardes/ }).click();
  await page.getByTestId('save-slot-2').getByRole('button', { name: 'Sauvegarder' }).click();
  await expect(page.getByText('Partie sauvegardée (emplacement 2).')).toBeVisible();
  await expect(page.getByTestId('save-slot-2')).toContainText('Normal');

  // Sur mobile le panneau couvre l'écran : on le ferme avant d'ouvrir les options.
  await page.getByRole('button', { name: 'Fermer' }).click();
  await page.getByRole('button', { name: /Options/ }).click();
  await page.getByRole('button', { name: 'Quitter la partie' }).click();
  await page.getByRole('button', { name: /Charger une partie/ }).click();
  await page.getByTestId('save-slot-2').getByRole('button', { name: 'Charger' }).click();
  await expect(page.getByTestId('game')).toBeVisible();
});

test('le profil d’un invité montre les succès à débloquer', async ({ page }) => {
  await page.getByRole('button', { name: /Profil/ }).click();
  await expect(page.getByRole('heading', { name: 'Profil' })).toBeVisible();
  await expect(page.getByTestId('achievement-black-friday')).toContainText('Vendredi Noir');
});
