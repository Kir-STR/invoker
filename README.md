# invoker

Claude Code plugin: дисциплинарный слой + движок эволюции правил для AI-агентов в любом проекте. Дистилляция переносимой «агентной ОС».

## Установка

Подключи плагин в Claude Code, затем в целевом проекте запусти `/invoker:init`.

## Скиллы

- **`ivk init`** (`/invoker:init`) — скаффолдер: раскладывает выбранный субстрат и модули в проект.
- **`ivk retro`** (`/invoker:retro`) — движок эволюции правил *(в разработке, см. План B)*.

## Разработка

```bash
npm test   # node --test "skills/init/test/*.test.mjs"
```

Дизайн: `docs/specs/2026-06-15-invoker-design.md`. План: `docs/plans/2026-06-16-invoker-init.md`.
