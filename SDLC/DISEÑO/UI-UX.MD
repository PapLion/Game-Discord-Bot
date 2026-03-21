# 🎨 UI/UX Design — Discord Game Bot

> En un bot de Discord no hay pantallas ni wireframes.
> El "UI" es la experiencia conversacional completa —
> embeds, comandos, flujos, feedback y consistencia visual.
> Todo implementado directamente. Sin mockups.

---

## 1. Design System — Paleta de Colores

Cada tipo de embed tiene un color hexadecimal fijo definido en EmbedFactory.
Consistencia visual en todo el bot — el jugador identifica el tipo de mensaje por el color antes de leer.

```typescript
export const EMBED_COLORS = {
  // Juegos
  GAME_ANNOUNCE:   0x5865F2,  // Blurple Discord — anuncio de juego
  LOBBY:           0x5865F2,  // Blurple Discord — lobby activo
  ROUND_START:     0xFEE75C,  // Amarillo — ronda iniciando, atención
  ROUND_RESULT:    0x57F287,  // Verde — resultado correcto
  ROUND_TIMEOUT:   0xED4245,  // Rojo — tiempo agotado
  GAME_END:        0xFFD700,  // Dorado — fin de juego, ganador

  // Premios
  WINNER_DM:       0xFFD700,  // Dorado — DM de victoria
  PRIZE_DROP:      0xEB459E,  // Rosa — drop aleatorio
  DAILY_REWARD:    0x57F287,  // Verde — daily claim exitoso
  REWARD_CLAIMED:  0x57F287,  // Verde — premio reclamado

  // Perfil / Stats
  SCORE:           0x5865F2,  // Blurple — perfil del jugador
  LEADERBOARD:     0xFFD700,  // Dorado — rankings
  INVENTORY:       0x5865F2,  // Blurple — inventario
  HISTORY:         0x5865F2,  // Blurple — historial

  // Sistema
  ERROR:           0xED4245,  // Rojo — errores
  WARNING:         0xFEE75C,  // Amarillo — advertencias
  INFO:            0x5865F2,  // Blurple — información general
  SUCCESS:         0x57F287,  // Verde — confirmaciones
  ADMIN:           0xEB459E,  // Rosa — acciones admin

  // Juegos especiales
  SPECIAL_GAME:    0xF47FFF,  // Púrpura claro — eventos especiales
  TOURNAMENT:      0xFFD700,  // Dorado — torneos
}
```

---

## 2. Design System — Emojis y Lenguaje Visual

Emojis consistentes en todo el bot. El jugador aprende el lenguaje visual rápido.

```
ESTADO DE JUEGO
🎮  → juego / gaming
🎯  → ronda activa
🏆  → ganador / victoria
👑  → primer lugar
⏱️  → countdown / tiempo
👥  → jugadores en lobby
✅  → correcto / unido / éxito
❌  → incorrecto / cancelado / error
📊  → scores / estadísticas

PREMIOS
💰  → coins
🎁  → regalo / premio
🏅  → badge
🎲  → juego de suerte
🔮  → item especial
🎫  → redeem code
🔑  → special access
⚡  → reaction speed item
📚  → trivia item

SISTEMA
🔥  → streak activo
💔  → streak roto
⚠️  → advertencia
📋  → lista / reporte admin
🌟  → legendary / especial
👤  → perfil de usuario
📈  → estadísticas / winrate
🥇  → favorito / mejor
```

---

## 3. Design System — Tipografía y Estructura de Embeds

Todas las reglas que EmbedFactory debe seguir para consistencia total.

```
REGLAS GENERALES:
→ Títulos: siempre con emoji al inicio
→ Separador visual: ━━━━━━━━━━━━━━━━━━━━━━━━
→ Campos: nombre en negrita implícita (Discord los hace bold)
→ Footer: siempre presente con contexto útil
→ Thumbnail: avatar del bot o icono del juego cuando aplica
→ Timestamp: solo en embeds de historial y audit

LONGITUD:
→ Títulos: máx 50 caracteres
→ Descripciones: máx 200 caracteres
→ Field values: máx 100 caracteres
→ Footer: máx 80 caracteres

TONO:
→ Mensajes de victoria: energético, celebratorio
→ Mensajes de error: claro, directo, siempre con solución
→ Mensajes admin: formal, informativo
→ Contdowns: urgente, conciso
```

---

## 4. Ciclo de Vida Visual Completo de un Juego

Todo el flujo de un juego desde !start hasta !reward — mensaje por mensaje.

---

### 4.1 Fase 1 — Anuncio de Juego (!start)

```
COLOR: 0x5865F2 (Blurple)
ACCIÓN: Nuevo mensaje — bot lo guarda para editar

┌────────────────────────────────────────┐
│ 🎮 TRIVIA CHALLENGE                    │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ 👥 Jugadores: 0/10                     │
│ ⏱️  Inicio en: 30s                     │
│ 💰 Premio: 100 Coins + 🏅 Rare Badge   │
│                                        │
│ Escribe !join para participar          │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ 📋 Iniciado por @Admin                 │
└────────────────────────────────────────┘
```

---

### 4.2 Fase 2 — Lobby Activo (mensaje editado cada 5s)

```
COLOR: 0x5865F2 (Blurple) — mismo mensaje, editado
ACCIÓN: LiveMessageManager.updateLobby() cada 5s

┌────────────────────────────────────────┐
│ 🎮 TRIVIA CHALLENGE — LOBBY            │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ ✅ @Player1                            │
│ ✅ @Player2                            │
│ ✅ @Player3                            │
│ 👥 3/10 jugadores                      │
│ ⏱️  Inicio en: 18s                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ Todavía puedes unirte con !join        │
└────────────────────────────────────────┘
```

---

### 4.3 Fase 3 — Inicio de Ronda

```
COLOR: 0xFEE75C (Amarillo) — nuevo mensaje por ronda
ACCIÓN: Nuevo mensaje enviado

┌────────────────────────────────────────┐
│ 🎯 RONDA 1 / 5                         │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ ❓ ¿Cuál es la capital de Japón?       │
│                                        │
│ ⏱️  15 segundos para responder         │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ Escribe tu respuesta en el chat        │
└────────────────────────────────────────┘
```

---

### 4.4 Fase 4 — Resultado de Ronda (mensaje editado)

```
COLOR: 0x57F287 (Verde) — respuesta correcta
COLOR: 0xED4245 (Rojo)  — tiempo agotado / nadie respondió
ACCIÓN: LiveMessageManager edita el mensaje de ronda

[CORRECTO]
┌────────────────────────────────────────┐
│ ✅ @Player2 respondió primero!         │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ Respuesta: Tokio ✓                     │
│ +10 puntos                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ 📊 Player1: 0  |  Player2: 10  |  Player3: 0 │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ Siguiente ronda en 3s...               │
└────────────────────────────────────────┘

[TIMEOUT]
┌────────────────────────────────────────┐
│ ⏱️  ¡Tiempo agotado!                   │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ Nadie respondió correctamente          │
│ Respuesta correcta: Tokio              │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ 📊 Player1: 0  |  Player2: 0  |  Player3: 0 │
└────────────────────────────────────────┘
```

---

### 4.5 Fase 5 — Fin de Juego

```
COLOR: 0xFFD700 (Dorado)
ACCIÓN: Nuevo mensaje final

┌────────────────────────────────────────┐
│ 🏆 JUEGO TERMINADO                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ 👑 Ganador: @Player2                   │
│ 📊 Score final: 30 puntos              │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ 1st 👑 @Player2  — 30pts              │
│ 2nd 🥈 @Player1  — 20pts              │
│ 3rd 🥉 @Player3  — 10pts              │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ 💰 Premio pendiente para @Player2     │
│ Usa !reward para reclamar tu premio   │
└────────────────────────────────────────┘
```

---

### 4.6 Fase 6 — DM al Ganador (!reward)

```
COLOR: 0xFFD700 (Dorado)
ACCIÓN: DM privado — template exacto del cliente

┌────────────────────────────────────────┐
│ 🎉 You Won!                            │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ 🏆 Game:    Trivia Challenge           │
│ 💰 Prize:   100 Coins                 │
│ 🎁 Reward:  Rare Badge                │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ Your prize has been added to          │
│ your account!                         │
└────────────────────────────────────────┘

[FALLBACK — DM falla, mismo mensaje en canal]
┌────────────────────────────────────────┐
│ 🎉 You Won! — @Player2                 │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ 📢 No pudimos enviarte un DM          │
│ 🏆 Game:    Trivia Challenge           │
│ 💰 Prize:   100 Coins                 │
│ 🎁 Reward:  Rare Badge                │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ Your prize has been added to          │
│ your account!                         │
└────────────────────────────────────────┘
```

---

## 5. Embeds por Comando — Diseño Completo

### !score — Perfil del Jugador

```
COLOR: 0x5865F2 (Blurple)

┌────────────────────────────────────────┐
│ 👤 @Player1                            │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ 💰 Coins:          1,250               │
│ 🏆 Victorias:      23                  │
│ 🎮 Partidas:       47                  │
│ 🔥 Streak:         5 días              │
│ 📊 Winrate:        48%                 │
│ 🥇 Juego fav:      Trivia              │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ Últimas victorias:                     │
│ • 🎯 Trivia     — hace 2h              │
│ • 🎲 Dice       — hace 1d              │
│ • 🔢 Math       — hace 3d              │
└────────────────────────────────────────┘
```

---

### !leaderboard — Rankings

```
COLOR: 0xFFD700 (Dorado)

┌────────────────────────────────────────┐
│ 🏆 LEADERBOARD                         │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ 👑 1.  @Player2    — 3,450 coins       │
│ 🥈 2.  @Player5    — 2,890 coins       │
│ 🥉 3.  @Player1    — 1,250 coins       │
│    4.  @Player8    —   980 coins       │
│    5.  @Player3    —   750 coins       │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ 📊 Actualizado hace 12s               │
└────────────────────────────────────────┘
```

---

### !inventory — Inventario del Jugador

```
COLOR: 0x5865F2 (Blurple)

┌────────────────────────────────────────┐
│ 🎒 Inventario de @Player1              │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ 🏅 BADGES (2)                         │
│ • Week Warrior  — Obtenido hace 3d    │
│ • Trivia Master — Obtenido hace 1sem  │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ 🎮 ITEMS (3)                          │
│ • 📚 Knowledge Scroll  [Trivia]       │
│ • 🧠 Genius Crown      [Trivia]       │
│ • 🎲 Lucky Dice        [Dice]         │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ 🔑 ACCESOS ESPECIALES (1)             │
│ • Tournament Mode — Expira en 2d      │
└────────────────────────────────────────┘
```

---

### !daily — Daily Reward

```
COLOR: 0x57F287 (Verde) — claim exitoso
COLOR: 0xFEE75C (Amarillo) — ya reclamado hoy

[EXITOSO]
┌────────────────────────────────────────┐
│ 🔥 Day 7 Streak!                       │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ 💰 Base:       +150 coins              │
│ ⚡ Bonus:      +100 coins              │
│ ✖️  Multiplier: x3.0                   │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ 💰 Total:      750 coins               │
│ 🏅 Badge:      Week Warrior            │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ Vuelve mañana para mantener x3.0      │
└────────────────────────────────────────┘

[YA RECLAMADO]
┌────────────────────────────────────────┐
│ ⏱️  Ya reclamaste tu recompensa hoy    │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ 🔥 Streak actual: 7 días               │
│ ⏳ Próximo claim: en 14h 23m           │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ ¡No rompas tu racha!                  │
└────────────────────────────────────────┘

[STREAK ROTO]
┌────────────────────────────────────────┐
│ 💔 Streak roto                         │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ Tu racha de 7 días se perdió          │
│ Empezando desde día 1...              │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ 💰 Reward: 50 coins (base)            │
│ Vuelve mañana para empezar racha      │
└────────────────────────────────────────┘
```

---

### !history — Historial de Victorias

```
COLOR: 0x5865F2 (Blurple)

┌────────────────────────────────────────┐
│ 📋 Historial de @Player1               │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ 🏆 23 victorias totales                │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ 🎯 Trivia    — 100 coins  — hace 2h   │
│ 🎲 Dice      — Badge      — hace 1d   │
│ 🔢 Math      — 50 coins   — hace 3d   │
│ ⚡ Reaction  — Item       — hace 5d   │
│ 📖 WordGame  — 75 coins   — hace 1sem │
└────────────────────────────────────────┘
```

---

### !games list — Lista de Juegos

```
COLOR: 0x5865F2 (Blurple)

┌────────────────────────────────────────┐
│ 🎮 JUEGOS DISPONIBLES                  │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ 🎯 trivia        — 3-5min  — 💰+🏅    │
│ ⚡ reaction      — 30s     — 💰       │
│ 🔢 math          — 2-3min  — 💰       │
│ 📖 wordpuzzle    — 3min    — 💰+🎮    │
│ 🎲 dice          — 1min    — 💰       │
│ 🎡 spinwheel     — 30s     — 💰+🎮    │
│ 🔮 guessing      — 2min    — 💰       │
│ 🗡️  elimination   — 5min    — 💰+🏅    │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ 🌟 ESPECIALES (requieren acceso)       │
│ 👑 tournament    — evento              │
│ ⚔️  bossbattle    — evento              │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ !games info [nombre] para más detalles │
└────────────────────────────────────────┘
```

---

### !games info [nombre]

```
COLOR: 0x5865F2 (Blurple)

┌────────────────────────────────────────┐
│ 🎯 TRIVIA CHALLENGE                    │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ 📝 Responde preguntas antes que        │
│    los demás. El más rápido gana.      │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ ⏱️  Duración:    3-5 minutos           │
│ 👥 Jugadores:   2-10                   │
│ 🔄 Rondas:      5                      │
│ 💰 Premio:      100 coins + Rare Badge │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ !start trivia para comenzar           │
└────────────────────────────────────────┘
```

---

### Prize Drop — Drop Aleatorio

```
COLOR: 0xEB459E (Rosa)
ACCIÓN: Nuevo mensaje — bot lo guarda para detectar reacción

┌────────────────────────────────────────┐
│ 🎁 ¡PRIZE DROP!                        │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ 💰 Premio: 200 Coins                   │
│                                        │
│ ⚡ Reacciona con 🎁 para ganar         │
│ ⏱️  Tienes 30 segundos                 │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ ¡El primero en reaccionar gana!       │
└────────────────────────────────────────┘

[GANADOR ENCONTRADO]
┌────────────────────────────────────────┐
│ 🎉 @Player3 ganó el drop!              │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ 💰 Premio: 200 Coins añadidos          │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ Usa !reward para reclamar              │
└────────────────────────────────────────┘

[NADIE REACCIONÓ]
┌────────────────────────────────────────┐
│ ⏱️  Drop expirado                      │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ Nadie reclamó el premio a tiempo      │
│ El siguiente drop llegará pronto...   │
└────────────────────────────────────────┘
```

---

### !prizes pending — Admin Panel

```
COLOR: 0xEB459E (Rosa — admin)

┌────────────────────────────────────────┐
│ 📋 PREMIOS PENDIENTES DE ENTREGA       │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ #001 @Player1 → Redeem Code            │
│      Juego: Trivia | Hace 2h          │
│                                        │
│ #002 @Player2 → Physical Prize         │
│      Juego: Tournament | Hace 1d      │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ !prizes confirm [id] → marcar entregado│
└────────────────────────────────────────┘
```

---

### Mensajes de Error — Todos los Casos

```
COLOR: 0xED4245 (Rojo) — siempre

[PERMISO INSUFICIENTE]
┌────────────────────────────────────────┐
│ ❌ Sin permisos                        │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ Necesitas rol Admin para usar !start  │
└────────────────────────────────────────┘

[COOLDOWN ACTIVO]
┌────────────────────────────────────────┐
│ ⏱️  Cooldown activo                    │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ Espera 1.5s antes de usar !play       │
└────────────────────────────────────────┘

[LOBBY LLENO]
┌────────────────────────────────────────┐
│ ❌ Lobby lleno                         │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ El juego ya tiene 10/10 jugadores     │
│ Espera el próximo juego               │
└────────────────────────────────────────┘

[JUEGO YA INICIADO]
┌────────────────────────────────────────┐
│ ❌ Juego en curso                      │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ No puedes unirte, el juego ya empezó  │
│ Espera la próxima sesión              │
└────────────────────────────────────────┘

[SIN JUEGO ACTIVO]
┌────────────────────────────────────────┐
│ ❌ Sin juego activo                    │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ No hay ningún juego en este momento   │
│ Usa !games list para ver opciones     │
└────────────────────────────────────────┘

[SIN PREMIOS PENDIENTES]
┌────────────────────────────────────────┐
│ ❌ Sin premios pendientes              │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ No tienes premios por reclamar        │
│ ¡Juega para ganar uno!                │
└────────────────────────────────────────┘

[ANTICHEAT — RESPUESTA INHUMANA]
┌────────────────────────────────────────┐
│ ⚠️  Respuesta sospechosa               │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ Tu respuesta fue demasiado rápida     │
│ Advertencia 1/3                       │
└────────────────────────────────────────┘

[ANTICHEAT — BAN TEMPORAL]
┌────────────────────────────────────────┐
│ 🚫 Timeout aplicado                   │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ Comportamiento sospechoso detectado   │
│ No puedes jugar por 5 minutos         │
└────────────────────────────────────────┘
```

---

### Mensajes de Éxito / Confirmación

```
COLOR: 0x57F287 (Verde)

[JUEGO CANCELADO — SIN JUGADORES]
┌────────────────────────────────────────┐
│ ❌ Juego cancelado                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ No hay suficientes jugadores (min. 2) │
│ Usa !start [juego] para intentar      │
│ de nuevo                              │
└────────────────────────────────────────┘

[CUSTOM GAME CREADO]
┌────────────────────────────────────────┐
│ ✅ Movie Trivia creado                 │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ Tipo: Trivia  |  Rondas: 5  |  20s   │
│ Premio: 200 coins                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ !start movietrivia para jugarlo       │
└────────────────────────────────────────┘

[CODES CARGADOS — !addcodes]
┌────────────────────────────────────────┐
│ ✅ Códigos cargados                    │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ 15 redeem codes disponibles           │
│ Registrado en audit log               │
└────────────────────────────────────────┘

[ERROR !addcodes — formato inválido]
┌────────────────────────────────────────┐
│ ❌ Formato inválido                    │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ Adjunta un archivo .txt con un        │
│ código por línea                      │
│ Ejemplo: CODE001                      │
└────────────────────────────────────────┘
```

---

## 6. Flujos de UX por Juego

### Reaction Speed
```
Bot: [embed ROUND_START 0xFEE75C]
     "⚡ ¡AHORA! — primero en escribir !play gana"
         ↓
Jugadores escriben !play
         ↓
Bot detecta primero (>80ms para ser válido)
         ↓
Bot: [embed ROUND_RESULT 0x57F287]
     "@Player1 ganó en 142ms! ⚡"
         ↓
[Si nadie responde en 30s]
Bot: [embed ROUND_TIMEOUT 0xED4245]
     "⏱️ Nadie fue suficientemente rápido
      Usa !start reaction para intentar de nuevo"
```

---

### Elimination
```
Bot: [ROUND_START] "@Player3 — tu turno"
     Pregunta visible para todos
         ↓
Solo @Player3 responde
         ↓
[CORRECTO] Bot: "@Player3 sobrevivió ✅ — quedan 4"
[INCORRECTO] Bot: "@Player3 fue eliminado ❌ — quedan 3"
         ↓
[1 jugador queda]
Bot: [GAME_END 0xFFD700] "👑 @Player2 — último sobreviviente!"
```

---

### Spin Wheel
```
Bot: [ANNOUNCE] "🎡 SPIN WHEEL — todos pueden unirse con !join"
         ↓
Bot: [ROUND_START 0xFEE75C]
     "🎡 Girando la ruleta..."
     [3s de suspenso visual — mensaje editado con puntos ...]
         ↓
Bot: [GAME_END 0xFFD700]
     "🎡 La ruleta se detuvo en... @Player2!
      👑 Ganador seleccionado por suerte"
```

---

### Guessing
```
Bot: [ROUND_START] "🔮 Adivina el número entre 1 y 100
                   Tienes 2 minutos — ¡sin límite de intentos!"
         ↓
Jugadores envían números en chat
         ↓
Bot responde a cada intento:
     "📈 Demasiado alto" / "📉 Demasiado bajo" / "✅ ¡Correcto!"
         ↓
[Empate] Bot: "🤝 @Player1 y @Player2 adivinaron con la
               misma distancia — premio dividido"
```

---

## 7. UX del Wizard — !createGame (Admin en DM)

```
[PASO 1]
Bot DM: "🎮 Vamos a crear tu juego personalizado
         ━━━━━━━━━━━━━━━━━━━━━━━━━━
         ¿Cómo se llamará tu juego? (máx 30 chars)"

Admin: "Movie Trivia"

[PASO 2]
Bot DM: "¿En qué tipo base se basa?
         1️⃣  Trivia
         2️⃣  Reaction
         3️⃣  Guessing
         4️⃣  Elimination
         5️⃣  Luck
         Responde con el número"

Admin: "1"

[PASO 3]
Bot DM: "¿Cuántas rondas? (1-10)"
Admin: "5"

[PASO 4]
Bot DM: "¿Segundos por ronda? (10-60)"
Admin: "20"

[PASO 5]
Bot DM: "¿Qué premio otorga?
         1️⃣  Coins
         2️⃣  Badge
         3️⃣  Virtual Item
         4️⃣  Role
         5️⃣  Redeem Code"

Admin: "1"

Bot DM: "¿Cuántos coins?"
Admin: "200"

[PASO 6 — Solo si base = Trivia]
Bot DM: "Envía tus preguntas en este formato
         (mínimo 5, máximo 20):

         pregunta | respuesta
         pregunta | respuesta

         Ejemplo:
         ¿Quién dirigió Titanic? | James Cameron"

Admin: envía lista

[PASO 7 — Confirmación]
┌────────────────────────────────────────┐
│ 📋 RESUMEN DE TU JUEGO                 │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ Nombre:     Movie Trivia               │
│ Tipo:       Trivia                     │
│ Rondas:     5 × 20s                    │
│ Premio:     200 coins                  │
│ Preguntas:  8 cargadas                 │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ Reacciona ✅ para confirmar           │
│ Reacciona ❌ para cancelar            │
└────────────────────────────────────────┘

[CONFIRMADO]
Bot DM: "✅ Movie Trivia creado exitosamente
         !start movietrivia para jugarlo en el servidor"

[CANCELADO]
Bot DM: "❌ Creación cancelada
         Usa !createGame para empezar de nuevo"
```

---

## 8. UX Reglas Generales

```
REGLA 1 — Sin spam
→ El bot nunca envía múltiples mensajes seguidos donde
  puede editar uno solo (LiveMessageManager)
→ Countdowns editados cada 5s en el mismo mensaje

REGLA 2 — Siempre hay una acción siguiente
→ Todo mensaje de error incluye qué hacer
→ "Usa !games list", "Espera el próximo juego", etc.
→ El jugador nunca queda perdido

REGLA 3 — Feedback inmediato
→ Cada comando recibe respuesta en < 1s
→ Si hay procesamiento largo → "⏳ Procesando..." primero

REGLA 4 — Consistencia total
→ EmbedFactory es la ÚNICA fuente de embeds
→ Nunca mensajes de texto plano excepto en wizard DM
→ Mismo color = mismo tipo de mensaje, siempre

REGLA 5 — Admin vs Jugador
→ Mensajes de admin en DM cuando es información sensible
→ Mensajes de jugador en canal siempre
→ Wizard de !createGame siempre en DM

REGLA 6 — Lenguaje
→ Mensajes de juego: inglés (cliente lo especificó en DM template)
→ Mensajes de error/sistema: inglés
→ Consistencia total — no mezclar idiomas

REGLA 7 — Escalabilidad visual
→ Leaderboard máx 10 entradas
→ Inventory paginado si > 10 items (usando botones Discord)
→ History máx 5 entradas recientes
```

---

## 9. Componente EmbedFactory — Referencia Completa

Todos los métodos que debe implementar EmbedFactory.ts:

```typescript
class EmbedFactory {
  // Ciclo de vida del juego
  static gameAnnounce(data: GameAnnounceData): EmbedBuilder
  static gameLobby(data: LobbyState): EmbedBuilder
  static roundStart(data: RoundStartData): EmbedBuilder
  static roundResult(data: RoundResultData): EmbedBuilder
  static roundTimeout(data: RoundTimeoutData): EmbedBuilder
  static gameEnd(data: GameEndData): EmbedBuilder

  // Premios
  static winnerDM(data: WinnerDMData): EmbedBuilder
  static winnerChannel(data: WinnerDMData): EmbedBuilder  // mismo formato
  static prizeDrop(data: PrizeDropData): EmbedBuilder
  static prizeDropWinner(data: PrizeDropWinnerData): EmbedBuilder
  static prizeDropExpired(): EmbedBuilder

  // Comandos de jugador
  static score(data: ScoreData): EmbedBuilder
  static leaderboard(data: LeaderboardData): EmbedBuilder
  static inventory(data: InventoryData): EmbedBuilder
  static history(data: HistoryData): EmbedBuilder
  static gamesList(data: GamesListData): EmbedBuilder
  static gamesInfo(data: GameInfoData): EmbedBuilder

  // Daily / Streak
  static dailyClaim(data: DailyClaimData): EmbedBuilder
  static dailyAlreadyClaimed(data: DailyAlreadyData): EmbedBuilder
  static streakBroken(data: StreakBrokenData): EmbedBuilder

  // Admin
  static prizesPending(data: PrizesPendingData): EmbedBuilder
  static codesLoaded(count: number): EmbedBuilder
  static customGameCreated(data: CustomGameData): EmbedBuilder
  static customGameSummary(data: CustomGameData): EmbedBuilder

  // Sistema
  static error(message: string, suggestion?: string): EmbedBuilder
  static warning(message: string): EmbedBuilder
  static success(message: string): EmbedBuilder
  static info(message: string): EmbedBuilder
  static cooldown(remaining: number): EmbedBuilder
  static noPermission(requiredRole: string): EmbedBuilder
}
```

---

## 10. Checklist UI/UX — Verificación Final

```
✅ Paleta de colores definida — 1 color por tipo de mensaje
✅ Emojis estandarizados — lenguaje visual consistente
✅ Tipografía y estructura de embeds — reglas claras
✅ Ciclo de vida visual completo — anuncio → lobby → ronda → fin → DM
✅ Template DM exacto del cliente — "You Won!" con todos los campos
✅ Fallback DM → canal — mismo template, mención al usuario
✅ Todos los comandos tienen embed diseñado
✅ Todos los errores tienen embed con solución
✅ Todos los edge cases tienen respuesta visual
✅ Wizard !createGame en DM — flujo paso a paso
✅ Real-time via message editing — sin spam
✅ EmbedFactory — referencia completa de todos los métodos
✅ Reglas UX generales — 7 reglas formalizadas
✅ Flujos específicos por juego — Reaction, Elimination, Spin, Guessing
✅ Sin mockups — diseño directo para implementación
```