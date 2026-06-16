# invoker — дизайн (spec)

Дата: 2026-06-15
Статус: operator-approved (сессия дизайна 2026-06-15), pending implementation plan

## 1. Суть

`invoker` — Claude Code plugin, который привносит в произвольный проект **дисциплинарный слой + движок эволюции правил для AI-агентов**. Это дистилляция операционной системы, выстраданной в боевом проекте, очищенная от проектной специфики и сделанная переносимой.

Принцип: **рабочий инструмент сейчас, без оверинжиниринга**; не идеально-универсальный, но честный и переносимый.

Плагин состоит из двух родов сущностей:

- **Скиллы** (активные, живут в плагине): `ivk init` (скаффолдер) и `ivk retro` (движок промоута правил).
- **Шаблоны** (статика, которую `ivk init` раскладывает в проект): инструкц-файлы, `.claude/rules/*.md`, seed-файлы.

> Каноническое имя вызова скиллов — `/invoker:init` / `/invoker:retro`; в прозе ниже сокращаем до `ivk init` / `ivk retro`.

Ключевое: `init` **не генерирует текст правил** — копирует выверенные шаблоны дословно. Вопросы init — **только про возможности плагина** (какие модули развернуть, под какие движки писать инструкции), не про значения проекта (имя и т.п.). Плейсхолдеры остаются — оператор заполняет их сам по месту.

### Граница с другими плагинами

invoker — **агностик**. Не вендорит и не требует чужих воркфлоу-плагинов. Поведенческие правила ссылаются на «твой скилл планирования/worktree (или эквивалент)», не привязываясь к конкретной реализации. Не дублируем чужой код; переносимо на Codex/Gemini.

## 2. Scope MVP / Non-goals

В MVP:

- Скиллы `init` и `retro`.
- Каталог шаблонов (субстрат + модули) с уже снятой проектной спецификой.
- Декларативный реестр модулей `modules.json`.
- Multi-engine эмиссия инструкций (CLAUDE/AGENTS/GEMINI) без транспайлера.

Вне MVP (зафиксировано как будущее):

- **runbooks / I-P split** — режим упаковки (вынос процедур в `docs/runbooks/`), не модуль. Включать позже, когда правило становится слишком длинным для autoload или retro-loop стабильно производит процедурный текст.
- Поля реестра `requires` / `conflicts` / `maturity` — добавить, когда init начнёт ими пользоваться.
- Авто-перевод одной инструкции в три (multi-engine делается курируемыми ролевыми шаблонами).
- Авто-детект значений проекта, анкеты про проект, policy-engine.
- Отдельные `commands/`-обёртки (скиллы вызываются как `/invoker:init`).

## 3. Архитектура

### 3.1. Анатомия плагина

```
invoker/
  .claude-plugin/plugin.json      # name, version, description
  skills/
    init/SKILL.md                 # ivk init — скаффолдер
    retro/SKILL.md                # ivk retro — движок промоута правил
  templates/                      # дословно копируемая статика
    instructions/
      CLAUDE.md.tmpl
      AGENTS.md.tmpl
      GEMINI.md.tmpl
    rules/                        # по файлу на модуль
      operator-gate.md
      retro-loop.md
      worktree-workflow.md
      subagent-dispatch.md
      pr-policy.md
      review-loop.md
      safety.md
      versioning.md
      glossary.md
    seed/
      ideas_4_rules.md            # пустой inbox
      retro-template.md
  modules.json                    # РЕЕСТР модулей (control plane для init)
  README.md
```

`modules.json` лежит в **корне плагина**, не в `templates/`: это управляющий манифест, а не копируемая статика.

### 3.2. Реестр `modules.json`

Единственный источник правды для init. Вся «магия» зависимостей/групп/дефолтов живёт здесь, не в коде скилла.

Схема модуля (MVP):

```jsonc
{
  "operator-gate": {
    "title": "Operator gate",
    "group": "base-discipline",
    "default": true,
    "files": ["rules/operator-gate.md"],
    "depends_on": [],
    "note": "Подтверждение деструктивных/наружу-направленных действий."
  },
  "review-loop": {
    "title": "Review loop",
    "group": "git-pr-workflow",
    "default": false,
    "files": ["rules/review-loop.md"],
    "depends_on": ["pr-policy"],
    "note": "Нужен CI review-бот."
  }
  // … остальные модули
}
```

- `title` — метка для чеклиста init.
- `note` — **user-facing подсказка** рядом с галкой; НЕ вопрос про проект, НЕ авто-детект.
- `depends_on` — каскад, дотягивается автоматически.
- Поля `requires`/`conflicts`/`maturity` — вне MVP.

### 3.3. Слепок в целевом проекте `.invoker/modules.json`

init генерит в целевой проект отдельный артефакт (не копию реестра) для будущих re-init/upgrade:

```jsonc
{
  "plugin": "invoker",
  "plugin_version": "0.1.0",
  "engines": ["claude", "agents"],
  "selected_modules": ["operator-gate", "retro-loop"],
  "resolved_modules": ["operator-gate", "retro-loop"],
  "created_at": "…"
}
```

`selected_modules` (явный выбор оператора) и `resolved_modules` (после каскада зависимостей) разведены намеренно.

## 4. Каталог модулей

### Обязательный субстрат («пустой invoker»)

Ставится всегда, без него invoker не invoker:

- инструкц-файл `CLAUDE.md` (+ `AGENTS.md`/`GEMINI.md` по выбору движков);
- каркас `.claude/rules/` + канон frontmatter (`globs` / `class`);
- пустой `ideas_4_rules.md` (inbox эволюции правил);
- слепок выбора `.invoker/modules.json` (пишется всегда). Реестр `modules.json` живёт в плагине (control plane init) и в целевой проект **не копируется**.

Субстрат не содержит ни одного поведенческого правила.

### Поведенческие модули (все опциональны)

Recommended-профиль (предотмечено в init, снимаемо — не silent install):

| Модуль | Группа | Default | depends_on | Зависит от |
|---|---|---|---|---|
| operator-gate | base-discipline | ✓ | — | ничего |
| retro-loop | base-discipline | ✓ | — | ничего (identity feature) |
| worktree-workflow | git-pr-workflow | — | — | git + worktrees |
| pr-policy | git-pr-workflow | — | worktree-workflow | PR-flow |
| review-loop | git-pr-workflow | — | pr-policy | CI review-бот |
| subagent-dispatch | subagent-workflow | — | — | subagent-driven стиль |
| safety | project-governance | — | — | safety-критичный проект |
| versioning | project-governance | — | — | промпты/контракты |
| glossary | project-governance | — | — | — |

Каскад: `review-loop → pr-policy → worktree-workflow` дотягивается автоматически и показывается оператору.

### UX-группировка init (4 активных блока + зарезервированный)

На диске — мелкие самодостаточные файлы-правила (переносимость + dependency graph). В чеклисте init — крупные блоки, чтобы не заставлять оператора принимать 10 микрорешений:

- **Base discipline:** operator-gate, retro-loop *(recommended)*
- **Git/PR workflow:** worktree-workflow, pr-policy, review-loop
- **Subagent workflow:** subagent-dispatch
- **Project governance:** safety, versioning, glossary
- **Context scaling:** runbooks *(вне MVP)*

## 5. Поток `ivk init`

1. Оператор запускает `/invoker:init`.
2. init читает `modules.json`.
3. Показывает сгруппированный чеклист (4 активных блока; Context scaling/runbooks зарезервирован, вне MVP); recommended (operator-gate, retro-loop) предотмечены; рядом `note`-подсказки. **Вопросов про проект нет.**
4. Выбор движков (capability-вопрос): CLAUDE.md всегда; AGENTS.md / GEMINI.md — по выбору.
5. Резолв каскада зависимостей; результат показывается оператору.
6. Копирует выбранные `rules/*.md` дословно в `.claude/rules/`.
7. **Собирает инструкц-файл(ы)** из `templates/instructions/*.tmpl`: указатели на модули **уже встроены** в каждый engine-шаблон и размечены маркерами `<!-- module:<id> -->…<!-- /module -->`. init **вырезает** блоки невыбранных модулей. Текст не синтезируется — только включение/исключение размеченных блоков.
8. Раскладывает seed: пустой `ideas_4_rules.md`; `retro-template.md` (если retro-loop выбран).
9. Пишет `.invoker/modules.json` (слепок выбора).
10. Отчёт: что создано, какие `{{placeholders}}` / TODO остались оператору. **Плейсхолдеры init не заполняет.**

## 6. Поток `ivk retro` (движок эволюции — флагман)

1. Читает `.claude/retro-*.md` (черновики-наблюдения по веткам) + наблюдения мастер-сессии.
2. Сводит кандидатов в `ideas_4_rules.md` → «Активные кандидаты», с **n-счётом** (число независимых прецедентов) и целевым файлом. **Это единственное изменение ФС, которое retro делает по умолчанию.**
3. Для `n≥2` / high-conf-safety **готовит кандидата к промоуту**: proposed rule text + target file + rationale — и показывает в отчёте. **Фактическая правка `.claude/rules/*` / CLAUDE.md — только после явного подтверждения оператора.** Никакого автономного самопереписывания инструкций.
4. **Cleanup — gated.** По умолчанию `retro-*.md` НЕ удаляются. retro предлагает cleanup; удаление разрешено только после записи строки в «Лог обработки» + подтверждения оператора. Альтернатива — архив в `.claude/retro/archive/` (тоже явное изменение ФС).

Классификация кандидатов: `n≥2`/high-conf-safety → готов к промоуту; `n=1` → остаётся ждать; reject → строка в «Лог обработки»; move → spec/OPS.

> Примечание реализации: уже существуют глобальные скиллы `/retro` и `/save`. При реализации сверить, не дублирует ли `ivk retro` их — плагинная версия либо заменяет глобальную, либо переиспользует.

## 7. Multi-engine — без транспайлера

Инструкции под разные движки — это **три роли**, а не один текст в трёх форматах: CLAUDE = оператор, AGENTS = консультант, GEMINI = ревьюер.

- `templates/instructions/` держит три курируемых ролевых шаблона, разделяющих общий include-блок «факты проекта» (имя/стек/конвенции — плейсхолдеры).
- init эмитит файлы только под выбранные движки.
- Авто-перевода одного в три нет — это оверинжиниринг.

## 8. Универсализация — работа авторинга, не логика init

Снятие проектной специфики делается один раз при написании шаблонов, не в рантайме:

- В каждом правиле дисциплинарный текст сохраняем дословно; проектную специфику (имена ботов, `gh`, конкретные пути, ссылки на roadmap, доменную специфику) заменяем на `{{placeholders}}` (напр. `{{REVIEW_BOT}}`, `{{PR_TOOL}}`) или нейтральные формулировки.
- `safety.md` — самый проектный: вырождается в **скелет** (заголовки-паттерны kill-switch / PII / consent + guidance-подсказки), контент = TODO. Не переносим чужие доменные инварианты в произвольный репозиторий.

init просто копирует уже-универсализованные шаблоны.

## 9. Открытые вопросы / отложено

- runbooks / I-P split: критерий включения позже — правило слишком длинно для autoload, либо retro-loop стабильно производит процедурный текст.
- Поля реестра `requires` / `conflicts` / `maturity`.
- Сверка `ivk retro` с существующими глобальными скиллами `/retro` и `/save` (заменяет / переиспользует — см. § 6).
- Точная форма gated-подтверждений в скиллах (report+STOP vs интерактив).
