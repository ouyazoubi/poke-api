CREATE TABLE IF NOT EXISTS trainers (
  id uuid PRIMARY KEY,
  name varchar(100) NOT NULL CHECK (length(trim(name)) > 0),
  level integer NOT NULL DEFAULT 1 CHECK (level >= 1),
  experience integer NOT NULL DEFAULT 0 CHECK (experience >= 0 AND experience < 10)
);
CREATE TABLE IF NOT EXISTS attacks (
  id uuid PRIMARY KEY,
  name varchar(100) NOT NULL CHECK (length(trim(name)) > 0),
  damage integer NOT NULL CHECK (damage BETWEEN 1 AND 10000),
  usage_limit integer NOT NULL CHECK (usage_limit BETWEEN 1 AND 100)
);
CREATE UNIQUE INDEX IF NOT EXISTS attacks_name_unique ON attacks (lower(name));
CREATE TABLE IF NOT EXISTS pokemon (
  id uuid PRIMARY KEY,
  trainer_id uuid NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
  name varchar(100) NOT NULL CHECK (length(trim(name)) > 0),
  max_life_point integer NOT NULL CHECK (max_life_point BETWEEN 1 AND 10000),
  life_point integer NOT NULL CHECK (life_point BETWEEN 0 AND max_life_point)
);
CREATE INDEX IF NOT EXISTS pokemon_trainer_idx ON pokemon (trainer_id);
CREATE TABLE IF NOT EXISTS pokemon_attacks (
  pokemon_id uuid NOT NULL REFERENCES pokemon(id) ON DELETE CASCADE,
  attack_id uuid NOT NULL REFERENCES attacks(id) ON DELETE RESTRICT,
  slot integer NOT NULL CHECK (slot BETWEEN 0 AND 3),
  usage_count integer NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  PRIMARY KEY (pokemon_id, attack_id),
  UNIQUE (pokemon_id, slot)
);
