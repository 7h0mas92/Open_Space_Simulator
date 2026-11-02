/**
 * Modèle de vue : ce que le rendu (`render/`) et l'interface (`ui/`) lisent.
 *
 * C'est la frontière entre la simulation et l'affichage. La simulation (`simulation/`, dans le
 * Web Worker) produit un `GameState` ; `view/adapter.ts` le convertit en `GameView`, un objet
 * plus simple à afficher (noms des colonnes, activités, heure de la journée…).
 *
 * Règle : ces objets sont des instantanés en lecture seule. Le rendu ne les modifie jamais ;
 * l'interface envoie des `GameCommand` pour demander un changement.
 */
import type {
  MissionGoal,
  StoryMissionId,
  StoryRewardId,
  AcquisitionOffer,
  FloorFinish,
  FloorMaterialId,
  FloorZone,
  ComputerId,
  CleanerTool,
  CleaningPlanId,
  PriceTier,
  PricingModel,
  ServerRoomNeed,
  SubscriptionRequirement,
  SubscriptionService,
  WallFinishId,
  WallZone,
  Birthday,
  CalendarDate,
  DecorTheme,
  DevSpecialty,
  DevStack,
  DevTrait,
  FinancingBlocker,
  FinancingKind,
  FurnitureColor,
  GameMode,
  GameResult,
  LocalizedText,
  MeetingFormatId,
  MonitorChoice,
  PetCoat,
  PetNeed,
  NotificationKind,
  Phase,
  PitchCategory,
  PitchResult,
  VentureRisk,
  VentureStatus,
  SprintObjective,
  SprintReport,
  Speed,
  TaskKind,
  TaskStack,
  TaskTrade,
} from '@oss/shared';

/**
 * Les 8 profils de développeurs du cahier des charges, puis les métiers de l'équipe web
 * (front, back, fullstack, tech lead, DevOps, testeur, scrum master, manager, sous-directeur,
 * directeur technique).
 */
export const DEV_ROLES = [
  'SENIOR_BEARD',
  'TEN_X',
  'INTERN',
  'RUSTACEAN',
  'DESIGNER',
  'PRODUCT_OWNER',
  'AI_AGENT',
  'GHOST',
  'FRONTEND',
  'BACKEND',
  'FULLSTACK',
  'TECH_LEAD',
  'DEVOPS',
  'QA_TESTER',
  'SCRUM_MASTER',
  'MANAGER',
  'DEPUTY_DIRECTOR',
  'DIRECTOR',
] as const;
export type DevRole = (typeof DEV_ROLES)[number];

/** Ce que fait un personnage ; pilote son comportement et son animation dans la scène. */
export const DEV_ACTIVITIES = [
  'WORKING',
  'COFFEE',
  'MEETING',
  'CHATTING',
  'ARGUING',
  'SLEEPING',
  'YELLING',
  'BABYFOOT',
  'BREAK',
  'LUNCH',
  'LEAVING',
  'REMOTE',
] as const;
export type DevActivity = (typeof DEV_ACTIVITIES)[number];

/** Pourquoi un dev télétravaille aujourd'hui (le télétravail est décidé par la simulation). */
export const REMOTE_REASONS = ['GHOST', 'FATIGUE', 'CONFLICT', 'NO_COFFEE', 'NO_DESK'] as const;
export type RemoteReason = (typeof REMOTE_REASONS)[number];

export const GAUGES = ['treasury', 'coffee', 'debt', 'stability', 'hype', 'users'] as const;
export type GaugeName = (typeof GAUGES)[number];
export type Gauges = Readonly<Record<GaugeName, number>>;

export interface DevStats {
  readonly speed: number;
  readonly quality: number;
  readonly endurance: number;
  readonly ego: number;
}

/** Note de performance globale, de S (excellent) à D (à la peine). */
export const PERFORMANCE_GRADES = ['S', 'A', 'B', 'C', 'D'] as const;
export type PerformanceGrade = (typeof PERFORMANCE_GRADES)[number];

/** Ce qu'un dev a produit pendant un sprint. */
export interface SprintPerformanceView {
  readonly sprint: number;
  /** Productivité en % d'un dev standard, ou null s'il n'a pas eu de tâche. */
  readonly productivity: number | null;
  /** Qualité moyenne du travail (0 à 1), ou null s'il n'a rien produit. */
  readonly quality: number | null;
  /** Points de tâches terminées. */
  readonly points: number;
  readonly tasks: number;
  /** Heures passées sur une tâche. */
  readonly hours: number;
  /** Pannes de prod provoquées. */
  readonly incidents: number;
  /** Sprint perdu (carte « sprintsLost ») : personne n'a rien produit. */
  readonly lost: boolean;
}

export interface PerformanceView {
  /** Performance globale de 0 à 100. */
  readonly score: number;
  readonly grade: PerformanceGrade;
  /** Vrai tant qu'aucun sprint terminé ne permet de la mesurer : elle vient du profil. */
  readonly estimated: boolean;
  /** Productivité retenue pour la note, en % d'un dev standard. */
  readonly productivity: number;
  /** Qualité retenue pour la note, de 0 à 1. */
  readonly quality: number;
  /** Productivité et qualité attendues d'après le profil (stats, rôle, niveau, trait). */
  readonly expectedProductivity: number;
  readonly expectedQuality: number;
  /** Pannes provoquées pendant les 2 derniers sprints. */
  readonly incidents: number;
  /** Les 2 derniers sprints terminés, du plus récent au plus ancien (0 à 2 éléments). */
  readonly lastSprints: readonly SprintPerformanceView[];
  /** Sprint en cours (null pour un candidat). */
  readonly current: SprintPerformanceView | null;
}

/** Carrière d'un dev dans l'entreprise. */
export interface CareerView {
  /** Sprint d'arrivée dans l'équipe. */
  readonly hiredAtSprint: number;
  /** Sprints passés dans l'équipe (le sprint d'arrivée compte). */
  readonly sprintsInTeam: number;
  /** Expérience accumulée vers le prochain niveau, et expérience nécessaire. */
  readonly xp: number;
  readonly xpToNext: number;
  /** Tâches terminées depuis l'arrivée. */
  readonly tasksDone: number;
  /** Tâche en cours, ou null. */
  readonly currentTask: LocalizedText | null;
}

export interface DevView {
  readonly id: string;
  readonly name: string;
  readonly age: number;
  readonly role: DevRole;
  /** Métier (code, design, produit, recette) : les tâches qu'il prend tout seul (null : aucune). */
  readonly trade: TaskTrade | null;
  /** Côté de la stack (front, back, les deux), ou null pour les profils sans côté. */
  readonly stack: DevStack | null;
  /** Spécialité d'un dev front, back ou DevOps (React, bases de données...), sinon null. */
  readonly specialty: DevSpecialty | null;
  /** Trait de personnalité (traduit par i18n : `traits.<trait>`). */
  readonly trait: DevTrait;
  /** Mini-bio drôle, dans les deux langues. */
  readonly bio: LocalizedText;
  readonly stats: DevStats;
  /** Salaire mensuel en euros. */
  readonly salary: number;
  readonly level: number;
  /** Moral de 0 à 100. */
  readonly morale: number;
  /** Énergie de 0 à 100. */
  readonly energy: number;
  readonly activity: DevActivity;
  /** Raison du télétravail du jour, ou null si le dev vient au bureau. */
  readonly remoteReason: RemoteReason | null;
  /** Affinité avec chaque collègue, de -100 (conflit) à +100. */
  readonly relations: Readonly<Record<string, number>>;
  /** Faits marquants, du plus récent au plus ancien. */
  readonly history: readonly { readonly sprint: number; readonly text: LocalizedText }[];
  /** Tirage du look (0 à 17), interprété selon le profil par `render/officeCharacters.ts`. */
  readonly look: number;
  /** Date d'anniversaire (jour et mois). */
  readonly birthday: Birthday;
  /** Performance globale et productivité par sprint. */
  readonly performance: PerformanceView;
  /** Ancienneté, expérience, tâches (null pour un candidat). */
  readonly career: CareerView | null;
  /** A démissionné après un refus d'augmentation : sprint de son départ, sinon null. */
  readonly leavingAtSprint: number | null;
}

export const TASK_TYPES = ['FEATURE', 'REFACTOR', 'BUGFIX', 'INFRA'] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const KANBAN_COLUMNS = ['BACKLOG', 'TODO', 'DOING', 'DONE'] as const;
export type KanbanColumn = (typeof KANBAN_COLUMNS)[number];

export interface TaskView {
  readonly id: string;
  readonly title: LocalizedText;
  readonly type: TaskType;
  /** Métier : seuls ses membres la prennent d'eux-mêmes (le joueur peut la confier à tous). */
  readonly trade: TaskTrade;
  /** Côté d'une tâche de code (front ou back), null pour les autres métiers. */
  readonly stack: TaskStack | null;
  /** Taille en points (1, 2, 3, 5, 8). */
  readonly size: number;
  readonly column: KanbanColumn;
  readonly assigneeId: string | null;
  /** Avancement de 0 à 1. */
  readonly progress: number;
  /** Sens de l'effet attendu sur les jauges (+1 ou -1), affiché sur la carte. */
  readonly impact: Partial<Gauges>;
  /** Feature hallucinée par l'IA Agent : livrée, mais elle n'existe pas. */
  readonly hallucinated: boolean;
  /** Tâche urgente ou hebdomadaire (null : tâche ordinaire). */
  readonly kind: TaskKind | null;
  /** Échéance d'une tâche spéciale : jour de la semaine (1 = lundi) et heure. */
  readonly due: { readonly dayOfWeek: number; readonly hour: number } | null;
  /** Heures simulées avant l'échéance (null sans échéance). */
  readonly hoursLeft: number | null;
}

/** Objectif du sprint en cours, avec la valeur atteinte jusqu'ici. */
export interface ObjectiveView {
  readonly kind: SprintObjective['kind'];
  readonly difficulty: SprintObjective['difficulty'];
  readonly target: number;
  readonly value: number;
  /** Vrai si la cible est atteinte à cet instant (pour « aucune panne » : pas encore de panne). */
  readonly reached: boolean;
  readonly reward: SprintObjective['reward'];
}

/** Effets de l'encadrement (directeur, managers, scrum master, tech lead, testeurs, DevOps). */
export interface LeadershipView {
  /** Bonus de productivité de toute l'équipe, en % (0 sans encadrement). */
  readonly productivity: number;
  /** Part de l'équipe encadrée par un manager, en %. */
  readonly coverage: number;
  /** Les réunions du Product Owner pèsent moitié moins (scrum master). */
  readonly lighterMeetings: boolean;
  /** Dette en moins sur les features livrées (tech lead, testeurs), en %. */
  readonly featureDebtCut: number;
  /** Stabilité gagnée chaque jour (DevOps). */
  readonly dailyStability: number;
  /** Moral gagné chaque jour par chacun (sous-directeur, managers). */
  readonly dailyMoral: number;
  /** Postes d'encadrement et de qualité encore ouverts (testeur, manager, directeur...). */
  readonly openings: readonly DevRole[];
}

export interface CandidateView {
  readonly id: string;
  readonly dev: DevView;
  /** Salaire demandé. */
  readonly askingSalary: number;
  /** Salaire de référence de son profil sur le marché. */
  readonly marketSalary: number;
}

/** Rotation d'un objet posé, en quarts de tour. */
export type Rotation = 0 | 1 | 2 | 3;

export interface PlacedItemView {
  readonly id: string;
  /** Identifiant du catalogue (voir `view/catalog.ts`). */
  readonly kind: string;
  readonly x: number;
  readonly z: number;
  readonly rotation: Rotation;
  /** Somme remboursée à la revente. */
  readonly resale: number;
  /** Couleur choisie (`natural` : couleurs d'origine du modèle). */
  readonly color: FurnitureColor;
  /** Accessoire : le meuble qui le porte et l'emplacement occupé, sinon `null`. */
  readonly host: ItemHost | null;
  /**
   * Poste de travail (bureau de dev, bureau debout) : l'écran posé dessus, celui livré avec le
   * bureau s'il n'a jamais été changé. Absent pour les autres objets.
   */
  readonly monitor?: MonitorChoice;
  /** Projecteur allumé (absent : éteint, ou objet sans interrupteur). */
  readonly on?: boolean;
  /** Bureau : son ordinateur (tour ou portable), absent pour les autres objets. */
  readonly computer?: ComputerId;
  /**
   * Décor offert avec une annexe (borne d'arcade, arbre, scène…) : sa clé. Il se déplace et se
   * tourne, mais ne se vend, ne se range ni ne se repeint, et n'a aucun effet. Absent pour le
   * mobilier acheté.
   */
  readonly annexDecor?: string;
}

/** Un projecteur allumé et l'écran qu'il a déroulé (voir `@oss/shared`, `projection.ts`). */
export interface ProjectionView {
  /** Identifiant de l'objet posé du projecteur. */
  readonly projector: string;
  /** Identifiant de l'objet posé de l'écran déroulé. */
  readonly screen: string;
}

/**
 * Pile d'objets rangés dans l'inventaire (la réserve du mode construction) : même type et même
 * couleur, dans l'ordre où ils ont été rangés pour la première fois.
 */
export interface StoredItemView {
  readonly kind: string;
  readonly color: FurnitureColor;
  readonly count: number;
  /** Somme remboursée à la revente du premier exemplaire de la pile. */
  readonly resale: number;
}

/** Emplacement d'un accessoire sur le plateau d'un meuble. */
export interface ItemHost {
  readonly id: string;
  readonly slot: number;
}

export interface GameTime {
  /** Sprint courant, de 1 à 39. */
  readonly sprint: number;
  readonly totalSprints: number;
  /** Jour dans le sprint, de 0 à 13 (lundi = 0, samedi = 5, lundi suivant = 7). */
  readonly day: number;
  /** Minute de la journée, de 0 à 1439. */
  readonly minute: number;
  readonly speed: Speed;
  /**
   * Durée réelle du tick en cours, en ms (Infinity quand le temps est arrêté). La simulation
   * avance par pas de 30 minutes ; l'affichage s'en sert pour faire défiler l'horloge en continu.
   */
  readonly tickMs: number;
  /** Instant (performance.now) où ce snapshot a été reçu : début du tick en cours. */
  readonly syncedAt: number;
}

export const SPRINT_STEPS = ['PLANNING', 'EXECUTION', 'DEMO', 'PITCH', 'ENDED'] as const;
export type SprintStep = (typeof SPRINT_STEPS)[number];

/** Carte d'événement affichée : la partie attend le choix du joueur. */
export interface EventView {
  readonly cardId: string;
  readonly title: LocalizedText;
  readonly description: LocalizedText;
  /** Niveau d'aggravation (0 au premier tirage, +1 à chaque « On en reparle »). */
  readonly level: number;
  readonly choices: readonly {
    readonly label: LocalizedText;
    /** Effets chiffrés sur les jauges, pour aider le joueur à choisir. */
    readonly effects: Partial<Record<GaugeName | 'moral', number>>;
  }[];
}

/** Argument proposé (ou déjà avancé) pendant un pitch. */
export interface PitchArgumentView {
  readonly id: string;
  readonly label: LocalizedText;
  readonly category: PitchCategory;
  /** Bluff : rapporte gros s'il passe, coûte cher s'il est démasqué. */
  readonly bluff: boolean;
}

/** Réponse déjà donnée, avec la réaction de l'investisseur. */
export interface PitchAnswerView extends PitchArgumentView {
  readonly reaction: 'good' | 'neutral' | 'bad';
  /** La réponse ne correspondait pas à la question posée. */
  readonly offTopic: boolean;
  readonly bluffCaught: boolean;
}

export interface PitchView {
  readonly investor: { readonly name: LocalizedText; readonly intro: LocalizedText };
  /** Nom du tour de table (Seed, Série A, Série B…) et sa difficulté (0 = le plus simple). */
  readonly roundName: LocalizedText;
  readonly tier: number;
  readonly tiers: number;
  /** Manche en cours (à partir de 0) et nombre de manches. */
  readonly round: number;
  readonly rounds: number;
  /** Question de l'investisseur à cette manche. */
  readonly question: { readonly text: LocalizedText; readonly category: PitchCategory } | null;
  readonly options: readonly PitchArgumentView[];
  readonly chosen: readonly PitchAnswerView[];
  /** Intérêt de l'investisseur (0 à 1) : sa probabilité actuelle de signer. */
  readonly interest: number;
  /** L'investisseur est parti avant la fin. */
  readonly walkedOut: boolean;
  readonly result: PitchResult | null;
}

/** Offre de financement hors tour de table (business angels, prêt, crowdfunding, subvention). */
export interface FinancingOfferView {
  readonly kind: FinancingKind;
  readonly amount: number;
  readonly blocker: FinancingBlocker | null;
  readonly nextSprint: number | null;
  readonly dilution: number;
  readonly monthly: number;
  readonly months: number;
}

/** Tout ce qui concerne l'argent levé : prochain tour, autres financements, prêt, annexes. */
export interface FundingView {
  /** Prochain tour de table (pitch) : nom, difficulté et nombre de questions. */
  readonly nextRound: {
    readonly name: LocalizedText;
    readonly tier: number;
    readonly manches: number;
    readonly options: number;
  };
  readonly tiers: number;
  /** Sprint à partir duquel on pourra repitcher (cooldown), sinon null. */
  readonly nextPitchSprint: number | null;
  readonly offers: readonly FinancingOfferView[];
  readonly loan: { readonly remaining: number; readonly monthly: number } | null;
  /** Tours de table réussis et total levé (tours, business angels, crowdfunding). */
  readonly rounds: number;
  readonly totalRaised: number;
  /** Annexes du bureau ouvertes par les tours de table (à partir de la Série B). */
  readonly annexes: number;
  readonly maxAnnexes: number;
}

/** Projet de filiale proposé pendant la planification. */
export interface VentureOfferView {
  readonly id: string;
  readonly icon: string;
  readonly name: LocalizedText;
  readonly pitch: LocalizedText;
  readonly risk: VentureRisk;
  readonly cost: number;
  /** Assez de trésorerie (en gardant quelques mois de salaires) pour ce projet. */
  readonly affordable: boolean;
}

/** Filiale du groupe. */
export interface VentureView {
  readonly id: string;
  readonly icon: string;
  readonly name: LocalizedText;
  readonly risk: VentureRisk;
  readonly status: VentureStatus;
  readonly invested: number;
  readonly stake: number;
  readonly valuation: number;
  /** Valeur de nos parts (valorisation × part détenue). */
  readonly stakeValue: number;
  readonly dividends: number;
  readonly salePrice: number;
  readonly soldFor: number | null;
  readonly foundedAtSprint: number;
  readonly history: readonly number[];
}

/** Demande d'augmentation d'un dev : la planification attend la réponse du joueur. */
export interface RaiseRequestView {
  readonly devId: string;
  readonly currentSalary: number;
  readonly requestedSalary: number;
  /** Accepté : moral gagné et nombre de compétences qui progressent. */
  readonly acceptMoral: number;
  readonly skillsGained: number;
  /** Refusé : probabilité de démission (0 à 1), sinon compétences perdues. */
  readonly resignChance: number;
  readonly skillsLost: number;
  /** Planifications avant le départ d'un dev qui démissionne. */
  readonly noticeSprints: number;
}

/** Le groupe : filiales, projets du sprint, et ce qui empêche d'en créer. */
export interface GroupView {
  /** Débloqué à partir de la Série A. */
  readonly unlocked: boolean;
  /** Raison pour laquelle on ne peut pas créer de filiale maintenant, sinon null. */
  readonly blocker: 'LOCKED' | 'WRONG_STAGE' | 'VENTURE_LIMIT' | 'TOO_LATE' | 'COOLDOWN' | null;
  /** Sprint à partir duquel on pourra recréer une filiale (cooldown), sinon null. */
  readonly nextSprint: number | null;
  readonly offers: readonly VentureOfferView[];
  readonly ventures: readonly VentureView[];
  /** Ailes ajoutées au bureau (une par filiale fondée). */
  readonly wings: number;
  readonly maxVentures: number;
  /** Trésorerie investissable (on garde toujours quelques mois de salaires). */
  readonly investable: number;
  /** Valeur des parts dans les filiales actives, comprise dans la valorisation. */
  readonly portfolio: number;
}

/** Une formule d'aménagement de la salle de réunion. */
export interface MeetingFormatView {
  readonly id: MeetingFormatId;
  readonly icon: string;
  readonly name: LocalizedText;
  readonly bonus: LocalizedText;
  readonly malus: LocalizedText;
  readonly price: number;
  readonly minPhase: Phase;
  /** Chance que la réunion d'équipe du matin soit utile (0 à 1). */
  readonly usefulOdds: number;
  /** Réunion de crise : part de « Réparer la prod » faite en sortant de la salle (0 à 1). */
  readonly crisisHeadStart: number;
  /** Pourquoi on ne peut pas la choisir maintenant, sinon null. */
  readonly blocker: 'LOCKED' | 'WRONG_STAGE' | 'NOT_ELIGIBLE' | 'NOT_ENOUGH_MONEY' | null;
}

/** La salle de réunion : son aménagement et le bilan de ses réunions. */
export interface MeetingRoomView {
  /** Le bureau a une salle de réunion (à partir de la Seed). */
  readonly unlocked: boolean;
  /** Formule choisie, ou null si la salle est vide. */
  readonly format: MeetingFormatId | null;
  /** Somme rendue si l'on démonte l'aménagement actuel. */
  readonly refund: number;
  readonly formats: readonly MeetingFormatView[];
  readonly useful: number;
  readonly useless: number;
  /** Réunions de crise tenues quand la prod est tombée. */
  readonly crisis: number;
  /** Dernier Daily tenu (point sur les tickets), null si aucun. */
  readonly daily: DailyView | null;
  /** Tickets en partie recodés pour rien, faute de Daily (travail en double). */
  readonly duplicates: number;
  /** Dernières réunions (du matin ou de crise), de la plus récente à la plus ancienne. */
  readonly recent: readonly {
    readonly tick: number;
    readonly useful: boolean;
    readonly crisis: boolean;
    readonly text: LocalizedText;
  }[];
}

/** Le point d'un participant du Daily sur son ticket. */
export interface DailyEntryView {
  readonly devId: string;
  readonly taskId: string;
  /** Avancement au Daily (0 à 1), et au Daily précédent si le ticket y était déjà. */
  readonly progress: number;
  readonly before: number | null;
}

/** Le Daily du matin : qui y était, utile ou non, et le point de chacun sur son ticket. */
export interface DailyView {
  readonly tick: number;
  /** Tenu aujourd'hui (le bonus de concentration court jusqu'au soir). */
  readonly today: boolean;
  /** La réunion se tient en ce moment : le projecteur de la salle affiche l'appli de tickets. */
  readonly live: boolean;
  readonly useful: boolean;
  /** Bonus de productivité des participants jusqu'au soir, en % (0 si inutile ou passé). */
  readonly focus: number;
  readonly attendees: readonly string[];
  readonly entries: readonly DailyEntryView[];
}

/** Un chat du bureau. */
export interface PetView {
  /** Identifiant stable : sert aussi de graine à son animation. */
  readonly id: string;
  readonly name: string;
  readonly coat: PetCoat;
  readonly adoptedSprint: number;
}

/** Les chats du bureau et ce qu'il faut pour en adopter un. */
export interface PetsView {
  readonly pets: readonly PetView[];
  readonly max: number;
  readonly price: number;
  /** Équipement posé dans l'open space : litière, gamelle, arbre à chat. */
  readonly needs: Readonly<Record<PetNeed, boolean>>;
  /** Tout l'équipement est posé : les chats sont heureux (sinon ils boudent). */
  readonly happy: boolean;
  /** Pourquoi on ne peut pas adopter maintenant, sinon null. */
  readonly blocker: 'LOCKED' | 'NOT_ELIGIBLE' | 'NOT_ENOUGH_MONEY' | 'WRONG_STAGE' | null;
}

/** Une salle des serveurs posée et ce qui lui manque pour tourner. */
export interface ServerRoomView {
  readonly id: string;
  readonly kind: string;
  /** Serveur, réseau et climatisation installés : son matériel donne ses effets. */
  readonly running: boolean;
  /** Ce qu'il faut encore y installer pour qu'elle tourne. */
  readonly missing: readonly ServerRoomNeed[];
  /** Équipements installés, sur le nombre d'emplacements. */
  readonly gear: number;
  readonly slots: number;
}

/** Salles des serveurs (l'abonnement fibre est dans `GameView.subscriptions`). */
export interface ServersView {
  readonly rooms: readonly ServerRoomView[];
  /** Part de la facture d'hébergement épargnée grâce aux serveurs (0.18 = -18 %). */
  readonly hostingSaving: number;
  readonly hostingSavingMax: number;
  /** Une box fibre est posée dans une salle des serveurs. */
  readonly hasBox: boolean;
}

/**
 * Pourquoi on ne peut pas souscrire à une offre maintenant. `CURRENT` : c'est l'offre en cours ;
 * `REQUIREMENT` : l'installation demandée (`requires`) manque.
 */
export type SubscriptionBlocker =
  'LOCKED' | 'NOT_ENOUGH_MONEY' | 'REQUIREMENT' | 'CURRENT' | 'WRONG_STAGE' | null;

/** Une offre d'abonnement. */
export interface SubscriptionOfferView {
  readonly id: string;
  readonly service: SubscriptionService;
  readonly name: LocalizedText;
  readonly description: LocalizedText;
  readonly detail: LocalizedText | null;
  /** Prix d'une période, et sa durée en jours de jeu. */
  readonly price: number;
  readonly periodDays: number;
  readonly minPhase: Phase;
  readonly requires: SubscriptionRequirement | null;
  readonly blocker: SubscriptionBlocker;
}

/** L'abonnement en cours d'un service. */
export interface CurrentSubscriptionView {
  readonly offer: SubscriptionOfferView;
  /** L'installation demandée est là : ses effets comptent (sinon il est payé pour rien). */
  readonly active: boolean;
  /** Jours de jeu avant le prochain prélèvement. */
  readonly nextBillDays: number;
  /** Sprint de la souscription. */
  readonly since: number;
  readonly totalPaid: number;
  /** Coût ramené à 30 jours de jeu. */
  readonly monthly: number;
}

/** Un service (internet, ménage…), son abonnement en cours et ses offres. */
export interface SubscriptionServiceView {
  readonly id: SubscriptionService;
  readonly icon: string;
  readonly current: CurrentSubscriptionView | null;
  readonly offers: readonly SubscriptionOfferView[];
}

/** Rubrique « Abonnements ». */
export interface SubscriptionsView {
  readonly services: readonly SubscriptionServiceView[];
  /** Nombre d'abonnements en cours. */
  readonly count: number;
  /** Total des abonnements ramené à 30 jours de jeu. */
  readonly monthlyTotal: number;
}

/** Une formule d'abonnement de ménage, son prix pour le bureau actuel et ce qui bloque. */
export interface CleaningPlanView {
  readonly id: CleaningPlanId;
  readonly name: LocalizedText;
  readonly description: LocalizedText;
  /** Jours de passage, de 1 (lundi) à 5 (vendredi). */
  readonly days: readonly number[];
  readonly weeklyPrice: number;
  /** Remise par rapport au prix d'un passage (0.25 = -25 %). */
  readonly discount: number;
  /** `CURRENT` : c'est la formule en cours. */
  readonly blocker: 'NOT_ENOUGH_MONEY' | 'CURRENT' | 'WRONG_STAGE' | null;
}

/** Saleté du bureau et entreprise de nettoyage. */
export interface CleaningView {
  /** Saleté de 0 à 100 %. */
  readonly dirt: number;
  /** Seuil d'alerte (%). */
  readonly alert: number;
  /** Part du travail gardée par un dev présent au bureau (0.8 = -20 %). */
  readonly productivity: number;
  /** Jours de semaine sans ménage (la saleté monte de plus en plus vite). */
  readonly daysSinceClean: number;
  /** Ménage en cours : avancement de 0 à 1. */
  readonly visit: { readonly express: boolean; readonly progress: number } | null;
  /** Appel réservé : dans combien d'heures de jeu l'équipe arrive. */
  readonly booking: { readonly express: boolean; readonly inHours: number } | null;
  readonly plan: {
    readonly plan: CleaningPlanId;
    readonly weeklyPrice: number;
    /** Jours de jeu avant le prochain prélèvement. */
    readonly nextBillDays: number;
    readonly totalPaid: number;
  } | null;
  readonly plans: readonly CleaningPlanView[];
  /** Prix d'un passage (base des tarifs), d'un appel pour ce soir et d'un appel express. */
  readonly visitPrice: number;
  readonly callPrice: number;
  readonly expressPrice: number;
  /** Ce qui empêche d'appeler l'équipe maintenant (`BUSY` : déjà réservée ou sur place). */
  readonly callBlocker: 'BUSY' | 'WRONG_STAGE' | 'NOT_ENOUGH_MONEY' | null;
  readonly crew: readonly {
    readonly id: string;
    readonly name: string;
    readonly tool: CleanerTool;
  }[];
  readonly visits: number;
  readonly spent: number;
}

/** Un réglage du modèle économique et ce qu'il donnerait avec les utilisateurs actuels. */
export interface PricingChoiceView {
  readonly model: PricingModel;
  readonly tier: PriceTier;
  /** Revenu par utilisateur et par mois (difficulté du mode comprise). */
  readonly arpu: number;
  /** Achat unique : payé une fois par chaque nouvel utilisateur (0 sinon). */
  readonly oneTime: number;
  /** Coefficients d'arrivées et de départs d'utilisateurs (1 = freemium standard). */
  readonly acquisition: number;
  readonly churn: number;
  /** Valeur d'un utilisateur pour les investisseurs (1 = freemium). */
  readonly userValue: number;
  /** Utilisateurs qui partiraient tout de suite en passant à ce réglage. */
  readonly usersLost: number;
  /** Hype gagnée ou perdue en passant à ce réglage. */
  readonly hype: number;
  /** Revenus mensuels des utilisateurs restants avec ce réglage. */
  readonly monthlyRevenue: number;
}

/** Modèle économique en cours et tous les réglages possibles. */
export interface PricingView {
  readonly current: PricingChoiceView;
  readonly choices: readonly PricingChoiceView[];
  /** Changements faits dans la partie. */
  readonly changes: number;
  /** Ce qui empêche de changer maintenant (`COOLDOWN` : déjà changé ce sprint). */
  readonly blocker: 'COOLDOWN' | 'WRONG_STAGE' | null;
}

/** Une zone de mur (le mur du fond ou de gauche d'une pièce) et son revêtement. */
export interface WallZoneView {
  readonly zone: WallZone;
  /** Peinture ou papier peint posé, `null` pour le mur crème d'origine. */
  readonly finish: WallFinishId | null;
}

/** Peintures et papiers peints des murs. */
export interface WallsView {
  /** Zones de mur du bureau actuel, dans l'ordre d'affichage. */
  readonly zones: readonly WallZoneView[];
  /** Revêtements pas encore débloqués à cette phase. */
  readonly locked: readonly WallFinishId[];
  /** Récompenses du mode Histoire pas débloquées dans cette partie. */
  readonly storyLocked: readonly WallFinishId[];
}

/** Une pièce et son sol. */
export interface FloorZoneView {
  readonly zone: FloorZone;
  /** Matière et teinte posées, `null` pour le sol d'origine de la pièce. */
  readonly finish: FloorFinish | null;
}

/** Sols des pièces. */
export interface FloorsView {
  /** Pièces du bureau actuel, dans l'ordre d'affichage. */
  readonly zones: readonly FloorZoneView[];
  /** Matières pas encore débloquées à cette phase. */
  readonly locked: readonly FloorMaterialId[];
  /** Récompenses du mode Histoire pas débloquées dans cette partie. */
  readonly storyLocked: readonly FloorMaterialId[];
}

/** Un objectif (ou une contrainte) de la mission en cours et où il en est. */
export interface MissionGoalView {
  readonly goal: MissionGoal;
  /** Valeur actuelle (1 ou 0 pour un objectif à cocher). */
  readonly value: number;
  readonly met: boolean;
}

/** Mode Histoire : la mission en cours. */
export interface StoryView {
  readonly missionId: StoryMissionId;
  readonly goals: readonly MissionGoalView[];
  readonly constraints: readonly MissionGoalView[];
  /** Sprints terminés depuis le début de la mission, et durée de la mission. */
  readonly sprintsDone: number;
  readonly sprints: number;
}

/** Ce qui vient de se passer dans la partie (toasts, effets visuels). */
export interface GameNotification {
  readonly tick: number;
  readonly kind: NotificationKind;
  readonly text: LocalizedText;
  readonly entityId: string | null;
}

/** Calendrier : la date du jour simulé et ce qu'on y fête. */
export interface CalendarView {
  /** Date réelle du jour simulé (la partie commence le lundi de la date de sa graine). */
  readonly date: CalendarDate;
  /** Périodes à thème en cours (Halloween, Noël…), selon la date seule. */
  readonly seasons: readonly DecorTheme[];
  /** Devs dont on fête l'anniversaire aujourd'hui (table de fête au bureau). */
  readonly birthdays: readonly string[];
}

export interface GameView {
  readonly seed: string;
  readonly mode: GameMode;
  /** Numéro du tick de simulation ayant produit cet instantané. */
  readonly tick: number;
  readonly time: GameTime;
  readonly calendar: CalendarView;
  readonly phase: Phase;
  readonly step: SprintStep;
  readonly gauges: Gauges;
  /** Historique des jauges, un point par jour simulé. */
  readonly history: readonly Gauges[];
  readonly devs: readonly DevView[];
  /** Ce que l'encadrement apporte à l'équipe, et les postes ouverts au recrutement. */
  readonly leadership: LeadershipView;
  readonly tasks: readonly TaskView[];
  readonly candidates: readonly CandidateView[];
  readonly items: readonly PlacedItemView[];
  /** Projections en cours : les écrans déroulés et les projecteurs qui les éclairent. */
  readonly projections: readonly ProjectionView[];
  /** Inventaire : objets rangés, sans effet tant qu'ils ne sont pas reposés. */
  readonly inventory: readonly StoredItemView[];
  /** Vrai pendant un incident de production (fumée, écran rouge). */
  readonly incident: boolean;
  /** Taille maximale de l'équipe à cette phase. */
  readonly teamMax: number;
  /** Bureaux posés dans l'open space : les devs en trop télétravaillent. */
  readonly desks: number;
  readonly valuation: number;
  /** Mois de trésorerie restants au rythme actuel (dépenses moins revenus), `null` si rentable. */
  readonly runwayMonths: number | null;
  /** Part du capital du fondateur (1 = 100 %). */
  readonly ownership: number;
  /** Carte d'événement en attente d'un choix, sinon null. */
  readonly event: EventView | null;
  /** Bilan du dernier sprint (affiché à l'écran de démo). */
  readonly lastReport: SprintReport | null;
  /** Objectif du sprint en cours (certains sprints seulement), sinon null. */
  readonly objective: ObjectiveView | null;
  readonly pitch: PitchView | null;
  /** Peut-on lancer une levée de fonds maintenant ? Sinon, la raison. */
  readonly pitchBlocker: 'WRONG_STAGE' | 'NO_HYPE' | 'COOLDOWN' | null;
  /** Levées de fonds : tours de table, autres financements, annexes du bureau. */
  readonly funding: FundingView;
  readonly acquisitionOffer: AcquisitionOffer | null;
  /** Demande d'augmentation en attente (pendant la planification), sinon null. */
  readonly raiseRequest: RaiseRequestView | null;
  /** Filiales (débloquées en Série A). */
  readonly group: GroupView;
  /** Salle de réunion (à partir de la Seed). */
  readonly meetingRoom: MeetingRoomView;
  /** Chats du bureau. */
  readonly pets: PetsView;
  /** Peintures et papiers peints des murs. */
  readonly walls: WallsView;
  /** Salles des serveurs. */
  /** Saleté du bureau et entreprise de nettoyage. */
  readonly cleaning: CleaningView;
  /** Modèle économique du produit. */
  readonly pricing: PricingView;
  readonly servers: ServersView;
  /** Abonnements (internet…). */
  readonly subscriptions: SubscriptionsView;
  /** Sols des pièces. */
  readonly floors: FloorsView;
  readonly canIpo: boolean;
  readonly result: GameResult | null;
  /** Mode Histoire : la mission en cours (null dans les autres modes). */
  readonly story: StoryView | null;
  /** Récompenses du mode Histoire utilisables dans cette partie. */
  readonly unlocks: readonly StoryRewardId[];
  /** Succès débloqués pendant cette partie (identifiants du catalogue). */
  readonly achievements: readonly string[];
  /** Replay d'une partie du classement : commandes rejouées sur le total. */
  readonly replay: { readonly played: number; readonly total: number } | null;
  /** Vrai si la simulation avance (faux en planification, en démo, face à une carte). */
  readonly running: boolean;
}

/** Commandes typées envoyées par l'interface. La simulation est seule juge de leur effet. */
export type GameCommand =
  | { readonly type: 'setSpeed'; readonly speed: Speed }
  | {
      readonly type: 'moveTask';
      readonly taskId: string;
      readonly column: KanbanColumn;
      readonly index: number;
    }
  /** Bouton « Tout en À faire » : tout le backlog passe dans la colonne À faire. */
  | { readonly type: 'moveAllToTodo' }
  | { readonly type: 'assignTask'; readonly taskId: string; readonly devId: string | null }
  | { readonly type: 'hire'; readonly candidateId: string; readonly offer: number }
  | { readonly type: 'fire'; readonly devId: string }
  | {
      readonly type: 'placeItem';
      readonly kind: string;
      readonly x: number;
      readonly z: number;
      readonly rotation: Rotation;
      readonly color?: FurnitureColor;
    }
  | {
      readonly type: 'placeAccessory';
      readonly kind: string;
      readonly host: ItemHost;
      readonly rotation: Rotation;
      readonly color?: FurnitureColor;
    }
  | {
      readonly type: 'moveAccessory';
      readonly itemId: string;
      readonly host: ItemHost;
      readonly rotation: Rotation;
    }
  | { readonly type: 'paintItem'; readonly itemId: string; readonly color: FurnitureColor }
  /** Change l'écran d'un poste de travail (modèle, taille, pied ou bras). */
  | { readonly type: 'setMonitor'; readonly itemId: string; readonly monitor: MonitorChoice }
  /** Allume ou éteint un projecteur (il déroule l'écran posé en face de lui). */
  | { readonly type: 'switchProjector'; readonly itemId: string; readonly on: boolean }
  | { readonly type: 'setComputer'; readonly itemId: string; readonly computer: ComputerId }
  | {
      readonly type: 'moveItem';
      readonly itemId: string;
      readonly x: number;
      readonly z: number;
      readonly rotation?: Rotation;
    }
  | { readonly type: 'rotateItem'; readonly itemId: string }
  | { readonly type: 'sellItem'; readonly itemId: string }
  | { readonly type: 'storeItem'; readonly itemId: string }
  | {
      readonly type: 'placeStored';
      readonly kind: string;
      readonly color: FurnitureColor;
      readonly x: number;
      readonly z: number;
      readonly rotation: Rotation;
    }
  | {
      readonly type: 'placeStoredAccessory';
      readonly kind: string;
      readonly color: FurnitureColor;
      readonly host: ItemHost;
      readonly rotation: Rotation;
    }
  | { readonly type: 'sellStored'; readonly kind: string; readonly color: FurnitureColor }
  | { readonly type: 'startSprint' }
  | { readonly type: 'resolveEvent'; readonly choiceIndex: number }
  | { readonly type: 'startPitch' }
  | { readonly type: 'pitchArgument'; readonly argumentId: string }
  | { readonly type: 'closePitch' }
  | { readonly type: 'takeFinancing'; readonly kind: FinancingKind }
  | { readonly type: 'endDemo' }
  | { readonly type: 'answerAcquisition'; readonly accept: boolean }
  | { readonly type: 'answerRaise'; readonly accept: boolean }
  | { readonly type: 'launchIpo' }
  | { readonly type: 'foundVenture'; readonly ideaId: string }
  | { readonly type: 'sellVenture'; readonly ventureId: string }
  | { readonly type: 'fitMeetingRoom'; readonly format: MeetingFormatId }
  | { readonly type: 'clearMeetingRoom' }
  | { readonly type: 'coverWall'; readonly zone: WallZone; readonly finish: WallFinishId }
  | { readonly type: 'coverFloor'; readonly zone: FloorZone; readonly finish: FloorFinish }
  | { readonly type: 'adoptPet'; readonly coat: PetCoat }
  | { readonly type: 'rehomePet'; readonly petId: string }
  /** Souscrit à une offre (ou change d'offre pour son service). */
  | { readonly type: 'subscribe'; readonly offer: string }
  | { readonly type: 'cancelSubscription'; readonly service: SubscriptionService }
  /** Appelle l'entreprise de nettoyage (ce soir, ou en express). */
  | { readonly type: 'callCleaning'; readonly express: boolean }
  | { readonly type: 'subscribeCleaning'; readonly plan: CleaningPlanId }
  | { readonly type: 'cancelCleaning' }
  /** Change le modèle économique et le niveau de prix (une fois par sprint). */
  | { readonly type: 'setPricing'; readonly model: PricingModel; readonly tier: PriceTier };

/** Résultat d'une commande, pour un retour immédiat dans l'interface. */
export type CommandResult =
  | { readonly ok: true; readonly message?: string }
  | { readonly ok: false; readonly reason: string };

/** Jour de la semaine : 0 = lundi … 4 = vendredi, 5 et 6 = week-end. */
export function weekday(day: number): number {
  return day % 7;
}

export function isWeekend(day: number): boolean {
  return weekday(day) >= 5;
}

/** Vendredi 17h : moment où la prod tombe traditionnellement. */
export function isFridayFive(time: Pick<GameTime, 'day' | 'minute'>): boolean {
  return weekday(time.day) === 4 && time.minute >= 17 * 60 && time.minute < 18 * 60;
}
