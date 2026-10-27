# Dockforge

[English](./README.md) | [Українська](./README.uk.md) | [Русский](./README.ru.md) | [Документація API](./docs/API.md)

Self-hosted PaaS-платформа для розгортання та адміністрування контейнеризованих вебдодатків, баз даних, брокерів повідомлень та ігрових серверів на одному або декількох Linux-вузлах.

Проєкт побудовано у форматі монорепозиторію: керуюче ядро на NestJS, вузловий агент для прямої роботи з Docker Engine API (`dockerode`), сервіс автоматичної збірки репозиторіїв через Nixpacks та вебклієнт на Vue 3 з візуальним конструктором залежностей (`Vue Flow`).

## Архітектура

Платформа складається з чотирьох сервісів та двох внутрішніх пакетів:

```text
.
├── apps/
│   ├── api-core/         # Керуюче ядро: IAM, RBAC, сховище секретів AES-256-GCM, DAG-рушій, планувальник
│   ├── host-agent/       # Демон вузла: Docker socket API, ліміти cgroups v2, мітки Traefik, потік логів
│   ├── worker-builder/   # CI/CD воркер: клонування Git, збірка образів Nixpacks, blue-green оновлення
│   └── web-client/       # Фронтенд: Vue 3, Vite, Tailwind CSS, Pinia, Vue Flow, Xterm.js
├── packages/
│   ├── shared-types/     # Спільні TypeScript-інтерфейси, DTO та контракти сокет-подій
│   └── database/         # Схема Prisma, міграції та клієнт PostgreSQL
├── templates/            # Маніфести додатків для запуску в 1 клік (PostgreSQL, Redis, Minecraft, Nextcloud)
└── docker-compose.dev.yml
```

### Основні підсистеми

- **Blueprint DAG Engine** — визначає порядок запуску зв'язаних сервісів за допомогою топологічного сортування (алгоритм Кана), перевіряє граф на відсутність циклів та автоматично підставляє рядки підключення (`DATABASE_URL`, `REDIS_URL`) між контейнерами.
- **Multi-Node Scheduler** — розподіляє нові контейнери між серверами кластера на основі доступного обсягу ОЗП та поточного навантаження CPU.
- **Secret Vault** — шифрує змінні середовища перед збереженням у БД за алгоритмом `AES-256-GCM` з унікальним вектором ініціалізації (`IV`) та тегом цілісності для кожного запису.
- **Ізоляція ресурсів** — обмежує споживання пам'яті, процесорного часу (`NanoCpus`) та кількості процесів (`PidsLimit`) через Linux `cgroups v2`, а також ізолює кожен проєкт у власній `bridge`-мережі Docker.
- **Маршрутизація та гібернація** — динамічно конфігурує маршрути Traefik v3 через мітки контейнерів та підтримує зупинку неактивних сервісів з автоматичним пробудженням при HTTP-запиті (Sablier).
- **Діагностика логів** — аналізує потік `stderr` у реальному часі для виявлення типових збоїв (`OOMKilled`, `EADDRINUSE`, помилки авторизації БД, `ECONNREFUSED`) та пропонує дії для швидкого виправлення.

## Вимоги до оточення

- **Node.js** `>= 20.x`
- **pnpm** `>= 9.x`
- **Docker** та **Docker Compose** (для локального запуску PostgreSQL, Redis, MinIO та Traefik)

## Локальний запуск для розробки

1. Клонуйте репозиторій та встановіть залежності:

```bash
git clone https://github.com/Misingpley/paas.git
cd paas
pnpm install
```

2. Створіть файл конфігурації середовища:

```bash
cp .env.example .env
```

3. Запустіть сервіси інфраструктури (PostgreSQL 16, Redis 7, MinIO S3, Traefik v3):

```bash
docker compose -f docker-compose.dev.yml up -d
```

   Локальні порти інфраструктури:
   - PostgreSQL: `localhost:5432`
   - Redis: `localhost:6379`
   - MinIO S3 API: `http://localhost:9000` (Веб-консоль: `http://localhost:9001`)
   - Traefik HTTP Proxy: `http://localhost:80` (Панель керування: `http://localhost:8080`)
   - Панель Control Plane API: `http://localhost:3000/api/docs`
   - Панель Host Agent Daemon: `http://localhost:3001/agent/docs`

4. Згенеруйте клієнт Prisma та синхронізуйте схему з базою даних:

```bash
pnpm db:generate
pnpm db:push
```

5. Зберіть пакети монорепозиторію та перевірте типи:

```bash
pnpm build
pnpm typecheck
```

## Основні команди

| Команда | Опис |
| :--- | :--- |
| `pnpm dev` | Запуск усіх сервісів у режимі розробки (watch mode) |
| `pnpm build` | Компіляція всіх пакетів та застосунків |
| `pnpm typecheck` | Перевірка типів TypeScript (`tsc --noEmit`) по всьому монорепозиторію |
| `pnpm db:generate` | Генерація `@prisma/client` зі схеми `packages/database/prisma/schema.prisma` |
| `pnpm db:push` | Застосування поточної схеми Prisma до локальної БД |
| `pnpm db:migrate` | Створення та застосування нової SQL-міграції |

## Ліцензія

MIT
