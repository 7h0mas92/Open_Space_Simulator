/**
 * Behavior trees minimalistes, génériques sur un contexte `C`.
 *
 * Un nœud renvoie `success`, `failure` ou `running` (l'action continue au tick suivant).
 * - `sequence` : exécute ses enfants dans l'ordre, s'arrête au premier qui ne réussit pas ;
 * - `selector` : essaie ses enfants dans l'ordre, s'arrête au premier qui ne rate pas ;
 * - `condition` : test instantané ; `action` : code arbitraire.
 *
 * Les nœuds sont sans état : tout l'état vit dans le contexte (le personnage). Un seul arbre
 * est donc partagé par tous les personnages, et leur état reste sérialisable.
 */
export type Status = 'success' | 'failure' | 'running';

export interface BTNode<C> {
  readonly name: string;
  tick(context: C): Status;
}

export function sequence<C>(name: string, ...children: BTNode<C>[]): BTNode<C> {
  return {
    name,
    tick(context) {
      for (const child of children) {
        const status = child.tick(context);
        if (status !== 'success') return status;
      }
      return 'success';
    },
  };
}

export function selector<C>(name: string, ...children: BTNode<C>[]): BTNode<C> {
  return {
    name,
    tick(context) {
      for (const child of children) {
        const status = child.tick(context);
        if (status !== 'failure') return status;
      }
      return 'failure';
    },
  };
}

export function condition<C>(name: string, test: (context: C) => boolean): BTNode<C> {
  return { name, tick: (context) => (test(context) ? 'success' : 'failure') };
}

export function action<C>(name: string, run: (context: C) => Status): BTNode<C> {
  return { name, tick: run };
}
