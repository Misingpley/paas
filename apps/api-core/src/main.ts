import { createServer, IncomingMessage, ServerResponse } from 'http';
import { SecretVaultService } from './vault/secret-vault.service';
import { PasswordHashService } from './auth/password-hash.service';
import { ClusterSchedulerService } from './cluster/cluster-scheduler.service';
import { PortAllocatorService } from './ports/port-allocator.service';
import { BlueprintDagService } from './blueprint/blueprint-dag.service';

const vaultService = new SecretVaultService();
const passwordService = new PasswordHashService();
const schedulerService = new ClusterSchedulerService();
const portAllocator = new PortAllocatorService();
const dagService = new BlueprintDagService();

function readJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
  });
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(payload, null, 2));
}

const apiDocsHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Valence Control Plane — API Explorer (v0.1.0)</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 32px; }
    .container { max-width: 960px; margin: 0 auto; }
    h1 { color: #38bdf8; margin-bottom: 4px; }
    .badge { background: #0284c7; color: #fff; padding: 3px 10px; border-radius: 999px; font-size: 13px; vertical-align: middle; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 20px; margin-top: 20px; }
    .method { font-weight: 700; color: #4ade80; font-family: monospace; }
    button { background: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; margin-top: 10px; }
    button:hover { background: #1d4ed8; }
    pre { background: #090d16; padding: 12px; border-radius: 6px; overflow-x: auto; color: #a5f3fc; font-size: 13px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Valence Control Plane API <span class="badge">v0.1.0</span></h1>
    <p>Interactive API Explorer for core orchestration, cryptography, and DAG scheduling services.</p>

    <div class="card">
      <div><span class="method">POST</span> <code>/api/vault/encrypt</code> — AES-256-GCM Secret Vault</div>
      <button onclick="runTest('/api/vault/encrypt', { env: { POSTGRES_PASSWORD: 'secret_db_password', JWT_KEY: 'prod_key_99' } }, 'out-vault')">Execute Test</button>
      <pre id="out-vault">Click "Execute Test" to encrypt environment variables...</pre>
    </div>

    <div class="card">
      <div><span class="method">POST</span> <code>/api/auth/hash</code> — Scrypt Password Hashing & Timing-Safe Verification</div>
      <button onclick="runTest('/api/auth/hash', { password: 'admin_password_2026' }, 'out-auth')">Execute Test</button>
      <pre id="out-auth">Click "Execute Test" to hash and verify password...</pre>
    </div>

    <div class="card">
      <div><span class="method">POST</span> <code>/api/cluster/schedule</code> — Multi-Node Bin-Packing Scheduler</div>
      <button onclick="runTest('/api/cluster/schedule', { requiredMemoryMb: 1024 }, 'out-sched')">Execute Test</button>
      <pre id="out-sched">Click "Execute Test" to select optimal cluster node...</pre>
    </div>

    <div class="card">
      <div><span class="method">POST</span> <code>/api/blueprint/plan</code> — Blueprint DAG Topological Sort & ENV Injection</div>
      <button onclick="runTest('/api/blueprint/plan', {}, 'out-dag')">Execute Test</button>
      <pre id="out-dag">Click "Execute Test" to build DAG execution order...</pre>
    </div>
  </div>
  <script>
    async function runTest(url, body, targetId) {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      document.getElementById(targetId).textContent = JSON.stringify(data, null, 2);
    }
  </script>
</body>
</html>`;

export const server = createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && (req.url === '/' || req.url === '/api/docs')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(apiDocsHtml);
      return;
    }

    if (req.method === 'GET' && req.url === '/api/health') {
      sendJson(res, 200, { status: 'ok', service: 'valence-api-core', version: '0.1.0' });
      return;
    }

    if (req.method === 'POST' && req.url === '/api/vault/encrypt') {
      const body = await readJsonBody(req);
      const encrypted = vaultService.encryptEnv(body.env || { DEMO_SECRET: 'value123' });
      const decrypted = vaultService.decryptEnv(encrypted);
      sendJson(res, 200, { encryptedPayload: encrypted, verifiedDecrypted: decrypted });
      return;
    }

    if (req.method === 'POST' && req.url === '/api/auth/hash') {
      const body = await readJsonBody(req);
      const pwd = body.password || 'demo_pass';
      const hash = passwordService.hashPassword(pwd);
      const isValid = passwordService.verifyPassword(pwd, hash);
      sendJson(res, 200, { passwordHash: hash, verified: isValid });
      return;
    }

    if (req.method === 'POST' && req.url === '/api/cluster/schedule') {
      const body = await readJsonBody(req);
      const sampleNodes = [
        { nodeId: 'node-1', hostname: 'worker-eu-1', publicIp: '10.0.0.11', status: 'OFFLINE' as const, totalMemoryMb: 8192, usedMemoryMb: 0, cpuCores: 4, cpuLoadPercent: 0, activeContainers: 0 },
        { nodeId: 'node-2', hostname: 'worker-eu-2', publicIp: '10.0.0.12', status: 'ONLINE' as const, totalMemoryMb: 4096, usedMemoryMb: 3072, cpuCores: 4, cpuLoadPercent: 65, activeContainers: 5 },
        { nodeId: 'node-3', hostname: 'worker-eu-3', publicIp: '10.0.0.13', status: 'ONLINE' as const, totalMemoryMb: 16384, usedMemoryMb: 2048, cpuCores: 8, cpuLoadPercent: 15, activeContainers: 2 },
      ];
      const selected = schedulerService.selectOptimalNode(sampleNodes, body.requiredMemoryMb || 1024);
      const allocatedPort = portAllocator.findAvailablePort([10000, 10001]);
      sendJson(res, 200, { selectedNode: selected, allocatedExternalPort: allocatedPort });
      return;
    }

    if (req.method === 'POST' && req.url === '/api/blueprint/plan') {
      const ordered = dagService.buildExecutionOrder({
        projectId: 'proj-demo',
        nodes: [
          { id: 'api-backend', label: 'NestJS Backend', position: { x: 300, y: 100 }, spec: { category: 'WEB_APP', image: 'node:22-alpine', env: {}, resources: { memoryMb: 512, cpuCores: 1 }, ports: [{ internalPort: 3000, protocol: 'tcp' }], volumes: [] } },
          { id: 'postgres-db', label: 'PostgreSQL 16', position: { x: 50, y: 100 }, spec: { category: 'DBAAS', image: 'postgres:16-alpine', env: { POSTGRES_USER: 'admin' }, resources: { memoryMb: 1024, cpuCores: 1 }, ports: [{ internalPort: 5432, protocol: 'tcp' }], volumes: [] } },
        ],
        edges: [
          { id: 'edge-1', sourceNodeId: 'postgres-db', targetNodeId: 'api-backend', envInjections: [{ targetEnvKey: 'DATABASE_URL', valueTemplate: 'postgresql://admin:secret@{{HOST}}:5432/prod' }] },
        ],
      });
      sendJson(res, 200, { executionWaveOrder: ordered.map((n) => n.id), resolvedNodes: ordered });
      return;
    }

    sendJson(res, 404, { error: 'Route not found' });
  } catch (err: any) {
    sendJson(res, 400, { error: err?.message || 'Bad request' });
  }
});

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, () => console.log(`Valence API Core running on http://localhost:${PORT}/api/docs`));
