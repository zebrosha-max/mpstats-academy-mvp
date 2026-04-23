---
phase: 48-staging-environment
plan: 03
type: execute
wave: 2
depends_on: [48-01-vps-infra, 48-02-code-changes]
files_modified:
  - .claude/memory/project_staging_environment.md
autonomous: false
requirements: [SC-1, SC-2, SC-3, SC-4, SC-5, SC-6, SC-7]

must_haves:
  truths:
    - "Файл /home/deploy/maal/.env.staging существует на VPS с NEXT_PUBLIC_STAGING=true, NEXT_PUBLIC_SHOW_LIBRARY=true, разными от prod Site URL"
    - "Контейнер maal-staging-web запущен, статус Up, проходит healthcheck"
    - "curl -I https://staging.platform.mpstats.academy → 401"
    - "curl -I -u team:PASS https://staging.platform.mpstats.academy → 200, HTML содержит 'STAGING'"
    - "curl -u team:PASS https://staging.platform.mpstats.academy/learn (после логина тестового юзера) показывает LibrarySection"
    - "Prod platform.mpstats.academy продолжает возвращать 200 и тот же container ID, что до staging деплоя"
    - "Команда из 1-2 человек подтвердила визуально: STAGING банка видна, Library раздел виден, prod не тронут"
    - "VPS после деплоя вернулся на ветку master (чтобы следующий prod-deploy не взял чужой код)"
  artifacts:
    - path: "/home/deploy/maal/.env.staging (VPS)"
      provides: "staging-env с флагами и креденшелами"
    - path: "docker container maal-staging-web"
      provides: "запущенный staging сервис"
    - path: ".claude/memory/project_staging_environment.md"
      provides: "дополнен реальными путями VPS и результатами smoke-тестов"
  key_links:
    - from: "staging.platform.mpstats.academy"
      to: "docker container :3001"
      via: "nginx proxy_pass + basic auth"
      pattern: "curl -I -u team:PASS → 200"
    - from: "container"
      to: "Supabase prod DB"
      via: "DATABASE_URL из .env.staging"
      pattern: "shared DB, см. D-05"
---

<objective>
Задеплоить staging-контейнер на VPS, прогнать полный smoke-набор (10 проверок из 48-RESEARCH.md), убедиться что prod не затронут, и передать команде доступы. После этого плана вся Phase 48 закрыта, команда может пользоваться staging-стендом и видеть Phase 46 Library через демо-флаг.

Purpose: объединить инфру (Plan 48-01) и код (Plan 48-02), добавить VPS-specific настройки (.env.staging, ветка, rebuild), показать Library-демо.
Output: работающий staging-стенд с demo Library, 10/10 smoke-тестов зелёные, prod-инвариант сохранён, команда подтвердила.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/48-staging-environment/48-CONTEXT.md
@.planning/phases/48-staging-environment/48-RESEARCH.md
@.planning/phases/48-staging-environment/48-VALIDATION.md
@.planning/phases/48-staging-environment/48-01-SUMMARY.md
@.planning/phases/48-staging-environment/48-02-SUMMARY.md
@.claude/memory/deploy-details.md
@docker-compose.staging.yml
</context>

<tasks>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 1: Коммит и пуш кода из Plan 48-02 + создание .env.staging на VPS</name>
  <read_first>
    - .planning/phases/48-staging-environment/48-02-SUMMARY.md (список modified files)
    - .planning/phases/48-staging-environment/48-RESEARCH.md раздел "Deploy Workflow → Первый запуск" шаг 2
  </read_first>
  <what-built>Код Plan 48-02 закоммичен в master (или фича-ветку). На VPS создан `/home/deploy/maal/.env.staging` с правильными ключами.</what-built>
  <how-to-verify>
    **Шаг 1 — коммит кода (выполняет пользователь или Claude по запросу):**
    ```bash
    cd "D:/GpT_docs/MPSTATS ACADEMY ADAPTIVE LEARNING/MAAL"
    git status         # проверить что .env.staging НЕ в untracked/staged
    git add Dockerfile docker-compose.staging.yml .gitignore \
            apps/web/src/components/shared/StagingBanner.tsx \
            apps/web/src/app/layout.tsx \
            apps/web/src/app/\(main\)/learn/page.tsx \
            apps/web/tests/unit/StagingBanner.test.tsx \
            apps/web/.env.example MAAL/CLAUDE.md \
            .claude/memory/project_staging_environment.md \
            .claude/memory/MEMORY.md
    git commit -m "feat(infra): staging environment (Phase 48)"
    git push origin master
    ```

    **Шаг 2 — создать `.env.staging` на VPS (ручное, содержит секреты):**
    ```bash
    ssh deploy@89.208.106.208
    cd /home/deploy/maal
    git pull origin master

    # Скопировать prod env как основу
    cp .env.production .env.staging
    nano .env.staging
    ```

    В `nano` ОБЯЗАТЕЛЬНО изменить:
    - `NEXT_PUBLIC_SITE_URL=https://staging.platform.mpstats.academy` (вместо prod)
    - Добавить в конец файла:
      ```
      # Staging feature flags
      NEXT_PUBLIC_STAGING=true
      NEXT_PUBLIC_SHOW_LIBRARY=true
      ```
    - Остальные переменные (SUPABASE, CLOUDPAYMENTS, YANDEX_ID, DATABASE_URL и т.д.) — без изменений (shared с prod по D-05)

    Сохранить, выйти из nano. Права:
    ```bash
    chmod 600 .env.staging
    ls -la .env.staging   # -rw------- deploy deploy
    ```

    **Шаг 3 — подтвердить Claude:** "код запушен, .env.staging создан".
  </how-to-verify>
  <acceptance_criteria>
    - `git log --oneline -1` на local и VPS совпадают (remote tracking up to date)
    - `ssh deploy@89.208.106.208 'test -f /home/deploy/maal/.env.staging && echo OK'` возвращает "OK"
    - `ssh deploy@89.208.106.208 'grep -q NEXT_PUBLIC_STAGING=true /home/deploy/maal/.env.staging && echo OK'` возвращает "OK"
    - `ssh deploy@89.208.106.208 'grep -q NEXT_PUBLIC_SHOW_LIBRARY=true /home/deploy/maal/.env.staging && echo OK'` возвращает "OK"
    - `ssh deploy@89.208.106.208 'grep NEXT_PUBLIC_SITE_URL /home/deploy/maal/.env.staging'` возвращает строку с `staging.platform.mpstats.academy`
    - `git ls-files | grep -c "\.env\.staging$"` возвращает 0 (не в индексе git)
  </acceptance_criteria>
  <resume-signal>Напишите "код запушен, .env.staging создан"</resume-signal>
</task>

<task type="auto">
  <name>Task 2: Собрать и запустить staging-контейнер на VPS</name>
  <read_first>
    - .planning/phases/48-staging-environment/48-RESEARCH.md раздел "Deploy Workflow → Регулярный деплой"
    - .planning/phases/48-staging-environment/48-CONTEXT.md D-06 (ручной деплой, с VPS)
  </read_first>
  <files>нет локальных файлов — команды через SSH</files>
  <action>
На VPS: prod остаётся на master (без checkout), build staging через compose с `-p maal-staging`.

```bash
ssh deploy@89.208.106.208 << 'EOF'
set -e
cd /home/deploy/maal

echo "=== Текущая ветка (должна быть master для первого запуска) ==="
git status --short --branch | head -5

echo "=== Prod container status BEFORE ==="
docker ps --filter "name=maal-web" --format "{{.Names}} {{.Status}} {{.ID}}" > /tmp/prod-before.txt
cat /tmp/prod-before.txt

echo "=== Build & start staging ==="
# .env.staging лежит рядом с compose — docker-compose подхватит автоматически для env interpolation
# Но нам нужно чтобы build.args резолвились из .env.staging, а не .env → передаём через --env-file
docker compose -p maal-staging --env-file .env.staging -f docker-compose.staging.yml up -d --build 2>&1 | tail -60

echo "=== Staging container started ==="
docker ps --filter "name=maal-staging" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo "=== Prod container status AFTER (должен быть ровно тот же ID, что BEFORE) ==="
docker ps --filter "name=maal-web" --format "{{.Names}} {{.Status}} {{.ID}}" > /tmp/prod-after.txt
cat /tmp/prod-after.txt

echo "=== Diff prod before/after (должно быть пусто или только измененный uptime) ==="
diff /tmp/prod-before.txt /tmp/prod-after.txt || echo "WARN: prod container changed!"

echo "=== Wait for staging healthcheck (до 60 сек) ==="
for i in 1 2 3 4 5 6; do
  STATUS=$(docker inspect maal-staging-web --format='{{.State.Health.Status}}' 2>/dev/null || echo "none")
  echo "  attempt $i: $STATUS"
  [[ "$STATUS" == "healthy" ]] && break
  sleep 10
done

echo "=== Staging logs (последние 30 строк) ==="
docker logs maal-staging-web --tail 30 2>&1
EOF
```

**Критично про `--env-file .env.staging`:** этот флаг говорит docker-compose использовать `.env.staging` для резолва `${VAR}` в `args:` секции. Без него compose читает `.env` (symlink на `.env.production`) → build соберётся с prod-значениями Supabase/CP (это ок по D-05), НО без `NEXT_PUBLIC_SHOW_LIBRARY` (т.к. в .env.production его нет) → флаг не прокинется. `--env-file` решает это явно.

Если что-то идёт не так:
- Build упал → `docker compose -p maal-staging -f docker-compose.staging.yml logs web` (посмотреть build log)
- Healthcheck `unhealthy` → `docker logs maal-staging-web` (runtime error), `curl http://127.0.0.1:3001/api/health` (напрямую на host)
- Prod container ID изменился → **КАТАСТРОФА**, отдельный компонент внезапно сработал — немедленно в SUMMARY, разбираться
  </action>
  <verify>
    <automated>ssh deploy@89.208.106.208 'docker ps --filter "name=maal-staging-web" --format "{{.Status}}" | grep -q "Up"' возвращает exit 0; ssh deploy@89.208.106.208 'curl -sf http://127.0.0.1:3001/api/health' возвращает JSON с status ok</automated>
  </verify>
  <acceptance_criteria>
    - `docker ps --filter "name=maal-staging-web"` показывает статус `Up` (не `Restarting`, не пусто)
    - `docker inspect maal-staging-web --format='{{.State.Health.Status}}'` возвращает `healthy` (в пределах 60 сек после старта)
    - Prod container ID до и после деплоя staging — **идентичен** (diff prod-before.txt prod-after.txt пустой кроме uptime)
    - `curl -s http://127.0.0.1:3001/api/health` (внутри VPS) возвращает `{"status":"ok"}` или аналогичный healthy JSON
    - build log содержит `NEXT_PUBLIC_STAGING=true` и `NEXT_PUBLIC_SHOW_LIBRARY=true` (или это видно в `docker inspect maal-staging-web --format='{{.Config.Env}}'`)
  </acceptance_criteria>
  <done>Staging-контейнер Up + healthy. Prod ID не сменился. Флаги корректно переданы в build.</done>
</task>

<task type="auto">
  <name>Task 3: Полный smoke-набор (10 проверок из 48-RESEARCH.md Validation Architecture)</name>
  <read_first>
    - .planning/phases/48-staging-environment/48-RESEARCH.md раздел "Validation Architecture" → Phase Requirements → Test Map
    - .planning/phases/48-staging-environment/48-VALIDATION.md Per-Task Verification Map
  </read_first>
  <files>нет — только HTTP/SSH проверки</files>
  <action>
Запустить все smoke-тесты. Результаты положить в `48-03-SUMMARY.md` таблицей.

**Пароль нужен.** Вариант A — пользователь передаёт Claude один раз (через resume-signal), Claude использует в curl командах без логирования. Вариант B — Claude даёт команды, пользователь запускает локально, копирует результаты.

Полный скрипт (вариант A):
```bash
PASS='<password from Server auth.md>'
BASE=https://staging.platform.mpstats.academy
PROD=https://platform.mpstats.academy

echo "=== Test 1: Basic auth challenge (SC-1) ==="
curl -I -s -o /dev/null -w "HTTP %{http_code}\n" $BASE/
# Ожидается: HTTP 401

echo "=== Test 2: WWW-Authenticate Basic header (SC-1) ==="
curl -I -s $BASE/ | grep -i "www-authenticate"
# Ожидается: WWW-Authenticate: Basic realm="MPSTATS Academy Staging"

echo "=== Test 3: Basic auth успех (SC-1) ==="
curl -I -s -u "team:$PASS" -o /dev/null -w "HTTP %{http_code}\n" $BASE/
# Ожидается: HTTP 200 (или 307/302 redirect — окей, главное не 401/5xx)

echo "=== Test 4: StagingBanner в HTML (SC-2) ==="
curl -s -u "team:$PASS" $BASE/ | grep -c "STAGING"
# Ожидается: >= 1 (текст плашки "STAGING — данные реальные...")

echo "=== Test 5: X-Robots-Tag noindex (SC-6) ==="
curl -I -s -u "team:$PASS" $BASE/ | grep -i "x-robots-tag"
# Ожидается: x-robots-tag: noindex, nofollow

echo "=== Test 6: SSL valid (SC-6) ==="
curl -Iv -s -u "team:$PASS" $BASE/ 2>&1 | grep -iE "(SSL certificate verify ok|issuer:.*Let.s Encrypt)"
# Ожидается: хотя бы одно совпадение, без "SSL certificate problem"

echo "=== Test 7: Library НЕ видна на prod (SC-3 negative) ==="
curl -s $PROD/learn 2>&1 | grep -c "library-section-component" || echo "0"
# Для анонимного юзера prod /learn редиректит на /login → не увидим ничего специфичного.
# Альтернатива: проверить, что на prod компонент не в SSR-DOM. Но он всё равно не в SSR (он Client Component). Этот тест будет выполнен вручную как manual-step в Task 4.

echo "=== Test 8: Prod URL отдаёт 200 (SC-5) ==="
curl -I -s -o /dev/null -w "HTTP %{http_code}\n" $PROD/
# Ожидается: HTTP 200

echo "=== Test 9: Prod container ID unchanged (SC-5) ==="
ssh deploy@89.208.106.208 'docker ps --filter "name=maal-web" --format "{{.ID}} Uptime: {{.Status}}"'
# Сравнить с 48-01/48-02 pre-flight (ID должен совпадать с тем что был до Plan 48-01)

echo "=== Test 10: Staging контейнер running (SC-4) ==="
ssh deploy@89.208.106.208 'docker ps --filter "name=maal-staging-web" --format "Status: {{.Status}}"'
# Ожидается: Status: Up X seconds (healthy)
```

Ожидаемая итоговая таблица в SUMMARY:

| # | SC | Проверка | Ожидание | Результат |
|---|----|----------|----------|-----------|
| 1 | SC-1 | 401 без auth | HTTP 401 | ✅ / ❌ |
| 2 | SC-1 | WWW-Authenticate header | Basic realm | ✅ / ❌ |
| 3 | SC-1 | 200 с auth | HTTP 200 (или 3xx) | ✅ / ❌ |
| 4 | SC-2 | STAGING в HTML | ≥1 match | ✅ / ❌ |
| 5 | SC-6 | X-Robots-Tag noindex | "noindex, nofollow" | ✅ / ❌ |
| 6 | SC-6 | SSL valid | Let's Encrypt verify ok | ✅ / ❌ |
| 7 | SC-3 | Library hidden on prod | manual verify | see Task 4 |
| 8 | SC-5 | Prod URL 200 | HTTP 200 | ✅ / ❌ |
| 9 | SC-5 | Prod container unchanged | ID same | ✅ / ❌ |
| 10 | SC-4 | Staging Up | Up (healthy) | ✅ / ❌ |

Если что-то красное — НЕ продолжать к Task 4, разбираться.
  </action>
  <verify>
    <automated>Все 10 проверок passed — см. acceptance criteria. Scripted summary строится в конце Task.</automated>
  </verify>
  <acceptance_criteria>
    - Tests 1-6, 8-10 — все ✅ (автоматически проверяемые)
    - Test 7 (Library hidden on prod) — отложен к Task 4 как manual
    - Для любого ❌ — в SUMMARY записана причина + rollback plan (либо прикрутить фикс, либо `docker compose -p maal-staging down`)
  </acceptance_criteria>
  <done>9/10 зелёных (тест 7 — в Task 4 manual). Prod-инвариант сохранён, staging доступен с паролем, банка STAGING видна.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: Демо Phase 46 Library + визуальная проверка команды + cleanup VPS</name>
  <read_first>
    - .planning/phases/48-staging-environment/48-VALIDATION.md раздел "Manual-Only Verifications"
    - .planning/phases/48-staging-environment/48-RESEARCH.md раздел "Risks & Gotchas" R2 (Yandex OAuth), R7 (git checkout cleanup)
    - .claude/memory/project_staging_environment.md (известные ограничения)
  </read_first>
  <what-built>Staging задеплоен, 9 smoke-тестов зелёные, банка STAGING видна. Осталось: (1) команда визуально проверяет Library через тестовый аккаунт, (2) подтверждает что prod не изменился, (3) VPS возвращается на `master` ветку.</what-built>
  <how-to-verify>
    **Шаг 1 — создать или использовать тестовый аккаунт:**
    Если `staging-test@mpstats.academy` ещё не зарегистрирован: зайти на `https://staging.platform.mpstats.academy` с паролем basic auth, зарегистрироваться через email/password (НЕ через Yandex — см. known limitation в CLAUDE.md про OAuth callback).

    **Шаг 2 — проверить Library на staging:**
    1. Залогиниться как `staging-test@mpstats.academy`
    2. Открыть `https://staging.platform.mpstats.academy/learn`
    3. Прокрутить вниз — должен быть раздел "Библиотека" с 5 осями и skill-блоками (Phase 46 контент)
    4. Если Library пустая — см. troubleshooting в `.claude/memory/project_staging_environment.md` раздел "Library пустая на staging"

    **Шаг 3 — проверить Library ОТСУТСТВУЕТ на prod:**
    1. Залогиниться тем же аккаунтом (или создать prod-аккаунт) на `https://platform.mpstats.academy`
    2. Открыть `/learn`
    3. Прокрутить вниз — **НЕ** должно быть раздела "Библиотека"

    **Шаг 4 — показать 1-2 членам команды:**
    1. Отправить URL + логин/пароль basic auth (НЕ в публичный чат — личным сообщением)
    2. Попросить их: открыть, увидеть банку STAGING, увидеть Library, убедиться что prod без Library
    3. Получить подтверждение от 1-2 человек

    **Шаг 5 — cleanup VPS (R7 critical!):**
    ```bash
    ssh deploy@89.208.106.208
    cd /home/deploy/maal
    git status
    # Если branch != master → git checkout master
    # Это обязательно, чтобы следующий prod-deploy (docker compose build) не использовал чужой код
    ```

    **Шаг 6 — дополнить memory actual values:**
    Обновить `.claude/memory/project_staging_environment.md`:
    - Заменить placeholder "Server auth.md" на реальный путь файла на диске пользователя
    - Добавить фактическую дату деплоя
    - Если Library была пустая и пришлось дозагружать контент — записать шаги
    - Добавить подтверждение команды (имена 1-2 человек, дата)
  </how-to-verify>
  <acceptance_criteria>
    - Library виден на staging, не виден на prod — визуально подтверждено
    - 1-2 члена команды подтвердили доступ и видимость (записано в SUMMARY)
    - VPS `git status` показывает branch `master`
    - `.claude/memory/project_staging_environment.md` обновлён реальными данными из деплоя
    - Final prod invariant: `curl -I https://platform.mpstats.academy/` → HTTP 200
  </acceptance_criteria>
  <resume-signal>Напишите "демо принято, VPS на master, команда подтвердила" или опишите проблемы (Library пустая / prod сломался / кто-то не смог зайти)</resume-signal>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| SSH deploy@VPS → Docker daemon | Trusted (key auth) |
| Git origin master → VPS /home/deploy/maal | Trusted (pull only) |
| Staging team members → staging URL | Semi-trusted (basic auth пароль известен всей команде) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-48-12 | Tampering | Prod container случайно перезапущен | mitigate | Явное сравнение container ID before/after в Task 2 + Task 3 Test 9; `-p maal-staging` изолирует project |
| T-48-13 | Tampering | VPS забыли вернуть на master → следующий prod-deploy собирается с фича-веткой | mitigate | Task 4 шаг 5 — обязательный `git checkout master`; задокументировано в CLAUDE.md Staging Workflow |
| T-48-14 | Denial of Service | Staging забивает Supabase connection pool → prod тормозит | accept | Первая итерация: команда ≤5 человек, нагрузка минимальная. Если появится проблема — вынести в отдельный Supabase проект (deferred idea) |
| T-48-15 | Information Disclosure | Пароль basic auth утечет через git/chat | mitigate | Task 1 передача пароля через resume-signal (не в postgresql/slack). `Server auth.md` в .gitignore/локально |
</threat_model>

<verification>
Final phase gate — все 7 SC зелёные:

```bash
# SC-1: basic auth
curl -I -s -o /dev/null -w "%{http_code}" https://staging.platform.mpstats.academy/      # 401
curl -I -s -u team:$PASS -o /dev/null -w "%{http_code}" https://staging.platform.mpstats.academy/  # 200

# SC-2: banner
curl -s -u team:$PASS https://staging.platform.mpstats.academy/ | grep -c STAGING         # >=1

# SC-3: Library visible staging / hidden prod — manual

# SC-4: staging container
ssh deploy@89.208.106.208 'docker ps --filter "name=maal-staging-web" --format "{{.Status}}"'  # Up

# SC-5: prod 200 + same container ID
curl -I -s -o /dev/null -w "%{http_code}" https://platform.mpstats.academy/                # 200

# SC-6: SSL + noindex
curl -Iv -s -u team:$PASS https://staging.platform.mpstats.academy/ 2>&1 | grep "verify ok"
curl -I -s -u team:$PASS https://staging.platform.mpstats.academy/ | grep -i x-robots-tag   # noindex

# SC-7: docs
grep -q "## Staging Workflow" MAAL/CLAUDE.md && echo OK
test -f .claude/memory/project_staging_environment.md && echo OK
```
</verification>

<success_criteria>
- SC-1: staging URL открывается с basic auth prompt (Task 3 Test 1-3)
- SC-2: после пароля — копия платформы + жёлтая плашка STAGING (Task 3 Test 4 + Task 4 визуал)
- SC-3: NEXT_PUBLIC_SHOW_LIBRARY=true показывает Library на staging, на prod скрыт (Task 4 визуал)
- SC-4: staging-deploy не трогает prod контейнер (Task 2 before/after diff + Task 3 Test 9)
- SC-5: prod продолжает работать (Task 3 Test 8 + Test 9)
- SC-6: staging имеет валидный SSL и X-Robots-Tag: noindex (Task 3 Test 5-6)
- SC-7: MAAL/CLAUDE.md содержит раздел Staging Workflow (закрыто Plan 48-02, финально перепроверено здесь)
</success_criteria>

<output>
После завершения создать `.planning/phases/48-staging-environment/48-03-SUMMARY.md` с:
- Таблицей 10 smoke-проверок (результат каждой)
- Фактическими значениями: URL, логин basic auth (без пароля), container name, порт
- Подтверждением от команды (имена 1-2 человек + дата)
- Финальным git log (2 коммита: 48-02 код + optional 48-03 docs update)
- Deferred backlog: Yandex OAuth callback для staging, CarrotQuest guard, Supabase redirect URLs — если решили не делать в этой фазе
- Записью в phase history — готово к "Phase 48 SHIPPED"
</output>
