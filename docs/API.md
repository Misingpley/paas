# Dockforge — API Reference (v0.2.0)

- **Control Plane (`@paas/api-core`)**: `http://localhost:3000` (Interactive Explorer: `http://localhost:3000/api/docs`)
- **Host Agent Daemon (`@paas/host-agent`)**: `http://localhost:3001` (Interactive Explorer: `http://localhost:3001/agent/docs`)

---

## Part 1: Control Plane API (`http://localhost:3000`)

### 1.1. `GET /api/health`
Returns control plane status and build version.

**Response (`200 OK`):**
```json
{
  "status": "ok",
  "service": "dockforge-api-core",
  "version": "0.1.0"
}
```

### 1.2. `POST /api/vault/encrypt`
Encrypts a key-value map of container environment variables using `AES-256-GCM` (`scrypt` key derivation, 12-byte random `IV`, and 16-byte authentication tag) and verifies decryption integrity.

**Request Body:**
```json
{
  "env": {
    "POSTGRES_PASSWORD": "secret_db_password",
    "JWT_KEY": "prod_key_99"
  }
}
```

**Response (`200 OK`):**
```json
{
  "encryptedPayload": "bb6b2e63ed2d93f5ca20b982:6591d0ce544cdef532abf30a09236448:64632977a661...",
  "verifiedDecrypted": {
    "POSTGRES_PASSWORD": "secret_db_password",
    "JWT_KEY": "prod_key_99"
  }
}
```

### 1.3. `POST /api/auth/hash`
Generates a salted `scrypt` password hash (`salt:hash`) and runs a timing-safe verification (`crypto.timingSafeEqual`).

**Request Body:**
```json
{
  "password": "admin_password_2026"
}
```

**Response (`200 OK`):**
```json
{
  "passwordHash": "8450efe37d10089282d498f59ec76c30:24f9ba0c492fa8b3e2a00a8a86d79ef4...",
  "verified": true
}
```

### 1.4. `POST /api/cluster/schedule`
Evaluates cluster node telemetry (`ONLINE` status and free memory capacity) to select the least-loaded worker host and allocates the next free external `TCP/UDP` port.

**Request Body:**
```json
{
  "requiredMemoryMb": 1024
}
```

**Response (`200 OK`):**
```json
{
  "selectedNode": {
    "nodeId": "node-3",
    "hostname": "worker-eu-3",
    "publicIp": "10.0.0.13",
    "status": "ONLINE",
    "totalMemoryMb": 16384,
    "usedMemoryMb": 2048,
    "cpuCores": 8,
    "cpuLoadPercent": 15,
    "activeContainers": 2
  },
  "allocatedExternalPort": 10002
}
```

### 1.5. `POST /api/blueprint/plan`
Runs Kahn's topological sort algorithm on a project's service dependency graph (`ProjectBlueprint`), checks for cyclic dependencies, and injects internal Docker DNS hostnames (`svc-<sourceNodeId>`) into dependent container environment variables.

**Response (`200 OK`):**
```json
{
  "executionWaveOrder": [
    "postgres-db",
    "api-backend"
  ],
  "resolvedNodes": [
    {
      "id": "postgres-db",
      "label": "PostgreSQL 16",
      "position": { "x": 50, "y": 100 },
      "spec": {
        "category": "DBAAS",
        "image": "postgres:16-alpine",
        "env": { "POSTGRES_USER": "admin" },
        "resources": { "memoryMb": 1024, "cpuCores": 1 },
        "ports": [{ "internalPort": 5432, "protocol": "tcp" }],
        "volumes": []
      }
    },
    {
      "id": "api-backend",
      "label": "NestJS Backend",
      "position": { "x": 300, "y": 100 },
      "spec": {
        "category": "WEB_APP",
        "image": "node:22-alpine",
        "env": {
          "DATABASE_URL": "postgresql://admin:secret@svc-postgres-db:5432/prod"
        },
        "resources": { "memoryMb": 512, "cpuCores": 1 },
        "ports": [{ "internalPort": 3000, "protocol": "tcp" }],
        "volumes": []
      }
    }
  ]
}
```

---

## Part 2: Host Agent Daemon API (`http://localhost:3001`)

### 2.1. `POST /agent/docker/spec`
Generates Docker container labels for Traefik v3 routing and Sablier hibernation alongside Linux `cgroups v2` `HostConfig` resource limits (`Memory`, `NanoCpus`, `PidsLimit`).

**Request Body:**
```json
{
  "subdomain": "nextcloud"
}
```

**Response (`200 OK`):**
```json
{
  "containerName": "svc-svc-nextcloud-1",
  "labels": {
    "paas.project.id": "proj-cloud",
    "paas.service.id": "svc-nextcloud-1",
    "traefik.enable": "true",
    "traefik.http.routers.svc-nextcloud-1.rule": "Host(`nextcloud.paas.local`)",
    "sablier.enable": "true",
    "sablier.group": "proj-cloud"
  },
  "HostConfig": {
    "Memory": 1073741824,
    "NanoCpus": 1500000000,
    "PidsLimit": 512
  }
}
```

### 2.2. `POST /agent/logs/analyze`
Classifies a container `stderr` log line against known failure regex rules (`OOM_KILLED`, `PORT_IN_USE`, `DB_AUTH_FAILED`, `CONNECTION_REFUSED`) and returns a structured diagnostic with a recommended recovery action.

**Request Body:**
```json
{
  "serviceId": "svc-minecraft-1",
  "logLine": "FATAL: java.lang.OutOfMemoryError: Java heap space (exit code 137)"
}
```

**Response (`200 OK`):**
```json
{
  "matched": true,
  "diagnostic": {
    "serviceId": "svc-minecraft-1",
    "errorCode": "OOM_KILLED",
    "rawLogExcerpt": "FATAL: java.lang.OutOfMemoryError: Java heap space (exit code 137)",
    "humanExplanation": "Container exceeded its RAM quota and was terminated by the Linux kernel OOM killer.",
    "suggestedFix": "INCREASE_MEMORY"
  }
}
```

### 2.3. `POST /agent/telemetry/autoscale`
Evaluates current container memory saturation (`>= 85%`) and returns the updated memory limit (`+256 MB`, capped at `maxMemoryMb`) for live `docker update` resizing without container restarts.

**Request Body:**
```json
{
  "currentUsageMb": 470,
  "currentLimitMb": 512,
  "maxMemoryMb": 2048,
  "autoScaleEnabled": true
}
```

**Response (`200 OK`):**
```json
{
  "scaledUp": true,
  "previousLimitMb": 512,
  "newLimitMb": 768
}
```
