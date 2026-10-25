# Dockforge

Self-hosted PaaS for deploying and managing containerized applications, databases, message brokers, and game servers across one or multiple Linux hosts.

Built as a monorepo with a NestJS control plane, a lightweight node agent communicating directly with the Docker Engine API (`dockerode`), a Nixpacks-based build worker, and a Vue 3 web client with a visual dependency graph (`Vue Flow`).

## Architecture

The platform is split into four runtime applications and two internal libraries:

```text
.
├── apps/
│   ├── api-core/         # Control plane: IAM, RBAC, AES-256-GCM secret vault, DAG engine, scheduler
│   ├── host-agent/       # Node daemon: Docker socket API, cgroups v2 limits, Traefik labels, log stream
│   ├── worker-builder/   # CI/CD worker: Git clone, Nixpacks image builds, blue-green rollout
│   └── web-client/       # Frontend: Vue 3, Vite, Tailwind CSS, Pinia, Vue Flow, Xterm.js
├── packages/
│   ├── shared-types/     # Shared TypeScript interfaces, DTOs, and socket payload contracts
│   └── database/         # Prisma schema, migrations, and PostgreSQL client
├── templates/            # One-click application manifests (PostgreSQL, Redis, Minecraft, Nextcloud)
└── docker-compose.dev.yml
```

### Core Subsystems

- **Blueprint DAG Engine** — resolves service startup order using topological sorting (Kahn's algorithm), validates the graph for cycles, and injects connection strings (`DATABASE_URL`, `REDIS_URL`) across linked nodes.
- **Multi-Node Scheduler** — selects target cluster nodes based on available RAM and CPU load.
- **Secret Vault** — encrypts service environment variables at rest using `AES-256-GCM` with per-record initialization vectors and authentication tags.
- **Resource Isolation** — enforces per-container memory, CPU (`NanoCpus`), and process count (`PidsLimit`) quotas via Linux `cgroups v2`, placing each project into an isolated Docker bridge network.
- **Edge Routing & Hibernation** — configures Traefik v3 routers via container labels and supports stopping idle containers with automatic wake-on-HTTP via Sablier.
- **Log Diagnostics** — parses container `stderr` streams to detect common runtime failures (`OOMKilled`, `EADDRINUSE`, authentication errors, `ECONNREFUSED`) and exposes one-click recovery actions.

## Prerequisites

- **Node.js** `>= 20.x`
- **pnpm** `>= 9.x`
- **Docker** & **Docker Compose** (for local PostgreSQL, Redis, MinIO, and Traefik)

## Local Development Setup

1. Clone the repository and install dependencies:

```bash
git clone https://github.com/Misingpley/paas.git
cd paas
pnpm install
```

2. Copy the environment configuration and adjust secrets if needed:

```bash
cp .env.example .env
```

3. Start the local infrastructure stack (PostgreSQL 16, Redis 7, MinIO S3, Traefik v3):

```bash
docker compose -f docker-compose.dev.yml up -d
```

   Local infrastructure endpoints:
   - PostgreSQL: `localhost:5432`
   - Redis: `localhost:6379`
   - MinIO S3 API: `http://localhost:9000` (Console: `http://localhost:9001`)
   - Traefik HTTP Proxy: `http://localhost:80` (Dashboard: `http://localhost:8080`)

4. Generate the Prisma client and push the schema to PostgreSQL:

```bash
pnpm db:generate
pnpm db:push
```

5. Build all workspace packages and verify types:

```bash
pnpm build
pnpm typecheck
```

## Workspace Commands

| Command | Description |
| :--- | :--- |
| `pnpm dev` | Run all applications in watch mode |
| `pnpm build` | Compile all packages and applications |
| `pnpm typecheck` | Run `tsc --noEmit` across the monorepo |
| `pnpm db:generate` | Regenerate `@prisma/client` from `packages/database/prisma/schema.prisma` |
| `pnpm db:push` | Sync Prisma schema with the local database |
| `pnpm db:migrate` | Create and apply a new SQL migration |

## License

MIT
