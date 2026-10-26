import express, { type ErrorRequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { pool, transaction } from './db/database.js';
import { GameRepository } from './db/GameRepository.js';
import { Attack } from './domain/Attack.js';
import { Pokemon } from './domain/Pokemon.js';
import { Trainer } from './domain/Trainer.js';
import { BattleService } from './domain/BattleService.js';
import { GameError } from './domain/errors.js';

const name = z.string().trim().min(1).max(100);
const id = z.uuid();
const attackInput = z.object({ name, damage: z.number().int().min(1).max(10000), usageLimit: z.number().int().min(1).max(100) }).strict();
const pokemonInput = z.object({ name, lifePoint: z.number().int().min(1).max(10000) }).strict();
const battleInput = z.object({ trainer1Id: id, trainer2Id: id,
  mode: z.enum(['random', 'deterministic', 'arena1', 'arena2']) }).strict();
const pathId = (value: unknown) => id.parse(value);
export const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));
app.get(['/', '/api'], (_req, res) => {
  res.json({ service: 'poke-api', message: 'API Pokémon en ligne', routes: { health: '/health', trainers: '/trainers', pokemon: '/pokemon', attacks: '/attacks', battles: 'POST /battles' } });
});
app.get('/health', async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok' });
});
app.get('/attacks', async (_req, res) => {
  res.json(await transaction(db => new GameRepository(db).attacks()));
});
app.get('/attacks/:id', async (req, res) => {
  const attackId = pathId(req.params.id);
  res.json(await transaction(db => new GameRepository(db).attack(attackId)));
});
app.post('/attacks', async (req, res) => {
  const data = attackInput.parse(req.body);
  const attack = new Attack(randomUUID(), data.name, data.damage, data.usageLimit);
  await transaction(db => new GameRepository(db).createAttack(attack));
  res.status(201).location(`/attacks/${attack.id}`).json(attack);
});
app.get('/trainers', async (_req, res) => {
  res.json(await transaction(db => new GameRepository(db).trainers()));
});
app.get('/trainers/:id', async (req, res) => {
  const trainerId = pathId(req.params.id);
  res.json(await transaction(db => new GameRepository(db).trainer(trainerId)));
});
app.post('/trainers', async (req, res) => {
  const data = z.object({ name }).strict().parse(req.body);
  const trainer = new Trainer(randomUUID(), data.name);
  await transaction(db => new GameRepository(db).save(trainer));
  res.status(201).location(`/trainers/${trainer.id}`).json(trainer);
});
app.post('/trainers/:id/pokemon', async (req, res) => {
  const trainerId = pathId(req.params.id);
  const data = pokemonInput.parse(req.body);
  const pokemon = new Pokemon(randomUUID(), data.name, data.lifePoint);
  await transaction(async db => {
    const repo = new GameRepository(db);
    const trainer = await repo.trainer(trainerId);
    trainer.addPokemon(pokemon);
    await repo.save(trainer);
  });
  res.status(201).location(`/pokemon/${pokemon.id}`).json(pokemon);
});
app.get('/pokemon', async (_req, res) => {
  res.json(await transaction(async db => (await new GameRepository(db).trainers()).flatMap(t => t.pokemon)));
});
app.get('/pokemon/:id', async (req, res) => {
  const pokemonId = pathId(req.params.id);
  res.json(await transaction(async db => (await new GameRepository(db).owner(pokemonId)).pokemon.find(p => p.id === pokemonId)));
});
app.post('/pokemon/:id/attacks', async (req, res) => {
  const pokemonId = pathId(req.params.id);
  const { attackId } = z.object({ attackId: id }).strict().parse(req.body);
  res.json(await transaction(async db => {
    const repo = new GameRepository(db);
    const trainer = await repo.owner(pokemonId);
    const pokemon = trainer.pokemon.find(p => p.id === pokemonId)!;
    pokemon.learn(await repo.attack(attackId));
    await repo.save(trainer);
    return pokemon;
  }));
});
app.post('/pokemon/:id/heal', async (req, res) => {
  const pokemonId = pathId(req.params.id);
  res.json(await transaction(async db => {
    const repo = new GameRepository(db);
    const trainer = await repo.owner(pokemonId);
    const pokemon = trainer.pokemon.find(p => p.id === pokemonId)!;
    pokemon.heal();
    await repo.save(trainer);
    return pokemon;
  }));
});
app.post('/trainers/:id/tavern', async (req, res) => {
  const trainerId = pathId(req.params.id);
  res.json(await transaction(async db => {
    const repo = new GameRepository(db);
    const trainer = await repo.trainer(trainerId);
    trainer.tavern();
    await repo.save(trainer);
    return trainer;
  }));
});
app.post('/battles', async (req, res) => {
  const data = battleInput.parse(req.body);
  res.json(await transaction(async db => {
    const repo = new GameRepository(db);
    const a = await repo.trainer(data.trainer1Id);
    const b = await repo.trainer(data.trainer2Id);
    const result = new BattleService().run(a, b, data.mode);
    await repo.save(a);
    await repo.save(b);
    return result;
  }));
});
app.use((_req, res) => { res.status(404).json({ error: 'Route introuvable.' }); });
const errors: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof z.ZodError) {
    res.status(400).json({ error: 'Données invalides.', details: error.issues });
  } else if (error instanceof GameError) {
    res.status(error.status).json({ error: error.message });
  } else if (error?.code === '23505') {
    res.status(409).json({ error: 'Cette ressource existe déjà.' });
  } else if (error?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'JSON invalide.' });
  } else if (error?.type === 'entity.too.large') {
    res.status(413).json({ error: 'Corps de requête trop volumineux.' });
  } else {
    console.error(error);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
};
app.use(errors);
