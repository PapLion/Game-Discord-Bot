# Discord Game Bot — Agent Context

## Stack
Node.js 20 LTS | TypeScript 5.4 | discord.js 14.15 | better-sqlite3 9.6

## Arquitectura
Layered: presentation → application → domain → infrastructure
Las dependencias SOLO apuntan hacia abajo. Nunca al revés.

## Reglas absolutas
- NUNCA usar `any` en TypeScript
- NUNCA SQL con string concatenation — solo prepared statements  
- NUNCA hardcodear colores — solo EMBED_COLORS de Constants.ts
- NUNCA hardcodear números — solo GAME_CONSTANTS de Constants.ts
- NUNCA texto plano al canal — siempre EmbedFactory
- NUNCA Error genérico — usar GameError, PrizeError, AuthError
- Todo comando tiene try/catch sin excepción

## Documentación del proyecto
SDLC/ANALISIS-REQUISITOS/ARCHITECH.MD — arquitectura completa
SDLC/ANALISIS-REQUISITOS/RESOLVER-GAPS.MD — soluciones técnicas
SDLC/DISEÑO/TEACHLEAD.MD — estándares y orden de implementación
SDLC/DISEÑO/UI-UX.MD — embeds, colores, flujos visuales
SDLC/DISEÑO/QA.MD — casos críticos y tests requeridos
SDLC/IMPLEMENTACION/ROADMAP.MD — plan de implementación
