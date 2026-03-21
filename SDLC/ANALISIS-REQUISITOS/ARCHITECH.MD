# 🏗️ Arquitectura de Software — Discord Game Bot

---

## 1. Paradigma de Programación

El sistema usa **3 paradigmas combinados de manera deliberada:**

```
OOP (Object-Oriented)
→ Para entidades con estado y ciclo de vida
  BaseGame, GameSession, Player, Prize

Funcional
→ Para transformaciones de datos sin estado
  EmbedFactory, validators, parsers, calculators

Event-Driven
→ Para comunicación entre sistemas desacoplados
  ScopedEventEmitter, GameEventEmitter, PrizeDropScheduler
```

---

## 2. Principio de Diseño Global

**Arquitectura en Capas (Layered Architecture)**

```
┌─────────────────────────────────────────┐
│           PRESENTATION LAYER            │
│   Discord Events, Commands, Embeds      │
│   EmbedFactory, LiveMessageManager      │
├─────────────────────────────────────────┤
│           APPLICATION LAYER             │
│   GameOrchestrator, CommandRegistry     │
│   Chain of Responsibility, Middleware   │
├─────────────────────────────────────────┤
│            DOMAIN LAYER                 │
│   BaseGame, GameStrategy, PrizeSystem   │
│   StreakSystem, AntiCheatService        │
│   DailyRewardService, PlayerPool        │
├─────────────────────────────────────────┤
│         INFRASTRUCTURE LAYER            │
│   DatabaseService, GameRegistry         │
│   LeaderboardCache, PrizeDropScheduler  │
│   ScopedEventEmitter, AuditLogger       │
└─────────────────────────────────────────┘
```

**Regla fundamental:** Las dependencias solo apuntan hacia abajo.
El Domain Layer nunca conoce al Infrastructure Layer directamente — usa interfaces.
Ninguna capa superior importa detalles de implementación de capas inferiores.

---

## 3. Estructura de Carpetas Final

```
discord-game-bot/
├── src/
│   ├── presentation/
│   │   ├── commands/
│   │   │   ├── player/
│   │   │   │   ├── JoinCommand.ts
│   │   │   │   ├── PlayCommand.ts
│   │   │   │   ├── RewardCommand.ts
│   │   │   │   ├── ScoreCommand.ts
│   │   │   │   ├── LeaderboardCommand.ts
│   │   │   │   ├── InventoryCommand.ts
│   │   │   │   ├── HistoryCommand.ts     ← RF-17: !history victorias del jugador
│   │   │   │   ├── DailyCommand.ts
│   │   │   │   ├── GamesCommand.ts       ← RF-15: !games list | RF-16: !games info
│   │   │   └── admin/
│   │   │       ├── StartCommand.ts
│   │   │       ├── CreateGameCommand.ts
│   │   │       ├── AddCodesCommand.ts    ← RF-18: !addcodes batch upload
│   │   │       ├── PrizesCommand.ts
│   │   │       └── DropCommand.ts
│   │   ├── embeds/
│   │   │   └── EmbedFactory.ts
│   │   └── live/
│   │       └── LiveMessageManager.ts
│   │
│   ├── application/
│   │   ├── orchestrator/
│   │   │   └── GameOrchestrator.ts
│   │   ├── registry/
│   │   │   └── CommandRegistry.ts
│   │   └── middleware/
│   │       ├── PermissionMiddleware.ts
│   │       ├── CooldownMiddleware.ts
│   │       ├── AntiCheatMiddleware.ts
│   │       └── SessionValidationMiddleware.ts
│   │
│   ├── domain/
│   │   ├── games/
│   │   │   ├── base/
│   │   │   │   ├── BaseGame.ts
│   │   │   │   └── GameStrategy.ts
│   │   │   ├── builtin/
│   │   │   │   ├── TriviaGame.ts
│   │   │   │   ├── ReactionGame.ts
│   │   │   │   ├── MathGame.ts
│   │   │   │   ├── WordPuzzleGame.ts
│   │   │   │   ├── DiceGame.ts
│   │   │   │   ├── SpinWheelGame.ts
│   │   │   │   ├── GuessingGame.ts
│   │   │   │   └── EliminationGame.ts
│   │   │   └── special/
│   │   │       ├── TournamentGame.ts
│   │   │       ├── EventTriviaGame.ts
│   │   │       ├── HighStakesGame.ts
│   │   │       ├── MidnightDropGame.ts
│   │   │       └── BossBattleGame.ts
│   │   ├── prizes/
│   │   │   ├── PrizeSystem.ts
│   │   │   ├── adapters/
│   │   │   │   ├── CoinsAdapter.ts
│   │   │   │   ├── RoleAdapter.ts
│   │   │   │   ├── BadgeAdapter.ts
│   │   │   │   ├── RedeemAdapter.ts
│   │   │   │   ├── VirtualItemAdapter.ts
│   │   │   │   └── SpecialAccessAdapter.ts
│   │   │   └── DMSystem.ts
│   │   ├── players/
│   │   │   ├── PlayerPool.ts
│   │   │   └── PermissionService.ts
│   │   └── systems/
│   │       ├── StreakSystem.ts
│   │       ├── DailyRewardService.ts
│   │       ├── AntiCheatService.ts
│   │       └── RedeemCodeService.ts
│   │
│   ├── infrastructure/
│   │   ├── database/
│   │   │   ├── DatabaseService.ts
│   │   │   ├── schema.sql
│   │   │   └── migrations/
│   │   ├── cache/
│   │   │   └── LeaderboardCache.ts
│   │   ├── plugins/
│   │   │   ├── GameRegistry.ts
│   │   │   └── GameBuilder.ts
│   │   ├── scheduler/
│   │   │   └── PrizeDropScheduler.ts
│   │   ├── events/
│   │   │   └── ScopedEventEmitter.ts
│   │   └── logger/
│   │       ├── AuditLogger.ts
│   │       └── SystemLogger.ts
│   │
│   ├── types/
│   │   ├── game.types.ts
│   │   ├── prize.types.ts
│   │   ├── player.types.ts
│   │   ├── command.types.ts
│   │   └── event.types.ts
│   │
│   └── index.ts
│
├── config/
│   ├── prizes.json
│   ├── wordlist.json
│   └── bot.config.ts
│
├── data/
│   └── games.db
│
├── .env
├── .env.example
├── tsconfig.json
└── package.json
```

---

## 4. Requisitos Formales Derivados de RESOLVER-GAPS

### Requisitos Funcionales Adicionales
| ID | Requisito | Gap origen |
|---|---|---|
| RF-15 | `!games list` muestra todos los juegos disponibles desde GameRegistry — builtin + custom | G-G |
| RF-16 | `!games info [nombre]` muestra detalles, premio y duración estimada de un juego específico | G-G |
| RF-17 | `!history` muestra historial de victorias del jugador con juego, premio y fecha | G-I |
| RF-18 | Admin puede cargar redeem codes externos en batch via `!addcodes` con archivo .txt adjunto | G-L |

### Requisitos No Funcionales Adicionales
| ID | Requisito | Gap origen |
|---|---|---|
| RNF-08 | Real-time updates via message editing — el bot edita el mismo mensaje del lobby cada 5s, nunca hace spam de mensajes nuevos | G-H |
| RNF-09 | El sistema opera completamente sin redeem codes cargados — fallback automático a coins con notificación al admin via log_channel | G-Q |

### Comportamiento RNF-09 — Sin Redeem Codes
```
RedeemAdapter.deliver()
    ↓
¿Hay códigos disponibles en DB (status = 'available')?
    ├── ✅ Sí → entregar código normalmente via DM
    └── ❌ No → NO romper el flujo
                    ↓
              Entregar coins como fallback (valor configurable en prizes.json)
                    ↓
              SystemLogger.warn('No redeem codes available')
                    ↓
              Notificar admin via log_channel:
              "⚠️ No hay redeem codes disponibles.
               Se entregaron [X] coins como alternativa a @user"
                    ↓
              Registrar en audit_log con metadata: { fallback: true, reason: 'no_codes' }
```

---

## 5. Patrones de Diseño Implementados

### Creacionales
| Patrón | Dónde | Por qué |
|---|---|---|
| Factory | GameFactory | Crear instancias de juego sin que el comando conozca la implementación |
| Singleton | DatabaseService, BotClient | Una sola instancia de conexión DB y cliente Discord |
| Builder | GameBuilder | Construcción paso a paso de juegos custom por admin |

### Estructurales
| Patrón | Dónde | Por qué |
|---|---|---|
| Facade | GameOrchestrator | Simplifica la interfaz de todos los subsistemas para los comandos |
| Adapter | CoinsAdapter, RoleAdapter, BadgeAdapter, RedeemAdapter, VirtualItemAdapter, SpecialAccessAdapter | Normaliza la entrega de premios heterogéneos |
| Strategy | TriviaGame, ReactionGame, MathGame... | Lógica de juego intercambiable sin modificar BaseGame |

### De Comportamiento
| Patrón | Dónde | Por qué |
|---|---|---|
| Observer | ScopedEventEmitter | Desacopla ganador detectado de PrizeSystem, ScoreService, Logger |
| Command | JoinCommand, StartCommand... | Encapsula cada acción con permisos, cooldown y ejecución |
| Template Method | BaseGame | Esqueleto fijo del ciclo de vida; hooks sobreescribibles por juego |
| Chain of Responsibility | PermissionMiddleware → CooldownMiddleware → AntiCheatMiddleware → SessionValidationMiddleware | Validaciones encadenadas antes de ejecutar cualquier comando |
| State | StreakSystem (inactive/active/broken/maxed) | Estados de streak con transiciones controladas |
| Iterator | PlayerPool en EliminationGame | Eliminación ordenada y controlada de jugadores |

### Adicionales
| Patrón | Dónde | Por qué |
|---|---|---|
| Plugin/Registry | GameRegistry | Registro dinámico de juegos sin recompilar |
| Scheduler | PrizeDropScheduler | Drops aleatorios en background independiente |
| Read-Through Cache | LeaderboardCache | Leaderboard en memoria con invalidación por evento |
| Optimistic Locking | RedeemCodeService | Previene race conditions en claim de códigos |
| Scoped EventEmitter | ScopedEventEmitter | Aísla eventos por sesión — sin colisiones entre juegos paralelos |
| Role-Based Permission | PermissionService | Jerarquía Owner > Admin > Moderator > Player > Banned |

---

## 6. Flujo de Datos Global

```
Discord API
    ↓
index.ts → BotClient (Singleton)
    ↓
Event: messageCreate
    ↓
CommandRegistry.dispatch()
    ↓
Chain of Responsibility
    ├── PermissionMiddleware
    ├── CooldownMiddleware
    ├── AntiCheatMiddleware
    └── SessionValidationMiddleware
    ↓
Command.execute(context)
    ↓
GameOrchestrator (Facade)
    ↓
    ├──→ GameRegistry (Plugin/Registry)
    │        └──→ GameFactory
    │                 └──→ GameBuilder → BaseGame + Strategy
    │
    ├──→ ScopedEventEmitter (por sesión)
    │        ├──→ PrizeSystem → PrizeAdapter → entrega
    │        ├──→ ScoreService → DatabaseService
    │        ├──→ LeaderboardCache → invalidar
    │        └──→ AuditLogger → registrar
    │
    ├──→ LiveMessageManager → edita embeds en tiempo real
    │
    └──→ DMSystem → EmbedFactory → DM o fallback canal

Infrastructure (transversal)
    ├── DatabaseService (Singleton) ← todas las capas
    ├── BotClient (Singleton) ← todas las capas
    └── PrizeDropScheduler ← corre independiente en background
```

---

## 7. Interfaces Clave — Contratos entre Capas

```typescript
// Contrato de todo juego
interface GameStrategy {
  start(session: GameSession): Promise<void>
  evaluateAnswer(input: string, ctx: GameContext): boolean
  calculateWinner(participants: Participant[]): Participant
  end(session: GameSession): Promise<void>
}

// Contrato de entrega de premio
interface PrizeDelivery {
  deliver(userId: string, prize: Prize): Promise<DeliveryResult>
  canDeliver(userId: string, prize: Prize): Promise<boolean>
}

// Contrato de comando
interface BotCommand {
  name: string
  aliases: string[]
  requiredRole: BotRole
  cooldown: number
  execute(ctx: CommandContext): Promise<void>
}

// Contrato de middleware
interface Middleware {
  handle(ctx: CommandContext, next: () => Promise<void>): Promise<void>
}

// Contrato de plugin de juego
interface GamePlugin {
  metadata: GameMetadata
  strategy: GameStrategy
  builder?: GameBuilder
}

// Contrato de repositorio — Dependency Inversion en DB
interface UserRepository {
  findByDiscordId(discordId: string, guildId: string): Promise<User | null>
  upsert(user: Partial<User>): Promise<User>
  updateCoins(userId: string, amount: number): Promise<void>
}

// Contrato de logger
interface Logger {
  error(msg: string, meta?: object): void
  warn(msg: string, meta?: object): void
  info(msg: string, meta?: object): void
  debug(msg: string, meta?: object): void
}

// Contrato de EmbedFactory — fuente única de todos los embeds
// Usa EMBED_COLORS para consistencia visual total
// Métodos completos alineados con UI-UX.MD
abstract class EmbedFactory {
  // Ciclo de vida del juego
  static gameAnnounce(data: GameAnnounceData): EmbedBuilder    // color: GAME_ANNOUNCE
  static gameLobby(data: LobbyState): EmbedBuilder             // color: LOBBY
  static roundStart(data: RoundStartData): EmbedBuilder        // color: ROUND_START
  static roundResult(data: RoundResultData): EmbedBuilder      // color: ROUND_RESULT
  static roundTimeout(data: RoundTimeoutData): EmbedBuilder    // color: ROUND_TIMEOUT
  static gameEnd(data: GameEndData): EmbedBuilder              // color: GAME_END

  // Premios — template exacto especificado por el cliente
  static winnerDM(data: WinnerDMData): EmbedBuilder            // color: WINNER_DM
  static winnerChannel(data: WinnerDMData): EmbedBuilder       // color: WINNER_DM — mismo template, fallback canal
  static prizeDrop(data: PrizeDropData): EmbedBuilder          // color: PRIZE_DROP
  static prizeDropWinner(data: PrizeDropWinnerData): EmbedBuilder
  static prizeDropExpired(): EmbedBuilder

  // Comandos de jugador
  static score(data: ScoreData): EmbedBuilder                  // color: SCORE
  static leaderboard(data: LeaderboardData): EmbedBuilder      // color: LEADERBOARD
  static inventory(data: InventoryData): EmbedBuilder          // color: INVENTORY
  static history(data: HistoryData): EmbedBuilder              // color: HISTORY
  static gamesList(data: GamesListData): EmbedBuilder          // color: INFO
  static gamesInfo(data: GameInfoData): EmbedBuilder           // color: INFO

  // Daily / Streak
  static dailyClaim(data: DailyClaimData): EmbedBuilder        // color: DAILY_REWARD
  static dailyAlreadyClaimed(data: DailyAlreadyData): EmbedBuilder
  static streakBroken(data: StreakBrokenData): EmbedBuilder

  // Admin
  static prizesPending(data: PrizesPendingData): EmbedBuilder  // color: ADMIN
  static codesLoaded(count: number): EmbedBuilder              // color: SUCCESS
  static customGameCreated(data: CustomGameData): EmbedBuilder // color: SUCCESS
  static customGameSummary(data: CustomGameData): EmbedBuilder // color: ADMIN

  // Sistema
  static error(message: string, suggestion?: string): EmbedBuilder  // color: ERROR
  static warning(message: string): EmbedBuilder                     // color: WARNING
  static success(message: string): EmbedBuilder                     // color: SUCCESS
  static info(message: string): EmbedBuilder                        // color: INFO
  static cooldown(remaining: number): EmbedBuilder                  // color: WARNING
  static noPermission(requiredRole: string): EmbedBuilder           // color: ERROR
}
```

---

## 8. Principios SOLID Aplicados

```
S — Single Responsibility
    Cada clase tiene UN propósito.
    EmbedFactory solo construye embeds.
    DatabaseService solo maneja conexión y queries.
    AntiCheatService solo valida comportamiento sospechoso.
    DMSystem solo maneja entrega de mensajes directos.

O — Open/Closed
    Agregar juego nuevo = nueva clase que implementa GameStrategy.
    Nunca modificar BaseGame ni GameOrchestrator.
    Agregar premio nuevo = nueva clase que implementa PrizeDelivery.
    Agregar middleware = nuevo eslabón en la cadena, sin tocar los existentes.

L — Liskov Substitution
    TriviaGame, MathGame, ReactionGame son
    intercambiables donde BaseGame es esperado.
    CoinsAdapter, RoleAdapter son intercambiables
    donde PrizeDelivery es esperado.
    Cualquier implementación de UserRepository es
    intercambiable en los servicios del dominio.

I — Interface Segregation
    GameStrategy no tiene métodos de premio.
    PrizeDelivery no tiene métodos de juego.
    BotCommand no tiene lógica de DB.
    Logger no tiene lógica de auditoría de negocio.
    UserRepository no expone métodos de game_sessions.

D — Dependency Inversion
    GameOrchestrator depende de GameStrategy (interfaz)
    no de TriviaGame (implementación).
    PrizeSystem depende de PrizeDelivery (interfaz)
    no de CoinsAdapter (implementación).
    Domain layer depende de UserRepository (interfaz)
    no de DatabaseService (implementación).
```

---

## 9. Clean Code — Principios Aplicados

### DRY (Don't Repeat Yourself)
```
Los 8 juegos comparten lógica común en BaseGame:
→ announce(), waitForPlayers(), deliverPrize(), cleanup()
Solo roundLogic() y evaluateWinner() son sobreescritos.

EmbedFactory centraliza TODOS los templates de embed.
Sin duplicación de estilos entre comandos.

Constants.ts centraliza todos los valores mágicos:
→ LOBBY_WAIT_SECONDS, MAX_PLAYERS, MIN_REACTION_MS, etc.
```

### KISS (Keep It Simple, Stupid)
```
Cada función hace UNA cosa y la hace bien.
GameOrchestrator no contiene lógica de juego — delega.
PermissionMiddleware no contiene lógica de cooldown — delega.
Si una función supera 30 líneas, se divide.
```

### YAGNI (You Aren't Gonna Need It)
```
Decisiones de NO implementar:
→ No REST API externa (no hay dashboard web en requisitos)
→ No WebSockets propios (Discord maneja el real-time)
→ No Redis (SQLite es suficiente para 1 servidor)
→ No microservicios (un proceso Node.js es suficiente)
→ No i18n (cliente no lo pidió)
```

### Naming Conventions (TypeScript)
```
Clases:         PascalCase     → GameOrchestrator, PrizeSystem
Interfaces:     PascalCase     → GameStrategy, PrizeDelivery
Tipos:          PascalCase     → GameSession, Participant
Funciones:      camelCase      → evaluateAnswer(), deliverPrize()
Variables:      camelCase      → sessionId, userId, prizeType
Constantes:     UPPER_SNAKE    → MAX_PLAYERS, LOBBY_WAIT_SECONDS
Archivos:       PascalCase.ts  → BaseGame.ts, EmbedFactory.ts
Enums:          PascalCase     → BotRole.ADMIN, GameStatus.ACTIVE
```

### Error Boundaries — Propagación entre Capas
```
Presentation Layer:
→ Captura TODOS los errores de comandos
→ Nunca expone stack traces al usuario
→ Responde con EmbedFactory.error(mensajeAmigable)
→ Loggea el error completo en SystemLogger

Application Layer:
→ Captura errores de GameOrchestrator
→ Rollback de transacciones si la DB falla mid-game
→ Emite evento 'session:error' al ScopedEventEmitter

Domain Layer:
→ Lanza errores tipados (GameError, PrizeError, AuthError)
→ Nunca lanza strings o Error genéricos

Infrastructure Layer:
→ DatabaseService envuelve excepciones de SQLite
   en DatabaseError con contexto útil
→ Retry automático con backoff en llamadas a Discord API
```

### No Magic Numbers — Constants.ts
```typescript
export const GAME_CONSTANTS = {
  LOBBY_WAIT_SECONDS: 30,
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 10,
  MIN_REACTION_MS: 80,        // menor = bot/cheat
  SPAM_WINDOW_MS: 3000,
  SPAM_MAX_MESSAGES: 5,
  COOLDOWN_PLAY_MS: 2000,
  COOLDOWN_JOIN_MS: 1000,
  ROUND_TIMEOUT_MS: 15000,
  LEADERBOARD_TTL_MS: 60000,
  DROP_INTERVAL_MIN_MS: 900000,   // 15 min
  DROP_INTERVAL_MAX_MS: 3600000,  // 60 min
  DROP_REACTION_WINDOW_MS: 30000,
  PRIZE_RETRY_MAX: 3,
  PRIZE_RETRY_BACKOFF_MS: 50,
  STREAK_WINDOW_MIN_HOURS: 20,
  STREAK_WINDOW_MAX_HOURS: 28,
  MAX_STREAK_MULTIPLIER: 5.0,
}

// Paleta de colores — un color por tipo de mensaje
// Definida en src/presentation/embeds/EmbedFactory.ts
// Usada exclusivamente por EmbedFactory — nunca hardcodeada en comandos
export const EMBED_COLORS = {
  // Ciclo de vida del juego
  GAME_ANNOUNCE:   0x5865F2,  // Blurple — anuncio de juego
  LOBBY:           0x5865F2,  // Blurple — lobby activo
  ROUND_START:     0xFEE75C,  // Amarillo — ronda iniciando
  ROUND_RESULT:    0x57F287,  // Verde — respuesta correcta
  ROUND_TIMEOUT:   0xED4245,  // Rojo — tiempo agotado
  GAME_END:        0xFFD700,  // Dorado — fin de juego / ganador

  // Premios
  WINNER_DM:       0xFFD700,  // Dorado — DM de victoria (template cliente)
  PRIZE_DROP:      0xEB459E,  // Rosa — drop aleatorio
  DAILY_REWARD:    0x57F287,  // Verde — daily claim exitoso
  REWARD_CLAIMED:  0x57F287,  // Verde — premio reclamado

  // Perfil / Stats
  SCORE:           0x5865F2,  // Blurple — perfil del jugador
  LEADERBOARD:     0xFFD700,  // Dorado — rankings
  INVENTORY:       0x5865F2,  // Blurple — inventario
  HISTORY:         0x5865F2,  // Blurple — historial de victorias

  // Sistema
  ERROR:           0xED4245,  // Rojo — todos los errores
  WARNING:         0xFEE75C,  // Amarillo — advertencias
  INFO:            0x5865F2,  // Blurple — información general
  SUCCESS:         0x57F287,  // Verde — confirmaciones
  ADMIN:           0xEB459E,  // Rosa — acciones admin

  // Juegos especiales
  SPECIAL_GAME:    0xF47FFF,  // Púrpura — eventos especiales
  TOURNAMENT:      0xFFD700,  // Dorado — torneos
}
```

---

## 10. Security by Design (SbD) — Transversal

### Threat Model — Amenazas Específicas de un Bot de Discord
```
AMENAZA 1: Command injection
→ Usuario envía input malicioso en respuestas de juego
→ Mitigación: sanitización en CommandContext antes de procesar

AMENAZA 2: SQL injection
→ Input de usuario llega a queries de DB
→ Mitigación: prepared statements únicamente, NUNCA string concat

AMENAZA 3: Bot automatizado (cheat)
→ Script responde en <80ms o hace spam de comandos
→ Mitigación: SlidingWindowRateLimiter + detección inhumana

AMENAZA 4: Privilege escalation
→ Jugador intenta ejecutar comandos de admin
→ Mitigación: PermissionMiddleware valida BotRole en CADA comando

AMENAZA 5: Race condition en premios
→ Dos requests reclaman el mismo redeem code simultáneamente
→ Mitigación: Optimistic Locking con version field en DB

AMENAZA 6: Token exposure
→ Bot token hardcodeado en código fuente
→ Mitigación: .env obligatorio, .env nunca en git, .env.example sin valores

AMENAZA 7: Guild data leakage
→ Datos de un servidor visibles en otro
→ Mitigación: guild_id en todas las queries, guild-scoped por defecto

AMENAZA 8: Denial of Service (bot)
→ Flood de comandos satura el event loop
→ Mitigación: Rate limiting global + por usuario + por guild
```

### Trust Boundaries
```
NO confiamos en:
→ Contenido de mensajes de Discord (siempre sanitizar)
→ IDs de roles enviados por usuarios (siempre validar contra Discord API)
→ Argumentos de comandos (siempre validar tipo y rango)

SÍ confiamos en:
→ IDs de usuario de Discord (generados por Discord, no modificables)
→ Guild ID del contexto del mensaje (generado por Discord)
→ Variables de entorno del servidor (controladas por nosotros)
```

### Principle of Least Privilege
```
Bot Intents declarados (solo los necesarios):
→ GUILDS
→ GUILD_MESSAGES
→ GUILD_MESSAGE_REACTIONS
→ GUILD_MEMBERS (para asignar roles)
→ DIRECT_MESSAGES
→ MESSAGE_CONTENT (privileged intent — solo para leer comandos)

NO se solicitan intents innecesarios:
→ GUILD_PRESENCES ← no necesario
→ GUILD_BANS ← no necesario
→ GUILD_INTEGRATIONS ← no necesario

Cada componente accede solo a su capa:
→ Commands no acceden a DatabaseService directamente
→ Domain layer no accede a Discord API directamente
→ Middleware no accede a GameRegistry
```

### Defense in Depth
```
Capa 1 — Red: Rate limiting por usuario/guild
Capa 2 — Entrada: Input sanitization en CommandContext
Capa 3 — Autorización: PermissionMiddleware + BotRole
Capa 4 — Aplicación: AntiCheatService + SlidingWindowRateLimiter
Capa 5 — Datos: Prepared statements + Optimistic Locking
Capa 6 — Auditoría: AuditLogger en todas las acciones admin
```

### Secure Defaults
```
guild_config defaults seguros:
→ prefix: '!'                    (no vacío)
→ max_players_per_game: 10       (límite razonable)
→ min_players_per_game: 2        (evita juegos de 1)
→ lobby_wait_seconds: 30         (ventana razonable)
→ drop_interval_min: 15 min      (no flood de drops)
→ log_channel_id: null           (silencioso hasta configurar)

Bot arranca en modo seguro:
→ Sin guild_config → usa defaults, no falla
→ Sin redeem codes → fallback a coins, no falla
→ Sin log_channel → logs solo en archivo, no falla
```

---

## 11. Base de Datos — Schema Completo

### Tablas

```sql
-- USUARIOS
CREATE TABLE users (
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
CREATE TABLE game_sessions (
  id           TEXT PRIMARY KEY,
  guild_id     TEXT NOT NULL,
  channel_id   TEXT NOT NULL,
  game_type    TEXT NOT NULL,
  status       TEXT DEFAULT 'waiting',
  -- waiting | active | finished | cancelled
  started_by   TEXT NOT NULL,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  ended_at     DATETIME
);

-- PARTICIPACIÓN
CREATE TABLE participation (
  id           TEXT PRIMARY KEY,
  session_id   TEXT NOT NULL REFERENCES game_sessions(id),
  user_id      TEXT NOT NULL REFERENCES users(id),
  score        INTEGER DEFAULT 0,
  is_winner    INTEGER DEFAULT 0,  -- 0=false, 1=true (SQLite)
  joined_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- GANADORES HISTÓRICOS
CREATE TABLE game_winners (
  id           TEXT PRIMARY KEY,
  session_id   TEXT NOT NULL REFERENCES game_sessions(id),
  user_id      TEXT NOT NULL REFERENCES users(id),
  game_type    TEXT NOT NULL,
  prize_id     TEXT REFERENCES prizes(id),
  score        INTEGER,
  won_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- INVENTARIO
CREATE TABLE inventory (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id),
  item_type    TEXT NOT NULL,  -- badge | virtual_item | special_access
  item_id      TEXT NOT NULL,
  obtained_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- BADGES
CREATE TABLE badges (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT,
  icon_url     TEXT,
  rarity       TEXT DEFAULT 'common'
  -- common | rare | epic | legendary
);

-- VIRTUAL ITEMS
CREATE TABLE virtual_items (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT,
  game_type    TEXT NOT NULL,  -- juego al que pertenece
  type         TEXT NOT NULL,  -- cosmetic | collectible
  value        TEXT            -- metadata JSON
);

-- SPECIAL ACCESS
CREATE TABLE special_access (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id),
  game_id      TEXT,           -- null = acceso a todos los especiales
  granted_by   TEXT NOT NULL,
  granted_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at   DATETIME        -- null = permanente
);

-- PREMIOS
CREATE TABLE prizes (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  type         TEXT NOT NULL,
  -- coins | role | badge | redeem | virtual_item | special_access
  value        TEXT NOT NULL,
  rarity       TEXT DEFAULT 'common',
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- PREMIOS PENDIENTES DE RECLAMAR
CREATE TABLE pending_prizes (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  session_id    TEXT REFERENCES game_sessions(id),
  prize_id      TEXT NOT NULL REFERENCES prizes(id),
  prize_type    TEXT NOT NULL,
  prize_value   TEXT NOT NULL,
  status        TEXT DEFAULT 'pending',
  -- pending | claimed | expired | failed
  attempts      INTEGER DEFAULT 0,
  last_attempt  DATETIME,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  claimed_at    DATETIME,
  expires_at    DATETIME
);

-- REDEEM CODES
CREATE TABLE redeem_codes (
  id           TEXT PRIMARY KEY,
  code         TEXT UNIQUE NOT NULL,
  prize_id     TEXT REFERENCES prizes(id),
  status       TEXT DEFAULT 'available',
  -- available | claimed | expired
  claimed_by   TEXT REFERENCES users(id),
  claimed_at   DATETIME,
  version      INTEGER DEFAULT 0,  -- optimistic locking
  expires_at   DATETIME,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- AUDIT LOG
CREATE TABLE audit_log (
  id                   TEXT PRIMARY KEY,
  action               TEXT NOT NULL,
  actor_id             TEXT NOT NULL,
  target_id            TEXT,
  metadata             TEXT,  -- JSON
  manually_confirmed   INTEGER DEFAULT 0,
  confirmed_by         TEXT,
  confirmed_at         DATETIME,
  created_at           DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- CONFIG POR SERVIDOR
CREATE TABLE guild_config (
  guild_id              TEXT PRIMARY KEY,
  prefix                TEXT DEFAULT '!',
  game_channel_id       TEXT,
  log_channel_id        TEXT,
  drop_interval_min     INTEGER DEFAULT 15,
  drop_interval_max     INTEGER DEFAULT 60,
  max_players_per_game  INTEGER DEFAULT 10,
  min_players_per_game  INTEGER DEFAULT 2,
  lobby_wait_seconds    INTEGER DEFAULT 30,
  updated_at            DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- CUSTOM GAMES (creados por admin)
CREATE TABLE custom_games (
  id              TEXT PRIMARY KEY,
  guild_id        TEXT NOT NULL,
  name            TEXT NOT NULL,
  base_type       TEXT NOT NULL,
  config          TEXT NOT NULL,  -- JSON con toda la config
  created_by      TEXT NOT NULL,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(guild_id, name)
);
```

### Índices

```sql
CREATE INDEX idx_users_discord_guild    ON users(discord_id, guild_id);
CREATE INDEX idx_participation_session  ON participation(session_id);
CREATE INDEX idx_participation_user     ON participation(user_id);
CREATE INDEX idx_game_winners_user      ON game_winners(user_id, won_at);
CREATE INDEX idx_game_winners_type      ON game_winners(game_type, won_at);
CREATE INDEX idx_inventory_user         ON inventory(user_id);
CREATE INDEX idx_pending_prizes_user    ON pending_prizes(user_id, status);
CREATE INDEX idx_pending_prizes_status  ON pending_prizes(status, created_at);
CREATE INDEX idx_audit_log_actor        ON audit_log(actor_id, created_at);
CREATE INDEX idx_game_sessions_guild    ON game_sessions(guild_id, status);
CREATE INDEX idx_special_access_user    ON special_access(user_id, expires_at);
```

### Estrategia de Migraciones
```
src/infrastructure/database/migrations/
    ├── 001_initial_schema.sql      ← schema base completo
    ├── 002_add_custom_games.sql    ← si se añade después
    └── migrator.ts                 ← corre migraciones al iniciar

Reglas:
→ Nunca modificar una migración existente
→ Siempre añadir nueva migración para cambios
→ Migrator corre automáticamente en cada arranque
→ Tabla 'schema_migrations' trackea qué migraciones corrieron
```

### Inicialización en Primer Arranque
```
index.ts arranca
    ↓
DatabaseService.initialize()
    ↓
¿Existe games.db?
    ├── No → ejecutar 001_initial_schema.sql
    └── Sí → ejecutar migraciones pendientes
    ↓
Verificar integridad de tablas
    ↓
Bot listo
```

### Estrategia de Backup
```
→ Backup automático diario de games.db a data/backups/
→ Mantener últimos 7 backups
→ Nombre: games_YYYY-MM-DD.db
→ PrizeDropScheduler ejecuta backup a las 00:00 UTC
```

---

## 12. Asincronismo

```
Estrategia global: async/await sobre Promises
No callbacks — sin callback hell
No blocking en event loop principal

Concurrencia controlada:
┌─────────────────────────────────────────────────┐
│ Múltiples sesiones paralelas                    │
│ → ScopedEventEmitter aísla eventos por sesión  │
│ → Cada sesión tiene su propio estado en memoria │
│                                                 │
│ Race conditions en Reaction Speed               │
│ → Promise.race() con mutex lock por sesión     │
│ → Solo el primer resolve cuenta                │
│                                                 │
│ Timeouts de ronda                               │
│ → Promise.race([awaitAnswer(), roundTimeout()]) │
│                                                 │
│ Retry de premios                                │
│ → Exponential backoff: 50ms, 100ms, 150ms      │
│                                                 │
│ Message editing en tiempo real                  │
│ → setInterval cada 5s con cleanup en end()     │
│ → clearInterval obligatorio al terminar sesión │
│                                                 │
│ better-sqlite3 (síncrono)                       │
│ → Aislado en DatabaseService                   │
│ → Nunca llamado directamente desde Domain      │
│ → Wrapeado en métodos async para consistencia  │
│                                                 │
│ PrizeDropScheduler                              │
│ → setTimeout recursivo — no setInterval        │
│ → Se reprograma al completar — no se acumula   │
└─────────────────────────────────────────────────┘
```

---

## 13. Comunicación Interna — Catálogo de Eventos

### Eventos de Sesión (Scoped — por sessionId)
```
session:started       → { sessionId, gameType, channelId, guildId }
session:player_joined → { sessionId, userId, totalPlayers }
session:round_start   → { sessionId, roundNumber, question }
session:round_end     → { sessionId, roundNumber, winnerId, scores }
session:winner        → { sessionId, userId, prize, gameType }
session:ended         → { sessionId, reason: 'finished'|'cancelled'|'no_players' }
session:error         → { sessionId, error, context }
```

### Eventos Globales (ScopedEventEmitter.global())
```
drop:announced        → { channelId, prize, messageId }
drop:winner           → { userId, prize, guildId }
bot:ready             → { guilds: string[] }
bot:error             → { error, context }
daily:claimed         → { userId, streak, prize }
```

### Reglas de Eventos
```
Error en observer:
→ El error NO se propaga al emisor
→ Se loggea en SystemLogger como ERROR
→ Los demás observers continúan ejecutándose

Event ordering:
→ Los observers de una sesión se ejecutan en paralelo (Promise.all)
→ Excepción: ScoreService debe completar antes de AuditLogger
  (se garantiza con await explícito en GameOrchestrator)

Dead letter:
→ Si ningún observer escucha un evento → SystemLogger.warn()
→ No falla silenciosamente

Cleanup:
→ ScopedEventEmitter.destroySession(sessionId) al terminar
→ Elimina todos los listeners de esa sesión
→ Previene memory leaks en sesiones largas
```

---

## 14. Discord API — Diseño y Uso

### Intents Requeridos
```typescript
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,       // asignar roles
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,     // privileged intent
  ]
})
```

### Gateway Events Utilizados
```
messageCreate     → despachar comandos
messageReactionAdd → prize drops (primero en reaccionar)
guildMemberAdd    → crear registro de usuario automáticamente
guildCreate       → inicializar guild_config con defaults
guildDelete       → limpiar datos del servidor (opcional)
```

### REST vs Gateway
```
Gateway (tiempo real, events push):
→ Recibir mensajes y reacciones
→ Detectar entrada de nuevos miembros

REST (llamadas directas):
→ Editar mensajes del lobby (LiveMessageManager)
→ Enviar DMs (DMSystem)
→ Asignar/remover roles (RoleAdapter)
→ Fetch de member info (PermissionService)
```

### Rate Limits de Discord
```
Global:          50 requests/segundo
Per-route:       varía por endpoint
Message edit:    5 edits/10s por mensaje

Estrategia:
→ discord.js maneja rate limits automáticamente con queue
→ LiveMessageManager edita cada 5s — bien dentro del límite
→ RoleAdapter usa queue con backoff para asignación masiva
→ No hacer burst de DMs — PrizeSystem los espacía 500ms entre DMs
```

### Timeout Policies
```
DM attempt:      5 segundos → falla → fallback canal
Role assignment: 10 segundos → falla → retry × 3 → log error
Message edit:    3 segundos → falla → log warn, continúa
API call global: 15 segundos → falla → lanza DiscordAPIError
```

### No hay API interna expuesta
```
Decisión (YAGNI): No se implementa REST API interna.
Razón: El cliente no requiere dashboard web.
Futuro: Si se necesita, añadir Express/Fastify en presentation layer
        sin tocar domain ni infrastructure.
```

---

## 15. Network — Políticas

### Conexiones de Red
```
SALIENTES únicamente:
→ Discord Gateway WSS (WebSocket)
→ Discord REST API (HTTPS)
→ No hay conexiones entrantes
→ No hay servidor HTTP expuesto

DNS: discord.com, gateway.discord.gg
Puertos: 443 (HTTPS/WSS)
```

### Bot Token Security
```
Entorno DEV:
→ .env local, nunca commiteado
→ .gitignore incluye .env

Entorno PROD:
→ Variable de entorno del sistema operativo
→ Nunca en código, nunca en logs
→ SystemLogger.ts filtra BOT_TOKEN de cualquier log

.env.example (commiteado, sin valores reales):
BOT_TOKEN=your_bot_token_here
CLIENT_ID=your_client_id_here
GUILD_ID=your_guild_id_here (opcional, dev)
DB_PATH=./data/games.db
LOG_LEVEL=info
NODE_ENV=development
```

### Retry Policies — Llamadas de Red
```
Estrategia: Exponential backoff con jitter

Intentos: 3
Backoff:  intento 1 → 1s
          intento 2 → 2s
          intento 3 → 4s
Jitter:   ±500ms aleatorio (evita thundering herd)

Aplica a:
→ Envío de DMs
→ Asignación de roles
→ Edición de mensajes críticos

NO aplica a:
→ Lectura de mensajes (el evento ya llegó)
→ Operaciones de DB (mejor-sqlite3 es local)
```

### Offline Behavior — Discord API no responde
```
Reconexión:
→ discord.js maneja reconexión automática con backoff
→ Bot no pierde estado en memoria durante reconexión breve

Sesión activa durante desconexión:
→ Timer de ronda sigue corriendo
→ Al reconectar: verificar si sesión debe continuar o cancelar
→ Si desconexión > 30s: cancelar sesión activa, pending_prizes intactos

Estado persistente:
→ pending_prizes en DB sobrevive cualquier desconexión
→ Al reconectar: SystemLogger.info('Bot reconectado')
→ Admin notificado si había sesión activa cancelada
```

---

## 16. Management — Configuración y Operación

### Configuración por Entorno
```typescript
// config/bot.config.ts
export const config = {
  token: process.env.BOT_TOKEN!,
  clientId: process.env.CLIENT_ID!,
  dbPath: process.env.DB_PATH ?? './data/games.db',
  logLevel: process.env.LOG_LEVEL ?? 'info',
  nodeEnv: process.env.NODE_ENV ?? 'development',

  isDev: process.env.NODE_ENV === 'development',
  isProd: process.env.NODE_ENV === 'production',
}

// Validación al arrancar — falla rápido si falta algo crítico
function validateConfig(): void {
  if (!config.token) throw new Error('BOT_TOKEN is required')
  if (!config.clientId) throw new Error('CLIENT_ID is required')
}
```

### Feature Flags
```typescript
// config/features.ts — activar/desactivar sin redeployar
export const features = {
  PRIZE_DROPS_ENABLED:    process.env.FEAT_DROPS    !== 'false',
  DAILY_REWARDS_ENABLED:  process.env.FEAT_DAILY    !== 'false',
  CUSTOM_GAMES_ENABLED:   process.env.FEAT_CUSTOM   !== 'false',
  SPECIAL_GAMES_ENABLED:  process.env.FEAT_SPECIAL  !== 'false',
  ANTI_CHEAT_STRICT:      process.env.FEAT_STRICT   === 'true',
}
```

### Graceful Shutdown
```
SIGTERM / SIGINT recibido
    ↓
1. Dejar de aceptar nuevos comandos
2. Cancelar todas las sesiones activas
   → Insertar pending_prizes para ganadores actuales
   → Notificar en canal: "Bot reiniciando, juego cancelado"
3. Esperar que PrizeDropScheduler complete su ciclo actual
4. Flush de logs pendientes
5. Cerrar conexión a DB
6. Desconectar cliente Discord
7. process.exit(0)

Timeout: 10 segundos máximo para shutdown limpio
```

### Bot Restart Recovery
```
Al iniciar:
1. Verificar sesiones con status = 'active' en DB
2. Si existen → marcar como 'cancelled'
3. Verificar pending_prizes con status = 'pending'
4. Log: "Bot reiniciado. X sesiones canceladas. Y premios pendientes."
5. Si hay log_channel configurado → notificar al servidor
```

### Runtime Configuration Update
```
guild_config se puede actualizar en runtime via comandos admin:
!config set max_players 15     → actualiza DB + cache en memoria
!config set log_channel #logs  → actualiza inmediatamente
!config get                    → muestra config actual del servidor

GameOrchestrator lee guild_config en cada !start
(no cacheado — siempre fresco de DB para config)
```

---

## 17. Monitoreo Completo

### Loggers
```
src/infrastructure/logger/
    ├── SystemLogger.ts   → Winston — errores técnicos, lifecycle del bot
    └── AuditLogger.ts    → acciones de negocio, premios, admin actions

SystemLogger niveles:
ERROR → excepciones no manejadas, DB caída, Discord API fail,
        bot desconectado, crash recovery
WARN  → DM fallback activado, redeem codes agotados,
        sesión cancelada por desconexión, rate limit alcanzado
INFO  → bot iniciado/detenido, juego iniciado/terminado,
        premio entregado, daily reclamado, drop ejecutado
DEBUG → cada comando recibido, cada middleware ejecutado,
        cada query a DB (solo en NODE_ENV=development)

AuditLogger (siempre INFO, va a audit_log en DB):
→ prize_awarded      { userId, prizeType, prizeValue, sessionId }
→ prize_claimed      { userId, pendingPrizeId }
→ admin_reward       { adminId, targetUserId, prize }
→ code_loaded        { adminId, codesCount }
→ code_claimed       { userId, codeId }
→ game_started       { adminId, gameType, sessionId }
→ game_cancelled     { reason, sessionId }
→ ban_applied        { userId, reason, duration }
→ config_changed     { adminId, key, oldValue, newValue }
→ prize_confirmed    { adminId, auditLogId }
```

### Métricas de Negocio
```
Métricas tracked en audit_log (consultables via !stats admin):
→ Juegos jugados por hora/día
→ Prizes entregados por tipo
→ DMs fallidos vs exitosos (ratio)
→ Comandos más usados
→ Jugadores más activos
→ Juegos más populares
→ Redeem codes disponibles vs usados
→ Streaks activos en el servidor
```

### Health Checks
```
Al iniciar:
→ Verificar conexión Discord API ✓/✗
→ Verificar integridad DB ✓/✗
→ Verificar tablas existen ✓/✗
→ Verificar intents concedidos ✓/✗

Periódico (cada 5 min):
→ Discord API ping → log si > 500ms
→ DB query simple → log si > 100ms

Log de uptime:
→ SystemLogger.info('Uptime: Xh Ym') cada hora
```

### Alertas al Admin
```
Condiciones que notifican al log_channel del servidor:
→ Bot reconectado después de desconexión
→ Sesión cancelada por error inesperado
→ Redeem codes agotados (< 5 disponibles)
→ pending_prizes sin reclamar por > 24h
→ Usuario baneado por anti-cheat
→ DB backup completado/fallido
```

---

## 18. Performance vs Scalability — Trade-offs

| Decisión | Performance | Scalability | Trade-off aceptado |
|---|---|---|---|
| SQLite | ✅ Rápido para reads | ⚠️ Writes secuenciales | Aceptable para 1 servidor Discord |
| LeaderboardCache (TTL 60s) | ✅ 0ms en HIT | ✅ DB no saturada | Leaderboard stale hasta 60s |
| better-sqlite3 síncrono | ✅ Sin overhead async | ⚠️ Bloquea event loop | Aislado en DatabaseService, calls breves |
| In-memory game state | ✅ Acceso instantáneo | ⚠️ Se pierde en crash | pending_prizes en DB como respaldo |
| Message editing (no nuevos msgs) | ✅ Sin spam visual | ✅ Menos API calls | Rate limit Discord en edits (5/10s) |
| ScopedEventEmitter | ✅ Sin colisiones | ✅ Sesiones ilimitadas | Cleanup manual obligatorio |
| No Redis | ✅ Sin infraestructura extra | ⚠️ Cache en memoria del proceso | Aceptable para escala actual |
| Promise.all en observers | ✅ Paralelo | ⚠️ Un observer lento bloquea otros | Timeout individual por observer |
| Backup diario local | ✅ Sin latencia | ⚠️ Sin offsite backup | Aceptable para proyecto de cliente |

---

## 19. Principios SOLID + Clean Code — Checklist Final

```
✅ S — Single Responsibility     → cada clase/función un propósito
✅ O — Open/Closed               → extensible sin modificar existente
✅ L — Liskov Substitution       → implementaciones intercambiables
✅ I — Interface Segregation     → interfaces específicas y pequeñas
✅ D — Dependency Inversion      → depender de abstracciones
✅ DRY                           → BaseGame, EmbedFactory, Constants
✅ KISS                          → funciones < 30 líneas, delegación
✅ YAGNI                         → no REST API, no Redis, no i18n
✅ Naming Conventions            → PascalCase, camelCase, UPPER_SNAKE
✅ Error Boundaries              → tipados, propagación por capa
✅ No Magic Numbers              → Constants.ts centralizado
✅ Security by Design            → threat model, trust boundaries,
                                   least privilege, defense in depth
✅ Graceful Degradation          → fallbacks en DM, redeem, DB
✅ Fail Fast                     → validación de config al arrancar
✅ Separation of Concerns        → 4 capas con responsabilidades claras
```