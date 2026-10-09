import {
  PETS,
  PET_NAMES,
  PET_NEEDS,
  PHASES,
  getFurniture,
  type CommandError,
  type CommandResult,
  type GameState,
  type PetCoat,
  type PetEffects,
  type PetNeed,
} from '@oss/shared';
import { query } from './ecs';
import { addMoney, changeMoral, devIds, notify, text, type SimContext } from './helpers';
import { seedToState } from './rng';

/*
 * Chats du bureau : adoption, départ et effets sur l'équipe (ajoutés à ceux du mobilier dans
 * `computeOfficeEffects`). Les déplacements des chats ne regardent que le rendu (`ai/cats.ts`).
 *
 * Rien ici ne passe par `ctx.rng` : le nom d'un chat vient d'un hachage de la graine et du
 * nombre d'adoptions. Une partie sans chat tire exactement les mêmes nombres qu'avant.
 */

/** Équipement posé dans l'open space (les objets rangés dans l'inventaire ne comptent pas). */
export function petEquipment(state: GameState): Record<PetNeed, boolean> {
  const found: Record<PetNeed, boolean> = { litter: false, bowl: false, tree: false };
  for (const id of query(state, 'furniture')) {
    const placed = state.components.furniture[id];
    const need = placed ? getFurniture(placed.itemId)?.petNeed : undefined;
    if (need) found[need] = true;
  }
  return found;
}

/** Équipement qui manque encore (vide : les chats sont heureux, ou on peut en adopter). */
export function missingPetNeeds(state: GameState): PetNeed[] {
  const equipment = petEquipment(state);
  return PET_NEEDS.filter((need) => !equipment[need]);
}

export type PetBlocker = Extract<
  CommandError,
  'LOCKED' | 'NOT_ELIGIBLE' | 'NOT_ENOUGH_MONEY' | 'WRONG_STAGE'
>;

/** Pourquoi on ne peut pas adopter de chat maintenant (`null` si c'est possible). */
export function adoptionBlocker(state: GameState): PetBlocker | null {
  if (state.stage === 'PITCH') return 'WRONG_STAGE';
  if (PHASES.indexOf(state.phase) < PHASES.indexOf(PETS.minPhase)) return 'LOCKED';
  if (state.pets.length >= PETS.max || missingPetNeeds(state).length > 0) return 'NOT_ELIGIBLE';
  if (state.gauges.treasury < PETS.price) return 'NOT_ENOUGH_MONEY';
  return null;
}

/** Nom du prochain chat : dérivé de la graine, sans doublon parmi les chats présents. */
export function nextPetName(state: GameState): string {
  const [hash = 0] = seedToState(`${state.seed}#pet#${state.stats.petsAdopted}`);
  const taken = new Set(state.pets.map((pet) => pet.name));
  for (let offset = 0; offset < PET_NAMES.length; offset++) {
    const name = PET_NAMES[(hash + offset) % PET_NAMES.length];
    if (name && !taken.has(name)) return name;
  }
  return `${PET_NAMES[0]} ${state.stats.petsAdopted + 1}`;
}

export function adoptPet(state: GameState, ctx: SimContext, coat: PetCoat): CommandResult {
  const blocker = adoptionBlocker(state);
  if (blocker) return { ok: false, error: blocker };
  const name = nextPetName(state);
  addMoney(state, -PETS.price);
  state.stats.petsAdopted++;
  state.pets.push({
    id: `cat-${state.stats.petsAdopted}`,
    coat,
    name,
    adoptedSprint: state.sprint,
  });
  notify(
    state,
    ctx,
    'PET_ADOPTED',
    text(
      [
        '{name} a rejoint l’équipe en tant que chat de bureau.',
        '{name} joined the team as office cat.',
      ],
      {
        name,
      },
    ),
  );
  return { ok: true };
}

/** Confie un chat à une famille : pas de remboursement, et toute l'équipe a un coup de blues. */
export function rehomePet(state: GameState, ctx: SimContext, petId: string): CommandResult {
  if (state.stage === 'PITCH') return { ok: false, error: 'WRONG_STAGE' };
  const index = state.pets.findIndex((pet) => pet.id === petId);
  const pet = state.pets[index];
  if (!pet) return { ok: false, error: 'NOT_FOUND' };
  state.pets.splice(index, 1);
  for (const id of devIds(state)) changeMoral(state, id, PETS.rehomeMoral);
  notify(
    state,
    ctx,
    'PET_REHOMED',
    text(
      [
        '{name} part vivre dans une famille. L’open space est bien vide.',
        '{name} went to live with a family. The office feels empty.',
      ],
      {
        name: pet.name,
      },
    ),
  );
  return { ok: true };
}

/** Effets cumulés des chats : heureux s'ils ont tout leur équipement, sinon ils boudent. */
export function petEffects(state: GameState): PetEffects {
  const count = state.pets.length;
  const mood = missingPetNeeds(state).length === 0 ? PETS.happy : PETS.sulking;
  return {
    moral: mood.moral * count,
    hypePerDay: mood.hypePerDay * count,
    teamProductivity: mood.teamProductivity * count,
  };
}
