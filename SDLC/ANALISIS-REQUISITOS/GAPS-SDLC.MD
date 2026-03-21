
---

## 🔴 Análisis y Requisitos — Gaps

### RF faltantes:
| ID | Requisito no capturado |
|---|---|
| RF-11 | "Feel like a full game platform" — experiencia de plataforma, no solo comandos sueltos |
| RF-12 | Track **participation** explícitamente — no solo scores y winners |
| RF-13 | Access to special games como tipo de premio — no está en RF |
| RF-14 | Virtual items como tipo de premio — mencionado en client, ausente en RF |

### RNF faltantes:
| ID | Requisito no capturado |
|---|---|
| RNF-06 | Handle errors **especially DM failures** — el cliente lo enfatizó explícitamente, no está como RNF |
| RNF-07 | Prizes handled manually or via external — implica que el sistema debe ser auditable externamente |

---

## 🔴 Diseño Funcional — Gaps

### Casos de Uso faltantes:
| ID | Lo que falta |
|---|---|
| CU-11 | Jugador ve su **inventario** (`!inventory`) — el cliente menciona inventory/prizes en DB pero no hay comando para verlo |
| CU-12 | Admin configura premios para un juego antes de iniciarlo |
| CU-13 | Bot trackea **participación** aunque el jugador no gane — el cliente lo pidió explícitamente |

### Flujos incompletos:

**`!start` no tiene flujo definido con juego específico:**
```
-- Lo que tenemos es genérico
Admin !start trivia

-- Lo que falta
!start sin argumento → ¿qué pasa? ¿lista los juegos disponibles?
!start juegoInexistente → ¿qué responde el bot?
```

**El flujo de premio no cubre Virtual Items ni Special Access:**
```
-- Lo que tenemos
├── Coins → DB
├── Role → Discord API
├── Badge → DB inventory
├── Redeem Code → DM
└── Special Access → ??? (mencionado pero sin flujo)

-- Virtual Items no aparece en ningún flujo
```

**Falta el flujo de error handling completo:**
```
-- El cliente dijo "Handle errors especially DM failures"
-- Solo tenemos el fallback DM → canal
-- ¿Qué pasa si el canal también falla?
-- ¿Qué pasa si la DB está caída durante entrega de premio?
-- ¿Qué pasa si Discord API rate limit al asignar roles?
```

### Diseño por juego incompleto:
| Juego | Gap |
|---|---|
| **Spin Wheel** | No define cuántos jugadores participan ni si todos ganan algo o solo el seleccionado |
| **Guessing** | No define si hay múltiples rondas o es una sola |
| **Word Puzzle** | No define la fuente de palabras ni dificultad |
| **Reaction Speed** | No define qué pasa si nadie reacciona en el tiempo límite |

---

## 🔴 Diseño Técnico — Gaps

### Estructura de carpetas incompleta:
```
-- Lo que tenemos
src/
├── commands/
├── games/
├── systems/
├── database/
├── handlers/
├── utils/
└── index.ts

-- Lo que falta
├── plugins/          ← GameRegistry/Plugin pattern no tiene carpeta
├── cache/            ← LeaderboardCache no tiene carpeta
├── middleware/       ← Chain of Responsibility no tiene carpeta
├── scheduler/        ← PrizeDropScheduler no tiene carpeta
├── types/            ← interfaces y tipos TypeScript centralizados
└── config/           ← prizes.json existe pero no config general del bot
```

### DB Schema incompleto vs requisitos:
```sql
-- Lo que tenemos
users        → (id, discord_id, coins, badges, streak, last_daily)

-- Gaps críticos:
-- 'badges' es un campo en users? debería ser tabla separada
-- No hay tabla participation (el cliente pidió track participation)
-- No hay tabla virtual_items
-- No hay tabla special_access_grants
-- No hay tabla audit_log (requerido para prizes manuales externos)
-- No hay tabla guild_config (configuración por servidor)
-- No hay índices definidos en ninguna tabla
-- No hay foreign keys explícitas
-- No hay timestamps updated_at en users
-- redeem_codes no está en el schema original (lo añadimos en patrones pero nunca en el schema)
```

### Schema corregido y completo:
```sql
-- USUARIOS
users (
  id           TEXT PRIMARY KEY,
  discord_id   TEXT UNIQUE NOT NULL,
  guild_id     TEXT NOT NULL,
  coins        INTEGER DEFAULT 0,
  streak       INTEGER DEFAULT 0,
  last_daily   DATETIME,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
)

-- SESIONES DE JUEGO
game_sessions (
  id           TEXT PRIMARY KEY,
  guild_id     TEXT NOT NULL,
  channel_id   TEXT NOT NULL,
  game_type    TEXT NOT NULL,
  status       TEXT DEFAULT 'waiting',  -- waiting|active|finished|cancelled
  started_by   TEXT NOT NULL,           -- discord_id del admin
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  ended_at     DATETIME
)

-- PARTICIPACIÓN (nuevo — cliente lo pidió explícitamente)
participation (
  id           TEXT PRIMARY KEY,
  session_id   TEXT NOT NULL REFERENCES game_sessions(id),
  user_id      TEXT NOT NULL REFERENCES users(id),
  score        INTEGER DEFAULT 0,
  is_winner    BOOLEAN DEFAULT FALSE,
  joined_at    DATETIME DEFAULT CURRENT_TIMESTAMP
)

-- INVENTARIO GENERAL
inventory (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id),
  item_type    TEXT NOT NULL,  -- badge|virtual_item|special_access
  item_id      TEXT NOT NULL,  -- referencia al item específico
  obtained_at  DATETIME DEFAULT CURRENT_TIMESTAMP
)

-- BADGES (separado de users)
badges (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT,
  icon_url     TEXT,
  rarity       TEXT DEFAULT 'common'
)

-- VIRTUAL ITEMS (nuevo — cliente lo pidió)
virtual_items (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT,
  type         TEXT NOT NULL,
  value        TEXT
)

-- SPECIAL ACCESS (nuevo — cliente lo pidió)
special_access (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id),
  game_id      TEXT,           -- null = acceso a todos
  granted_by   TEXT NOT NULL,
  granted_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at   DATETIME        -- null = permanente
)

-- PREMIOS
prizes (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  type         TEXT NOT NULL,  -- coins|role|badge|redeem|virtual_item|special_access
  value        TEXT NOT NULL,
  rarity       TEXT DEFAULT 'common',
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
)

-- REDEEM CODES (del gap 10)
redeem_codes (
  id           TEXT PRIMARY KEY,
  code         TEXT UNIQUE NOT NULL,
  prize_id     TEXT REFERENCES prizes(id),
  status       TEXT DEFAULT 'available',
  claimed_by   TEXT REFERENCES users(id),
  claimed_at   DATETIME,
  version      INTEGER DEFAULT 0,
  expires_at   DATETIME,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
)

-- AUDIT LOG (para prizes manuales y acciones admin)
audit_log (
  id           TEXT PRIMARY KEY,
  action       TEXT NOT NULL,
  actor_id     TEXT NOT NULL,
  target_id    TEXT,
  metadata     TEXT,           -- JSON con detalles
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
)

-- CONFIG POR SERVIDOR
guild_config (
  guild_id           TEXT PRIMARY KEY,
  prefix             TEXT DEFAULT '!',
  game_channel_id    TEXT,
  log_channel_id     TEXT,
  drop_interval_min  INTEGER DEFAULT 15,
  drop_interval_max  INTEGER DEFAULT 60,
  updated_at         DATETIME DEFAULT CURRENT_TIMESTAMP
)

-- ÍNDICES
CREATE INDEX idx_users_discord_id      ON users(discord_id, guild_id);
CREATE INDEX idx_participation_session ON participation(session_id);
CREATE INDEX idx_participation_user    ON participation(user_id);
CREATE INDEX idx_inventory_user        ON inventory(user_id);
CREATE INDEX idx_audit_log_actor       ON audit_log(actor_id, created_at);
CREATE INDEX idx_game_sessions_guild   ON game_sessions(guild_id, status);
```

---

## ✅ Resumen de lo que hay que actualizar

| Sección | Estado actual | Acción |
|---|---|---|
| Requisitos Funcionales | Falta RF-11 al RF-14 | Añadir |
| Requisitos No Funcionales | Falta RNF-06 y RNF-07 | Añadir |
| Casos de Uso | Falta CU-11, CU-12, CU-13 | Añadir |
| Flujos | !start incompleto, error handling, virtual items, special access | Completar |
| Diseño por juego | 4 juegos con gaps | Completar |
| Estructura de carpetas | Falta plugins, cache, middleware, scheduler, types | Actualizar |
| DB Schema | 6 tablas faltantes, sin índices, sin FK | Reemplazar con schema completo |

---

## 📋 Plan de Resolución de Gaps — SDLC.MD

---

### 🔴 Gaps de Requisitos (RF/RNF)

**RF-11 al RF-14 + RNF-06 y RNF-07:**

Añadir directamente a la tabla de requisitos en el SDLC:

```
RF-11 → "Feel like a full game platform" — UI/UX consistente,
         embeds ricos, flujo cohesivo entre comandos
RF-12 → Track participation de todos los jugadores,
         no solo winners
RF-13 → Access to special games como tipo de premio
RF-14 → Virtual items como tipo de premio

RNF-06 → Error handling prioritario en DM failures,
          con fallback garantizado
RNF-07 → Auditabilidad externa de prizes manuales
```

---

### 🔴 Gaps de Casos de Uso

**CU-11, CU-12, CU-13:**

```
CU-11 → Jugador escribe !inventory → ve sus badges,
         virtual items y special access
CU-12 → Admin configura premios antes de !start
         mediante !setprize [juego] [tipo] [valor]
CU-13 → Bot registra participation de cada jugador
         al hacer !join, independientemente de si gana
```

---

### 🔴 Gaps de Flujos

**Flujo !start incompleto — definir casos edge:**
```
!start sin argumento
    → Bot responde con lista de juegos disponibles
      desde GameRegistry

!start [juegoInexistente]
    → Bot responde "Juego no encontrado"
      + sugiere !games list
```

**Flujo de error handling completo:**
```
Premio a entregar
    ↓
Intento 1: DM al ganador
    ├── ✅ Éxito → fin
    └── ❌ Falla → Intento 2: mensaje en canal
              ├── ✅ Éxito → fin
              └── ❌ Falla (rate limit/canal inválido)
                        → guardar en tabla pending_prizes
                        → reintentar en próximo evento
                        → notificar admin via log_channel
                        ↓
                  DB caída durante entrega
                        → transacción con rollback
                        → premio en cola pending_prizes
                        → retry automático cada 5 min
                        ↓
                  Discord API rate limit en roles
                        → cola de asignación con backoff
                        → exponential retry: 1s, 2s, 4s, 8s
```

**Flujo Virtual Items:**
```
Premio tipo virtual_item
    ↓
PrizeAdapter → VirtualItemAdapter
    ↓
Insertar en inventory DB
    ↓
Registrar en audit_log
    ↓
DM/canal: "🎁 Obtuviste: [nombre del item]"
```

**Flujo Special Access:**
```
Premio tipo special_access
    ↓
PrizeAdapter → SpecialAccessAdapter
    ↓
Insertar en special_access DB con expires_at
    ↓
¿Tiene rol de Discord asociado?
    ├── ✅ → asignar rol via Discord API
    └── ❌ → solo registro en DB
    ↓
DM/canal: "🔑 Acceso especial concedido: [juego]"
```

---

### 🔴 Gaps por Juego

```
Spin Wheel
    → Solo el jugador seleccionado gana el premio principal
    → Resto de participantes no reciben nada
    → Si 0 jugadores → bot cancela y avisa

Guessing
    → Una sola ronda por sesión
    → Si empate (misma distancia) → ambos ganan
      premio dividido en coins

Word Puzzle
    → Palabras desde wordlist.json configurable por admin
    → Dificultad: easy/medium/hard según longitud
      (easy: 4-5 letras, medium: 6-7, hard: 8+)

Reaction Speed
    → Si nadie reacciona en 30s → ronda cancelada
    → Bot anuncia "nadie fue lo suficientemente rápido"
    → Admin puede repetir o terminar sesión
```

---

### 🔴 Gaps de Estructura de Carpetas

```
discord-game-bot/
├── src/
│   ├── commands/
│   ├── games/
│   ├── systems/
│   ├── database/
│   ├── handlers/
│   ├── utils/
│   ├── plugins/       ← GameRegistry + Plugin pattern
│   ├── cache/         ← LeaderboardCache
│   ├── middleware/    ← Chain of Responsibility
│   ├── scheduler/     ← PrizeDropScheduler
│   └── types/         ← interfaces y tipos TS centralizados
├── data/
├── config/
│   ├── prizes.json
│   ├── wordlist.json  ← nuevo para Word Puzzle
│   └── bot.config.ts  ← configuración general
├── .env
├── tsconfig.json
└── package.json
```

---

### 🔴 Gap DB Schema

Reemplazar schema original con el schema completo ya definido que incluye:

- `users` — con updated_at y sin badges embebido
- `game_sessions` — con guild_id, channel_id, started_by
- `participation` — tabla nueva
- `inventory` — normalizada
- `badges` — tabla separada
- `virtual_items` — tabla nueva
- `special_access` — tabla nueva
- `prizes` — actualizada
- `redeem_codes` — con optimistic locking
- `audit_log` — tabla nueva
- `guild_config` — tabla nueva
- Todos los índices definidos
- Todas las foreign keys explícitas

---

---

## 🔴 Gaps adicionales no capturados

### Del cliente:
> *"The system should feel like a full game platform"*

RF-11 lo menciona pero no se tradujo a nada concreto funcional ni técnico. ¿Qué significa "platform feel" en términos de diseño? Embeds consistentes, sistema de anuncios entre juegos, lobby visible, historial de partidas. Eso no está en ningún flujo ni en la estructura.

---

> *"!reward → trigger prize system"*

El comando `!reward` aparece en los casos de uso como "asigna premio manualmente" pero el cliente lo definió como **trigger del prize system**, no solo asignación manual. Son dos comportamientos distintos. No está bien capturado.

---

> *"Access to special games"* como premio

RF-13 lo captura pero no hay ningún flujo que defina **qué es un special game**, cómo se restringe el acceso, cómo el bot valida si un jugador tiene acceso antes de dejarlo entrar con `!join`. Ese flujo de validación no existe.

---

> *"Virtual items"* como premio

RF-14 lo captura pero igual que special access — no hay definición de **qué es un virtual item** funcionalmente. ¿Tiene uso dentro del bot? ¿Es puramente cosmético? ¿Se puede tradear? Sin eso no se puede implementar ni la tabla ni el adapter correctamente.

---

> *"Be scalable for new games"*

RNF-01 lo dice pero técnicamente el Plugin/Registry pattern lo resuelve a nivel de código. Lo que **no está capturado** es el flujo de **cómo un admin agrega un juego nuevo en runtime** sin tocar código. El Builder Pattern existe en patrones pero no hay ningún caso de uso ni flujo funcional que lo describa paso a paso.

---

> *"pending_prizes"* en el flujo de error handling

El plan de resolución menciona guardar premios fallidos en `pending_prizes` pero esa tabla **no existe en el schema**. Es un gap técnico nuevo introducido por la solución misma.

---

> *"!games list"* sugerido en el plan

Se menciona como sugerencia en el flujo de `!start` pero no está definido como comando formal, no tiene caso de uso, no tiene RF asociado.

---

## 📋 Gaps adicionales a añadir antes de resolver

| # | Gap | Área |
|---|---|---|
| G-A | "Platform feel" sin definición concreta funcional/técnica | Funcional + Técnico |
| G-B | `!reward` mal capturado — trigger vs asignación manual | Funcional |
| G-C | Special games — flujo de validación de acceso en `!join` ausente | Funcional |
| G-D | Virtual items — definición funcional ausente | Funcional |
| G-E | Custom game creation — flujo funcional paso a paso ausente | Funcional |
| G-F | Tabla `pending_prizes` no está en schema | Técnico |
| G-G | `!games list` no formalizado como comando | Funcional + RF |

---

---

## 🔴 Lo que el cliente escribió que NO está capturado en ningún lado

### 1. "Players join and compete in real time"
"Real time" implica que los jugadores ven actualizaciones en vivo — scores cambiando, quién se unió, countdown visible. No hay ningún RF, RNF, flujo ni componente técnico que defina cómo se comunica el estado en tiempo real. ¿El bot edita mensajes? ¿Usa embeds que se actualizan? No está definido.

---

### 2. "The system should feel like a full game platform"
RF-11 lo menciona pero sigue siendo vago. El cliente viene de contexto Roblox. En Roblox hay lobby, waiting room, anuncio de inicio, cuenta regresiva, anuncio de ganador, historial. Nada de eso está en flujos concretos.

---

### 3. "Track scores, winners, and participation"
Participation está en CU-13 y en la tabla. Pero **winners históricos** — ¿hay un comando para ver historial de ganadores? ¿El cliente puede ver quién ganó qué juego cuándo? No hay RF ni comando para eso.

---

### 4. "The DM must include their prize/reward" — formato exacto
El cliente definió el formato **exacto** del DM:
```
🎉 You Won!
🏆 Game: Trivia Challenge
💰 Prize: 100 Coins
🎁 Reward: Rare Badge
Your prize has been added to your account!
```
No hay ningún componente técnico que defina cómo se construye este embed/mensaje. ¿Quién lo construye? ¿Dónde vive ese template? No está en utils, ni en DMSystem, ni en ningún flujo.

---

### 5. "Support multiple players at once" — lobby concurrente
ScopedEventEmitter cubre sesiones paralelas técnicamente. Pero funcionalmente no está definido **cuántos jugadores máximo por juego**, **qué pasa si se llena el lobby**, **qué pasa si un jugador intenta unirse a un juego ya iniciado**. Ninguno de esos edge cases está en flujos.

---

### 6. "Redeem codes (if external rewards exist)"
El cliente dijo **"if"** — es condicional. El RedeemAdapter y la tabla existen pero no hay flujo que defina **cómo el admin carga códigos externos al sistema**, de dónde vienen, qué formato tienen. Solo definimos cómo se entregan, no cómo entran al sistema.

---

### 7. "Real prizes must be handled manually or via external"
RNF-07 lo menciona como "auditabilidad" pero el cliente está diciendo algo más específico — necesita un mecanismo para que **él como admin sepa qué premios físicos debe entregar manualmente** después de que el bot notifique. No hay ningún flujo ni comando de admin que genere un reporte o lista de premios pendientes de entrega manual.

---

### 8. Comandos — el cliente definió exactamente 6
```
!join, !start, !play, !score, !leaderboard, !reward
```
Nosotros añadimos `!daily`, `!inventory`, `!games list`, `!setprize`, `!createGame`, `!drop`. Ninguno de estos está validado con el cliente. Los añadimos por cuenta propia sin base en CLIENT-REQUERIMENTS.MD.

---

## 📋 Gaps nuevos identificados

| # | Gap | Área |
|---|---|---|
| G-H | Real-time updates — cómo se comunica estado en vivo | Funcional + Técnico |
| G-I | Historial de ganadores — comando y tabla | Funcional + Técnico |
| G-J | Template del DM — quién lo construye y dónde vive | Técnico |
| G-K | Lobby limits — máximo jugadores, join tardío, lobby lleno | Funcional |
| G-L | Carga de redeem codes externos — flujo de entrada | Funcional |
| G-M | Reporte de premios manuales pendientes para el admin | Funcional |
| G-N | Comandos extra no validados con el cliente | Funcional |

---

---

## 🔍 Iteración Exhaustiva — CLIENT-REQUERIMENTS.MD

---

### Línea: *"Goal: Build a Discord bot that runs multiple game types"*
✅ Cubierto — RF-01, GameFactory, Strategy Pattern

---

### Línea: *"automatically sends winners a DM that contains their prize (reward details) after each game"*
✅ Cubierto — RF-03, DMSystem, PrizeAdapter
⚠️ **"after each game"** — ¿está definido el trigger exacto? ¿Es cuando `game_sessions.status = 'finished'`? El evento `game:winner` existe pero el trigger formal de "después de cada juego completo" vs "después de cada ronda" no está diferenciado. **Gap G-O.**

---

### Línea: *"Support multiple games (like Roblox-style variety)"*
✅ Cubierto — Plugin/Registry, Strategy
⚠️ **"Roblox-style"** refuerza G-A y G-H — lobby, waiting room, countdown. Sigue sin flujo concreto.

---

### Línea: *"Players join and compete in real time"*
🔴 G-H sigue abierto — real-time updates no definidos técnicamente.

---

### Línea: *"Track scores, winners, and participation"*
✅ Scores — participation table, ScoreService
✅ Participation — CU-13, tabla participation
🔴 **Winners históricos** — G-I sigue abierto. No hay tabla `game_winners` ni comando `!history`.

---

### Línea: *"When a player wins: The bot sends a Direct Message (DM)"*
✅ Cubierto — DMSystem, PrizeAdapter

---

### Línea: *"The DM must include their prize/reward"*
🔴 G-J sigue abierto — template del DM no tiene componente definido.

---

### Línea: *"The system should feel like a full game platform"*
🔴 G-A sigue abierto. Además identifico algo nuevo:
**"feel like"** implica consistencia visual — todos los mensajes del bot deben tener el mismo estilo de embed. No hay un `EmbedBuilder` centralizado definido en la arquitectura. **Gap G-P.**

---

### Línea: *"If DMs fail: Send the same message in the server instead"*
✅ Cubierto — fallback en PrizeAdapter
✅ Error handling completo cubierto en plan de resolución
⚠️ **"the same message"** — literalmente el mismo formato. Refuerza G-J, el template debe ser idéntico en DM y en canal.

---

### Línea: *"Prizes included in DMs can be: Coins / points"*
✅ Cubierto — CoinsAdapter

---

### Línea: *"Virtual items"*
🔴 G-D sigue abierto — definición funcional ausente.

---

### Línea: *"Roles (Discord perks)"*
✅ Cubierto — RoleAdapter

---

### Línea: *"Badges"*
✅ Cubierto — BadgeAdapter, tabla badges

---

### Línea: *"Access to special games"*
🔴 G-C sigue abierto — validación de acceso en `!join` no definida.

---

### Línea: *"Redeem codes (if external rewards exist)"*
🔴 G-L sigue abierto — flujo de carga de códigos externos no definido.
⚠️ Nuevo: **"if external rewards exist"** implica que el sistema debe funcionar perfectamente **sin** redeem codes. El bot no debe romperse si no hay códigos cargados. No hay manejo de este caso en ningún flujo. **Gap G-Q.**

---

### Línea: *"Trivia"*
✅ Cubierto — TriviaStrategy, flujo definido

---

### Línea: *"Reaction speed games"*
✅ Cubierto — ReactionStrategy
✅ Edge case (nadie reacciona) cubierto en plan

---

### Línea: *"Word puzzles"*
✅ Cubierto — WordPuzzleStrategy
✅ wordlist.json, dificultades definidas

---

### Línea: *"Math challenges"*
✅ Cubierto — MathStrategy

---

### Línea: *"Luck-based games (dice, spin wheel)"*
✅ Dice cubierto
✅ Spin Wheel cubierto con edge cases

---

### Línea: *"Guessing games"*
✅ Cubierto — GuessingStrategy, empate definido

---

### Línea: *"Elimination games"*
✅ Cubierto — Iterator Pattern, PlayerPool

---

### Línea: *"!join → join game"*
✅ Cubierto — JoinCommand
🔴 G-K sigue abierto — lobby lleno, join tardío no definidos.

---

### Línea: *"!start → start game (admin only)"*
✅ Cubierto — StartCommand, Role-Based Permissions
✅ Edge cases (!start sin argumento, juego inexistente) cubiertos en plan

---

### Línea: *"!play → participate"*
✅ Cubierto — PlayCommand, AntiCheat middleware
⚠️ Nuevo: **¿Cuál es la diferencia exacta entre `!join` y `!play`?** El cliente los define como comandos separados. `!join` = entrar al lobby, `!play` = participar activamente en la ronda. Ese flujo de dos pasos no está claramente diferenciado en ningún caso de uso ni flujo. **Gap G-R.**

---

### Línea: *"!score → check points"*
✅ Cubierto — ScoreCommand
⚠️ Nuevo: ¿`!score` muestra solo coins o también el historial de partidas ganadas? No está definido el alcance de lo que retorna. **Gap G-S.**

---

### Línea: *"!leaderboard → view rankings"*
✅ Cubierto — LeaderboardCache, LeaderboardCommand

---

### Línea: *"!reward → trigger prize system"*
🔴 G-B sigue abierto — trigger vs asignación manual no diferenciados.

---

### Línea: *"Must be built for Discord"*
✅ Cubierto — discord.js

---

### Línea: *"Use a database to store: user scores"*
✅ Cubierto — tabla users, participation

---

### Línea: *"inventory/prizes"*
✅ Cubierto — tabla inventory, prizes

---

### Línea: *"Support multiple players at once"*
✅ ScopedEventEmitter técnicamente
🔴 G-K sigue abierto funcionalmente

---

### Línea: *"Handle errors (especially DM failures)"*
✅ Cubierto — error handling completo en plan
✅ RNF-06

---

### Línea: *"Be scalable for new games"*
✅ Plugin/Registry Pattern
🔴 G-E sigue abierto — flujo funcional de custom game creation paso a paso

---

### Línea: *"Daily rewards"*
✅ Cubierto — DailyRewardService, StreakTier Table

---

### Línea: *"Streak bonuses"*
✅ Cubierto — State Pattern completo

---

### Línea: *"Random prize drops"*
✅ Cubierto — PrizeDropScheduler

---

### Línea: *"Admin-controlled rewards"*
✅ Cubierto — Role-Based Permissions, RewardCommand
🔴 G-M sigue abierto — reporte de premios manuales pendientes

---

### Línea: *"Custom game creation"*
🔴 G-E sigue abierto

---

### Línea: *"Anti-cheat / cooldowns"*
✅ Cubierto — SlidingWindowRateLimiter, consecuencias escalonadas

---

### Línea: *"The bot cannot send physical prizes directly"*
✅ RNF-07 parcialmente
🔴 G-M sigue abierto

---

### Línea: *"Instead, it sends prize information inside DMs"*
✅ Cubierto — DMSystem
🔴 G-J sigue abierto — template no tiene componente

---

### Línea: *"Real prizes must be handled manually or via external"*
🔴 G-M sigue abierto — flujo de admin para gestión manual no existe

---

## 📋 Mapa Completo y Final de Gaps

| # | Gap | Área | Estado |
|---|---|---|---|
| G-A | Platform feel sin definición concreta | Funcional + Técnico | 🔴 Abierto |
| G-B | `!reward` trigger vs asignación manual | Funcional | 🔴 Abierto |
| G-C | Special games — validación acceso en `!join` | Funcional | 🔴 Abierto |
| G-D | Virtual items — definición funcional | Funcional | 🔴 Abierto |
| G-E | Custom game creation — flujo funcional paso a paso | Funcional | 🔴 Abierto |
| G-F | Tabla `pending_prizes` no en schema | Técnico | 🔴 Abierto |
| G-G | `!games list` no formalizado | Funcional + RF | 🔴 Abierto |
| G-H | Real-time updates — estado en vivo | Funcional + Técnico | 🔴 Abierto |
| G-I | Historial de ganadores — tabla y comando | Funcional + Técnico | 🔴 Abierto |
| G-J | Template DM — componente centralizado | Técnico | 🔴 Abierto |
| G-K | Lobby limits — máximo jugadores, join tardío | Funcional | 🔴 Abierto |
| G-L | Carga de redeem codes externos — flujo entrada | Funcional | 🔴 Abierto |
| G-M | Reporte premios manuales pendientes para admin | Funcional | 🔴 Abierto |
| G-N | Comandos extra no validados con cliente | Funcional | 🔴 Abierto |
| G-O | Trigger "after each game" vs "after each round" | Funcional | 🔴 Abierto |
| G-P | EmbedBuilder centralizado — consistencia visual | Técnico | 🔴 Abierto |
| G-Q | Sistema funciona sin redeem codes cargados | Funcional | 🔴 Abierto |
| G-R | Diferencia exacta `!join` vs `!play` — flujo de dos pasos | Funcional | 🔴 Abierto |
| G-S | Alcance de `!score` — qué retorna exactamente | Funcional | 🔴 Abierto |

---

