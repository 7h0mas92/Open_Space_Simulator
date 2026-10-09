import type { TradeTaskTemplate } from './tasks';

/**
 * Tâches des testeurs (recette) : chasse aux bugs (bugfix, +stabilité), tests automatisés
 * (refacto, −dette) et environnement de test (infra). Jamais de feature : un testeur ne livre
 * rien de nouveau, il empêche le reste de casser.
 */
export const QA_TASKS: readonly TradeTaskTemplate[] = [
  { title: ['Recette de la release du vendredi', 'Friday release QA pass'], type: 'BUGFIX' },
  {
    title: ['Tester le paiement avec une carte expirée', 'Test checkout with an expired card'],
    type: 'BUGFIX',
  },
  {
    title: ['Tests de non-régression (encore)', 'Regression tests (again)'],
    type: 'BUGFIX',
  },
  {
    title: ['Saisir « 🦄 » dans tous les champs', 'Type "🦄" in every form field'],
    type: 'BUGFIX',
  },
  {
    title: ['Tester sur un vieil Android de 2016', 'Test on a 2016 Android phone'],
    type: 'BUGFIX',
  },
  {
    title: ['Écrire les tests end-to-end du parcours', 'Write end-to-end tests for the flow'],
    type: 'REFACTO',
  },
  {
    title: ['Supprimer les tests qui clignotent', 'Fix the flaky tests'],
    type: 'REFACTO',
  },
  {
    title: ['Plan de test de 40 pages', '40-page test plan'],
    type: 'REFACTO',
  },
  {
    title: ['Base de données de test réaliste', 'Realistic test database'],
    type: 'INFRA',
  },
  {
    title: ['Brancher les tests dans la CI', 'Plug the tests into CI'],
    type: 'INFRA',
  },
  {
    title: ['Ouvrir 37 tickets « ça marche pas »', 'File 37 "it doesn’t work" tickets'],
    type: 'BUGFIX',
  },
  {
    title: ['Test de charge : 10 000 faux clients', 'Load test: 10,000 fake customers'],
    type: 'INFRA',
  },
];
