Perfecto. Con eso ya puedo cerrar esos gaps de ambigüedad. Déjame consolidar las definiciones:

---

## ✅ Definiciones Cerradas

### Virtual Items
Cada juego tiene su propio set de items coleccionables únicos:

| Juego | Virtual Items |
|---|---|
| Trivia | 📚 Knowledge Scroll, 🧠 Genius Crown |
| Reaction Speed | ⚡ Lightning Gloves, 🏃 Speed Boots |
| Math | 🔢 Calculator Rune, 📐 Precision Lens |
| Word Puzzle | 📖 Word Tome, 🖊️ Scribe Feather |
| Dice/Luck | 🎲 Lucky Dice, 🍀 Fortune Charm |
| Spin Wheel | 🎡 Wheel Fragment, ✨ Spin Token |
| Guessing | 🔮 Crystal Ball, 👁️ Oracle Eye |
| Elimination | 🗡️ Survivor Blade, 🛡️ Last Stand Shield |
| Special Games | 👑 Event Crown, 🌟 Legendary Token |

Puramente cosméticos/coleccionables dentro del bot. Se acumulan en `!inventory`.

---

### Special Games
Juegos de evento — no están disponibles permanentemente, solo cuando un admin los activa manualmente en ocasiones especiales:

| Special Game | Descripción |
|---|---|
| 🏆 Tournament Mode | Eliminación entre todos los jugadores del servidor, bracket style |
| 🎃 Event Trivia | Trivia temática por evento (Halloween, Navidad, etc.) |
| 💎 High Stakes | Juego donde se apuestan coins acumuladas |
| 🌙 Midnight Drop | Prize drop masivo que ocurre una vez al día a hora aleatoria |
| ⚔️ Boss Battle | Todos vs un "boss" — responden preguntas para bajarle HP |

Acceso via `special_access` en inventory — solo jugadores con el item/rol correspondiente pueden hacer `!join` a estos juegos.

---

### !join vs !play — Flujo de dos pasos clarificado

```
!join  → entrar al LOBBY antes de que empiece el juego
         (ventana de 30s mientras se espera jugadores)
         
!play  → participar ACTIVAMENTE durante una ronda en curso
         (responder, reaccionar, adivinar según el juego)
         
!reward → reclamar premio ganado
          (el premio queda pendiente hasta que el jugador
           lo reclama explícitamente con este comando)
```

---

### !reward — Redefinido

```
Jugador gana juego
    ↓
Premio queda en estado 'pending' en DB
    ↓
Bot notifica: "🎉 Ganaste! Usa !reward para reclamar tu premio"
    ↓
Jugador escribe !reward
    ↓
Bot entrega premio → DM con detalles
    ↓
Premio pasa a estado 'claimed' en DB
    ↓
Registrar en audit_log
```

Esto resuelve G-B completamente y además añade una capa de seguridad — los premios no se entregan automáticamente sin confirmación del jugador.

---

## 📋 Gaps cerrados con estas definiciones

| Gap | Estado |
|---|---|
| G-D Virtual items definición funcional | ✅ Cerrado |
| G-C Special games validación acceso en !join | ✅ Cerrado |
| G-B !reward trigger vs asignación manual | ✅ Cerrado |
| G-R Diferencia !join vs !play | ✅ Cerrado |

---

## 📋 Gaps restantes abiertos

| # | Gap |
|---|---|
| G-A | Platform feel — definición concreta |
| G-E | Custom game creation — flujo paso a paso |
| G-F | Tabla pending_prizes no en schema |
| G-G | !games list no formalizado |
| G-H | Real-time updates |
| G-I | Historial de ganadores |
| G-J | Template DM centralizado |
| G-K | Lobby limits |
| G-L | Carga redeem codes externos |
| G-M | Reporte premios manuales admin |
| G-N | Comandos extra no validados |
| G-O | Trigger after each game vs after each round |
| G-P | EmbedBuilder centralizado |
| G-Q | Sistema sin redeem codes cargados |
| G-S | Alcance de !score |

**15 gaps restantes.** ¿Los resolvemos uno por uno?

## Resolución G-A hasta G-S

---

### G-A — Platform Feel — Definición Concreta

**¿Qué significa "feel like a full game platform" técnicamente?**

Todo mensaje del bot sigue el mismo patrón visual y de experiencia:

```
CICLO DE VIDA VISUAL DE CADA JUEGO:

1. ANUNCIO (cuando admin hace !start)
┌─────────────────────────────────┐
│ 🎮 TRIVIA CHALLENGE             │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ 👥 Jugadores: 0/10              │
│ ⏱️  Inicio en: 30s              │
│ 💰 Premio: 100 Coins + Badge    │
│                                 │
│ Escribe !join para participar   │
└─────────────────────────────────┘

2. LOBBY UPDATE (cada vez que alguien hace !join)
┌─────────────────────────────────┐
│ 🎮 TRIVIA CHALLENGE — LOBBY     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ ✅ @Player1                     │
│ ✅ @Player2                     │
│ 👥 2/10 jugadores               │
│ ⏱️  Inicio en: 22s              │
└─────────────────────────────────┘
(bot edita el mismo mensaje — no spam)

3. INICIO DE RONDA
┌─────────────────────────────────┐
│ 🎯 RONDA 1/5                    │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ ❓ ¿Cuál es la capital de Perú? │
│ ⏱️  15 segundos para responder  │
└─────────────────────────────────┘

4. RESULTADO DE RONDA
┌─────────────────────────────────┐
│ ✅ @Player1 respondió primero!  │
│ Respuesta: Lima ✓               │
│ +10 puntos                      │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ 📊 Scores: Player1: 10 | P2: 0 │
└─────────────────────────────────┘

5. FIN DE JUEGO
┌─────────────────────────────────┐
│ 🏆 JUEGO TERMINADO              │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ 👑 Ganador: @Player1            │
│ 💰 Premio pendiente             │
│                                 │
│ Usa !reward para reclamar       │
└─────────────────────────────────┘
```

**Técnicamente:**
- Bot **edita** el mensaje del lobby en lugar de enviar nuevos → no hay spam
- Todos los embeds usan la misma paleta de colores y estructura
- Transiciones entre fases son anunciadas con countdown
- `EmbedFactory` centralizado genera todos los embeds → resuelve G-P simultáneamente

---

### G-B — ✅ Cerrado en iteración anterior

---

### G-C — ✅ Cerrado en iteración anterior

---

### G-D — ✅ Cerrado en iteración anterior

---

### G-E — Custom Game Creation — Flujo Paso a Paso

```
Admin !createGame
    ↓
Bot abre DM con el admin con wizard interactivo:

PASO 1: Nombre
"¿Cómo se llamará tu juego?"
→ Admin responde: "Movie Trivia"

PASO 2: Tipo base
"¿En qué tipo base se basa?"
[Trivia] [Reaction] [Guessing] [Elimination] [Luck]
→ Admin elige: Trivia

PASO 3: Rondas
"¿Cuántas rondas? (1-10)"
→ Admin responde: 5

PASO 4: Tiempo por ronda
"¿Segundos por ronda? (10-60)"
→ Admin responde: 20

PASO 5: Premio
"¿Qué premio otorga?"
[Coins] [Badge] [Virtual Item] [Role] [Redeem Code]
→ Admin elige: Coins → "¿Cuántos?" → 200

PASO 6: Preguntas (si base = Trivia)
"Envía tus preguntas en formato:
 pregunta | respuesta
 (mínimo 5, máximo 20)"
→ Admin envía lista

PASO 7: Confirmación
┌─────────────────────────────┐
│ 📋 RESUMEN DE TU JUEGO     │
│ Nombre: Movie Trivia        │
│ Tipo: Trivia                │
│ Rondas: 5 × 20s             │
│ Premio: 200 Coins           │
│ Preguntas: 5 cargadas       │
│                             │
│ ✅ Confirmar  ❌ Cancelar   │
└─────────────────────────────┘
    ↓ confirma
GameBuilder.build() → valida
    ↓
GameRegistry.register()
    ↓
DB persiste el juego custom
    ↓
"✅ Movie Trivia creado. Usa !start movietrivia para jugarlo"
```

---

### G-F — Tabla pending_prizes — Schema

```sql
pending_prizes (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  session_id    TEXT REFERENCES game_sessions(id),
  prize_id      TEXT NOT NULL REFERENCES prizes(id),
  prize_type    TEXT NOT NULL,
  prize_value   TEXT NOT NULL,
  status        TEXT DEFAULT 'pending',  -- pending|claimed|expired|failed
  attempts      INTEGER DEFAULT 0,       -- intentos de entrega
  last_attempt  DATETIME,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  claimed_at    DATETIME,
  expires_at    DATETIME                 -- null = no expira
)

CREATE INDEX idx_pending_prizes_user   ON pending_prizes(user_id, status);
CREATE INDEX idx_pending_prizes_status ON pending_prizes(status, created_at);
```

**Flujo integrado:**
```
Jugador gana
    ↓
INSERT pending_prizes (status: 'pending')
    ↓
Bot notifica: "usa !reward para reclamar"
    ↓
Jugador !reward
    ↓
SELECT pending prizes WHERE user_id AND status = 'pending'
    ↓
¿Hay premios pendientes?
    ├── ✅ → entregar → UPDATE status = 'claimed'
    └── ❌ → "No tienes premios pendientes"
```

---

### G-G — !games list — Formalizado

**Nuevo comando oficial:**

```
!games list → muestra todos los juegos disponibles
!games info [nombre] → detalles de un juego específico
```

**RF nuevo:**
```
RF-15 → !games list muestra juegos disponibles desde GameRegistry
RF-16 → !games info [nombre] muestra detalles, premio y duración
```

**Caso de uso nuevo:**
```
CU-14 → Jugador escribe !games list
         → Bot responde embed con todos los juegos
           registrados, tipo, duración estimada y premio

CU-15 → Jugador escribe !games info trivia
         → Bot responde embed con detalles específicos del juego
```

---

### G-H — Real-Time Updates

**¿Cómo se comunica estado en vivo en Discord?**

Discord no tiene websockets hacia el usuario — el "real time" se logra con **message editing**:

```
class LiveMessageManager {
  // Guarda el mensaje del lobby para editarlo
  private liveMessages: Map<string, Message> = new Map()

  async updateLobby(sessionId: string, state: LobbyState): Promise<void> {
    const msg = this.liveMessages.get(sessionId)
    if (!msg) return
    await msg.edit({ embeds: [EmbedFactory.lobby(state)] })
  }

  async updateRound(sessionId: string, state: RoundState): Promise<void> {
    const msg = this.liveMessages.get(sessionId)
    await msg.edit({ embeds: [EmbedFactory.round(state)] })
  }
}
```

**Qué se actualiza en vivo:**
```
Lobby     → jugadores que se unen + countdown editado cada 5s
Ronda     → countdown de tiempo restante editado cada 5s
Scores    → scoreboard actualizado tras cada ronda
Resultado → embed final editado con ganador
```

**RNF nuevo:**
```
RNF-08 → Real-time updates via message editing, no spam de mensajes nuevos
```

---

### G-I — Historial de Ganadores

**Tabla nueva:**
```sql
game_winners (
  id           TEXT PRIMARY KEY,
  session_id   TEXT NOT NULL REFERENCES game_sessions(id),
  user_id      TEXT NOT NULL REFERENCES users(id),
  game_type    TEXT NOT NULL,
  prize_id     TEXT REFERENCES prizes(id),
  score        INTEGER,
  won_at       DATETIME DEFAULT CURRENT_TIMESTAMP
)

CREATE INDEX idx_game_winners_user ON game_winners(user_id, won_at);
CREATE INDEX idx_game_winners_game ON game_winners(game_type, won_at);
```

**Comando nuevo:**
```
!history          → últimas 5 partidas ganadas por el jugador
!history @user    → historial de otro jugador (público)
!history top      → los 5 jugadores con más victorias
```

**RF nuevo:**
```
RF-17 → !history muestra historial de victorias del jugador
```

---

### G-J — Template DM Centralizado

**EmbedFactory** en `src/utils/EmbedFactory.ts`:

```typescript
class EmbedFactory {
  // Template exacto que el cliente especificó
  static winnerDM(data: WinnerDMData): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle('🎉 You Won!')
      .addFields(
        { name: '🏆 Game',   value: data.gameName  },
        { name: '💰 Prize',  value: data.prizeName },
        { name: '🎁 Reward', value: data.rewardDescription }
      )
      .setFooter({ text: 'Your prize has been added to your account!' })
      .setColor(0xFFD700)
  }

  // Mismo template para fallback en canal
  static winnerChannel(data: WinnerDMData): EmbedBuilder {
    return this.winnerDM(data)  // idéntico — cliente dijo "the same message"
      .setDescription(`📢 ${data.userMention} no tenía DMs abiertos`)
  }

  static lobby(state: LobbyState): EmbedBuilder { ... }
  static round(state: RoundState): EmbedBuilder { ... }
  static gameEnd(state: GameEndState): EmbedBuilder { ... }
  static leaderboard(entries: LeaderboardEntry[]): EmbedBuilder { ... }
  static inventory(items: InventoryItem[]): EmbedBuilder { ... }
  static score(user: User): EmbedBuilder { ... }
  static dailyReward(result: DailyClaimResult): EmbedBuilder { ... }
  static prizeDrop(prize: Prize): EmbedBuilder { ... }
  static error(message: string): EmbedBuilder { ... }
}
```

**Carpeta:** `src/utils/EmbedFactory.ts` — resuelve G-P simultáneamente.

---

### G-K — Lobby Limits

```
Reglas de lobby definidas:

Mínimo jugadores : 2 (no se puede iniciar con 1)
Máximo jugadores : 10 por defecto (configurable en guild_config)
Ventana de join  : 30 segundos desde !start

Casos edge:
┌─────────────────────────────────────────────────────┐
│ Caso                   │ Comportamiento              │
├─────────────────────────────────────────────────────┤
│ !join con juego lleno  │ "Lobby lleno, espera        │
│                        │  el próximo juego"          │
├─────────────────────────────────────────────────────┤
│ !join con juego ya     │ "El juego ya comenzó,       │
│ iniciado               │  espera la próxima ronda"   │
├─────────────────────────────────────────────────────┤
│ 30s pasan con < 2      │ Bot cancela y anuncia       │
│ jugadores              │ "No hay suficientes         │
│                        │  jugadores, cancelado"      │
├─────────────────────────────────────────────────────┤
│ !join sin juego activo │ "No hay ningún juego        │
│                        │  activo. Usa !games list"   │
└─────────────────────────────────────────────────────┘
```

**guild_config actualizado:**
```sql
ALTER TABLE guild_config ADD COLUMN max_players_per_game INTEGER DEFAULT 10;
ALTER TABLE guild_config ADD COLUMN min_players_per_game INTEGER DEFAULT 2;
ALTER TABLE guild_config ADD COLUMN lobby_wait_seconds   INTEGER DEFAULT 30;
```

---

### G-L — Carga de Redeem Codes Externos

**Comando admin:**
```
!addcodes [archivo .txt adjunto]
o
!addcode PREMIO-XYZ123 [tipo] [valor]
```

**Flujo:**
```
Admin adjunta archivo .txt con formato:
CODE001
CODE002
CODE003

    ↓
Bot parsea el archivo
    ↓
Valida formato (no duplicados, no códigos ya existentes)
    ↓
INSERT batch en redeem_codes con status = 'available'
    ↓
"✅ 3 códigos cargados correctamente"
    ↓
Registrar en audit_log (quién cargó, cuántos, cuándo)
```

**RF nuevo:**
```
RF-18 → Admin puede cargar redeem codes externos via !addcodes
```

---

### G-M — Reporte Premios Manuales Admin

**Comando admin:**
```
!prizes pending          → lista de premios físicos por entregar manualmente
!prizes pending @user    → premios pendientes de un usuario específico
!prizes confirm [id]     → marcar premio físico como entregado manualmente
```

**Flujo:**
```
!prizes pending
    ↓
Query audit_log WHERE action = 'prize_awarded'
  AND prize_type IN ('physical', 'external', 'redeem')
  AND manually_confirmed = FALSE
    ↓
┌──────────────────────────────────────┐
│ 📋 PREMIOS PENDIENTES DE ENTREGA    │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ #001 @Player1 → Redeem Code         │
│      Juego: Trivia | Hace 2h        │
│                                     │
│ #002 @Player2 → Physical Prize      │
│      Juego: Tournament | Hace 1d    │
│                                     │
│ Usa !prizes confirm [id] para       │
│ marcar como entregado               │
└──────────────────────────────────────┘
```

**Campo nuevo en audit_log:**
```sql
ALTER TABLE audit_log ADD COLUMN manually_confirmed BOOLEAN DEFAULT FALSE;
ALTER TABLE audit_log ADD COLUMN confirmed_by TEXT;
ALTER TABLE audit_log ADD COLUMN confirmed_at DATETIME;
```

---

### G-N — Comandos Extra No Validados

Revisando los comandos que añadimos por cuenta propia vs los 6 del cliente:

| Comando | Origen | Validado? | Decisión |
|---|---|---|---|
| `!join` | Cliente | ✅ | Mantener |
| `!start` | Cliente | ✅ | Mantener |
| `!play` | Cliente | ✅ | Mantener |
| `!score` | Cliente | ✅ | Mantener |
| `!leaderboard` | Cliente | ✅ | Mantener |
| `!reward` | Cliente | ✅ | Mantener |
| `!daily` | Nosotros | ⚠️ | Mantener — cliente pidió daily rewards, necesita comando |
| `!inventory` | Nosotros | ⚠️ | Mantener — cliente pidió inventory en DB, necesita comando para verlo |
| `!games list` | Nosotros | ⚠️ | Mantener — necesario para scalability |
| `!games info` | Nosotros | ⚠️ | Mantener — UX básica |
| `!history` | Nosotros | ⚠️ | Mantener — cliente pidió track winners |
| `!createGame` | Nosotros | ⚠️ | Mantener — cliente pidió custom game creation |
| `!addcodes` | Nosotros | ⚠️ | Mantener — cliente pidió redeem codes |
| `!prizes pending` | Nosotros | ⚠️ | Mantener — cliente pidió manual prize handling |
| `!drop force` | Nosotros | ⚠️ | Mantener — admin control sobre drops |

**Conclusión:** Todos los comandos extra tienen justificación directa en CLIENT-REQUERIMENTS.MD. Ninguno es arbitrario.

---

### G-O — Trigger "After Each Game" vs "After Each Round"

```
Cliente dijo: "automatically sends winners a DM after each game"
                                                    ^^^^^^^^^^^
                                                    JUEGO completo
                                                    no por ronda
```

**Definición formal:**
```
Premio se entrega UNA VEZ por sesión completa — no por ronda.

Rondas intermedias → acumulan puntos solamente
Fin de sesión      → se determina ganador global
                   → INSERT pending_prizes
                   → Bot notifica !reward

Excepción: Dice y Spin Wheel son de una sola ronda
           → fin de ronda = fin de sesión = entrega de premio
```

**Impacto en BaseGame:**
```typescript
abstract class BaseGame {
  // Rondas solo acumulan — no entregan premios
  abstract roundLogic(): Promise<void>

  // Solo aquí se entrega el premio — al final del juego completo
  async end(): Promise<void> {
    const winner = this.evaluateWinner()
    await PrizeSystem.createPending(winner, this.session)
    await this.channel.send(EmbedFactory.gameEnd({ winner, session: this.session }))
  }
}
```

---

### G-P — ✅ Resuelto en G-J (EmbedFactory)

---

### G-Q — Sistema Sin Redeem Codes Cargados

```
PrizeAdapter → RedeemAdapter.deliver()
    ↓
¿Hay códigos disponibles en DB?
    ├── ✅ Hay códigos → entregar normalmente
    └── ❌ No hay códigos
              ↓
        NO romper el flujo
              ↓
        Entregar premio alternativo (coins por defecto)
        + notificar admin via log_channel:
          "⚠️ No hay redeem codes disponibles.
           Se entregaron [X] coins como alternativa a @user"
        + registrar en audit_log para seguimiento manual
```

**RNF nuevo:**
```
RNF-09 → El sistema opera completamente sin redeem codes cargados,
          con fallback automático a coins y notificación al admin
```

---

### G-R — ✅ Cerrado en iteración anterior

---

### G-S — Alcance de !score

```
!score → muestra perfil completo del jugador:

┌─────────────────────────────────┐
│ 👤 @Player1                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ 💰 Coins: 1,250                 │
│ 🏆 Victorias: 23                │
│ 🎮 Partidas jugadas: 47         │
│ 🔥 Streak actual: 5 días        │
│ 📊 Winrate: 48%                 │
│ 🥇 Juego favorito: Trivia       │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ Últimas victorias:              │
│ • Trivia — hace 2h              │
│ • Dice — hace 1d                │
│ • Math — hace 3d                │
└─────────────────────────────────┘
```

**Datos que requiere:**
- `users` → coins, streak
- `game_winners` → victorias, juego favorito
- `participation` → partidas jugadas, winrate

---

## ✅ Todos los Gaps Resueltos

| Gap | Estado |
|---|---|
| G-A Platform feel | ✅ LiveMessageManager + ciclo visual |
| G-B !reward trigger | ✅ Cerrado anteriormente |
| G-C Special games !join | ✅ Cerrado anteriormente |
| G-D Virtual items | ✅ Cerrado anteriormente |
| G-E Custom game creation | ✅ Wizard interactivo en DM |
| G-F pending_prizes schema | ✅ Tabla definida |
| G-G !games list | ✅ RF-15, RF-16, CU-14, CU-15 |
| G-H Real-time updates | ✅ LiveMessageManager + message editing |
| G-I Historial ganadores | ✅ game_winners table + !history |
| G-J Template DM | ✅ EmbedFactory centralizado |
| G-K Lobby limits | ✅ Reglas + edge cases + guild_config |
| G-L Carga redeem codes | ✅ !addcodes + flujo batch |
| G-M Reporte premios manuales | ✅ !prizes pending + audit_log |
| G-N Comandos extra | ✅ Todos justificados |
| G-O Trigger game vs round | ✅ BaseGame.end() único punto de entrega |
| G-P EmbedBuilder centralizado | ✅ Resuelto en G-J |
| G-Q Sin redeem codes | ✅ Fallback a coins + notificación admin |
| G-R !join vs !play | ✅ Cerrado anteriormente |
| G-S Alcance !score | ✅ Perfil completo definido |

**19/19 gaps resueltos.** ¿Pasamos al siguiente punto del SDLC?