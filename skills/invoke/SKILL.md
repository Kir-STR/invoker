---
name: invoke
description: Создаёт в проекте набор правил и инструкций для AI-агентов — выбираешь модули, invoke раскладывает файлы (правила в .claude/rules, CLAUDE.md и др.). Use when bootstrapping invoker in a project, initializing/setting up agent rules, instructions or discipline, scaffolding .claude/rules, or running /invoker:invoke (init/setup).
---

# invoke — раскладка правил и инструкций

Каноническое имя вызова — `/invoker:invoke`; в прозе — `ivk invoke`.

Создаёт в проекте набор правил и инструкций для AI-агентов. **Не генерирует текст** — копирует выверенные шаблоны дословно. Вопросы — только про возможности плагина (какие модули и какие файлы-инструкции), не про значения проекта.

## Протокол

1. **Покажи сгруппированный чеклист модулей** (4 активных группы; «Масштабирование контекста»/runbooks — вне MVP, не предлагать). Рядом с каждым модулем — `note` из реестра.
   - **Базовая дисциплина:** operator-gate, retro-loop, secret-hygiene *(recommended — предотмечены)*
   - **Работа с git и PR:** worktree-workflow, pr-policy, review-loop
   - **Работа с субагентами:** subagent-dispatch
   - **Управление проектом:** safety, architectural-invariants, versioning, glossary

   Recommended предотмечены, но снимаемы (не silent install). **Вопросов про проект не задавай.**

2. **Спроси, какие файлы-инструкции создать.** `CLAUDE.md` создаётся всегда. Дополнительно по выбору:
   - `AGENTS.md` — для инструментов, читающих AGENTS.md (напр. Codex);
   - `GEMINI.md` — для Gemini CLI.

   (CLAUDE.md не предлагать как снимаемый пункт — он обязателен.)

3. **Покажи резолв зависимостей** перед записью. Запусти (helper лежит в плагине — зови по абсолютному пути `${CLAUDE_PLUGIN_ROOT}`, т.к. cwd — целевой проект, а не плагин):
   `node "${CLAUDE_PLUGIN_ROOT}/skills/invoke/helper.mjs" resolve --modules <выбранные через запятую>`
   Покажи оператору `resolved` и `added` (что дотянул каскад). Дождись подтверждения.

4. **Примени** после подтверждения (`--target` — корень целевого проекта, обычно текущая директория `.`):
   `node "${CLAUDE_PLUGIN_ROOT}/skills/invoke/helper.mjs" apply --target <корень проекта> --engines <claude[,agents][,gemini]> --modules <выбранные>`

5. **Отчёт:** перечисли созданные файлы (из вывода helper'а). Плейсхолдеры `invoke` не заполняет, но в recommended-наборе их обычно не остаётся (`globs`/ветка проставлены дефолтами). Если в выбранном модуле остался проектно-уникальный `{{...}}` — укажи его оператору.

## Гарантии

- Правила копируются дословно (байт-в-байт).
- Инструкц-файлы собираются включением/исключением размеченных блоков `<!-- module:<id> -->`, текст не синтезируется.
- Реестр `modules.json` в проект не копируется; пишется слепок `.invoker/modules.json`.

> **Про `${CLAUDE_PLUGIN_ROOT}`:** переменная Claude Code, подставляемая инлайн в содержимое скиллов; абсолютный путь к корню установленного плагина. Источник: офиц. docs «Plugins reference → Environment variables» (code.claude.com/docs/en/plugins-reference). Нужна потому, что при запуске скилла cwd — целевой проект, а не каталог плагина. Manual-проверка (вне юнит-тестов, т.к. подстановку делает harness): установить плагин и запустить `/invoker:invoke` из тестового проекта — helper должен найтись и отработать.
