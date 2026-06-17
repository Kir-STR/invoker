# invoker

*Agent rules for your project — installed in one run, refined over time.*

*[English](#english) · [Русский](#русский)*

---

## English

invoker drops ready-made behavior rules for AI agents into your project — how agents work with git and PRs, how they run subagents, what they don't do without asking. You pick the modules you need; invoker copies vetted templates into `.claude/rules/` and builds the matching instruction files (`CLAUDE.md` / `AGENTS.md` / `GEMINI.md`). It doesn't write rule text for you and doesn't ask about your project's details.

It's not one-off scaffolding. Over time invoker notices which situations keep recurring in your sessions and suggests new rules to add — so the rule set grows with the project instead of going stale. *(This rule-evolution engine — `retro` — is in the works.)*

### Install & use

Add the plugin in Claude Code, then run `/invoker:invoke` in your project. Choose the modules and which engines you use (CLAUDE / AGENTS / GEMINI). invoker then creates:

- `.claude/rules/` — rule files for the modules you picked;
- instruction files in the project root (`CLAUDE.md`, plus `AGENTS.md` / `GEMINI.md` if selected);
- `.invoker/` — a record of your choices (`modules.json`) and an ideas inbox.

### Commands

- `/invoker:invoke` — install rules and instructions in a project.
- `/invoker:retro` — refine the rules over time from your real sessions *(in the works)*.

### Development

```bash
npm test
```

Pure Node ESM, no external dependencies. Design: `docs/specs/2026-06-15-invoker-design.md`. Plan: `docs/plans/2026-06-16-invoker-init.md`.

---

## Русский

invoker раскладывает в проект готовые правила поведения для AI-агентов — как агенты работают с git и PR, как запускают субагентов, чего не делают без спроса. Выбираешь нужные модули — плагин копирует выверенные шаблоны в `.claude/rules/` и собирает под них файлы-инструкции (`CLAUDE.md` / `AGENTS.md` / `GEMINI.md`). Текст правил он не сочиняет и про детали твоего проекта не спрашивает.

Это не разовый скаффолдинг. Со временем invoker подмечает, какие ситуации повторяются в твоих сессиях, и предлагает новые правила — так набор растёт вместе с проектом, а не устаревает. *(Этот движок эволюции правил — `retro` — в разработке.)*

### Установка и запуск

Подключи плагин в Claude Code и запусти `/invoker:invoke` в своём проекте. Выбери модули и движки, которыми пользуешься (CLAUDE / AGENTS / GEMINI). invoker создаст:

- `.claude/rules/` — файлы правил для выбранных модулей;
- файлы-инструкции в корне проекта (`CLAUDE.md`, а также `AGENTS.md` / `GEMINI.md`, если выбрал);
- `.invoker/` — запись твоего выбора (`modules.json`) и инбокс для идей.

### Команды

- `/invoker:invoke` — развернуть правила и инструкции в проекте.
- `/invoker:retro` — со временем дополнять правила на основе твоих реальных сессий *(в разработке)*.

### Разработка

```bash
npm test
```

Чистый Node ESM, без внешних зависимостей. Дизайн: `docs/specs/2026-06-15-invoker-design.md`. План: `docs/plans/2026-06-16-invoker-init.md`.
