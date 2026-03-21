# 🧪 QA Strategy — Discord Game Bot

> Estrategia liviana pero real.
> No buscamos cobertura perfecta — buscamos que lo crítico no falle.
> Tenemos OpenCode, Kimi K2.5 (Windsurf), Cursor y MiniMax M2.5.
> Cada herramienta tiene su rol en QA.

---

## 1. Roles de Herramientas en QA

```
OpenCode (MiniMax M2.5)
→ Escribe los unit tests mientras implementa cada módulo
→ Corre el test suite completo antes de mergear cada bloque
→ Corrige los errores que los tests revelan

Kimi K2.5 (Windsurf)
→ Revisión de código post-implementación por bloque
→ Detecta errores de lógica sutiles que OpenCode puede pasar
→ Verifica que los patrones de ARCHITECH.MD se implementaron correctamente
→ Revisa edge cases en juegos y sistema de premios

Cursor
→ Fix rápido de errores específicos que Kimi o los tests reportan
→ Refactoring puntual cuando algo no cumple estándares de TECHLEAD.MD

Tú (Product Owner)
→ Prueba manual en servidor Discord real al finalizar cada bloque
→ Valida que la experiencia visual coincide con UI-UX.MD
→ Aprueba o rechaza cada bloque antes de continuar
```

---

## 2. Scope — Qué Testeamos y Qué No

### ✅ Testeamos
```
→ Lógica de dominio pura — juegos, premios, streak, anticheat
→ DatabaseService — queries, transacciones, migraciones
→ Casos críticos de error — DM falla, DB caída, race condition
→ Flujos completos de los 6 comandos del cliente (!join → !reward)
→ Validaciones de seguridad — permisos, cooldowns, anticheat
→ Optimistic locking en redeem codes
```

### ❌ No testeamos
```
→ Discord API directamente — discord.js ya está testeado
→ EmbedFactory visual — se valida manualmente en Discord
→ Juegos especiales en profundidad — son bajo riesgo, poco uso
→ 100% de cobertura — no es el objetivo
```

---

## 3. Tipos de Prueba por Capa

```
DOMAIN LAYER → Unit Tests (Vitest)
  → Lógica pura, sin Discord, sin DB
  → Rápidos, aislados, muchos
  → OpenCode los escribe al implementar cada clase

INFRASTRUCTURE LAYER → Integration Tests (Vitest)
  → DatabaseService con SQLite en memoria (:memory:)
  → LeaderboardCache con datos reales
  → RedeemCodeService con optimistic locking real

APPLICATION LAYER → Integration Tests (Vitest)
  → GameOrchestrator con mocks de Discord
  → Chain of Responsibility — middleware en secuencia
  → PrizeSystem end-to-end desde ganador hasta pending_prize

PRESENTATION LAYER → Manual (tú en Discord)
  → Embeds correctos, colores, flujo visual
  → Message editing funciona sin spam
  → DM llega correctamente
```

---

## 4. Casos Críticos — Estos NUNCA pueden fallar

Identificados desde el diseño. Si alguno falla = bloqueante.

### 🔴 Crítico 1 — DM falla → fallback canal
```
Test: forzar DM a fallar (usuario con DMs cerrados)
Esperado: mismo mensaje aparece en canal con mención
Herramienta: prueba manual en Discord
Bloque: 4
```

### 🔴 Crítico 2 — Race condition en Redeem Code
```
Test: dos usuarios reclaman el mismo código simultáneamente
Esperado: solo uno lo obtiene, el otro recibe "ya reclamado"
Herramienta: Vitest con Promise.all de dos claims paralelos
Bloque: 4
```

### 🔴 Crítico 3 — Premio sobrevive crash del bot
```
Test: crear pending_prize → matar proceso → reiniciar bot
Esperado: pending_prize sigue en DB, !reward funciona post-restart
Herramienta: prueba manual
Bloque: 9
```

### 🔴 Crítico 4 — Anti-cheat detección inhumana
```
Test: respuesta en < 80ms en Reaction Speed
Esperado: respuesta rechazada, warning aplicado
Herramienta: Vitest con mock de timestamp
Bloque: 6
```

### 🔴 Crítico 5 — Admin no puede jugar como PLAYER
```
Test: !start con BotRole.PLAYER
Esperado: embed de error "sin permisos"
Herramienta: Vitest con mock de PermissionService
Bloque: 2
```

### 🔴 Crítico 6 — Streak no se rompe por timezone
```
Test: claim a las 23:58, next claim a las 00:02 día siguiente
Esperado: streak incrementa, no se rompe
Herramienta: Vitest con mock de Date
Bloque: 6
```

### 🔴 Crítico 7 — Bot restart no duplica premios
```
Test: ganador → bot crashea antes de INSERT pending_prize
     → reinicio → !reward
Esperado: un solo pending_prize, no duplicado
Herramienta: prueba manual + verificar DB
Bloque: 9
```

### 🔴 Crítico 8 — Sin redeem codes → fallback coins
```
Test: !reward cuando redeem_codes tabla está vacía
Esperado: coins entregados, admin notificado en log_channel
Herramienta: Vitest con DB vacía
Bloque: 4
```

### 🔴 Crítico 9 — AuditLogger registra todas las acciones críticas
```
Test: entregar premio → verificar audit_log tiene entrada correcta
Test: admin !reward manual → verificar audit_log con actor_id
Test: redeem code claimed → verificar audit_log con code_claimed action
Esperado: cada acción tiene row en audit_log con metadata completa
Herramienta: Vitest — verificar INSERT en audit_log post-acción
Bloque: 4
```

---

## 5. Unit Tests por Módulo — OpenCode los escribe

### Domain — juegos
```typescript
// BaseGame
- run() ejecuta fases en orden correcto
- end() inserta en pending_prizes exactamente una vez
- cancelación limpia ScopedEventEmitter

// TriviaGame
- evaluateWinner() retorna jugador con más puntos
- empate → retorna primero en tiempo

// EliminationGame + PlayerPool
- eliminate() reduce activos correctamente
- hasWinner() true cuando queda 1
- shuffle() distribuye orden aleatoriamente

// GuessingGame
- empate por misma distancia → ambos ganan
- nadie adivina → juego cancela limpiamente
```

### Domain — sistemas
```typescript
// StreakSystem
- inactive → active en primer claim
- active + claim en ventana → streak++
- active + claim fuera de ventana → broken
- broken → active con streak = 1
- maxed se mantiene en día 30+
- multiplicador correcto por tier

// AntiCheatService
- respuesta < 80ms → rechazada
- 3 flags → ban temporal aplicado
- sliding window resetea correctamente
- una sesión activa por usuario

// RedeemCodeService
- claim exitoso actualiza version
- claim concurrente → solo uno gana
- código expirado → rechazado
- código ya claimed → rechazado
```

### Infrastructure
```typescript
// DatabaseService
- initialize() crea todas las tablas
- migrations corren en orden
- prepared statements no permiten SQL injection
- singleton devuelve misma instancia siempre

// LeaderboardCache
- HIT devuelve data sin query DB
- MISS hace query y cachea
- invalidate() limpia correctamente
- TTL expira después de 60s

// ScopedEventEmitter
- eventos de sesión A no llegan a sesión B
- destroySession() limpia todos los listeners
- global() events llegan a todos

// AuditLogger
- prize_awarded genera row en audit_log con userId, prizeType, sessionId
- admin_reward genera row con adminId y targetUserId
- code_claimed genera row con userId y codeId
- game_started genera row con adminId y gameType
- manually_confirmed=false por defecto en premios nuevos
- confirmed_by y confirmed_at se actualizan al confirmar
```

### Application
```typescript
// Chain of Responsibility
- PLAYER no pasa PermissionMiddleware en !start
- cooldown activo bloquea !play
- anticheat flag bloquea comandos
- cadena completa en orden correcto

// GameOrchestrator
- startGame() crea sesión en DB
- handleWinner() emite game:winner a ScopedEventEmitter
- endGame() llama BaseGame.end() exactamente una vez
```

---

## 6. Estrategia de Datos de Prueba

```typescript
// test/fixtures/db.ts
// DB en memoria para todos los tests — nunca toca games.db real

export function createTestDb(): Database {
  const db = new Database(':memory:')
  runMigrations(db)
  return db
}

export const testUsers = {
  player:    { discordId: 'player_001', guildId: 'guild_001', coins: 100 },
  admin:     { discordId: 'admin_001',  guildId: 'guild_001', coins: 0   },
  newPlayer: { discordId: 'new_001',    guildId: 'guild_001', coins: 0   },
}

export const testPrizes = {
  coins:   { type: 'coins',   value: '100',      name: '100 Coins'  },
  badge:   { type: 'badge',   value: 'badge_001', name: 'Test Badge' },
  redeem:  { type: 'redeem',  value: 'CODE001',   name: 'Test Code'  },
}

export const testSession = {
  id: 'session_001',
  guildId: 'guild_001',
  channelId: 'channel_001',
  gameType: 'trivia' as GameType,
  status: 'active' as GameStatus,
  startedBy: 'admin_001',
  createdAt: new Date(),
}
```

---

## 7. Checklist de Validación Manual por Bloque

Tú lo ejecutas en Discord real al finalizar cada bloque.

```
BLOQUE 1 — Fundación
□ Bot aparece online en Discord
□ !help o comando inválido → embed de error con color rojo
□ Logs aparecen en /logs/combined.log
□ games.db creado con todas las tablas

BLOQUE 2 — Usuarios y Permisos
□ !start sin rol → embed "sin permisos" en rojo
□ Primer comando crea usuario en DB automáticamente
□ !play dos veces seguidas rápido → segundo bloqueado por cooldown

BLOQUE 3 — Core del Juego
□ !start trivia → embed de anuncio con color blurple
□ !join → nombre aparece en lobby editado (no mensaje nuevo)
□ Countdown se actualiza cada 5s visiblemente
□ Con 1 jugador en 30s → "cancelado, no hay suficientes jugadores"
□ !play con respuesta correcta → embed verde con puntos
□ !play con tiempo agotado → embed rojo
□ Fin de juego → embed dorado con ganador y "usa !reward"

BLOQUE 4 — Premios
□ !reward → DM llega con formato exacto del cliente
□ !reward con DMs cerrados → mismo mensaje en canal con mención
□ !reward sin premios → "no tienes premios pendientes"
□ Coins visibles en !score después de reclamar

BLOQUE 5 — Juegos
□ Cada juego jugable de inicio a fin sin errores
□ Reaction Speed: respuesta muy rápida → advertencia
□ Elimination: jugador eliminado no puede responder más
□ Spin Wheel: un ganador seleccionado aleatoriamente

BLOQUE 6 — Features de Plataforma
□ !leaderboard muestra ranking con colores correctos
□ !daily → reward con streak correcto
□ !daily dos veces el mismo día → "vuelve mañana"
□ !score → perfil completo con victorias, winrate y juego favorito
□ !inventory → items correctos por tipo
□ !history → últimas 5 victorias con juego, premio y tiempo
□ !history @otroUsuario → historial público visible
□ game_winners tiene row en DB después de cada juego terminado
□ audit_log tiene row después de cada premio entregado

BLOQUE 7 — Admin
□ Prize drop aparece en canal → primero en reaccionar gana
□ !prizes pending lista premios sin confirmar
□ !createGame → wizard abre en DM paso a paso
□ Juego custom aparece en !games list

BLOQUE 9 — Hardening
□ Bot se reinicia → sesiones marcadas cancelled en DB
□ CTRL+C → "Bot reiniciando, juego cancelado" en canal activo
□ Comando con error interno → embed de error, bot no crashea
```

---

## 8. Criterios Bloqueantes vs Menores

### 🔴 Bloqueante — no se puede continuar al siguiente bloque
```
→ Bot crashea con cualquier comando
→ Premio no se entrega en ningún caso
→ DM falla Y fallback al canal también falla
→ DB se corrompe o datos incorrectos post-operación
→ Permiso de admin ejecutable por PLAYER
→ Juego termina sin ganador definido
→ pending_prize no se crea al terminar juego
```

### 🟡 Menor — se puede continuar, se corrige en Bloque 9
```
→ Embed con color incorrecto
→ Texto de error con typo
→ Countdown que se desincroniza 1-2s
→ !games list con orden diferente al esperado
→ Log que no aparece en nivel correcto
→ Streak que tarda 1s extra en calcular
```

---

## 9. Flujo de QA por Bloque

```
OpenCode termina bloque
        ↓
OpenCode corre: npm run test
        ↓
¿Tests pasan?
    ├── ❌ No → OpenCode corrige con Cursor si es fix rápido
    │          → Kimi K2.5 revisa si es error de lógica complejo
    └── ✅ Sí → Kimi K2.5 hace code review del bloque
                        ↓
               ¿Kimi encuentra issues?
                    ├── ❌ Sí → Cursor fix puntual
                    └── ✅ No → Tú validas manualmente en Discord
                                        ↓
                               ¿Validación manual pasa?
                                    ├── ❌ No → reportas issue → OpenCode corrige
                                    └── ✅ Sí → bloque DONE → siguiente bloque
```

---

## 10. Checklist QA — Verificación Final

```
✅ Roles de herramientas definidos — OpenCode, Kimi, Cursor, tú
✅ Scope claro — qué sí y qué no se testea
✅ Tipos de prueba por capa — unit, integration, manual
✅ 8 casos críticos identificados desde el diseño
✅ Unit tests por módulo especificados para OpenCode
✅ Fixtures de datos de prueba definidos
✅ Checklist de validación manual por bloque
✅ Criterios bloqueantes vs menores
✅ Flujo de QA por bloque con todas las herramientas
```