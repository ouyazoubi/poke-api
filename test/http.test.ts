import { test, after } from 'node:test';
import request from 'supertest';
import { app } from '../src/app.js';
import { pool } from '../src/db/database.js';
after(() => pool.end());
test('validation HTTP : données, UUID, JSON et route inconnue', async () => {
  await request(app).post('/trainers').send({ name: ' ' }).expect(400);
  await request(app).post('/attacks').send({ name: 'A', damage: -1, usageLimit: 10 }).expect(400);
  await request(app).post('/attacks').send({ name: 'A', damage: 1, usageLimit: 101 }).expect(400);
  await request(app).get('/trainers/invalide').expect(400);
  await request(app).post('/battles').send({ mode: 'unknown' }).expect(400);
  await request(app).post('/trainers').set('Content-Type', 'application/json').send('{').expect(400);
  await request(app).get('/inconnue').expect(404);
});
