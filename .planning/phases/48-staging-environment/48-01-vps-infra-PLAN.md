---
phase: 48-staging-environment
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: false
requirements: [SC-1, SC-6]
user_setup:
  - service: dns
    why: "DNS A-record staging.platform.mpstats.academy → 89.208.106.208"
    dashboard_config:
      - task: "Добавить A-запись у провайдера DNS"
        location: "Панель управления DNS (где настроен platform.mpstats.academy)"
  - service: htpasswd
    why: "Пароль Basic Auth задаёт владелец"
    dashboard_config:
      - task: "Придумать и записать пароль в Server auth.md"
        location: "local, не в git"

must_haves:
  truths:
    - "DNS staging.platform.mpstats.academy резолвится в 89.208.106.208"
    - "Порт 3001 на VPS свободен для staging-контейнера"
    - "Nginx vhost для staging-поддомена установлен и валиден (nginx -t OK)"
    - "Let's Encrypt сертификат выпущен на staging.platform.mpstats.academy"
    - "Basic Auth включён — GET / без учётки → 401 WWW-Authenticate"
    - "Заголовок X-Robots-Tag: noindex, nofollow возвращается для staging-поддомена"
    - "Prod nginx vhost platform.mpstats.academy продолжает работать без регрессов"
  artifacts:
    - path: "/etc/nginx/sites-available/staging.platform.mpstats.academy"
      provides: "vhost с basic auth + SSL + noindex + proxy_pass localhost:3001"
    - path: "/etc/nginx/sites-enabled/staging.platform.mpstats.academy"
      provides: "symlink на sites-available для активации"
    - path: "/etc/nginx/.htpasswd-staging"
      provides: "bcrypt-hash логин/пароль для команды"
    - path: "/etc/letsencrypt/live/staging.platform.mpstats.academy/fullchain.pem"
      provides: "SSL cert от certbot"
  key_links:
    - from: "DNS"
      to: "VPS 89.208.106.208"
      via: "A-record"
      pattern: "dig +short staging.platform.mpstats.academy"
    - from: "nginx :443"
      to: "localhost:3001"
      via: "proxy_pass в server-блоке"
      pattern: "proxy_pass http://127.0.0.1:3001"
    - from: "nginx"
      to: "/etc/nginx/.htpasswd-staging"
      via: "auth_basic_user_file"
      pattern: "auth_basic_user_file"
---

<objective>
Подготовить инфраструктуру на VPS 89.208.106.208 для второго Docker-стенда: DNS, Basic Auth, Nginx vhost, SSL-сертификат. Контейнер ещё НЕ запускается — это делает Plan 48-03 после того, как Plan 48-02 соберёт код. После этого плана `curl -I https://staging.platform.mpstats.academy` должен вернуть 401 (gate работает), а `curl -I -u user:pass …` — 502 (app ещё нет, но auth уже защищает).

Purpose: отделить инфра-шаги (DNS, SSL, Nginx) от кодовых изменений — их нельзя параллелить и они требуют человеческих действий (DNS + пароль).
Output: рабочий Nginx vhost с Basic Auth + SSL + noindex для staging-поддомена. Prod не задет.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/48-staging-environment/48-CONTEXT.md
@.planning/phases/48-staging-environment/48-RESEARCH.md
@.planning/phases/48-staging-environment/48-VALIDATION.md
@.claude/memory/deploy-details.md
@MAAL/CLAUDE.md
</context>

<tasks>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 1: Добавить DNS A-record и подготовить пароль Basic Auth</name>
  <read_first>
    - .planning/phases/48-staging-environment/48-CONTEXT.md (D-08, D-11)
    - .planning/phases/48-staging-environment/48-RESEARCH.md раздел "Deploy Workflow → Первый запуск"
  </read_first>
  <what-built>Инфра-работа на стороне человека, которую Claude сделать не может: DNS-запись у провайдера и пароль для htpasswd.</what-built>
  <how-to-verify>
    1. Пользователь заходит в панель DNS-провайдера (там же, где настроен platform.mpstats.academy).
    2. Добавляет A-запись: `staging.platform.mpstats.academy` → `89.208.106.208`. TTL — 300 или default.
    3. Ждёт propagation (обычно 5–60 мин).
    4. Локально проверяет: `dig +short staging.platform.mpstats.academy` возвращает `89.208.106.208`.
    5. Пользователь придумывает пароль для Basic Auth (≥16 символов, random), записывает в локальный `Server auth.md` (не в git) в формате: `staging.platform.mpstats.academy basic auth: team / <password>`.
    6. Сообщает Claude, что готов: "DNS propagated, пароль записан".
  </how-to-verify>
  <acceptance_criteria>
    - `dig +short staging.platform.mpstats.academy` возвращает ровно одну строку `89.208.106.208`
    - Пользователь явно подтвердил наличие пароля в `Server auth.md`
  </acceptance_criteria>
  <resume-signal>Напишите "готов, пароль: &lt;PASS&gt;" (пароль нужен Claude для шага htpasswd через SSH heredoc в одну команду, без echo в логи) или "готов, пароль установлю сам через SSH" (тогда шаг htpasswd Claude помечает как TODO для пользователя)</resume-signal>
</task>

<task type="auto">
  <name>Task 2: Pre-flight checks на VPS (порт 3001, apache2-utils, certbot, DNS)</name>
  <read_first>
    - .planning/phases/48-staging-environment/48-RESEARCH.md раздел "Risks & Gotchas" R6 (port collision)
    - .claude/memory/deploy-details.md раздел "VPS Services" (какие порты уже заняты)
  </read_first>
  <files>нет локальных файлов — команды на VPS через SSH</files>
  <action>
Подключиться к VPS и выполнить проверки. Если какая-то из них красная — остановиться и вернуть управление пользователю с описанием проблемы, НЕ продолжать к шагам 3+.

```bash
ssh deploy@89.208.106.208 << 'EOF'
set -e
echo "=== 1. DNS resolution from VPS ==="
dig +short staging.platform.mpstats.academy
echo "=== 2. Port 3001 должен быть свободен ==="
ss -tlnp | grep -E ':3001\b' || echo "OK: 3001 free"
echo "=== 3. Port 3000 (prod) должен быть занят prod-контейнером ==="
ss -tlnp | grep -E ':3000\b' || echo "WARN: prod not listening on 3000"
echo "=== 4. Prod container alive ==="
docker ps --filter "name=maal" --format "table {{.Names}}\t{{.Status}}"
echo "=== 5. Certbot auto-renewal timer ==="
systemctl list-timers | grep certbot || echo "WARN: certbot.timer not active"
echo "=== 6. apache2-utils (htpasswd binary) ==="
which htpasswd || echo "MISSING: apache2-utils — apt install нужен"
echo "=== 7. Nginx текущий статус ==="
sudo nginx -t 2>&1 | tail -5
echo "=== 8. Prod vhost существует ==="
ls /etc/nginx/sites-enabled/ | grep platform.mpstats.academy
EOF
```

Интерпретация выхода:
- DNS пустой / не тот IP → STOP, DNS ещё не пропагейтился
- Port 3001 занят → STOP, вывести `ss -tlnp | grep 3001` и спросить пользователя что за процесс
- Prod container не Up → STOP, разбираться с прод
- htpasswd missing → продолжить, следующий шаг его поставит
- certbot.timer не active → WARN, пометить в SUMMARY (не блокер для выпуска сертификата, но потребует ручного renew через 90 дней)
  </action>
  <verify>
    <automated>ssh deploy@89.208.106.208 'ss -tlnp | grep -E ":3001\\b" | wc -l' возвращает 0</automated>
  </verify>
  <acceptance_criteria>
    - Вывод команды содержит `OK: 3001 free`
    - Prod-контейнер в статусе `Up` (docker ps показывает его)
    - DNS возвращает `89.208.106.208` c VPS (не только локально)
  </acceptance_criteria>
  <done>Все pre-flight зелёные или WARN (но не STOP). Результат pre-flight скопирован в session notes.</done>
</task>

<task type="auto">
  <name>Task 3: Установить apache2-utils и создать /etc/nginx/.htpasswd-staging</name>
  <read_first>
    - .planning/phases/48-staging-environment/48-RESEARCH.md раздел "Nginx + Basic Auth + Certbot → Создание htpasswd"
    - .planning/phases/48-staging-environment/48-CONTEXT.md D-11
  </read_first>
  <files>/etc/nginx/.htpasswd-staging (на VPS)</files>
  <action>
Если пользователь передал пароль через resume-signal — сделать через SSH одной командой (пароль не попадает в persistent history, используется `htpasswd -b` + `history -c` + файл создаётся с правильными правами). Если пользователь сказал "установлю сам" — пропустить и оставить TODO в SUMMARY.

Вариант A (Claude задаёт пароль):
```bash
# PASSWORD передаётся через параметр без попадания в логи
ssh deploy@89.208.106.208 'sudo apt-get update -qq && sudo apt-get install -y apache2-utils'
ssh deploy@89.208.106.208 "sudo htpasswd -cb /etc/nginx/.htpasswd-staging team '<ПАРОЛЬ_ИЗ_RESUME_SIGNAL>'"
ssh deploy@89.208.106.208 'sudo chmod 640 /etc/nginx/.htpasswd-staging && sudo chown root:www-data /etc/nginx/.htpasswd-staging'
ssh deploy@89.208.106.208 'sudo ls -la /etc/nginx/.htpasswd-staging && sudo head -c 20 /etc/nginx/.htpasswd-staging'
```

Вариант B (пользователь задаёт сам):
Claude отдаёт пользователю команды для ручного выполнения и ждёт подтверждения, что файл создан и имеет права `640 root:www-data`.

Логин: `team` (единый для всей команды по D-11).
  </action>
  <verify>
    <automated>ssh deploy@89.208.106.208 'sudo test -f /etc/nginx/.htpasswd-staging && sudo stat -c "%U:%G %a" /etc/nginx/.htpasswd-staging' возвращает "root:www-data 640"</automated>
  </verify>
  <acceptance_criteria>
    - Файл `/etc/nginx/.htpasswd-staging` существует на VPS
    - Права: owner `root:www-data`, mode `640`
    - Первая строка начинается с `team:$` (bcrypt hash префикс)
  </acceptance_criteria>
  <done>htpasswd создан, `which htpasswd` работает, файл принадлежит `root:www-data`.</done>
</task>

<task type="auto">
  <name>Task 4: Создать pre-SSL nginx vhost и прогнать certbot</name>
  <read_first>
    - .planning/phases/48-staging-environment/48-RESEARCH.md раздел "Nginx + Basic Auth + Certbot" (Step 1 pre-SSL) + "Risks & Gotchas" R9
    - .planning/phases/48-staging-environment/48-CONTEXT.md D-09, D-10, D-26
    - Существующий prod vhost для референса: ssh deploy@89.208.106.208 'sudo cat /etc/nginx/sites-available/platform.mpstats.academy'
  </read_first>
  <files>/etc/nginx/sites-available/staging.platform.mpstats.academy (на VPS)</files>
  <action>
Шаг 1 — создать HTTP-only конфиг (для certbot webroot challenge):

```bash
ssh deploy@89.208.106.208 'sudo tee /etc/nginx/sites-available/staging.platform.mpstats.academy > /dev/null' << 'NGINXEOF'
server {
    listen 80;
    listen [::]:80;
    server_name staging.platform.mpstats.academy;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 404;
    }
}
NGINXEOF
```

Шаг 2 — активировать и проверить:
```bash
ssh deploy@89.208.106.208 'sudo ln -sf /etc/nginx/sites-available/staging.platform.mpstats.academy /etc/nginx/sites-enabled/staging.platform.mpstats.academy'
ssh deploy@89.208.106.208 'sudo nginx -t'
ssh deploy@89.208.106.208 'sudo systemctl reload nginx'
```

Шаг 3 — запросить сертификат через certbot (non-interactive):
```bash
ssh deploy@89.208.106.208 'sudo certbot certonly --nginx -d staging.platform.mpstats.academy --non-interactive --agree-tos --email zebrosha@gmail.com'
```

Используем `certonly`, а не `--nginx` с авто-редактированием конфига — иначе certbot добавит свой SSL-блок БЕЗ basic auth и noindex (R9 из research). Мы вручную напишем финальный HTTPS-конфиг в Task 5.

Проверка:
```bash
ssh deploy@89.208.106.208 'sudo ls /etc/letsencrypt/live/staging.platform.mpstats.academy/'
```
Должны быть `fullchain.pem`, `privkey.pem`, `cert.pem`, `chain.pem`.
  </action>
  <verify>
    <automated>ssh deploy@89.208.106.208 'sudo test -f /etc/letsencrypt/live/staging.platform.mpstats.academy/fullchain.pem && echo OK' возвращает "OK"</automated>
  </verify>
  <acceptance_criteria>
    - `nginx -t` после Step 2 возвращает `syntax is ok` + `test is successful`
    - Файл `/etc/letsencrypt/live/staging.platform.mpstats.academy/fullchain.pem` существует
    - `curl -I http://staging.platform.mpstats.academy/.well-known/acme-challenge/test` возвращает 404 (а не 5xx) — значит webroot работал
    - Prod vhost platform.mpstats.academy не задет: `curl -I https://platform.mpstats.academy` → 200
  </acceptance_criteria>
  <done>SSL-cert выпущен, DNS + HTTP работают, prod не задет.</done>
</task>

<task type="auto">
  <name>Task 5: Записать финальный HTTPS nginx vhost (basic auth + noindex + proxy_pass :3001)</name>
  <read_first>
    - .planning/phases/48-staging-environment/48-RESEARCH.md раздел "Nginx + Basic Auth + Certbot → Step 2"
    - MAAL/CLAUDE.md раздел Gotchas ("proxy_buffer_size 128k для Supabase auth cookies")
    - .planning/phases/48-staging-environment/48-CONTEXT.md D-10, D-12, D-13
  </read_first>
  <files>/etc/nginx/sites-available/staging.platform.mpstats.academy (на VPS, перезапись)</files>
  <action>
Перезаписать vhost финальной конфигурацией. Важно: basic auth + `X-Robots-Tag` **внутри HTTPS server-блока** (R9). `proxy_buffer_size 128k` обязателен (MAAL/CLAUDE.md gotchas — без него ломаются Supabase auth cookies).

```bash
ssh deploy@89.208.106.208 'sudo tee /etc/nginx/sites-available/staging.platform.mpstats.academy > /dev/null' << 'NGINXEOF'
# HTTP → HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name staging.platform.mpstats.academy;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS staging vhost
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name staging.platform.mpstats.academy;

    ssl_certificate /etc/letsencrypt/live/staging.platform.mpstats.academy/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/staging.platform.mpstats.academy/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Required for Supabase auth cookies (MAAL gotcha)
    proxy_buffer_size 128k;
    proxy_buffers 4 256k;
    proxy_busy_buffers_size 256k;

    # Basic Auth — applies to ALL location blocks (D-13)
    auth_basic "MPSTATS Academy Staging";
    auth_basic_user_file /etc/nginx/.htpasswd-staging;

    # Robots noindex — defence-in-depth (D-12)
    add_header X-Robots-Tag "noindex, nofollow" always;

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 60s;
    }
}
NGINXEOF

# Проверить и reload
ssh deploy@89.208.106.208 'sudo nginx -t'
ssh deploy@89.208.106.208 'sudo systemctl reload nginx'
```

Если `nginx -t` падает — сразу откатить:
```bash
ssh deploy@89.208.106.208 'sudo rm /etc/nginx/sites-enabled/staging.platform.mpstats.academy'
ssh deploy@89.208.106.208 'sudo systemctl reload nginx'
```
и разбираться с ошибкой. D-26 из context: `nginx -t` ОБЯЗАТЕЛЕН перед reload.
  </action>
  <verify>
    <automated>curl -I -o /dev/null -s -w "%{http_code}" https://staging.platform.mpstats.academy/ возвращает 401; curl -I -s https://staging.platform.mpstats.academy/ | grep -i "www-authenticate: basic" отрабатывает без ошибок; curl -I -s https://platform.mpstats.academy/ возвращает 200 (prod не задет)</automated>
  </verify>
  <acceptance_criteria>
    - `ssh deploy@89.208.106.208 'sudo nginx -t'` возвращает `syntax is ok` + `test is successful`
    - `curl -I https://staging.platform.mpstats.academy` → HTTP 401, заголовок `WWW-Authenticate: Basic realm="MPSTATS Academy Staging"`
    - `curl -I https://staging.platform.mpstats.academy` содержит `X-Robots-Tag: noindex, nofollow`
    - `curl -sI -u team:&lt;PASS&gt; https://staging.platform.mpstats.academy/` возвращает **502 или 504** (app ещё нет — это ожидаемо, auth gate прошёл) ИЛИ 200 если prod случайно не слушает на 3001 (что маловероятно, но окей)
    - `curl -I https://platform.mpstats.academy/` по-прежнему возвращает 200 (prod цел)
    - HTTP redirect работает: `curl -I http://staging.platform.mpstats.academy/` → 301 Location: https://...
  </acceptance_criteria>
  <done>Инфра-gate работает: без пароля — 401, с паролем — 502 (нет app backend), prod жив.</done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Internet → nginx :443 | Untrusted входы от поисковиков, ботов, случайных пользователей |
| nginx → localhost:3001 | Trusted, всегда на loopback, наружу не пробрасывается |
| SSH deploy@89.208.106.208 | Trusted, ключ-based auth |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-48-01 | Information Disclosure | staging vhost | mitigate | Basic Auth на всех location'ах (D-13) + X-Robots-Tag noindex (D-12) — defence-in-depth против случайной индексации и прямого доступа |
| T-48-02 | Information Disclosure | пароль htpasswd | mitigate | htpasswd файл `640 root:www-data`, хранится вне git, пароль в `Server auth.md` локально |
| T-48-03 | Spoofing | SSL cert staging | mitigate | Let's Encrypt через certbot, auto-renewal через существующий systemd timer |
| T-48-04 | Tampering | nginx reload без nginx -t | mitigate | D-26: явный `nginx -t` перед каждым `systemctl reload nginx` — prod vhost не ломается |
| T-48-05 | Elevation of Privilege | Basic Auth bruteforce | accept | Низкий риск на первой итерации: сильный пароль (≥16 chars) + noindex уменьшает surface. rate-limiting отложен до первой реальной атаки |
| T-48-06 | Denial of Service | certbot renewal fail через 90 дней | accept | existing certbot.timer покроет; WARN если timer не active — задокументировать в memory |
</threat_model>

<verification>
После выполнения всех задач должны пройти 4 smoke-теста:

```bash
# 1. Без auth — 401
curl -I -s -o /dev/null -w "%{http_code}" https://staging.platform.mpstats.academy/
# Ожидается: 401

# 2. WWW-Authenticate header присутствует
curl -I -s https://staging.platform.mpstats.academy/ | grep -i "www-authenticate: basic"
# Ожидается: non-empty вывод

# 3. X-Robots-Tag noindex
curl -I -s https://staging.platform.mpstats.academy/ | grep -i "x-robots-tag: noindex"
# Ожидается: non-empty вывод

# 4. Prod не задет
curl -I -s -o /dev/null -w "%{http_code}" https://platform.mpstats.academy/
# Ожидается: 200
```
</verification>

<success_criteria>
- SC-1: `curl -I https://staging.platform.mpstats.academy` → 401 + WWW-Authenticate: Basic (покрыто Task 5)
- SC-6: SSL валиден + X-Robots-Tag: noindex в response headers (покрыто Task 4 + Task 5)

Prod-инвариант: `curl -I https://platform.mpstats.academy` → 200 до и после всех изменений (проверяется после Task 5).
</success_criteria>

<output>
После завершения создать `.planning/phases/48-staging-environment/48-01-SUMMARY.md` с:
- Зафиксированными паролем-плейсхолдером (`team / см. Server auth.md`) — НЕ реальным паролем
- Результатом pre-flight проверок
- Подтверждением всех 4 smoke-тестов
- WARN если certbot.timer не активен (с рекомендацией включить)
- TODO для Plan 48-03: контейнер ещё не запущен, за auth gate сейчас 502
</output>
