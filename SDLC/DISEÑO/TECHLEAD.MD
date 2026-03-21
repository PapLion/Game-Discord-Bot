# ⚙️ Tech Lead — Discord Game Bot

> Este documento es la guía de implementación para OpenCode.
> Cada decisión técnica está tomada, justificada y es final.
> OpenCode no decide — implementa según lo que está aquí.

---

## 1. Stack Exacto — Versiones Fijadas

```json
{
  "runtime":    "Node.js 20 LTS",
  "language":   "TypeScript 5.4",
  "framework":  "discord.js 14.15",
  "database":   "better-sqlite3 9.6",
  "logger":     "winston 3.13",
  "testing":    "vitest 1.6",
  "linter":     "eslint 9 + @typescript-eslint 7",
  "formatter":  "prettier 3.3",
  "runner":     "tsx 4.15 (dev) / tsc (prod)"
}
```

### package.json — Scripts obligatorios
```json
{
  "scripts": {
    "dev":     "tsx watch src/index.ts",
    "build":   "tsc --project tsconfig.json",
    "start":   "node dist/index.js",
    "lint":    "eslint src --ext .ts",
    "format":  "prettier --write src",
    "test":    "vitest run",
    "test:watch": "vitest"
  }
}
```

### tsconfig.json — Configuración obligatoria
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## 2. Decisiones Técnicas Tomadas y Justificadas

Estas decisiones son FINALES. OpenCode no las cambia.

| Decisión | Elegido | Descartado | Razón |
|---|---|---|---|
| Runtime | Node.js 20 LTS | Bun, Deno | Compatibilidad con discord.js, ecosistema maduro |
| Lenguaje | TypeScript strict | JavaScript | Type safety, intellisense, contratos entre capas |
| Discord library | discord.js v14 | eris, oceanic | Mayor comunidad, mejor soporte, más ejemplos |
| DB | better-sqlite3 | sequelize, prisma, pg | Sin setup, síncrono controlado, suficiente para 1 servidor |
| ORM | Ninguno — SQL directo | Prisma, TypeORM | Control total, sin magia, queries claras |
| Logger | Winston | pino, console.log | Niveles, transports, structured logging |
| Test runner | Vitest | Jest, Mocha | Compatible con ESM, más rápido, misma API que Jest |
| Process manager | PM2 (prod) | forever, nodemon | Auto-restart, logs, monitoring básico |
| Prefix commands | `!` | Slash commands | Cliente lo especificó explícitamente |
| State management | In-memory Maps | Redis, DB | Velocidad, simplicidad, pending_prizes como respaldo |

---

## 3. Orden de Implementación

OpenCode implementa en este orden exacto. Cada bloque debe estar
funcionando y probado antes de pasar al siguiente.

### Capas y sus carpetas — referencia obligatoria
```
src/presentation/   → commands/, embeds/, live/
                      Todo lo que toca Discord directamente
src/application/    → orchestrator/, registry/, middleware/
                      Coordinación entre presentation y domain
src/domain/         → games/, prizes/, players/, systems/
                      Lógica de negocio pura — sin Discord, sin DB
src/infrastructure/ → database/, cache/, plugins/, scheduler/, events/, logger/
                      Servicios técnicos que el domain usa via interfaces
src/types/          → game.types, prize.types, player.types, command.types, event.types
                      Contratos compartidos entre todas las capas
```

### BLOQUE 1 — Fundación (sin esto nada funciona)
```
1.  Setup proyecto — package.json, tsconfig, eslint, prettier
2.  src/infrastructure/database/DatabaseService.ts — conexión, schema.sql, migrator
3.  src/infrastructure/logger/SystemLogger.ts + AuditLogger.ts
4.  BotClient Singleton — login, ready event
5.  src/application/registry/CommandRegistry.ts — despacho de comandos
6.  src/application/middleware/ — Chain of Responsibility base (sin lógica aún)
7.  src/presentation/embeds/EmbedFactory.ts — todos los métodos con EMBED_COLORS
8.  src/types/ — todos los tipos definidos antes de implementar lógica
9.  Constants.ts — GAME_CONSTANTS + EMBED_COLORS
```

### BLOQUE 2 — Sistema de Usuarios y Permisos
```
9.  UserRepository — CRUD básico
10. PermissionService — BotRole, jerarquía
11. PermissionMiddleware — validación por comando
12. CooldownMiddleware — sliding window básico
13. guild_config — defaults seguros al arrancar
```

### BLOQUE 3 — Core del Juego
```
14. src/domain/games/base/BaseGame.ts — ciclo de vida completo (abstract)
15. src/domain/games/base/GameStrategy.ts — interface
16. src/infrastructure/events/ScopedEventEmitter.ts — eventos por sesión
17. src/presentation/live/LiveMessageManager.ts — message editing
18. src/application/orchestrator/GameOrchestrator.ts — facade completo
19. src/infrastructure/plugins/GameRegistry.ts + GameFactory
20. src/domain/games/builtin/TriviaGame.ts — primer juego implementado y probado
21. StartCommand, JoinCommand, PlayCommand — flujo completo con Trivia
```

### BLOQUE 4 — Sistema de Premios
```
23. PrizeSystem — lógica central
24. CoinsAdapter
25. BadgeAdapter
26. RoleAdapter
27. VirtualItemAdapter
28. SpecialAccessAdapter
29. RedeemAdapter + RedeemCodeService (optimistic locking)
30. DMSystem — DM + fallback canal
31. pending_prizes — flujo completo
32. !reward — claim flow
```

### BLOQUE 5 — Juegos Restantes
```
33. ReactionGame
34. MathGame
35. WordPuzzleGame
36. DiceGame
37. SpinWheelGame
38. GuessingGame
39. EliminationGame + PlayerPool
```

### BLOQUE 6 — Features de Plataforma
```
40. LeaderboardCache — read-through + invalidación
41. StreakSystem — State Pattern completo
42. DailyRewardService — tiers + multiplicadores
43. AntiCheatService — SlidingWindowRateLimiter + inhumana
44. AntiCheatMiddleware — integración con cadena
45. SessionValidationMiddleware
46. ScoreCommand, LeaderboardCommand, InventoryCommand
47. HistoryCommand, DailyCommand, GamesCommand
48. ScoreService — actualización post-juego
```

### BLOQUE 7 — Admin y Scheduler
```
49. PrizeDropScheduler — drops aleatorios en background
50. DropCommand — !drop force, pause, resume
51. AddCodesCommand — batch upload
52. PrizesCommand — !prizes pending, confirm
53. CreateGameCommand — wizard en DM
54. GameBuilder — construcción dinámica
55. !config set/get — runtime config
```

### BLOQUE 8 — Juegos Especiales
```
56. TournamentGame
57. EventTriviaGame
58. HighStakesGame
59. MidnightDropGame
60. BossBattleGame
```

### BLOQUE 9 — Hardening
```
61. Graceful shutdown — SIGTERM/SIGINT handler
62. Bot restart recovery — sesiones canceladas, pending prizes
63. Health checks — al arrancar y periódicos
64. Backup automático — PrizeDropScheduler corre a las 00:00 UTC
65. Error boundaries — todos los comandos envueltos en try/catch
66. Rate limiting global — por guild
67. .env validation — falla rápido si falta BOT_TOKEN
```

---

## 4. Estándares de Código — OpenCode los sigue siempre

### Todos los Commands — referencia completa
```
PLAYER COMMANDS (src/presentation/commands/player/)
→ JoinCommand     — !join — BotRole.PLAYER — cooldown: COOLDOWN_JOIN_MS
→ PlayCommand     — !play — BotRole.PLAYER — cooldown: COOLDOWN_PLAY_MS
→ RewardCommand   — !reward — BotRole.PLAYER — cooldown: 0
→ ScoreCommand    — !score — BotRole.PLAYER — cooldown: 0
→ LeaderboardCommand — !leaderboard — BotRole.PLAYER — cooldown: 0
→ InventoryCommand   — !inventory — BotRole.PLAYER — cooldown: 0
→ HistoryCommand     — !history — BotRole.PLAYER — cooldown: 0
→ DailyCommand       — !daily — BotRole.PLAYER — cooldown: 0
→ GamesCommand       — !games — BotRole.PLAYER — cooldown: 0

ADMIN COMMANDS (src/presentation/commands/admin/)
→ StartCommand       — !start — BotRole.MODERATOR — cooldown: 0
→ CreateGameCommand  — !createGame — BotRole.ADMIN — cooldown: 0
→ AddCodesCommand    — !addcodes — BotRole.ADMIN — cooldown: 0
→ PrizesCommand      — !prizes — BotRole.ADMIN — cooldown: 0
→ DropCommand        — !drop — BotRole.ADMIN — cooldown: 0
```

### Estructura obligatoria de un Command
```typescript
// src/presentation/commands/player/JoinCommand.ts
import { BotCommand, CommandContext } from '../../../types/command.types'
import { BotRole } from '../../../domain/players/PermissionService'
import { EmbedFactory } from '../../embeds/EmbedFactory'

export class JoinCommand implements BotCommand {
  name = 'join'
  aliases = ['j']
  requiredRole = BotRole.PLAYER
  cooldown = GAME_CONSTANTS.COOLDOWN_JOIN_MS

  async execute(ctx: CommandContext): Promise<void> {
    try {
      // lógica aquí
    } catch (error) {
      SystemLogger.error('JoinCommand failed', { error, userId: ctx.userId })
      await ctx.reply({ embeds: [EmbedFactory.error('No pudimos procesarlo')] })
    }
  }
}
```

### Estructura obligatoria de un Game
```typescript
// src/domain/games/builtin/TriviaGame.ts
import { BaseGame } from '../base/BaseGame'
import { GameSession, Participant } from '../../../types/game.types'

export class TriviaGame extends BaseGame {
  // Solo sobreescribir lo que cambia — nunca tocar run()
  protected async roundLogic(): Promise<void> {
    // lógica específica de trivia
  }

  protected evaluateWinner(): Participant {
    // lógica específica de trivia
  }
}
```

### Estructura obligatoria de un Adapter
```typescript
// src/domain/prizes/adapters/CoinsAdapter.ts
import { PrizeDelivery, DeliveryResult } from '../../../types/prize.types'
import { Prize } from '../../../types/prize.types'

export class CoinsAdapter implements PrizeDelivery {
  async canDeliver(userId: string, prize: Prize): Promise<boolean> {
    // validar que se puede entregar
  }

  async deliver(userId: string, prize: Prize): Promise<DeliveryResult> {
    try {
      // entregar coins
      AuditLogger.log('prize_awarded', { userId, prize })
      return { success: true }
    } catch (error) {
      SystemLogger.error('CoinsAdapter.deliver failed', { error, userId })
      return { success: false, error }
    }
  }
}
```

### Reglas de código que OpenCode NUNCA viola
```
❌ NUNCA usar any en TypeScript — usar unknown y narrowing
❌ NUNCA hacer query SQL con string concatenation — solo prepared statements
❌ NUNCA hardcodear colores en embeds — solo EMBED_COLORS
❌ NUNCA hardcodear números — solo GAME_CONSTANTS
❌ NUNCA acceder a DatabaseService desde Presentation Layer directamente
❌ NUNCA acceder a Discord API desde Domain Layer directamente
❌ NUNCA lanzar Error genérico — usar GameError, PrizeError, AuthError
❌ NUNCA dejar un comando sin try/catch
❌ NUNCA enviar mensaje de texto plano al canal — siempre EmbedFactory
❌ NUNCA crear un embed sin color — siempre EMBED_COLORS[tipo]
❌ NUNCA duplicar lógica de juego — usar BaseGame
❌ NUNCA duplicar lógica de premio — usar PrizeDelivery interface
```

---

## 5. Errores Tipados — Jerarquía Obligatoria

```typescript
// src/types/errors.ts

// Base
export class BotError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message)
    this.name = 'BotError'
  }
}

// Por dominio
export class GameError extends BotError {
  constructor(message: string, code: string) {
    super(message, code)
    this.name = 'GameError'
  }
}

export class PrizeError extends BotError {
  constructor(message: string, code: string) {
    super(message, code)
    this.name = 'PrizeError'
  }
}

export class AuthError extends BotError {
  constructor(message: string, code: string) {
    super(message, code)
    this.name = 'AuthError'
  }
}

export class DatabaseError extends BotError {
  constructor(message: string, code: string) {
    super(message, code)
    this.name = 'DatabaseError'
  }
}

// Códigos de error estandarizados
export const ERROR_CODES = {
  // Game
  NO_ACTIVE_SESSION:     'GAME_001',
  SESSION_FULL:          'GAME_002',
  GAME_ALREADY_STARTED:  'GAME_003',
  NOT_IN_SESSION:        'GAME_004',
  INSUFFICIENT_PLAYERS:  'GAME_005',

  // Prize
  NO_PENDING_PRIZES:     'PRIZE_001',
  REDEEM_CODE_CLAIMED:   'PRIZE_002',
  REDEEM_CODE_EXPIRED:   'PRIZE_003',
  NO_CODES_AVAILABLE:    'PRIZE_004',
  DM_FAILED:             'PRIZE_005',

  // Auth
  INSUFFICIENT_ROLE:     'AUTH_001',
  BANNED:                'AUTH_002',
  COOLDOWN_ACTIVE:       'AUTH_003',

  // Database
  QUERY_FAILED:          'DB_001',
  MIGRATION_FAILED:      'DB_002',
}
```

---

## 6. Puntos de Integración entre Módulos

Dónde se conectan los sistemas — OpenCode los respeta exactamente.

```
CommandRegistry
    → recibe messageCreate de BotClient
    → despacha a Chain of Responsibility
    → Chain despacha a Command.execute()

Command.execute()
    → llama a GameOrchestrator (nunca a Domain directamente)
    → responde siempre con EmbedFactory (nunca texto plano)

GameOrchestrator
    → usa GameRegistry para obtener el plugin
    → usa GameFactory para crear la instancia
    → usa ScopedEventEmitter para comunicar eventos
    → usa LiveMessageManager para updates en tiempo real

ScopedEventEmitter (game:winner)
    → PrizeSystem.createPending() — crea pending_prize en DB
    → ScoreService.update() — actualiza scores
    → LeaderboardCache.invalidate() — invalida cache
    → AuditLogger.log() — registra en audit_log
    ORDEN: PrizeSystem primero, AuditLogger último

DMSystem
    → recibe WinnerDMData de PrizeSystem
    → usa EmbedFactory.winnerDM() para construir embed
    → intenta DM → si falla → EmbedFactory.winnerChannel()
    → nunca lanza excepción — siempre entrega o loggea

PrizeDropScheduler
    → corre independiente, nunca bloquea event loop
    → emite a ScopedEventEmitter.global() al encontrar ganador
    → se reprograma automáticamente con setTimeout recursivo

DatabaseService
    → singleton estricto — getInstance() siempre
    → todas las queries son prepared statements
    → wrappea excepciones de SQLite en DatabaseError
    → migrator corre en initialize() antes de cualquier query
```

---

## 7. Tipos Centralizados — src/types/

OpenCode define todos los tipos aquí antes de implementar.
Nunca inline types en clases — siempre importar de types/.

```typescript
// game.types.ts
export type GameType =
  | 'trivia' | 'reaction' | 'math' | 'wordpuzzle'
  | 'dice' | 'spinwheel' | 'guessing' | 'elimination'
  | 'tournament' | 'eventtrivia' | 'highstakes'
  | 'midnightdrop' | 'bossbattle'

export type GameStatus = 'waiting' | 'active' | 'finished' | 'cancelled'

export interface GameSession {
  id: string
  guildId: string
  channelId: string
  gameType: GameType
  status: GameStatus
  startedBy: string
  createdAt: Date
  endedAt?: Date
}

export interface Participant {
  userId: string
  discordId: string
  score: number
  isWinner: boolean
  joinedAt: Date
}

export interface GameContext {
  session: GameSession
  participants: Participant[]
  currentRound: number
  totalRounds: number
}

// prize.types.ts
export type PrizeType =
  | 'coins' | 'role' | 'badge'
  | 'redeem' | 'virtual_item' | 'special_access'

export interface Prize {
  id: string
  name: string
  type: PrizeType
  value: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
}

export interface DeliveryResult {
  success: boolean
  error?: Error
  fallbackUsed?: boolean
}

export interface WinnerDMData {
  userId: string
  userMention: string
  gameName: string
  prizeName: string
  rewardDescription: string
  sessionId: string
}

// command.types.ts
export interface CommandContext {
  userId: string
  discordId: string
  guildId: string
  channelId: string
  args: string[]
  message: Message
  reply: (options: MessageCreateOptions) => Promise<void>
}

// event.types.ts
export interface GameWinnerEvent {
  sessionId: string
  userId: string
  gameType: GameType
  prize: Prize
  guildId: string
}

export interface DropWinnerEvent {
  userId: string
  prize: Prize
  guildId: string
  channelId: string
}

// player.types.ts
export interface GameWinner {
  id: string
  sessionId: string
  userId: string
  gameType: GameType
  prizeId?: string
  score: number
  wonAt: Date
}

// Referencia a tabla game_winners en DB
// Usada por: HistoryCommand, ScoreCommand, ScoreService
// Campos: id, session_id, user_id, game_type, prize_id, score, won_at
// Índices: idx_game_winners_user (user_id, won_at)
//          idx_game_winners_type (game_type, won_at)
```

---

## 8. Git — Estructura de Ramas

```
main
  └── develop
        ├── feat/block-1-foundation
        ├── feat/block-2-users-permissions
        ├── feat/block-3-core-game
        ├── feat/block-4-prize-system
        ├── feat/block-5-games
        ├── feat/block-6-platform-features
        ├── feat/block-7-admin-scheduler
        ├── feat/block-8-special-games
        └── feat/block-9-hardening
```

### Convención de commits
```
feat: add TriviaGame strategy
fix: handle DM failure fallback correctly
refactor: extract prize delivery to adapter
test: add CoinsAdapter unit tests
chore: update dependencies
docs: update TECHLEAD.MD implementation order
```

---

## 9. Criterios de Done por Bloque

Un bloque está DONE cuando cumple TODO esto:

```
BLOQUE 1 — Fundación
✅ Bot conecta a Discord y loggea "Ready"
✅ DB se inicializa con schema completo sin errores
✅ Migraciones corren automáticamente
✅ SystemLogger escribe a archivo en /logs
✅ EmbedFactory devuelve embeds con colores correctos
✅ .env faltante → falla con mensaje claro

BLOQUE 2 — Usuarios y Permisos
✅ Usuario se crea automáticamente al primer comando
✅ !start bloqueado para PLAYER — solo MODERATOR+
✅ Cooldown de !play funciona (2s entre intentos)
✅ guild_config se inicializa con defaults en servidor nuevo

BLOQUE 3 — Core del Juego
✅ !start trivia → lobby aparece en canal
✅ !join → jugador aparece en lobby editado
✅ Lobby se edita cada 5s (no nuevos mensajes)
✅ Con < 2 jugadores en 30s → cancela con mensaje
✅ !play responde a pregunta → resultado en embed
✅ Juego termina → embed de ganador en canal
✅ pending_prize creado en DB al terminar

BLOQUE 4 — Premio
✅ !reward → DM con template exacto del cliente
✅ DM falla → mismo mensaje en canal con mención
✅ Coins se suman al balance del usuario
✅ Role se asigna via Discord API
✅ Badge aparece en inventory
✅ Redeem code marcado como claimed con optimistic lock
✅ Sin redeem codes → fallback coins + notifica admin

BLOQUE 5 — Juegos
✅ Cada juego jugable de inicio a fin
✅ Edge cases cubiertos (nadie responde, empate, etc.)
✅ Todos usan BaseGame.end() para entregar premio

BLOQUE 6 — Features de Plataforma
✅ !leaderboard desde cache en < 5ms en HIT
✅ Cache se invalida al terminar un juego
✅ !daily funciona con streak correcto
✅ Streak roto si no reclama en 28h
✅ Anti-cheat detecta respuesta < 80ms
✅ 3 flags → ban temporal 5 minutos
✅ game_winners INSERT al terminar cada juego
✅ !history muestra últimas 5 victorias del jugador desde game_winners
✅ !score muestra victorias, winrate y juego favorito desde game_winners

BLOQUE 7 — Admin
✅ Drop aleatorio cada 15-60 min
✅ !prizes pending lista premios manuales
✅ !createGame wizard completo en DM

BLOQUE 8 — Juegos Especiales
✅ Special games requieren special_access para !join
✅ Tournament crea bracket y elimina correctamente

BLOQUE 9 — Hardening
✅ SIGTERM → shutdown limpio en < 10s
✅ Bot restart → sesiones activas marcadas cancelled
✅ Bot restart → pending_prizes intactos
✅ Todos los comandos manejan errores sin crashear el bot
```

---

## 10. Reglas de Implementación para OpenCode

```
REGLA 1 — Un archivo, una responsabilidad
Cada archivo exporta UNA clase o conjunto de funciones relacionadas.
No mezclar Command con lógica de DB nunca.

REGLA 2 — Interfaces antes que implementaciones
Antes de implementar TriviaGame, verificar que GameStrategy
y BaseGame están completos. Nunca al revés.

REGLA 3 — Constants antes que lógica
Antes de hardcodear cualquier número o color,
verificar si ya está en GAME_CONSTANTS o EMBED_COLORS.
Si no está → añadirlo ahí primero.

REGLA 4 — EmbedFactory es la única UI
Ningún comando envía MessageCreateOptions con content
de texto plano. Todo pasa por EmbedFactory.

REGLA 5 — DatabaseService es el único acceso a DB
Ningún archivo importa better-sqlite3 directamente.
Solo DatabaseService lo usa.

REGLA 6 — Errores tipados siempre
throw new GameError('msg', ERROR_CODES.NO_ACTIVE_SESSION)
NUNCA throw new Error('msg') o throw 'string'

REGLA 7 — Implementar en orden de bloques
No saltar bloques. Si Bloque 3 no está done,
no empezar Bloque 4.

REGLA 8 — Cada método async tiene try/catch
Sin excepciones. El bot no puede crashear por
un error en un comando de usuario.

REGLA 9 — Logs en cada acción crítica
prize_awarded → AuditLogger
game_started  → AuditLogger
error         → SystemLogger.error
warn          → SystemLogger.warn

REGLA 10 — Cleanup siempre
ScopedEventEmitter.destroySession() al terminar sesión.
clearInterval() al terminar countdown.
liveMessages.delete(sessionId) al terminar juego.
```

---

## 11. Checklist Tech Lead — Verificación Final

```
✅ Stack fijado con versiones exactas
✅ Decisiones técnicas tomadas y justificadas
✅ Orden de implementación en 9 bloques
✅ Estándares de código con ejemplos reales
✅ Errores tipados con jerarquía y códigos
✅ Puntos de integración entre módulos
✅ Tipos centralizados definidos
✅ Git branches y convención de commits
✅ Criterios de Done por bloque
✅ 10 reglas de implementación para OpenCode
```