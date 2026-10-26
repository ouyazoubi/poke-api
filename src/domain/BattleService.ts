import { Trainer } from './Trainer.js';
import { pick, type Pokemon, type Random } from './Pokemon.js';
import { GameError } from './errors.js';
export type Mode = 'random' | 'deterministic' | 'arena1' | 'arena2';
export interface DuelResult {
  pokemonIds: string[];
  winnerId: string | null;
  reason: 'knockout' | 'exhaustion' | 'no-pokemon';
  turns: ReturnType<Pokemon['attack']>[];
}

export class BattleService {
  constructor(private readonly random: Random = Math.random) {}
  private strongest(trainer: Trainer): Pokemon | undefined {
    return [...trainer.alivePokemon].sort((a, b) => b.lifePoint - a.lifePoint || a.id.localeCompare(b.id))[0];
  }
  private duel(a: Trainer, b: Trainer, randomMode: boolean, aStarts: boolean): DuelResult {
    if (randomMode) { a.tavern(); b.tavern(); }
    const p = randomMode ? pick(a.alivePokemon, this.random) : this.strongest(a);
    const q = randomMode ? pick(b.alivePokemon, this.random) : this.strongest(b);
    if (!p || !q) return { pokemonIds: [], winnerId: p ? a.id : q ? b.id : null, reason: 'no-pokemon', turns: [] };
    const turns: DuelResult['turns'] = [];
    let first = aStarts;
    while (p.alive && q.alive && (p.canAttack || q.canAttack)) {
      const actor = first ? p : q;
      const target = first ? q : p;
      if (actor.canAttack) turns.push(actor.attack(target, randomMode ? this.random : () => 0));
      first = !first;
    }
    const winner = !q.alive ? a : !p.alive ? b : undefined;
    if (winner) winner.gainExperience(1);
    return { pokemonIds: [p.id, q.id], winnerId: winner?.id ?? null,
      reason: winner ? 'knockout' : 'exhaustion', turns };
  }
  run(a: Trainer, b: Trainer, mode: Mode) {
    if (a.id === b.id) throw new GameError('Choisissez deux dresseurs différents.', 400);
    if (!a.pokemon.length || !b.pokemon.length) throw new GameError('Chaque dresseur doit posséder au moins un Pokémon.');
    const rounds: DuelResult[] = [];
    const randomMode = mode === 'random' || mode === 'arena1';
    const count = mode === 'arena1' || mode === 'arena2' ? 100 : 1;
    for (let i = 0; i < count; i++) {
      if (mode === 'arena2' && (!a.alivePokemon.length || !b.alivePokemon.length)) break;
      rounds.push(this.duel(a, b, randomMode, i % 2 === 0));
    }
    let winnerId: string | null;
    if (mode === 'arena1') {
      const score = a.level - b.level || a.experience - b.experience;
      winnerId = score > 0 ? a.id : score < 0 ? b.id : null;
    } else if (mode === 'arena2') {
      winnerId = !a.alivePokemon.length && b.alivePokemon.length ? b.id
        : !b.alivePokemon.length && a.alivePokemon.length ? a.id : null;
    } else winnerId = rounds[0]?.winnerId ?? null;
    return { mode, winnerId, roundsPlayed: rounds.length, rounds, trainers: [a, b] };
  }
}
