import { acceptanceChance } from '../simulation/devs';
import type { CandidateView } from './types';

/** Chance (0 à 1) que le candidat accepte cette offre : la même règle que la simulation. */
export function offerAcceptance(candidate: CandidateView, offer: number): number {
  return acceptanceChance(
    { askingSalary: candidate.askingSalary, stats: candidate.dev.stats },
    offer,
  );
}
