---
name: init
description: Скаффолдер invoker — раскладывает выбранный дисциплинарный субстрат и модули в текущий проект. Use when the user wants to bootstrap invoker in a project, run `ivk init`, or set up agent rules/instructions.
---

# ivk init — скаффолдер

Каноническое имя вызова — `/invoker:init`; в прозе — `ivk init`.

Раскладывает субстрат invoker в текущий проект. **Не генерирует текст** — копирует выверенные шаблоны дословно. Вопросы — только про возможности плагина, не про значения проекта. Плейсхолдеры (`{{...}}`) оставляет оператору.

## Протокол

1. **Покажи сгруппированный чеклист модулей** (4 активных блока; Context scaling/runbooks — вне MVP, не предлагать):
   - **Base discipline:** operator-gate, retro-loop *(recommended — предотмечены)*
   - **Git/PR workflow:** worktree-workflow, pr-policy, review-loop
   - **Subagent workflow:** subagent-dispatch
   - **Project governance:** safety, versioning, glossary

   Рядом с каждым — `note` из реестра. Recommended предотмечены, но снимаемы (не silent install). **Вопросов про проект не задавай.**

2. **Спроси про движки** (capability-вопрос): CLAUDE.md — всегда; AGENTS.md / GEMINI.md — по выбору.

3. **Покажи резолв зависимостей** перед записью. Запусти (helper лежит в плагине — зови по абсолютному пути `${CLAUDE_PLUGIN_ROOT}`, т.к. cwd — целевой проект, а не плагин):
   `node "${CLAUDE_PLUGIN_ROOT}/skills/init/helper.mjs" resolve --modules <выбранные через запятую>`
   Покажи оператору `resolved` и `added` (что дотянул каскад). Дождись подтверждения.

4. **Примени** после подтверждения (`--target` — корень целевого проекта, обычно текущая директория `.`):
   `node "${CLAUDE_PLUGIN_ROOT}/skills/init/helper.mjs" apply --target <корень проекта> --engines <claude[,agents][,gemini]> --modules <выбранные>`

5. **Отчёт:** перечисли созданные файлы (из вывода helper'а) и предупреди про оставшиеся `{{placeholders}}` / TODO в инструкц-файлах и `safety.md`. **Плейсхолдеры init не заполняет** — это работа оператора.

## Гарантии

- Правила копируются дословно (байт-в-байт).
- Инструкц-файлы собираются включением/исключением размеченных блоков `<!-- module:<id> -->`, текст не синтезируется.
- Реестр `modules.json` в проект не копируется; пишется слепок `.invoker/modules.json`.

> **Про `${CLAUDE_PLUGIN_ROOT}`:** переменная Claude Code, подставляемая инлайн в содержимое скиллов; абсолютный путь к корню установленного плагина. Источник: офиц. docs «Plugins reference → Environment variables» (code.claude.com/docs/en/plugins-reference). Нужна потому, что при запуске скилла cwd — целевой проект, а не каталог плагина. Manual-проверка (вне юнит-тестов, т.к. подстановку делает harness): установить плагин и запустить `/invoker:init` из тестового проекта — helper должен найтись и отработать.
