import { Attack } from './Attack.js';
import { GameError } from './errors.js';
export type Random = () => number;
export function pick<T>(items: readonly T[], random: Random): T {
  if (!items.length) throw new GameError('Aucun choix disponible.');
  const index = Math.floor(random() * items.length);
  const item = items[index];
  if (item === undefined) throw new GameError('Générateur aléatoire invalide.', 500);
  return item;
}

export class Pokemon {
  private moves: Attack[] = [];
  private hp: number;
  constructor(public readonly id: string, public readonly name: string,
    public readonly maxLifePoint: number, lifePoint = maxLifePoint, attacks: Attack[] = []) {
    if (!name.trim() || !Number.isInteger(maxLifePoint) || maxLifePoint < 1 ||
        !Number.isInteger(lifePoint) || lifePoint < 0 || lifePoint > maxLifePoint) {
      throw new GameError('Pokémon invalide.', 400);
    }
    this.hp = lifePoint;
    attacks.forEach(attack => this.learn(attack));
  }
  get lifePoint(): number { return this.hp; }
  get attacks(): readonly Attack[] { return [...this.moves]; }
  get alive(): boolean { return this.hp > 0; }
  get canAttack(): boolean { return this.alive && this.moves.some(a => a.available); }
  learn(attack: Attack): void {
    if (this.moves.some(a => a.id === attack.id || a.name.toLowerCase() === attack.name.toLowerCase())) {
      throw new GameError('Ce Pokémon connaît déjà cette attaque.');
    }
    if (this.moves.length === 4) throw new GameError('Un Pokémon ne peut apprendre que 4 attaques.');
    this.moves.push(new Attack(attack.id, attack.name, attack.damage, attack.usageLimit, attack.usageCount));
  }
  heal(): void { this.hp = this.maxLifePoint; this.moves.forEach(a => a.reset()); }
  attack(target: Pokemon, random: Random = Math.random) {
    if (target === this) throw new GameError('Un Pokémon ne peut pas s’attaquer lui-même.');
    if (!this.alive || !target.alive) throw new GameError('Un Pokémon K.O. ne peut pas combattre.');
    const move = pick(this.moves.filter(a => a.available), random);
    const damage = move.use();
    target.hp = Math.max(0, target.hp - damage);
    return { attackerId: this.id, targetId: target.id, attackId: move.id, damage, remainingLifePoint: target.hp };
  }
  toJSON() {
    return { id: this.id, name: this.name, lifePoint: this.hp, maxLifePoint: this.maxLifePoint, attacks: this.moves };
  }
}
