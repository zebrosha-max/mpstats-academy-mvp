---
name: MAAL Deploy & Infrastructure
description: VPS deploy procedure, Docker, Nginx config, domain migration details for MAAL
type: reference
---

## Production
- URL: https://platform.mpstats.academy
- VPS: 89.208.106.208 (НЕ 79.137.197.90 — тот для OpenClaw)
- User: deploy (SSH key auth only)
- Container: Docker Compose, image `maal-web`, port 127.0.0.1:3000
- Repo на VPS: `/home/deploy/maal/`
- Env: `/home/deploy/maal/.env.production` + `.env` symlink

## Редеплой
```bash
ssh deploy@89.208.106.208
cd /home/deploy/maal
git pull origin master
docker compose down && docker compose build --no-cache && docker compose up -d
```

## Логи
```bash
docker compose logs --tail=50 -f
```

## Nginx
- Reverse proxy: Nginx 1.24.0
- SSL: Let's Encrypt (auto-renewal)
- `proxy_buffer_size 128k` обязателен для Supabase auth cookies

## Docker Gotchas
- `.env` должен быть симлинком на `.env.production` (Docker Compose читает build args)
- `NEXT_PUBLIC_*` переменные вшиваются при build time, не runtime
- Alpine `localhost` резолвит в IPv6 — использовать `127.0.0.1` в healthcheck
- Auth callback redirect использует `NEXT_PUBLIC_SITE_URL`, не `request.url`
- Dockerfile: 5-stage multi-stage build с turbo prune

## Domain Migration (2026-03-11, COMPLETE)
Мигрировали с `academyal.duckdns.org` на `platform.mpstats.academy`:
- Yandex OAuth redirect URI updated
- Supabase Site URL + Redirect URLs
- `.env.production` NEXT_PUBLIC_SITE_URL
- Nginx server_name
- Let's Encrypt cert reissued

## VPS Services (89.208.106.208)
| Сервис | Версия | Порт |
|--------|--------|------|
| Docker | 29.1.3 | - |
| Nginx | 1.24.0 | 80/443 |
| Node.js | 20.19.6 | 3000 |
| n8n | 2.0.3 | 5678 (Docker) |
| ngrok | 3.34.1 | 4040 (API) |
| PM2 | 5.x | - |

## SSH через Python (paramiko)
```python
import paramiko
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('89.208.106.208', username='deploy', password='<см. Server auth.md>')
stdin, stdout, stderr = ssh.exec_command('команда')
print(stdout.read().decode())
ssh.close()
```
Важно: sshpass недоступен на Windows — использовать paramiko.

## ngrok для n8n webhooks
```python
# Запуск ngrok (через SSH на VPS)
ssh.exec_command('pkill -f ngrok || true')
ssh.exec_command('nohup ngrok http 5678 --log=stdout > /tmp/ngrok.log 2>&1 &')
# Получить URL
stdin, stdout, stderr = ssh.exec_command('curl -s http://localhost:4040/api/tunnels')
data = json.loads(stdout.read().decode())
ngrok_url = data['tunnels'][0]['public_url']
```
