import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import request from 'supertest';
if (!process.env.TEST_DATABASE_URL) throw new Error('Définissez TEST_DATABASE_URL vers une base de test dédiée.');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
const { app } = await import('../src/app.js');
const { pool, transaction } = await import('../src/db/database.js');
const { GameRepository } = await import('../src/db/GameRepository.js');
test('PostgreSQL : parcours HTTP, persistance, concurrence et rollback', async () => {
  const trainers: string[] = []; const attacks: string[] = [];
  try {
    await pool.query(await readFile(new URL('../src/db/schema.sql', import.meta.url), 'utf8'));
    const suffix = crypto.randomUUID();
    const attack = (await request(app).post('/attacks').send({ name: `Charge-${suffix}`, damage: 100, usageLimit: 10 }).expect(201)).body;
    attacks.push(attack.id);
    const a = (await request(app).post('/trainers').send({ name: 'Sacha' }).expect(201)).body;
    trainers.push(a.id);
    const b = (await request(app).post('/trainers').send({ name: 'Ondine' }).expect(201)).body;
    trainers.push(b.id);
    const p = (await request(app).post(`/trainers/${a.id}/pokemon`).send({ name: 'Pikachu', lifePoint: 50 }).expect(201)).body;
    const q = (await request(app).post(`/trainers/${b.id}/pokemon`).send({ name: 'Carapuce', lifePoint: 50 }).expect(201)).body;
    for (const pokemon of [p, q]) await request(app).post(`/pokemon/${pokemon.id}/attacks`).send({ attackId: attack.id }).expect(200);
    await request(app).post(`/pokemon/${p.id}/attacks`).send({ attackId: attack.id }).expect(409);
    await request(app).post('/battles').send({ trainer1Id: a.id, trainer2Id: b.id, mode: 'random' }).expect(200);
    let state = (await request(app).get(`/trainers/${a.id}`).expect(200)).body;
    assert.equal(state.experience, 1);
    assert.equal(state.pokemon[0].attacks[0].usageCount, 1);
    assert.equal((await request(app).get(`/pokemon/${q.id}`).expect(200)).body.lifePoint, 0);
    await assert.rejects(transaction(async db => {
      const repo = new GameRepository(db); const t = await repo.trainer(a.id);
      t.gainExperience(5); await repo.save(t); throw new Error('rollback voulu');
    }));
    assert.equal((await request(app).get(`/trainers/${a.id}`)).body.experience, 1);
    const results = await Promise.all([0, 1].map(() => request(app).post('/battles').send({ trainer1Id: a.id, trainer2Id: b.id, mode: 'random' })));
    assert.ok(results.every(r => r.status === 200));
    state = (await request(app).get(`/trainers/${a.id}`)).body;
    assert.equal(state.experience, 3);
    await request(app).post(`/trainers/${b.id}/tavern`).expect(200);
    const healed = (await request(app).get(`/pokemon/${q.id}`)).body;
    assert.equal(healed.lifePoint, 50); assert.equal(healed.attacks[0].usageCount, 0);
    await request(app).post('/battles').send({ trainer1Id: a.id, trainer2Id: b.id, mode: 'deterministic' }).expect(200);
    const stopped = (await request(app).post('/battles').send({ trainer1Id: a.id, trainer2Id: b.id, mode: 'arena2' }).expect(200)).body;
    assert.equal(stopped.roundsPlayed, 0); assert.equal(stopped.winnerId, a.id);
    const arena = (await request(app).post('/battles').send({ trainer1Id: a.id, trainer2Id: b.id, mode: 'arena1' }).expect(200)).body;
    assert.equal(arena.roundsPlayed, 100); assert.equal(arena.winnerId, a.id);
    for (const trainer of arena.trainers) {
      const persisted = (await request(app).get(`/trainers/${trainer.id}`).expect(200)).body;
      assert.deepEqual(persisted, trainer);
    }
    await request(app).get(`/trainers/${crypto.randomUUID()}`).expect(404);
    await request(app).post('/battles').send({ trainer1Id: a.id, trainer2Id: a.id, mode: 'random' }).expect(400);
  } finally {
    await pool.query('DELETE FROM trainers WHERE id = ANY($1::uuid[])', [trainers]);
    await pool.query('DELETE FROM attacks WHERE id = ANY($1::uuid[])', [attacks]);
    await pool.end();
  }
});
