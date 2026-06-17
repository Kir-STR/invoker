# invoker

*[English](#english) · [Русский](#русский)*

---

## English

A Claude Code plugin that sets up rules and instruction files for AI agents in your project.

You pick the modules you want; invoker copies ready-made rule files into the project and builds the matching instruction files. It copies the templates as-is — it doesn't write rule text for you, and it doesn't ask about your project's details.

### Install & use

Add the plugin in Claude Code, then run `/invoker:invoke` in your project. Choose the modules and which engines you use (CLAUDE / AGENTS / GEMINI). invoker then creates:

- `.claude/rules/` — rule files for the modules you picked;
- instruction files in the project root (`CLAUDE.md`, plus `AGENTS.md` / `GEMINI.md` if selected);
- `.invoker/` — a record of your choices (`modules.json`) and an ideas inbox.

### Commands

- `/invoker:invoke` — set up rules and instructions in a project.
- `/invoker:retro` — evolve the rules over time *(planned)*.

### Development

```bash
npm test
```

Pure Node ESM, no external dependencies. Design: `docs/specs/2026-06-15-invoker-design.md`. Plan: `docs/plans/2026-06-16-invoker-init.md`.

---

## Русский

Плагин для Claude Code, который разворачивает в проекте правила и файлы-инструкции для AI-агентов.

Ты выбираешь нужные модули — invoker копирует готовые файлы правил в проект и собирает под них файлы-инструкции. Шаблоны копируются как есть: плагин не пишет за тебя текст правил и не спрашивает про детали твоего проекта.

### Установка и запуск

Подключи плагин в Claude Code и запусти `/invoker:invoke` в своём проекте. Выбери модули и движки, которыми пользуешься (CLAUDE / AGENTS / GEMINI). invoker создаст:

- `.claude/rules/` — файлы правил для выбранных модулей;
- файлы-инструкции в корне проекта (`CLAUDE.md`, а также `AGENTS.md` / `GEMINI.md`, если выбрал);
- `.invoker/` — запись твоего выбора (`modules.json`) и инбокс для идей.

### Команды

- `/invoker:invoke` — развернуть правила и инструкции в проекте.
- `/invoker:retro` — развивать правила со временем *(в планах)*.

### Разработка

```bash
npm test
```

Чистый Node ESM, без внешних зависимостей. Дизайн: `docs/specs/2026-06-15-invoker-design.md`. План: `docs/plans/2026-06-16-invoker-init.md`.
