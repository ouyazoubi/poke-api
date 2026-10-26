import { GameError } from './errors.js';

export class Attack {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly damage: number,
    public readonly usageLimit: number,
    private used = 0,
  ) {
    if (!name.trim() || !Number.isInteger(damage) || damage < 1 ||
        !Number.isInteger(usageLimit) || usageLimit < 1 ||
        !Number.isInteger(used) || used < 0 || used > usageLimit) {
      throw new GameError('Attaque invalide.', 400);
    }
  }
  get usageCount(): number { return this.used; }
  get available(): boolean { return this.used < this.usageLimit; }
  use(): number {
    if (!this.available) throw new GameError('Attaque épuisée.');
    this.used++;
    return this.damage;
  }
  reset(): void { this.used = 0; }
  describe(): string {
    return `${this.name} : ${this.damage} dégâts, ${this.used}/${this.usageLimit} utilisations.`;
  }
  toJSON() {
    return { id: this.id, name: this.name, damage: this.damage,
      usageLimit: this.usageLimit, usageCount: this.used, information: this.describe() };
  }
}
