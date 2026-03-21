-- Initial schema migration
-- USUARIOS
CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,
  discord_id   TEXT NOT NULL,
  guild_id     TEXT NOT NULL,
  coins        INTEGER DEFAULT 0,
  streak       INTEGER DEFAULT 0,
  last_daily   DATETIME,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(discord_id, guild_id)
);

-- SESIONES DE JUEGO
CREATE TABLE IF NOT EXISTS game_sessions (
  id           TEXT PRIMARY KEY,
  guild_id     TEXT NOT NULL,
  channel_id   TEXT NOT NULL,
  game_type    TEXT NOT NULL,
  status       TEXT DEFAULT 'waiting',
  started_by   TEXT NOT NULL,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  ended_at     DATETIME
);

-- PARTICIPACIÓN
CREATE TABLE IF NOT EXISTS participation (
  id           TEXT PRIMARY KEY,
  session_id   TEXT NOT NULL REFERENCES game_sessions(id),
  user_id      TEXT NOT NULL REFERENCES users(id),
  score        INTEGER DEFAULT 0,
  is_winner    INTEGER DEFAULT 0,
  joined_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- GANADORES HISTÓRICOS
CREATE TABLE IF NOT EXISTS game_winners (
  id           TEXT PRIMARY KEY,
  session_id   TEXT NOT NULL REFERENCES game_sessions(id),
  user_id      TEXT NOT NULL REFERENCES users(id),
  game_type    TEXT NOT NULL,
  prize_id     TEXT REFERENCES prizes(id),
  score        INTEGER,
  won_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- INVENTARIO
CREATE TABLE IF NOT EXISTS inventory (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id),
  item_type    TEXT NOT NULL,
  item_id      TEXT NOT NULL,
  obtained_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- BADGES
CREATE TABLE IF NOT EXISTS badges (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT,
  icon_url     TEXT,
  rarity       TEXT DEFAULT 'common'
);

-- VIRTUAL ITEMS
CREATE TABLE IF NOT EXISTS virtual_items (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT,
  game_type    TEXT NOT NULL,
  type         TEXT NOT NULL,
  value        TEXT
);

-- SPECIAL ACCESS
CREATE TABLE IF NOT EXISTS special_access (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id),
  game_id      TEXT,
  granted_by   TEXT NOT NULL,
  granted_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at   DATETIME
);

-- PREMIOS
CREATE TABLE IF NOT EXISTS prizes (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  type         TEXT NOT NULL,
  value        TEXT NOT NULL,
  rarity       TEXT DEFAULT 'common',
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- PREMIOS PENDIENTES DE RECLAMAR
CREATE TABLE IF NOT EXISTS pending_prizes (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  session_id    TEXT REFERENCES game_sessions(id),
  prize_id      TEXT NOT NULL REFERENCES prizes(id),
  prize_type    TEXT NOT NULL,
  prize_value   TEXT NOT NULL,
  status        TEXT DEFAULT 'pending',
  attempts      INTEGER DEFAULT 0,
  last_attempt  DATETIME,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  claimed_at    DATETIME,
  expires_at    DATETIME
);

-- REDEEM CODES
CREATE TABLE IF NOT EXISTS redeem_codes (
  id           TEXT PRIMARY KEY,
  code         TEXT UNIQUE NOT NULL,
  prize_id     TEXT REFERENCES prizes(id),
  status       TEXT DEFAULT 'available',
  claimed_by   TEXT REFERENCES users(id),
  claimed_at   DATETIME,
  version      INTEGER DEFAULT 0,
  expires_at   DATETIME,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- AUDIT LOG
CREATE TABLE IF NOT EXISTS audit_log (
  id                   TEXT PRIMARY KEY,
  action               TEXT NOT NULL,
  actor_id             TEXT NOT NULL,
  target_id            TEXT,
  metadata             TEXT,
  manually_confirmed   INTEGER DEFAULT 0,
  confirmed_by         TEXT,
  confirmed_at         DATETIME,
  created_at           DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- CONFIG POR SERVIDOR
CREATE TABLE IF NOT EXISTS guild_config (
  guild_id              TEXT PRIMARY KEY,
  prefix                TEXT DEFAULT '!',
  game_channel_id       TEXT,
  log_channel_id        TEXT,
  drop_interval_min     INTEGER DEFAULT 15,  -- minutos
  drop_interval_max     INTEGER DEFAULT 60,  -- minutos
  max_players_per_game  INTEGER DEFAULT 10,
  min_players_per_game  INTEGER DEFAULT 2,
  lobby_wait_seconds    INTEGER DEFAULT 30,
  updated_at            DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- CUSTOM GAMES
CREATE TABLE IF NOT EXISTS custom_games (
  id              TEXT PRIMARY KEY,
  guild_id        TEXT NOT NULL,
  name            TEXT NOT NULL,
  base_type       TEXT NOT NULL,
  config          TEXT NOT NULL,
  created_by      TEXT NOT NULL,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(guild_id, name)
);

-- SCHEMA MIGRATIONS
CREATE TABLE IF NOT EXISTS schema_migrations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  applied_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ÍNDICES
CREATE INDEX IF NOT EXISTS idx_users_discord_guild    ON users(discord_id, guild_id);
CREATE INDEX IF NOT EXISTS idx_participation_session  ON participation(session_id);
CREATE INDEX IF NOT EXISTS idx_participation_user     ON participation(user_id);
CREATE INDEX IF NOT EXISTS idx_game_winners_user      ON game_winners(user_id, won_at);
CREATE INDEX IF NOT EXISTS idx_game_winners_type      ON game_winners(game_type, won_at);
CREATE INDEX IF NOT EXISTS idx_inventory_user         ON inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_prizes_user    ON pending_prizes(user_id, status);
CREATE INDEX IF NOT EXISTS idx_pending_prizes_status ON pending_prizes(status, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor        ON audit_log(actor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_game_sessions_guild    ON game_sessions(guild_id, status);
CREATE INDEX IF NOT EXISTS idx_special_access_user    ON special_access(user_id, expires_at);
