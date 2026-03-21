# 🗺️ ROADMAP — Discord Game Bot

> Plan de implementación completo.
> Cada paso tiene: qué hacer, quién lo hace, qué leer, cómo validar.
> Se ejecuta en orden. R-A → R-B → R-C etc.
> No se improvisa. No se salta pasos.

---

## Archivos de referencia en SDLC/
```
SDLC/ANALISIS-REQUISITOS/
    CLIENT-REQUERIMENTS.MD  → qué quiere el cliente
    GAPS-SDLC.MD            → extracción técnica del cliente
    RESOLVER-GAPS.MD        → solución a cada gap
    ARCHITECH.MD            → arquitectura completa

SDLC/DISEÑO/
    UI-UX.MD                → embeds, colores, flujos visuales
    TECHLEAD.MD             → stack, estándares, orden de implementación
    QA.MD                   → casos críticos, tests, validación manual
```

---

## R-A — Setup del Proyecto

**Quién:** OpenCode
**Lee:** SDLC/DISEÑO/TECHLEAD.MD → Sección 1 (Stack) y Sección 3 Bloque 1
**Hace:**
```
→ Inicializar proyecto Node.js + TypeScript
→ Instalar dependencias con versiones exactas de TECHLEAD.MD
→ Configurar tsconfig.json según TECHLEAD.MD
→ Configurar eslint + prettier
→ Crear estructura de carpetas completa de ARCHITECH.MD:
   src/presentation/, src/application/, src/domain/,
   src/infrastructure/, src/types/
→ Crear .env.example con variables de ARCHITECH.MD
→ Crear .gitignore con .env incluido
```
**Validación:**
```
✅ npm run build compila sin errores
✅ Estructura de carpetas existe completa
✅ tsconfig strict mode activo
```

---

## R-B — Fundación Técnica

**Quién:** OpenCode
**Lee:** SDLC/DISEÑO/TECHLEAD.MD → Sección 3 Bloque 1, Sección 5, Sección 7
**Lee:** SDLC/ANALISIS-REQUISITOS/ARCHITECH.MD → Sección 9 (Clean Code), Sección 11 (DB Schema)
**Hace:**
```
→ src/types/ — todos los tipos definidos primero
   game.types.ts, prize.types.ts, player.types.ts,
   command.types.ts, event.types.ts
→ Constants.ts — GAME_CONSTANTS + EMBED_COLORS
→ src/infrastructure/database/DatabaseService.ts — Singleton
→ src/infrastructure/database/schema.sql — 12 tablas completas
→ src/infrastructure/database/migrations/001_initial_schema.sql
→ src/infrastructure/logger/SystemLogger.ts — Winston
→ src/infrastructure/logger/AuditLogger.ts
→ BotClient Singleton — login, ready event
→ src/types/errors.ts — jerarquía de errores tipados
```
**Validación:**
```
✅ Bot conecta a Discord y loggea "Ready"
✅ games.db creado con todas las tablas al arrancar
✅ Migraciones corren automáticamente
✅ SystemLogger escribe a /logs/combined.log
✅ npm run test — tests de DatabaseService pasan
```
**QA — Kimi K2.5 revisa:**
```
→ Schema completo vs ARCHITECH.MD Sección 11
→ Singleton pattern correcto en DatabaseService y BotClient
→ Prepared statements en todas las queries
```

---

## R-C — Sistema de Comandos y Permisos

**Quién:** OpenCode
**Lee:** SDLC/DISEÑO/TECHLEAD.MD → Sección 3 Bloque 2, Sección 4
**Lee:** SDLC/ANALISIS-REQUISITOS/ARCHITECH.MD → Sección 10 (SbD), Sección 13 (Discord API)
**Hace:**
```
→ src/application/registry/CommandRegistry.ts
→ src/application/middleware/PermissionMiddleware.ts
→ src/application/middleware/CooldownMiddleware.ts
→ src/application/middleware/ — Chain of Responsibility base
→ src/domain/players/PermissionService.ts — BotRole jerarquía
→ src/infrastructure/database/UserRepository.ts — CRUD
→ guild_config — inicialización con defaults seguros
→ src/presentation/embeds/EmbedFactory.ts — TODOS los métodos
   usando EMBED_COLORS de Constants.ts
```
**Validación:**
```
✅ !start con BotRole.PLAYER → embed rojo "sin permisos"
✅ Usuario se crea automáticamente al primer comando
✅ guild_config inicializa con defaults en servidor nuevo
✅ EmbedFactory devuelve embeds con colores de EMBED_COLORS
✅ npm run test — PermissionMiddleware + Chain tests pasan
```
**QA — Kimi K2.5 revisa:**
```
→ EmbedFactory tiene TODOS los métodos de UI-UX.MD Sección 9
→ EMBED_COLORS usados correctamente — nunca colores hardcodeados
→ Chain of Responsibility en orden correcto
```

---

## R-D — Core del Juego (Trivia primero)

**Quién:** OpenCode
**Lee:** SDLC/DISEÑO/TECHLEAD.MD → Sección 3 Bloque 3
**Lee:** SDLC/DISEÑO/UI-UX.MD → Sección 4 (Ciclo de vida visual)
**Lee:** SDLC/ANALISIS-REQUISITOS/RESOLVER-GAPS.MD → G-A, G-H, G-K, G-O
**Hace:**
```
→ src/domain/games/base/BaseGame.ts — abstract, ciclo completo
→ src/domain/games/base/GameStrategy.ts — interface
→ src/infrastructure/events/ScopedEventEmitter.ts
→ src/presentation/live/LiveMessageManager.ts — message editing
→ src/application/orchestrator/GameOrchestrator.ts — Facade
→ src/infrastructure/plugins/GameRegistry.ts + GameFactory
→ src/domain/games/builtin/TriviaGame.ts
→ StartCommand, JoinCommand, PlayCommand
```
**Validación:**
```
✅ !start trivia → embed GAME_ANNOUNCE color blurple
✅ !join → nombre aparece en lobby editado (no mensaje nuevo)
✅ Countdown se actualiza cada 5s — mismo mensaje editado
✅ Con < 2 jugadores en 30s → cancela con embed de error
✅ !play respuesta correcta → embed verde con puntos
✅ !play timeout → embed rojo
✅ Fin de juego → embed dorado con ganador
✅ npm run test — BaseGame + ScopedEventEmitter + GameOrchestrator pasan
```
**QA — Kimi K2.5 revisa:**
```
→ BaseGame.end() es el único punto de entrega de premio (G-O)
→ ScopedEventEmitter aísla sesiones correctamente
→ LiveMessageManager edita — nunca envía nuevo mensaje en lobby
→ Lobby limits de guild_config respetados (G-K)
```

---

## R-E — Sistema de Premios Completo

**Quién:** OpenCode
**Lee:** SDLC/DISEÑO/TECHLEAD.MD → Sección 3 Bloque 4
**Lee:** SDLC/DISEÑO/UI-UX.MD → Sección 4.6 (DM template)
**Lee:** SDLC/ANALISIS-REQUISITOS/RESOLVER-GAPS.MD → G-B, G-F, G-J, G-Q
**Lee:** SDLC/ANALISIS-REQUISITOS/ARCHITECH.MD → Sección 13 (Discord API timeouts)
**Hace:**
```
→ src/domain/prizes/PrizeSystem.ts
→ src/domain/prizes/adapters/CoinsAdapter.ts
→ src/domain/prizes/adapters/BadgeAdapter.ts
→ src/domain/prizes/adapters/RoleAdapter.ts
→ src/domain/prizes/adapters/VirtualItemAdapter.ts
→ src/domain/prizes/adapters/SpecialAccessAdapter.ts
→ src/domain/prizes/adapters/RedeemAdapter.ts
→ src/domain/systems/RedeemCodeService.ts — optimistic locking
→ src/domain/prizes/DMSystem.ts — DM + fallback canal
→ pending_prizes — flujo completo
→ RewardCommand — !reward claim flow
```
**Validación:**
```
✅ !reward → DM con template EXACTO del cliente (UI-UX.MD 4.6)
✅ DMs cerrados → mismo template en canal con mención
✅ Coins se suman al balance en DB
✅ Role se asigna via Discord API
✅ Badge aparece en inventory
✅ Redeem code: claim concurrente → solo uno gana (optimistic lock)
✅ Sin redeem codes → fallback coins + admin notificado (G-Q)
✅ npm run test — 8 casos críticos de QA.MD pasan (Crítico 1,2,8,9)
```
**QA — Kimi K2.5 revisa:**
```
→ DMSystem nunca lanza excepción — siempre entrega o loggea
→ AuditLogger registra cada prize_awarded, code_claimed
→ Optimistic locking implementado correctamente en RedeemCodeService
→ pending_prizes tiene status correcto en cada transición
```

---

## R-F — Los 7 Juegos Restantes

**Quién:** OpenCode
**Lee:** SDLC/DISEÑO/TECHLEAD.MD → Sección 3 Bloque 5
**Lee:** SDLC/DISEÑO/UI-UX.MD → Sección 6 (Flujos UX por juego)
**Lee:** SDLC/ANALISIS-REQUISITOS/RESOLVER-GAPS.MD → gaps de juegos (Spin, Guessing, Word, Reaction)
**Hace:**
```
→ ReactionGame — con detección inhumana < 80ms
→ MathGame
→ WordPuzzleGame — con wordlist.json
→ DiceGame
→ SpinWheelGame
→ GuessingGame — con empate por distancia
→ EliminationGame + PlayerPool — Iterator Pattern
```
**Validación:**
```
✅ Cada juego jugable de inicio a fin sin errores
✅ Reaction: respuesta < 80ms → advertencia anticheat
✅ Elimination: jugador eliminado no puede responder
✅ Spin Wheel: un ganador por azar
✅ Guessing: empate → ambos ganan premio dividido
✅ Word Puzzle: palabras desde wordlist.json
✅ Nadie responde en tiempo → juego cancela limpiamente
✅ npm run test — PlayerPool + GuessingGame empate pasan
```
**QA — Kimi K2.5 revisa:**
```
→ Todos extienden BaseGame correctamente
→ Ninguno duplica lógica que está en BaseGame
→ Flujos visuales coinciden con UI-UX.MD Sección 6
```

---

## R-G — Features de Plataforma

**Quién:** OpenCode
**Lee:** SDLC/DISEÑO/TECHLEAD.MD → Sección 3 Bloque 6
**Lee:** SDLC/DISEÑO/UI-UX.MD → Sección 5 (Embeds por comando)
**Lee:** SDLC/ANALISIS-REQUISITOS/RESOLVER-GAPS.MD → G-I, G-S, G-7 (leaderboard)
**Hace:**
```
→ LeaderboardCache — read-through + invalidación por Observer
→ StreakSystem — State Pattern (inactive/active/broken/maxed)
→ DailyRewardService — tiers + multiplicadores
→ AntiCheatService — SlidingWindowRateLimiter + detección inhumana
→ AntiCheatMiddleware — añadir a cadena
→ SessionValidationMiddleware — añadir a cadena
→ ScoreCommand — perfil completo desde game_winners + participation
→ LeaderboardCommand
→ InventoryCommand
→ HistoryCommand — desde game_winners
→ DailyCommand
→ GamesCommand — !games list + !games info
→ ScoreService — INSERT game_winners al terminar juego
```
**Validación:**
```
✅ !leaderboard desde cache < 5ms en HIT
✅ Cache se invalida al terminar juego
✅ !daily → reward con streak correcto
✅ !daily dos veces → "vuelve mañana con tiempo restante"
✅ Streak roto si no reclama en 28h
✅ !score → perfil completo con victorias, winrate, juego fav
✅ !history → últimas 5 victorias con juego y premio
✅ game_winners tiene row en DB después de cada juego
✅ audit_log tiene row después de cada premio entregado
✅ npm run test — StreakSystem todos los estados pasan (Crítico 4,6)
```
**QA — Kimi K2.5 revisa:**
```
→ Embeds coinciden con UI-UX.MD Sección 5
→ StreakSystem transiciones correctas por State Pattern
→ AntiCheatService en posición correcta en la cadena
→ ScoreService usa game_winners — no participation para victorias
```

---

## R-H — Admin, Scheduler y Config

**Quién:** OpenCode
**Lee:** SDLC/DISEÑO/TECHLEAD.MD → Sección 3 Bloque 7
**Lee:** SDLC/DISEÑO/UI-UX.MD → Sección 7 (Wizard createGame)
**Lee:** SDLC/ANALISIS-REQUISITOS/RESOLVER-GAPS.MD → G-E, G-L, G-M, G-G
**Hace:**
```
→ PrizeDropScheduler — setTimeout recursivo, background
→ DropCommand — !drop force, pause, resume
→ AddCodesCommand — batch upload desde .txt
→ PrizesCommand — !prizes pending, !prizes confirm
→ CreateGameCommand — wizard interactivo en DM
→ GameBuilder — construcción dinámica desde wizard
→ !config set/get — runtime guild_config update
```
**Validación:**
```
✅ Drop aleatorio aparece en canal cada 15-60 min
✅ !drop force → drop inmediato
✅ Primero en reaccionar con 🎁 en 30s gana
✅ !prizes pending → lista correcta de premios manuales
✅ !prizes confirm [id] → manually_confirmed=true en audit_log
✅ !createGame → wizard abre en DM paso a paso (UI-UX.MD S.7)
✅ Juego custom aparece en !games list después de crear
✅ !addcodes con .txt → códigos en DB con status available
✅ !config set max_players 15 → actualiza guild_config en runtime
```
**QA — Kimi K2.5 revisa:**
```
→ PrizeDropScheduler no bloquea event loop
→ Wizard de createGame maneja cancelación limpiamente
→ AuditLogger registra code_loaded, config_changed, prize_confirmed
→ GameBuilder persiste en custom_games tabla
```

---

## R-I — Juegos Especiales

**Quién:** OpenCode
**Lee:** SDLC/DISEÑO/TECHLEAD.MD → Sección 3 Bloque 8
**Lee:** SDLC/ANALISIS-REQUISITOS/RESOLVER-GAPS.MD → G-C (special games acceso)
**Hace:**
```
→ TournamentGame — bracket style, eliminación
→ EventTriviaGame — trivia temática
→ HighStakesGame — apuesta de coins
→ MidnightDropGame — drop masivo diario
→ BossBattleGame — todos vs boss con HP
→ Validación de special_access en !join para estos juegos
```
**Validación:**
```
✅ !join a special game sin special_access → embed error
✅ !join con special_access válido → entra al lobby
✅ special_access con expires_at vencido → rechazado
✅ Tournament crea bracket y elimina correctamente
✅ BossBattle reduce HP del boss por respuesta correcta
```
**QA — Kimi K2.5 revisa:**
```
→ SpecialAccessAdapter valida antes de permitir !join
→ Todos extienden BaseGame correctamente
→ special_access tabla consultada en PermissionMiddleware
```

---

## R-J — Hardening y Cierre

**Quién:** OpenCode
**Lee:** SDLC/DISEÑO/TECHLEAD.MD → Sección 3 Bloque 9, Sección 10 (Reglas)
**Lee:** SDLC/ANALISIS-REQUISITOS/ARCHITECH.MD → Sección 15 (Network), Sección 16 (Management)
**Lee:** SDLC/DISEÑO/QA.MD → Sección 8 (Bloqueantes) y Sección 9 (Flujo QA)
**Hace:**
```
→ Graceful shutdown — SIGTERM/SIGINT handler
→ Bot restart recovery — sesiones cancelled, pending_prizes intactos
→ Health checks al arrancar y cada 5 min
→ Backup automático de games.db a las 00:00 UTC
→ Error boundaries — verificar que TODOS los comandos tienen try/catch
→ Rate limiting global por guild
→ .env validation — falla rápido si falta BOT_TOKEN
→ PM2 ecosystem.config.js para producción
```
**Validación:**
```
✅ CTRL+C → "Bot reiniciando" en canal activo → shutdown limpio
✅ Bot restart → sesiones activas marcadas cancelled
✅ Bot restart → pending_prizes intactos en DB
✅ Comando con error interno → embed de error, bot NO crashea
✅ Sin BOT_TOKEN en .env → error claro al arrancar, no panic
✅ npm run test — suite completa pasa sin errores
✅ Crítico 3 y 7 de QA.MD validados manualmente
```
**QA — Kimi K2.5 revisa:**
```
→ Todos los comandos tienen try/catch sin excepción
→ Ningún archivo importa better-sqlite3 directamente
→ Ningún embed usa colores hardcodeados
→ Ninguna query usa string concatenation
```

---

## R-K — Validación Final Manual en Discord

**Quién:** Tú
**Lee:** SDLC/DISEÑO/QA.MD → Sección 7 (Checklist manual completo)
**Lee:** SDLC/DISEÑO/UI-UX.MD → Sección 4 y 5 (visual reference)
**Hace:**
```
→ Ejecutar checklist completo de QA.MD Sección 7
   bloque por bloque en servidor Discord real
→ Validar que embeds coinciden con UI-UX.MD
→ Validar template DM exacto del cliente
→ Verificar los 9 casos críticos de QA.MD Sección 4
→ Reportar cualquier bloqueante a OpenCode para fix
```
**Criterio de aprobación:**
```
✅ 0 errores bloqueantes de QA.MD Sección 8
✅ Template DM exactamente como cliente especificó
✅ Todos los juegos jugables de inicio a fin
✅ !reward funciona en todos los escenarios
✅ Bot no crashea bajo ningún comando
```

---

## R-L — Despliegue y Entrega al Cliente

**Quién:** OpenCode + Tú
**Lee:** SDLC/ANALISIS-REQUISITOS/ARCHITECH.MD → Sección 15 (Management), Sección 16 (Monitoreo)
**Hace:**
```
→ Crear README.md con instrucciones de setup para el cliente:
   - Requisitos (Node.js 20, npm)
   - Configurar .env con su BOT_TOKEN
   - npm install && npm run build && npm start
   - Cómo configurar PM2 para producción
   - Cómo usar !config para setup inicial del servidor
→ Crear SETUP.md con guía de primer uso para el cliente
→ Verificar que .env.example está completo
→ Último npm run build limpio
→ Entregar repositorio al cliente
```
**Entregable final:**
```
✅ Repositorio con código completo
✅ README.md con setup claro
✅ SETUP.md con guía de primer uso
✅ .env.example con todas las variables
✅ npm run build compila sin errores ni warnings
```

---

## Resumen del Roadmap

> **Modos de OpenCode:**
> - **Plan → Build** = Usa Plan Mode para revisar, luego Build para ejecutar. Para bloques con riesgo alto.
> - **Build directo** = Ejecuta directo sin plan. Para bloques con spec clara y bajo riesgo.
> - **Plan → SDD Orchestrator** = Para bloques grandes con múltiples sistemas en paralelo. Overhead justificado.

| Paso | Qué | Modo OpenCode | Bloque TECHLEAD | Razón del modo |
|---|---|---|---|---|
| R-A | Setup del proyecto | Plan → Build | Bloque 1 (parte) | Base del proyecto — error aquí rompe todo |
| R-B | Fundación técnica | Plan → Build | Bloque 1 | DB + tipos + loggers — crítico, sin retorno fácil |
| R-C | Comandos y permisos | Plan → Build | Bloque 2 | EmbedFactory + Chain — muchos archivos coordinados |
| R-D | Core del juego | Plan → SDD Orchestrator | Bloque 3 | BaseGame + GameOrchestrator + 3 comandos en paralelo |
| R-E | Sistema de premios | Plan → SDD Orchestrator | Bloque 4 | 6 adapters + DMSystem + optimistic locking en paralelo |
| R-F | 7 juegos restantes | Build directo | Bloque 5 | Spec clara — cada juego es independiente, bajo riesgo |
| R-G | Features de plataforma | Plan → Build | Bloque 6 | StreakSystem + AntiCheat + 6 comandos — coordinación alta |
| R-H | Admin, Scheduler, Config | Build directo | Bloque 7 | Spec clara en RESOLVER-GAPS — wizard y scheduler independientes |
| R-I | Juegos especiales | Build directo | Bloque 8 | Extienden BaseGame — patrón ya establecido, bajo riesgo |
| R-J | Hardening y cierre | Plan → Build | Bloque 9 | Toca todo el sistema — supervisión obligatoria |
| R-K | Validación manual | **Tú** | QA.MD | Manual en Discord real |
| R-L | Despliegue y entrega | Build directo | — | Setup final — README + PM2, bajo riesgo |

---

## Regla de oro

```
Cada paso tiene criterios de validación.
Si los criterios no pasan → NO se avanza al siguiente paso.
OpenCode corre tests. Kimi revisa. Tú apruebas los manuales.
Sin aprobación → fix primero, siguiente paso después.
```