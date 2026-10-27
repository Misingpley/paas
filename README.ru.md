# Dockforge

[English](./README.md) | [Українська](./README.uk.md) | [Русский](./README.ru.md) | [Документация API](./docs/API.md)

Self-hosted PaaS-платформа для развертывания и управления контейнеризированными веб-приложениями, базами данных, брокерами сообщений и игровыми серверами на одном или нескольких Linux-хостах.

Проект организован как монорепозиторий: управляющее ядро на NestJS, агент узла для прямой работы с Docker Engine API (`dockerode`), воркер сборки репозиториев через Nixpacks и веб-клиент на Vue 3 с визуальным редактором графа зависимостей (`Vue Flow`).

## Архитектура

Платформа разделена на четыре приложения и два внутренних пакета:

```text
.
├── apps/
│   ├── api-core/         # Управляющее ядро: IAM, RBAC, хранилище секретов AES-256-GCM, DAG-движок, планировщик
│   ├── host-agent/       # Демон узла: Docker socket API, лимиты cgroups v2, метки Traefik, стрим логов
│   ├── worker-builder/   # CI/CD воркер: клонирование Git, сборка образов Nixpacks, blue-green обновление
│   └── web-client/       # Фронтенд: Vue 3, Vite, Tailwind CSS, Pinia, Vue Flow, Xterm.js
├── packages/
│   ├── shared-types/     # Общие TypeScript-интерфейсы, DTO и контракты сокет-событий
│   └── database/         # Схема Prisma, миграции и клиент PostgreSQL
├── templates/            # Манифесты приложений для запуска в 1 клик (PostgreSQL, Redis, Minecraft, Nextcloud)
└── docker-compose.dev.yml
```

### Основные подсистемы

- **Blueprint DAG Engine** — вычисляет порядок запуска связанных сервисов с помощью топологической сортировки (алгоритм Кана), проверяет граф на отсутствие циклов и автоматически инжектит строки подключения (`DATABASE_URL`, `REDIS_URL`) между контейнерами.
- **Multi-Node Scheduler** — распределяет контейнеры по узлам кластера на основе свободной оперативной памяти и загрузки CPU.
- **Secret Vault** — шифрует переменные окружения перед записью в БД алгоритмом `AES-256-GCM` с уникальным вектором инициализации (`IV`) и тегом подлинности для каждой записи.
- **Изоляция ресурсов** — задает жесткие квоты памяти, процессора (`NanoCpus`) и числа процессов (`PidsLimit`) через Linux `cgroups v2`, помещая каждый проект в изолированную `bridge`-сеть Docker.
- **Маршрутизация и гибернация** — динамически настраивает маршруты Traefik v3 через метки контейнеров и поддерживает остановку неактивных сервисов с автоматическим пробуждением по входящему HTTP-запросу (Sablier).
- **Диагностика логов** — разбирает поток `stderr` контейнеров для обнаружения частых сбоев (`OOMKilled`, `EADDRINUSE`, ошибки авторизации БД, `ECONNREFUSED`) и предлагает быстрые действия для восстановления.

## Требования

- **Node.js** `>= 20.x`
- **pnpm** `>= 9.x`
- **Docker** и **Docker Compose** (для локального запуска PostgreSQL, Redis, MinIO и Traefik)

## Локальный запуск для разработки

1. Клонируйте репозиторий и установите зависимости:

```bash
git clone https://github.com/Misingpley/paas.git
cd paas
pnpm install
```

2. Скопируйте шаблон переменных окружения:

```bash
cp .env.example .env
```

3. Запустите локальную инфраструктуру (PostgreSQL 16, Redis 7, MinIO S3, Traefik v3):

```bash
docker compose -f docker-compose.dev.yml up -d
```

   Локальные адреса сервисов:
   - PostgreSQL: `localhost:5432`
   - Redis: `localhost:6379`
   - MinIO S3 API: `http://localhost:9000` (Веб-консоль: `http://localhost:9001`)
   - Traefik HTTP Proxy: `http://localhost:80` (Дашборд: `http://localhost:8080`)
   - Панель Control Plane API: `http://localhost:3000/api/docs`
   - Панель Host Agent Daemon: `http://localhost:3001/agent/docs`

4. Сгенерируйте клиент Prisma и синхронизируйте схему с базой данных:

```bash
pnpm db:generate
pnpm db:push
```

5. Соберите все пакеты и проверьте типы:

```bash
pnpm build
pnpm typecheck
```

## Команды монорепозитория

| Команда | Описание |
| :--- | :--- |
| `pnpm dev` | Запуск всех приложений в режиме разработки (watch mode) |
| `pnpm build` | Компиляция всех пакетов и сервисов |
| `pnpm typecheck` | Проверка типов TypeScript (`tsc --noEmit`) по всему проекту |
| `pnpm db:generate` | Генерация `@prisma/client` из схемы `packages/database/prisma/schema.prisma` |
| `pnpm db:push` | Применение текущей схемы Prisma к локальной БД |
| `pnpm db:migrate` | Создание и применение новой SQL-миграции |

## Лицензия

MIT
