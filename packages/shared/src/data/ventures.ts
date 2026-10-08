import type { VentureIdea } from '../sim/ventures.js';

/**
 * Projets de filiales proposés pendant la planification (3 par sprint, tirés sur une graine
 * à part). Six projets par profil de risque.
 */
export const VENTURE_IDEAS: readonly VentureIdea[] = [
  // Prudents : petits marchés, clients qui paient.
  {
    id: 'meeting-saas',
    icon: '📅',
    risk: 'SAFE',
    name: { fr: 'Réunionator', en: 'Meetinator' },
    pitch: {
      fr: 'Un SaaS qui planifie des réunions pour préparer vos réunions.',
      en: 'A SaaS that schedules meetings to prepare your meetings.',
    },
  },
  {
    id: 'coffee-subscription',
    icon: '☕',
    risk: 'SAFE',
    name: { fr: 'Caféine as a Service', en: 'Caffeine as a Service' },
    pitch: {
      fr: 'Un abonnement de café en grains pour les open spaces. Les devs ne résilient jamais.',
      en: 'A coffee bean subscription for open spaces. Devs never cancel.',
    },
  },
  {
    id: 'rubber-duck-store',
    icon: '🦆',
    risk: 'SAFE',
    name: { fr: 'CoinCoin Debug', en: 'QuackQuack Debug' },
    pitch: {
      fr: 'Des canards en plastique certifiés pour le rubber duck debugging.',
      en: 'Certified rubber ducks for rubber duck debugging.',
    },
  },
  {
    id: 'standup-timer',
    icon: '⏱️',
    risk: 'SAFE',
    name: { fr: 'Stand-up Minute', en: 'Stand-up Minute' },
    pitch: {
      fr: 'Un minuteur qui coupe le micro au bout de 60 secondes de stand-up.',
      en: 'A timer that mutes you after 60 seconds of stand-up.',
    },
  },
  {
    id: 'linkedin-ghostwriter',
    icon: '✍️',
    risk: 'SAFE',
    name: { fr: 'HumbleBrag Pro', en: 'HumbleBrag Pro' },
    pitch: {
      fr: 'Rédige vos posts LinkedIn « Je suis ravi d’annoncer ».',
      en: 'Writes your "I\'m thrilled to announce" LinkedIn posts.',
    },
  },
  {
    id: 'legacy-consulting',
    icon: '🧓',
    risk: 'SAFE',
    name: { fr: 'COBOL Rescue', en: 'COBOL Rescue' },
    pitch: {
      fr: 'Des seniors barbus louent leurs services aux banques qui tournent encore en COBOL.',
      en: 'Bearded seniors rent themselves out to banks still running COBOL.',
    },
  },
  // Audacieux : vrais marchés, vraie concurrence.
  {
    id: 'no-code-platform',
    icon: '🧩',
    risk: 'BOLD',
    name: { fr: 'NoCodeNoProblem', en: 'NoCodeNoProblem' },
    pitch: {
      fr: 'Une plateforme no-code… développée par 40 devs.',
      en: 'A no-code platform… built by 40 developers.',
    },
  },
  {
    id: 'plant-iot',
    icon: '🪴',
    risk: 'BOLD',
    name: { fr: 'Plante Connectée', en: 'SmartPlant' },
    pitch: {
      fr: 'Un capteur qui envoie une notification Slack quand la plante du bureau a soif.',
      en: 'A sensor that pings Slack when the office plant is thirsty.',
    },
  },
  {
    id: 'remote-office',
    icon: '🏝️',
    risk: 'BOLD',
    name: { fr: 'Bureau Partout', en: 'OfficeAnywhere' },
    pitch: {
      fr: 'Des open spaces à louer à la plage. Le wifi est « en cours d’installation ».',
      en: 'Beach open spaces for rent. Wi-Fi is "being installed".',
    },
  },
  {
    id: 'pair-programming-dating',
    icon: '💞',
    risk: 'BOLD',
    name: { fr: 'Pair Match', en: 'Pair Match' },
    pitch: {
      fr: 'Le Tinder du pair programming : swipe à droite sur les tabs, à gauche sur les espaces.',
      en: 'Tinder for pair programming: swipe right for tabs, left for spaces.',
    },
  },
  {
    id: 'bug-bounty-kids',
    icon: '🐛',
    risk: 'BOLD',
    name: { fr: 'Chasseurs de Bugs', en: 'Bug Hunters' },
    pitch: {
      fr: 'Des stagiaires cassent la prod des autres, contre rémunération.',
      en: "Interns break other people's production, for a fee.",
    },
  },
  {
    id: 'yaml-linter',
    icon: '📐',
    risk: 'BOLD',
    name: { fr: 'YAML Thérapie', en: 'YAML Therapy' },
    pitch: {
      fr: 'Un linter qui console les devs après une erreur d’indentation.',
      en: 'A linter that comforts devs after an indentation error.',
    },
  },
  // Moonshots : tout ou rien.
  {
    id: 'ai-for-ai',
    icon: '🤖',
    risk: 'MOONSHOT',
    name: { fr: 'GPT pour GPT', en: 'GPT for GPT' },
    pitch: {
      fr: 'Une IA qui écrit les prompts d’une IA qui écrit les prompts.',
      en: 'An AI that writes prompts for an AI that writes prompts.',
    },
  },
  {
    id: 'blockchain-coffee',
    icon: '⛓️',
    risk: 'MOONSHOT',
    name: { fr: 'CoffeeChain', en: 'CoffeeChain' },
    pitch: {
      fr: 'Chaque tasse de café devient un NFT. Les investisseurs adorent, personne ne sait pourquoi.',
      en: 'Every cup of coffee becomes an NFT. Investors love it, nobody knows why.',
    },
  },
  {
    id: 'quantum-todo',
    icon: '⚛️',
    risk: 'MOONSHOT',
    name: { fr: 'Quantum Todo', en: 'Quantum Todo' },
    pitch: {
      fr: 'Une todo-list quantique : vos tâches sont à la fois faites et pas faites.',
      en: 'A quantum to-do list: your tasks are both done and not done.',
    },
  },
  {
    id: 'mars-coworking',
    icon: '🚀',
    risk: 'MOONSHOT',
    name: { fr: 'Coworking sur Mars', en: 'Mars Coworking' },
    pitch: {
      fr: 'Latence de 20 minutes, mais enfin plus personne ne vous dérange.',
      en: '20-minute latency, but finally nobody bothers you.',
    },
  },
  {
    id: 'rust-os',
    icon: '🦀',
    risk: 'MOONSHOT',
    name: { fr: 'RustOS', en: 'RustOS' },
    pitch: {
      fr: 'Le Rustacé veut réécrire un système d’exploitation entier. En Rust, évidemment.',
      en: 'The Rustacean wants to rewrite a whole operating system. In Rust, obviously.',
    },
  },
  {
    id: 'metaverse-standup',
    icon: '🥽',
    risk: 'MOONSHOT',
    name: { fr: 'StandUp Verse', en: 'StandUp Verse' },
    pitch: {
      fr: 'Le daily stand-up en réalité virtuelle. Debout, pour de vrai.',
      en: 'The daily stand-up in virtual reality. Standing up, for real.',
    },
  },
];

export function getVentureIdea(id: string): VentureIdea | undefined {
  return VENTURE_IDEAS.find((idea) => idea.id === id);
}
