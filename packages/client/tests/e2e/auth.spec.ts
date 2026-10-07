import { expect, test, type Page } from '@playwright/test';

/** Email unique par test : les parcours tournent en parallèle sur la même base. */
function uniqueAccount(testId: string) {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return {
    email: `e2e-${suffix}@startup.io`,
    pseudo: `e2e_${testId.slice(0, 6)}_${suffix}`.slice(0, 24),
    password: 'ninja-du-code',
  };
}

async function register(page: Page, account: ReturnType<typeof uniqueAccount>) {
  await page.getByRole('button', { name: /Connexion/ }).click();
  await page.getByRole('tab', { name: 'Inscription' }).click();
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel(/Pseudo/).fill(account.pseudo);
  await page.getByLabel(/Mot de passe/).fill(account.password);
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('oss.language', 'fr'));
  await page.goto('/');
});

test('inscription, déconnexion puis reconnexion', async ({ page }, testInfo) => {
  const account = uniqueAccount(testInfo.testId);

  await register(page, account);
  await expect(page.getByText(`Bienvenue, ${account.pseudo} !`)).toBeVisible();

  // La session survit au rechargement (cookies httpOnly).
  await page.reload();
  await expect(page.getByText(`Bienvenue, ${account.pseudo} !`)).toBeVisible();

  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await page.getByRole('button', { name: /Connexion/ }).click();
  await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible();

  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Mot de passe').fill(account.password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByText(`Bienvenue, ${account.pseudo} !`)).toBeVisible();
});

test('refuse un mauvais mot de passe', async ({ page }) => {
  await page.getByRole('button', { name: /Connexion/ }).click();
  await page.getByLabel('Email').fill('personne@startup.io');
  await page.getByLabel('Mot de passe').fill('mauvais-mot-de-passe');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('alert')).toHaveText('Email ou mot de passe incorrect.');
});

test('la langue choisie est enregistrée dans le profil', async ({ page }, testInfo) => {
  const account = uniqueAccount(testInfo.testId);
  await register(page, account);
  await expect(page.getByText(`Bienvenue, ${account.pseudo} !`)).toBeVisible();

  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.getByText(`Welcome, ${account.pseudo}!`)).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  // Nouveau navigateur en français : la langue du profil reprend le dessus à la connexion.
  await page.evaluate(() => localStorage.setItem('oss.language', 'fr'));
  await page.reload();
  await expect(page.getByText(`Welcome, ${account.pseudo}!`)).toBeVisible();
});
