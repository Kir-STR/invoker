# invoker

*A portable agent-OS baseline: consistent rules, instructions, and procedures for AI agents in any project — set up in one run, refined over time.*

*[English](#english) · [Русский](#русский)*

---

## English

invoker bootstraps a quality, universal baseline for working with AI agents in any project. You pick what you need; invoker lays down a coherent set of files and procedures so agents behave consistently — and over time it helps those rules evolve. It copies vetted templates as-is: it doesn't write rule text for you and doesn't ask about your project's details.

### What invoker sets up

- **`CLAUDE.md`** — key instructions for the main agent (operator).
- **`AGENTS.md`** — an advisor role (e.g. Codex as a helper).
- **`GEMINI.md`** — a reviewer role (e.g. Gemini as a CI controller).
- **`.claude/rules/`** — useful rules, always loaded into context, kept out of `CLAUDE.md` so it stays lean.
- **runbooks** — step-by-step procedures read on demand, not kept in context all the time *(planned)*.
- **skills** — universal procedures referenced explicitly from `CLAUDE.md`/rules, so the agent invokes them for sure instead of guessing.

The first three plus rules are scaffolded into your project; skills live in the plugin and are invoked by name.

### Install & use

Add the plugin in Claude Code, then run `/invoker:invoke` in your project. Choose the modules and which engines you use (CLAUDE / AGENTS / GEMINI). invoker writes the rule files, the instruction files, and a `.invoker/` service zone (a snapshot of your choices and an ideas inbox).

### Commands

- **`/invoker:invoke`** — set up the baseline in a project.
- **`/invoker:retro`** — evolve the rules from your real sessions.
- **`/invoker:save`** — persist session memory for next time.

### Direction

invoker is growing into a small, portable agent-OS. The **retro** rule-evolution engine and the **save** memory trigger are already in; on the roadmap:

- a **runbook** layer — on-demand procedures that don't need to sit in context;
- packaging more universal procedures as **skills** referenced from the rules, so agents use them reliably.

It stays engine-agnostic and self-contained: invoker ships its own procedures and doesn't require third-party workflow plugins; where a project already has equivalents, the rules say "or equivalent".

### Development

```bash
npm test
```

Pure Node ESM, no external dependencies. Design: `docs/specs/2026-06-15-invoker-design.md`. Plan: `docs/plans/2026-06-16-invoker-init.md`.

---

## Русский

invoker разворачивает в проекте качественную универсальную основу для работы с AI-агентами. Ты выбираешь нужное — invoker раскладывает слаженный набор файлов и процедур, чтобы агенты вели себя последовательно, и со временем помогает этим правилам эволюционировать. Шаблоны копируются как есть: плагин не пишет за тебя текст правил и не спрашивает про детали проекта.

### Что разворачивает invoker

- **`CLAUDE.md`** — ключевые инструкции для основного агента (оператора).
- **`AGENTS.md`** — роль советника (например, Codex как помощник).
- **`GEMINI.md`** — роль ревьюера (например, Gemini как контролёр в CI).
- **`.claude/rules/`** — полезные правила, всегда в контексте, вынесены из `CLAUDE.md`, чтобы он оставался компактным.
- **runbook'и** — пошаговые процедуры, читаемые по необходимости, не висящие в контексте постоянно *(планируется)*.
- **скиллы** — универсальные процедуры, на которые `CLAUDE.md`/правила ссылаются явно, чтобы агент вызывал их наверняка, а не догадывался.

Первые три плюс правила раскладываются в проект; скиллы живут в плагине и вызываются по имени.

### Установка и запуск

Подключи плагин в Claude Code и запусти `/invoker:invoke` в своём проекте. Выбери модули и движки (CLAUDE / AGENTS / GEMINI). invoker запишет файлы правил, файлы-инструкции и служебную зону `.invoker/` (слепок выбора и инбокс идей).

### Команды

- **`/invoker:invoke`** — развернуть основу в проекте.
- **`/invoker:retro`** — развивать правила на основе твоих реальных сессий.
- **`/invoker:save`** — сохранять память сессии для следующего раза.

### Куда развивается

invoker растёт в небольшой переносимый agent-OS. Движок эволюции правил **retro** и триггер памяти **save** уже на месте; в планах:

- слой **runbook** — процедуры по запросу, которым не нужно занимать контекст;
- упаковка новых универсальных процедур в **скиллы**, на которые ссылаются правила, чтобы агенты использовали их надёжно.

invoker остаётся движок-агностичным и самодостаточным: поставляет свои процедуры и не требует сторонних воркфлоу-плагинов; если в проекте уже есть эквиваленты — правила говорят «или эквивалент».

### Разработка

```bash
npm test
```

Чистый Node ESM, без внешних зависимостей. Дизайн: `docs/specs/2026-06-15-invoker-design.md`. План: `docs/plans/2026-06-16-invoker-init.md`.
