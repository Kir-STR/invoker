# invoker

*[English](#english) · [Русский](#русский)*

---

## English

A Claude Code plugin that drops a **discipline layer + rule-evolution engine for AI agents** into any project — a portable distillation of a hard-won "agent OS".

`init` **copies vetted templates verbatim** (it never synthesizes rule text) and assembles instruction files by including/excluding marked `<!-- module:<id> -->` blocks. Questions are about plugin capabilities only, never your project's values — placeholders are left for you to fill.

### Install & use

Add the plugin in Claude Code, then run `/invoker:init` in your target project. Pick the modules and engines (CLAUDE/AGENTS/GEMINI); the scaffolder lays down `.claude/rules/`, instruction files, and a `.invoker/modules.json` snapshot.

### Skills

- **`ivk init`** (`/invoker:init`) — scaffolder: lays the selected substrate and modules into a project.
- **`ivk retro`** (`/invoker:retro`) — rule-evolution engine *(planned — Plan B)*.

### Development

```bash
npm test   # node --test "skills/init/test/*.test.mjs"
```

Pure Node ESM, no external dependencies. Design: `docs/specs/2026-06-15-invoker-design.md`. Plan: `docs/plans/2026-06-16-invoker-init.md`.

---

## Русский

Claude Code plugin, привносящий в любой проект **дисциплинарный слой + движок эволюции правил для AI-агентов** — переносимую дистилляцию выстраданной «агентной ОС».

`init` **копирует выверенные шаблоны дословно** (никогда не генерирует текст правил) и собирает инструкц-файлы включением/исключением размеченных блоков `<!-- module:<id> -->`. Вопросы — только про возможности плагина, не про значения проекта; плейсхолдеры оставляются оператору.

### Установка и запуск

Подключи плагин в Claude Code, затем в целевом проекте запусти `/invoker:init`. Выбери модули и движки (CLAUDE/AGENTS/GEMINI); скаффолдер разложит `.claude/rules/`, инструкц-файлы и слепок `.invoker/modules.json`.

### Скиллы

- **`ivk init`** (`/invoker:init`) — скаффолдер: раскладывает выбранный субстрат и модули в проект.
- **`ivk retro`** (`/invoker:retro`) — движок эволюции правил *(в разработке — План B)*.

### Разработка

```bash
npm test   # node --test "skills/init/test/*.test.mjs"
```

Чистый Node ESM, без внешних зависимостей. Дизайн: `docs/specs/2026-06-15-invoker-design.md`. План: `docs/plans/2026-06-16-invoker-init.md`.
