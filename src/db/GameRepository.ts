import type { PoolClient } from 'pg';
import { Attack } from '../domain/Attack.js';
import { Pokemon } from '../domain/Pokemon.js';
import { Trainer } from '../domain/Trainer.js';
import { GameError } from '../domain/errors.js';
export class GameRepository {
  constructor(private readonly db: PoolClient) {}
  async attack(id: string): Promise<Attack> {
    const { rows } = await this.db.query('SELECT * FROM attacks WHERE id=$1', [id]);
    const row = rows[0];
    if (!row) throw new GameError('Attaque introuvable.', 404);
    return new Attack(row.id, row.name, row.damage, row.usage_limit);
  }
  async attacks(): Promise<Attack[]> {
    const { rows } = await this.db.query('SELECT * FROM attacks ORDER BY name, id');
    return rows.map(r => new Attack(r.id, r.name, r.damage, r.usage_limit));
  }
  async createAttack(attack: Attack): Promise<void> {
    await this.db.query('INSERT INTO attacks(id,name,damage,usage_limit) VALUES($1,$2,$3,$4)',
      [attack.id, attack.name, attack.damage, attack.usageLimit]);
  }
  async trainer(id: string): Promise<Trainer> {
    const { rows } = await this.db.query('SELECT * FROM trainers WHERE id=$1', [id]);
    const t = rows[0];
    if (!t) throw new GameError('Dresseur introuvable.', 404);
    const pokemonRows = await this.db.query('SELECT * FROM pokemon WHERE trainer_id=$1 ORDER BY id', [id]);
    const moves = await this.db.query(`SELECT pa.*, a.name, a.damage, a.usage_limit
      FROM pokemon_attacks pa JOIN attacks a ON a.id=pa.attack_id
      JOIN pokemon p ON p.id=pa.pokemon_id WHERE p.trainer_id=$1 ORDER BY pa.slot`, [id]);
    const pokemon = pokemonRows.rows.map(p => new Pokemon(p.id, p.name, p.max_life_point, p.life_point,
      moves.rows.filter(m => m.pokemon_id === p.id).map(m =>
        new Attack(m.attack_id, m.name, m.damage, m.usage_limit, m.usage_count))));
    return new Trainer(t.id, t.name, t.level, t.experience, pokemon);
  }
  async trainers(): Promise<Trainer[]> {
    const { rows } = await this.db.query('SELECT id FROM trainers ORDER BY name, id');
    return Promise.all(rows.map(row => this.trainer(row.id)));
  }
  async owner(pokemonId: string): Promise<Trainer> {
    const { rows } = await this.db.query('SELECT trainer_id FROM pokemon WHERE id=$1', [pokemonId]);
    if (!rows[0]) throw new GameError('Pokémon introuvable.', 404);
    return this.trainer(rows[0].trainer_id);
  }
  async save(trainer: Trainer): Promise<void> {
    await this.db.query(`INSERT INTO trainers(id,name,level,experience) VALUES($1,$2,$3,$4)
      ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,level=EXCLUDED.level,experience=EXCLUDED.experience`,
    [trainer.id, trainer.name, trainer.level, trainer.experience]);
    for (const p of trainer.pokemon) {
      await this.db.query(`INSERT INTO pokemon(id,trainer_id,name,max_life_point,life_point) VALUES($1,$2,$3,$4,$5)
        ON CONFLICT(id) DO UPDATE SET life_point=EXCLUDED.life_point`,
      [p.id, trainer.id, p.name, p.maxLifePoint, p.lifePoint]);
      for (const [slot, attack] of p.attacks.entries()) {
        await this.db.query(`INSERT INTO pokemon_attacks(pokemon_id,attack_id,slot,usage_count) VALUES($1,$2,$3,$4)
          ON CONFLICT(pokemon_id,attack_id) DO UPDATE SET usage_count=EXCLUDED.usage_count`,
        [p.id, attack.id, slot, attack.usageCount]);
      }
    }
  }
}
