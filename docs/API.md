# Dockforge Control Plane — API Reference (v0.1.0)

Base URL (local development): `http://localhost:3000`  
Interactive Web Explorer: `http://localhost:3000/api/docs`

---

## 1. Healthcheck

### `GET /api/health`
Returns control plane status and build version.

**Response (`200 OK`):**
```json
{
  "status": "ok",
  "service": "dockforge-api-core",
  "version": "0.1.0"
}
```

---

## 2. Secret Vault (`AES-256-GCM`)

### `POST /api/vault/encrypt`
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

---

## 3. IAM Password Hashing (`scrypt`)

### `POST /api/auth/hash`
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

---

## 4. Multi-Node Cluster Scheduler & Port Allocator

### `POST /api/cluster/schedule`
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

---

## 5. Blueprint DAG Execution Planner

### `POST /api/blueprint/plan`
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
