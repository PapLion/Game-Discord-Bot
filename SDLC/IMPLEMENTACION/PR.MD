# PR.MD — Flujo de Pull Request

Cuando se te pida generar un PR, ejecuta estos pasos en orden sin saltarte ninguno.

---

## Pasos obligatorios

### 1. Estado del repositorio
- Mostrar staged changes
- Mostrar unstaged/uncommitted changes
- Mostrar rama actual

### 2. Formatear y limpiar código
- Ejecutar: `npm run format`
- Stage los cambios de formato

### 3. Crear commit convencional
Usar el tipo que se indique en la temática:
- `feat:` → nueva feature
- `fix:` → corrección de bug o incompatibilidad
- `refactor:` → refactoring sin cambio de comportamiento
- `test:` → añadir o corregir tests
- `docs:` → documentación
- `chore:` → tareas de mantenimiento, dependencias

Formato del mensaje:
```
<tipo>: <descripción corta en inglés>

- Detalle 1
- Detalle 2
- Detalle 3
```

❌ Nunca usar: "fixed stuff", "updates", "WIP"

### 4. Comparar con rama base y generar descripción del PR
- Detectar rama base: master (este proyecto no usa main ni develop)
- Generar diff contra master
- Construir descripción estructurada:

```
## Summary
<qué cambia y por qué>

## Technical Details
<detalles de implementación>

## Testing
<cómo se verificó que funciona>
- [ ] npm run build pasa
- [ ] npm run test pasa (si aplica)

## Related
<bloque del ROADMAP que corresponde: R-A, R-B, etc.>
```

### 5. Push y crear PR
```bash
git push origin <rama-actual>
gh pr create --title "<tipo>: <descripción>" --body "<descripción generada>"
gh pr view --web
```

---

## Tipos de PR por bloque del ROADMAP

| Bloque | Tipo de commit | Rama sugerida |
|---|---|---|
| R-A | feat | feat/block-1-foundation |
| R-B | feat | feat/block-2-foundation |
| R-C | feat | feat/block-3-permissions |
| R-D | feat | feat/block-4-core-game |
| R-E | feat | feat/block-5-prize-system |
| R-F | feat | feat/block-6-games |
| R-G | feat | feat/block-7-platform |
| R-H | feat | feat/block-8-admin |
| R-I | feat | feat/block-9-special-games |
| R-J | feat | feat/block-10-hardening |
| Fix cualquier bloque | fix | fix/<descripción-corta> |

---

## Uso

Cuando se te diga:
> "Lee PR.MD y genera un PR con temática X"

Ejecuta los 5 pasos de arriba usando X como la temática del commit.
