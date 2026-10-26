import { Pokemon } from './Pokemon.js';
import { GameError } from './errors.js';
export class Trainer {
  private team: Pokemon[] = [];
  private currentLevel: number;
  private xp: number;
  constructor(public readonly id: string, public readonly name: string, level = 1, experience = 0, pokemon: Pokemon[] = []) {
    if (!name.trim() || !Number.isInteger(level) || level < 1 ||
        !Number.isInteger(experience) || experience < 0 || experience >= 10) {
      throw new GameError('Dresseur invalide.', 400);
    }
    this.currentLevel = level;
    this.xp = experience;
    pokemon.forEach(p => this.addPokemon(p));
  }
  get level(): number { return this.currentLevel; }
  get experience(): number { return this.xp; }
  get pokemon(): readonly Pokemon[] { return [...this.team]; }
  get alivePokemon(): Pokemon[] { return this.team.filter(p => p.alive); }
  addPokemon(pokemon: Pokemon): void {
    if (this.team.some(p => p.id === pokemon.id)) throw new GameError('Pokémon déjà présent.');
    this.team.push(pokemon);
  }
  tavern(): void { this.team.forEach(p => p.heal()); }
  gainExperience(amount: number): void {
    if (!Number.isSafeInteger(amount) || amount < 0) throw new GameError('Expérience invalide.', 400);
    this.xp += amount;
    this.currentLevel += Math.floor(this.xp / 10);
    this.xp %= 10;
  }
  toJSON() {
    return { id: this.id, name: this.name, level: this.level, experience: this.experience, pokemon: this.team };
  }
}
