# API Pokémon — Express, TypeScript et PostgreSQL

API REST pédagogique utilisant la programmation orientée objet pour gérer les Pokémon, leurs attaques, les dresseurs et les combats. Les réponses sont en JSON.

## Démarrer avec Docker

Double-cliquer sur `Lancer.command` dans le dossier `poke`, ou utiliser :

```sh
cd ~/Desktop/poke
docker compose up -d --build --wait
```

Le schéma est installé automatiquement. L'API est accessible sur `http://localhost:3000` ; `GET /health` vérifie PostgreSQL. Les services fonctionnent en arrière-plan. La base Docker conserve ses données dans le volume `poke_poke_data`.

```sh
docker compose ps
docker compose logs --tail=50 api
docker compose stop
```

## Classes et relations

- `Attack` : nom, dégâts, limite et compteur d'utilisation ; `use()`, `reset()`, `describe()`.
- `Pokemon` : nom, PV actuels et maximum, liste d'attaques ; `learn()`, `heal()`, `attack()`.
- `Trainer` : nom, niveau, expérience, équipe ; `addPokemon()`, `tavern()`, `gainExperience()`.
- `BattleService` : les quatre modes de combat.
- `GameRepository` : reconstitution des objets et persistance PostgreSQL.

Un Pokémon appartient à un dresseur. Le catalogue d'attaques est partagé ; la relation `pokemon_attacks` conserve un compteur d'usage et un ordre d'apprentissage propres à chaque Pokémon. Les PV, l'expérience, le niveau et les usages sont encapsulés dans les classes métier.

## Règles

- Un Pokémon apprend au maximum quatre attaques, sans doublon.
- Les soins restaurent ses PV maximum et réinitialisent les usages de toutes ses attaques. La taverne soigne toute l'équipe.
- Les coups alternent. Un Pokémon sans attaque disponible passe son tour ; si les deux sont épuisés, le combat est nul.
- Une victoire par K.O. rapporte 1 XP. Chaque tranche de 10 XP donne un niveau supplémentaire ; le reliquat est conservé.
- Le niveau initial est 1. Les PV ne descendent jamais sous zéro.
- Les dresseurs d'un défi doivent être distincts et posséder chacun au moins un Pokémon.

| Mode | Déroulement |
| --- | --- |
| `random` | Soins des deux équipes, choix aléatoire d'un Pokémon et des attaques, un duel. |
| `arena1` | 100 défis aléatoires avec soins avant chaque duel. Le plus haut niveau final gagne, puis l'XP en cas d'égalité. |
| `deterministic` | Pokémon vivant avec le plus de PV actuels, première attaque disponible, sans soins. Les égalités de PV sont départagées par UUID. |
| `arena2` | Jusqu'à 100 défis déterministes sans soins ni réinitialisation des usages. Arrêt si une équipe est entièrement K.O. |

Dans les arènes, le premier joueur alterne entre les combats. Une égalité reste possible. Si les deux équipes survivent après 100 combats en arène 2, le résultat est nul. Une victoire contre une équipe déjà entièrement K.O. ne rapporte pas d'XP.

## Routes

Corps et réponses en JSON. Les identifiants sont des UUID générés par le serveur.

| Méthode | Route | Corps / effet |
| --- | --- | --- |
| GET | `/` ou `/api` | Informations sur l'API |
| GET | `/health` | État de la connexion PostgreSQL |
| GET | `/trainers` ou `/trainers/:id` | Dresseurs et équipes |
| POST | `/trainers` | `{ "name": "Sacha" }` |
| GET | `/pokemon` ou `/pokemon/:id` | Pokémon avec attaques apprises |
| POST | `/trainers/:id/pokemon` | `{ "name": "Pikachu", "lifePoint": 100 }` |
| GET | `/attacks` ou `/attacks/:id` | Catalogue d'attaques |
| POST | `/attacks` | `{ "name": "Éclair", "damage": 25, "usageLimit": 20 }` |
| POST | `/pokemon/:id/attacks` | `{ "attackId": "UUID" }` |
| POST | `/pokemon/:id/heal` | Soigner un Pokémon |
| POST | `/trainers/:id/tavern` | Soigner toute l'équipe |
| POST | `/battles` | `{ "trainer1Id": "UUID", "trainer2Id": "UUID", "mode": "random" }` |

Une création répond `201`, avec un en-tête `Location`. Les autres succès répondent `200`. Les erreurs JSON utilisent `400` (validation), `404` (ressource absente), `409` (règle métier ou doublon), `413` (corps trop volumineux) ou `500` (erreur interne).

Les noms font 1 à 100 caractères ; les dégâts et PV vont de 1 à 10 000 ; la limite d'usage va de 1 à 100. Les compteurs du catalogue valent zéro ; les usages réels sont exposés dans les attaques du Pokémon.

Une réponse de combat contient le mode, le vainqueur éventuel, le nombre de duels, le journal des coups et l'état final des deux dresseurs. Les PV, usages et XP sont enregistrés atomiquement dans une transaction PostgreSQL. Un verrou transactionnel sérialise les opérations du jeu pour éviter les mises à jour perdues.

## Exemple

```sh
curl -X POST localhost:3000/trainers \
  -H 'Content-Type: application/json' -d '{"name":"Sacha"}'

curl -X POST localhost:3000/attacks \
  -H 'Content-Type: application/json' \
  -d '{"name":"Charge","damage":20,"usageLimit":20}'
```

Utiliser les UUID renvoyés pour ajouter des Pokémon, leur apprendre des attaques et lancer des combats. Les routes peuvent aussi être appelées avec Postman ou Insomnia.

## Variante locale sans Docker

Node.js 22 minimum est nécessaire. Double-cliquer sur `Lancer-sans-Docker.command`, ou exécuter `npm start`. Le lanceur prépare les dépendances, compile le code et démarre PostgreSQL natif et Express. Garder le terminal ouvert ; `Ctrl+C` arrête les services.

Les fichiers d'exécution et les données de cette variante sont conservés dans un dossier permanent sous `~/Library/Application Support/Poke API/`. Le chemin est affiché au lancement. Docker et la variante locale ont des bases distinctes et utilisent les mêmes ports : les lancer séparément.

Pour une base externe : configurer `DATABASE_URL` dans `.env`, puis exécuter `npm run build`, `npm run db:migrate` et `npm run start:external`.

## Vérifications

```sh
npm test
npm run build
```

Les tests métier et HTTP couvrent les limites d'apprentissage, les soins, les usages indépendants, l'expérience, les quatre modes et les erreurs de validation. Avec une base de test dédiée :

```sh
TEST_DATABASE_URL=postgresql://poke:poke@127.0.0.1:55432/poke_test npm run test:integration
```

Le test d'intégration vérifie les routes, la persistance, les combats concurrents et le rollback, puis supprime ses propres données.

Projet local pédagogique sans authentification. Les identifiants fournis sont des identifiants de développement.
