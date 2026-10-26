import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Attack } from '../src/domain/Attack.js';
import { Pokemon } from '../src/domain/Pokemon.js';
import { Trainer } from '../src/domain/Trainer.js';
import { BattleService } from '../src/domain/BattleService.js';
const move = (id = 'a', damage = 20, uses = 10) => new Attack(id, id, damage, uses);
function team(id: string, hp = 50, damage = 20, uses = 10) {
  return new Trainer(id, id, 1, 0, [new Pokemon(id + '-p', id, hp, hp, [move('a', damage, uses)])]);
}
test('apprentissage : maximum 4, sans doublons, usages indépendants', () => {
  const p = new Pokemon('p', 'Pikachu', 100);
  const q = new Pokemon('q', 'Salamèche', 100);
  const attack = move();
  p.learn(attack); q.learn(attack);
  assert.throws(() => p.learn(move()));
  for (const id of ['b', 'c', 'd']) p.learn(move(id));
  assert.throws(() => p.learn(move('e')));
  p.attack(q, () => 0);
  assert.equal(p.attacks[0]!.usageCount, 1);
  assert.equal(q.attacks[0]!.usageCount, 0);
  assert.equal(attack.usageCount, 0);
});
test('attaques disponibles, épuisement, PV bornés et soins complets', () => {
  const p = new Pokemon('p', 'P', 50, 10, [move('a', 100, 1), move('b', 5, 1)]);
  const q = new Pokemon('q', 'Q', 200);
  p.attack(q, () => 0); p.attack(q, () => 0);
  assert.equal(q.lifePoint, 95);
  assert.throws(() => p.attack(q));
  p.heal();
  assert.equal(p.lifePoint, 50);
  assert.ok(p.attacks.every(a => a.usageCount === 0));
  const small = new Pokemon('s', 'S', 1);
  p.attack(small, () => 0);
  assert.equal(small.lifePoint, 0);
  assert.throws(() => small.attack(p));
});
test('la taverne soigne toute l’équipe ; XP avec reliquat et niveaux multiples', () => {
  const t = team('t');
  t.addPokemon(new Pokemon('b', 'B', 40, 0));
  t.tavern();
  assert.ok(t.pokemon.every(p => p.lifePoint === p.maxLifePoint));
  t.gainExperience(27);
  assert.equal(t.level, 3); assert.equal(t.experience, 7);
  assert.throws(() => t.gainExperience(-1));
});
test('défi aléatoire : taverne, KO et XP au vainqueur', () => {
  const a = team('a', 50, 100); const b = team('b');
  a.pokemon[0]!.attack(b.pokemon[0]!, () => 0);
  const result = new BattleService(() => 0).run(a, b, 'random');
  assert.equal(result.winnerId, 'a');
  assert.equal(result.rounds[0]!.reason, 'knockout');
  assert.equal(a.experience, 1);
});
test('défi déterministe : plus de PV actuels, première attaque, sans soin', () => {
  const a = team('a', 50, 100);
  a.addPokemon(new Pokemon('a-best', 'Best', 100, 60, [move('b', 100)]));
  const b = team('b');
  const result = new BattleService(() => { throw Error('Hasard interdit'); }).run(a, b, 'deterministic');
  assert.equal(result.rounds[0]!.pokemonIds[0], 'a-best');
  assert.equal(a.pokemon[1]!.lifePoint, 60);
  assert.equal(result.winnerId, 'a');
});
test('épuisement : égalité finie et aucune XP', () => {
  const a = team('a', 100, 1, 1); const b = team('b', 100, 1, 1);
  const result = new BattleService(() => 0).run(a, b, 'deterministic');
  assert.equal(result.winnerId, null);
  assert.equal(result.rounds[0]!.reason, 'exhaustion');
  assert.equal(result.rounds[0]!.turns.length, 2);
  assert.equal(a.experience, 0);
});
test('arène 1 : exactement 100 combats, classement niveau puis XP', () => {
  const a = team('a', 100, 100); const b = team('b', 100, 100);
  a.gainExperience(9);
  const result = new BattleService(() => 0).run(a, b, 'arena1');
  assert.equal(result.roundsPlayed, 100);
  assert.equal(a.level, 6); assert.equal(a.experience, 9);
  assert.equal(b.level, 6); assert.equal(b.experience, 0);
  assert.equal(result.winnerId, 'a');
});
test('arène 1 : égalité parfaite', () => {
  const result = new BattleService(() => 0).run(team('a', 100, 100), team('b', 100, 100), 'arena1');
  assert.equal(result.winnerId, null);
});
test('arène 2 : conserve dégâts et usages, arrête quand une équipe est KO', () => {
  const a = team('a', 100, 100); const b = team('b', 50, 1);
  b.addPokemon(new Pokemon('b-2', 'B2', 50, 50, [move('c', 1)]));
  const result = new BattleService().run(a, b, 'arena2');
  assert.equal(result.roundsPlayed, 2); assert.equal(result.winnerId, 'a');
  assert.equal(a.pokemon[0]!.lifePoint, 99);
  assert.equal(a.pokemon[0]!.attacks[0]!.usageCount, 2);
});
test('arène 2 : borne à 100 et équipes déjà KO', () => {
  const a = team('a', 100, 1, 1); const b = team('b', 100, 1, 1);
  const result = new BattleService().run(a, b, 'arena2');
  assert.equal(result.roundsPlayed, 100); assert.equal(result.winnerId, null);
  const dead = new Trainer('d', 'D', 1, 0, [new Pokemon('d-p', 'D', 50, 0)]);
  const stopped = new BattleService().run(a, dead, 'arena2');
  assert.equal(stopped.roundsPlayed, 0); assert.equal(stopped.winnerId, 'a');
});
test('équipes vides, auto-défis et données métier invalides', () => {
  const a = team('a');
  assert.throws(() => new BattleService().run(a, a, 'random'));
  assert.throws(() => new BattleService().run(a, new Trainer('b', 'B'), 'random'));
  assert.throws(() => move('a', 0));
  assert.throws(() => new Pokemon('a', 'A', 1, 2));
  assert.throws(() => new Trainer('a', 'A', 1, 10));
});
