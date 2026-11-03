# Passation à Thomas : la moitié du travail en cours

> Écrit le 2 novembre 2026 à la demande de Melvin. Base : `develop` au commit `a77f906` (PR #144).
> Melvin garde l'autre moitié (abonnements, bureau, économie), listée en bas pour savoir quels
> fichiers éviter.

## Avant de commencer

```bash
git checkout develop
git pull origin develop
```

Puis lire, dans cet ordre : le haut de [`CONTEXTE.md`](../CONTEXTE.md) (travaux en cours, journal,
conventions), ce fichier, et [`ARBORESCENCE.md`](../ARBORESCENCE.md) pour trouver les fichiers.
`CLAUDE.md` est lu tout seul par Claude Code.

Règles habituelles : tout en français, **une demande = une branche = une PR vers `develop`**,
captures 1440 px et 375 px, CI verte, **validation de l'autre avant la fusion** (squash), jamais le
RNG de la partie pour une fonctionnalité annexe (graine à part), nouveaux champs d'état optionnels
ou par défaut, textes FR et EN, et mise à jour de `CLAUDE.md`, du README et de `CONTEXTE.md` à la
fin de chaque travail.

## Le partage en un coup d'œil

| #   | Tâche                                                   | Qui    | Dépend de                  |
| --- | ------------------------------------------------------- | ------ | -------------------------- |
| T1  | Remettre `main` dans `develop` (13 fichiers en conflit) | Thomas | rien, **à faire d'abord**  |
| T2  | Mode Histoire en une seule longue partie, avec rivaux   | Thomas | T1                         |
| T3  | Arbre de compétences des devs                           | Thomas | T1                         |
| T4  | Arbre R&D des objets                                    | Thomas | T2, fusion de #129 et #134 |
| T5  | Vie de l'équipe : congés, rétrospective, team building  | Thomas | T1                         |
| T6  | Mise en production `develop` → `main`                   | Thomas | tests des deux             |
| M1  | Fusionner les PR de docs #139, #140, #141               | Melvin | rien                       |
| M2  | Hall et sécurité (#134), internet et clim (#129)        | Melvin | M1                         |
| M3  | Économie : modèle économique, B2B, support, marketing   | Melvin | M2                         |
| M4  | « Décaféiné », sons, OAuth GitHub                       | Melvin | décisions en attente       |

Idées libres pour celui qui finit en premier (prévenir l'autre avant) : événements de la vie en
France (grève, canicule, coupure internet), bilan de fin de partie façon « Wrapped », mode photo.

### Fichiers à ne pas toucher sans prévenir Melvin

`packages/shared/src/sim/subscriptions.ts`, `serverRoom.ts`, `cleaning.ts`,
`packages/client/src/simulation/subscriptions.ts`, `serverRoom.ts`, `cleaning.ts`, `economy.ts`,
`packages/client/src/ui/subscriptions/`, `ui/servers/`, tout ce qui concerne le hall
(branche `claude/project-thread-aljkab`) et la salle des serveurs (branche
`claude/project-thread-k800kk`).

Fichiers communs aux deux moitiés (ajouts courts, intégrer `develop` souvent) :
`packages/client/src/i18n/fr.json` et `en.json`, `packages/shared/src/sim/state.ts`,
`packages/client/src/simulation/state.ts`, `packages/client/src/simulation/bots.ts`,
`view/types.ts`, `view/adapter.ts`, `CONTEXTE.md`, `CLAUDE.md`, `README.md`.

---

## T1. Remettre `main` dans `develop`

**État.** `main` a 5 PR qui ne sont pas dans `develop` : mode Carrière (#121), bouton « Nouvelle
partie » à côté de « Continuer » (#137), base de production sur Supabase (#138), client Vercel
branché sur Render (#142, #143). Un `git merge origin/main` dans `develop` donne 13 fichiers en
conflit : `CLAUDE.md`, `CONTEXTE.md`, `README.md`, `client/scripts/balance/index.ts`,
`client/src/simulation/state.ts`, `shared/src/sim/state.ts`, `ui/game.css`, `ui/game/Hud.tsx`,
`ui/game/StageScreens.tsx`, `ui/store/lifecycle.ts`, `view/adapter.ts`,
`tests/unit/meta/menu.test.tsx`, `shared/src/meta/achievements.ts`. C'est surtout le mode
Carrière face au mode illimité `ENDLESS` (#135) et à la difficulté par mode (#130).

**Branche.** Nouvelle branche depuis `develop`, par exemple `chore/main-dans-develop`.

**Prompt à coller dans Claude Code :**

```text
Lis CLAUDE.md, CONTEXTE.md et docs/PASSATION-THOMAS.md (tâche T1). Fais git pull sur develop et
main. Crée la branche chore/main-dans-develop depuis develop et fusionne origin/main dedans (merge
commit, pas de rebase). Résous les 13 conflits en gardant les deux côtés : le mode Carrière (CAREER,
état career, jalons, succès career-*) ET le mode illimité ENDLESS, la difficulté par mode
(difficultyOf), le classement des entreprises, le ménage et les abonnements. CAREER doit passer par
difficultyOf comme les autres modes et suivre GLOBAL_EXCLUDED_MODES si son classement n'est pas
comparable. Pour CLAUDE.md, README.md et CONTEXTE.md, garde toutes les entrées des deux côtés,
sans doublon. Vérifie pnpm lint, pnpm format:check, pnpm typecheck, pnpm test et pnpm balance
--games 2000 (Normal et Daily identiques à avant : compare une partie rejouée). Ouvre une PR vers
develop « chore: intègre main (Carrière, Supabase, Vercel) dans develop », avec la liste des
conflits et comment chacun est résolu. Attends la validation de Melvin avant de fusionner.
```

---

## T2. Mode Histoire en une seule longue partie, avec rivaux

**État.** Demandé par Melvin le 17 octobre, rien de codé. La proposition complète est dans
[`docs/proposition-mode-histoire.md`](proposition-mode-histoire.md) : « Ctrl+Alt+Fonder », une
seule partie en 5 actes (environ 60 sprints) contre un ancien chef qui a volé ton idée (Synergix),
puis Pivotly et Gigacorp (tous inventés), un panneau « Marché », la tour du rival dans la ville de
New York, deux fins, puis une Saison libre sans limite. Les 10 missions actuelles (#122) sont
recyclées comme objectifs d'actes.

**Questions encore ouvertes** (section 5 de la proposition). Melvin te laisse trancher ; réponses
recommandées : partir de la campagne de #122 ; arbre des devs seulement en Histoire et en Illimité ;
environ 60 sprints ; noms et synopsis tels quels. La Saison libre peut réutiliser le mode illimité
(`packages/shared/src/sim/endless.ts`). Dis à Melvin ce que tu as choisi dans la PR.

**Branche.** Nouvelle branche depuis `develop` après T1. Découper en plusieurs PR (proposition,
section 4) : socle en actes, rivaux, histoire et fins, équilibrage.

**Prompt à coller dans Claude Code :**

```text
Lis CLAUDE.md, CONTEXTE.md, docs/PASSATION-THOMAS.md (tâche T2) et
docs/proposition-mode-histoire.md. Fais git pull sur develop. Le mode Histoire actuel
(packages/shared/src/story/, packages/client/src/simulation/story.ts, packages/client/src/ui/story/)
est fait de 10 missions séparées. Transforme-le en une seule longue partie en 5 actes, comme dans
la proposition, en gardant l'infrastructure existante (mode STORY, state.unlocks, récompenses
vérifiées par le serveur, POST /api/story/complete) et les missions comme objectifs d'actes.
Réponses retenues aux questions de la section 5 : [à remplir]. Ajoute les 3 rivaux simulés sur une
graine à part (seed#rival#…), sans toucher au RNG de la partie, et la Saison libre en réutilisant
packages/shared/src/sim/endless.ts. Commence par un plan de découpage en PR (socle, rivaux,
histoire et fins, équilibrage) et attends ma validation avant de coder. Une PR par étape vers
develop, textes FR et EN, captures 1440 et 375 px, CI verte, validation de Melvin avant fusion.
```

---

## T3. Arbre de compétences des devs

**État.** Rien de codé. Les devs ont déjà de l'XP et un niveau (`employment.xp`,
`employment.level`, +5 % de vitesse par niveau). La proposition (section 2) donne 1 point par
niveau, 3 branches de 5 nœuds (Technique, Vitesse, Humain), un nœud par métier, des formations
payantes et une réinitialisation à un mois de salaire.

**Branche.** Nouvelle branche depuis `develop` après T1. Indépendante de T2 : les bonus passent par
les systèmes `work.ts`, `needs.ts`, `meetings.ts`, `incidents.ts`, pas par l'histoire.

**Prompt à coller dans Claude Code :**

```text
Lis CLAUDE.md, CONTEXTE.md, docs/PASSATION-THOMAS.md (tâche T3) et la section 2 de
docs/proposition-mode-histoire.md. Fais git pull sur develop. Ajoute l'arbre de compétences des
devs : 1 point par niveau gagné, 3 branches de 5 nœuds (Technique, Vitesse, Humain), un nœud de
métier par profil, formations payantes, réinitialisation à un mois de salaire. Constantes dans
packages/shared/src/sim/skills.ts, logique dans packages/client/src/simulation/skills.ts, bonus
appliqués dans les systèmes existants (work, needs, meetings, incidents), commande typée
(LEARN_SKILL…), champ d'état optionnel par dev, onglet « Compétences » dans la fiche du dev (lu
via GameView). Modes concernés : [Histoire et Illimité, ou tous sauf le Daily]. Aucun tirage :
Normal et Daily doivent rester identiques au bit près quand on n'utilise pas l'arbre. Ajoute un
choix de compétences aux bots de pnpm balance. Tests, textes FR et EN, captures 1440 et 375 px,
PR vers develop, validation de Melvin avant fusion.
```

---

## T4. Arbre R&D des objets

**État.** Rien de codé (proposition, section 3) : en Histoire, le catalogue démarre réduit et se
débloque par 6 branches (Confort, Tech, Ambiance, Cuisine, Organisation, Prestige) avec des
points d'innovation. Le verrou de phase et le champ `unlock` du catalogue existent déjà.

**Attention.** À lancer **après** la fusion de #129 (salle des serveurs) et #134 (hall) de Melvin,
qui ajoutent des objets au catalogue, et après le socle de T2.

**Prompt à coller dans Claude Code :**

```text
Lis CLAUDE.md, CONTEXTE.md, docs/PASSATION-THOMAS.md (tâche T4) et la section 3 de
docs/proposition-mode-histoire.md. Fais git pull sur develop et vérifie que les PR #129 et #134
sont fusionnées (sinon arrête-toi et préviens-moi). Ajoute l'arbre R&D des objets en mode Histoire :
points d'innovation gagnés en livrant des features, en réussissant les objectifs et en battant un
rival sur un sprint ; 6 branches de 4 niveaux ; chaque niveau demande aussi l'acte correspondant ;
le verrou de phase reste. Réutilise le mécanisme existant (champ unlock du catalogue,
shopStatus dans view/placement.ts, erreur LOCKED). Les autres modes ne changent pas. Aucun
tirage, champ d'état optionnel, écran « R&D » responsive, textes FR et EN, tests, captures 1440 et
375 px, PR vers develop, validation de Melvin avant fusion.
```

---

## T5. Vie de l'équipe : congés, rétrospective, team building

**État.** Idées n°4, 6 et 7 de la liste du 17 octobre, rien de codé, à faire en 3 PR :

- **Congés et arrêts maladie** : congés payés à poser, ponts de mai, arrêt maladie après un
  burn-out (moral à 0). Le dev est absent, comme le télétravail mais sans travailler.
- **Rétrospective de sprint** : après la démo, l'équipe vote pour une action d'amélioration qui
  donne un petit bonus au sprint suivant.
- **Team building** : afterwork, séminaire, escape game. Coûte de l'argent et une journée de
  travail, répare le moral et les conflits.

**Prompt à coller dans Claude Code (une PR par idée) :**

```text
Lis CLAUDE.md, CONTEXTE.md et docs/PASSATION-THOMAS.md (tâche T5). Fais git pull sur develop.
Ajoute [les congés et arrêts maladie | la rétrospective de sprint | le team building] comme
décrit dans la tâche T5. Commence par me proposer les règles (coûts, effets, durée) et attends ma
validation. Constantes dans packages/shared/src/sim/, logique dans
packages/client/src/simulation/, interface via GameView. Tout hasard sur une graine à part
(seed#<sujet>#…), champ d'état optionnel, Normal et Daily identiques si le joueur n'utilise pas la
fonctionnalité, ou explique pourquoi c'est impossible. Bot dans pnpm balance si c'est une décision,
textes FR et EN, tests, captures 1440 et 375 px, PR vers develop, validation de Melvin avant
fusion.
```

---

## T6. Mise en production `develop` → `main`

Quand T1 est fusionnée et que Melvin et toi avez testé `develop` : PR `develop` → `main` en merge
commit (pas squash). `main` se redéploie sur GitHub Pages et sur Vercel et Render.

---

## Pour info : la moitié de Melvin

- **M1** : PR de docs #139 (ARBORESCENCE dans CONTEXTE), #140 (toile du projecteur), #141
  (placement à la demi-case), CI verte, à fusionner.
- **M2** : PR #134 (hall d'entrée, accueil, sécurité sur le modèle des abonnements) à valider ;
  PR #129 (offres internet du Wi-Fi à la fibre, température des salles) à rebrancher sur les
  abonnements (#126) puis à fusionner.
- **M3** : idées n°1, 2, 3 et 5 : modèle économique du produit (gratuit, freemium, abonnement,
  prix), clients B2B et contrats avec SLA, support client et NPS, campagnes marketing.
- **M4** : succès « Décaféiné », fichiers d'effets sonores et d'ambiance, application GitHub OAuth.

Si une de tes PR doit toucher un fichier de cette liste, préviens Melvin avant.
