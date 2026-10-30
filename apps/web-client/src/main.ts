import { createServer, IncomingMessage, ServerResponse } from 'http';
import { readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { ProjectBlueprint, SmartLogDiagnostic } from '@paas/shared-types';
import { TelemetryFormatter } from './utils/telemetry-formatter';
import { TemplateDeployWizard, StoreTemplateManifest } from './store/template-deploy-wizard';
import { LogRecoveryController } from './logs/log-recovery.controller';
import { BlueprintCanvasStore } from './canvas/blueprint-canvas.store';
import { CanvasLayoutHelper } from './canvas/canvas-layout.helper';

const telemetryFormatter = new TelemetryFormatter();
const deployWizard = new TemplateDeployWizard();
const logRecovery = new LogRecoveryController();
const canvasStore = new BlueprintCanvasStore();
const layoutHelper = new CanvasLayoutHelper();

function readJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolveBody, rejectBody) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      try {
        resolveBody(raw ? JSON.parse(raw) : {});
      } catch (err) {
        rejectBody(err);
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

function loadStoreTemplates(): StoreTemplateManifest[] {
  const templatesDir = resolve(__dirname, '../../../templates');
  const files = readdirSync(templatesDir).filter((f) => f.endsWith('.json'));
  return files.map((file) => JSON.parse(readFileSync(resolve(templatesDir, file), 'utf-8')));
}

const sampleClusterNodes = [
  {
    nodeId: 'node-eu-1',
    hostname: 'eu-central-worker-01',
    publicIp: '10.10.0.11',
    status: 'ONLINE' as const,
    totalMemoryMb: 16384,
    usedMemoryMb: 4096,
    cpuCores: 8,
    cpuLoadPercent: 28,
    activeContainers: 6,
  },
  {
    nodeId: 'node-eu-2',
    hostname: 'eu-central-worker-02',
    publicIp: '10.10.0.12',
    status: 'ONLINE' as const,
    totalMemoryMb: 8192,
    usedMemoryMb: 5800,
    cpuCores: 4,
    cpuLoadPercent: 71,
    activeContainers: 9,
  },
  {
    nodeId: 'node-us-1',
    hostname: 'us-east-game-01',
    publicIp: '10.20.0.15',
    status: 'ONLINE' as const,
    totalMemoryMb: 32768,
    usedMemoryMb: 29400,
    cpuCores: 16,
    cpuLoadPercent: 89,
    activeContainers: 14,
  },
];

const webConsoleHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Valence Web Console — DAG Architect & Smart Terminal (v0.5.0)</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #0b0f19; color: #e2e8f0; margin: 0; padding: 32px; }
    .container { max-width: 1080px; margin: 0 auto; }
    header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #1e293b; padding-bottom: 16px; margin-bottom: 24px; }
    h1 { color: #f8fafc; margin: 0; font-size: 24px; }
    .badge { background: #6366f1; color: #fff; padding: 4px 12px; border-radius: 999px; font-size: 13px; font-weight: 600; }
    h2 { color: #94a3b8; font-size: 15px; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 28px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; }
    .card { background: #111827; border: 1px solid #1f2937; border-radius: 10px; padding: 20px; }
    .node-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; font-weight: 700; }
    .sev-healthy { background: #064e3b; color: #34d399; padding: 2px 10px; border-radius: 999px; font-size: 12px; }
    .sev-warning { background: #78350f; color: #fbbf24; padding: 2px 10px; border-radius: 999px; font-size: 12px; }
    .sev-critical { background: #7f1d1d; color: #f87171; padding: 2px 10px; border-radius: 999px; font-size: 12px; }
    .bar-bg { background: #1f2937; height: 8px; border-radius: 4px; overflow: hidden; margin-top: 6px; }
    .bar-fill { background: #6366f1; height: 100%; }
    button { background: #4f46e5; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; margin-top: 10px; margin-right: 8px; }
    button:hover { background: #4338ca; }
    pre { background: #050811; border: 1px solid #1e293b; padding: 14px; border-radius: 8px; overflow-x: auto; color: #a5b4fc; font-size: 13px; margin-top: 12px; }
    .banner { background: #450a0a; border: 1px solid #dc2626; color: #fca5a5; padding: 14px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; font-family: monospace; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <h1>Valence Web Console</h1>
        <div style="color:#64748b; font-size:14px; margin-top:4px;">Cluster Telemetry, 1-Click App Store, Visual Blueprint Architect & Smart Terminal</div>
      </div>
      <span class="badge">v0.5.0</span>
    </header>

    <h2>1. Live Cluster Nodes (TelemetryFormatter)</h2>
    <div id="nodes-grid" class="grid">Loading cluster telemetry...</div>

    <h2>2. Visual Blueprint Architect — DAG Canvas (BlueprintCanvasStore & CanvasLayoutHelper)</h2>
    <div class="card">
      <div>Connect service nodes on the DAG canvas, snap node positions to the 20px grid, and detect isolated containers:</div>
      <button onclick="runCanvasTest('DBAAS')">Connect PostgreSQL → API Backend</button>
      <button onclick="runCanvasTest('MESSAGE_BROKER')">Connect RabbitMQ → Worker</button>
      <pre id="canvas-out">Click a button above to connect nodes on the DAG canvas...</pre>
    </div>

    <h2>3. Interactive Web Terminal & Smart Log Recovery (LogRecoveryController)</h2>
    <div class="card">
      <div id="term-banner" class="banner" style="display:none;"></div>
      <button onclick="runTerminalCrash('INCREASE_MEMORY', 'OOM_KILLED', 'Container exceeded RAM quota (exit 137)')">Simulate OOM Crash</button>
      <button onclick="runTerminalCrash('REALLOCATE_PORT', 'PORT_IN_USE', 'Error: listen EADDRINUSE :::3000')">Simulate Port Conflict</button>
      <button onclick="runTerminalCrash('SYNC_DB_CREDENTIALS', 'DB_AUTH_FAILED', 'FATAL: password authentication failed for user')">Simulate DB Auth Failure</button>
      <pre id="term-out">Click any crash simulation button to trigger the Smart Log 1-Click Recovery banner...</pre>
    </div>

    <h2>4. 1-Click App Store Wizard (TemplateDeployWizard)</h2>
    <div id="store-grid" class="grid">Loading store templates...</div>
    <pre id="spec-preview">Click "Deploy 1-Click App" on any template card above to generate its ContainerDeploySpec...</pre>
  </div>

  <script>
    async function loadDashboard() {
      const nodesRes = await fetch('/client/telemetry');
      const nodesData = await nodesRes.json();
      document.getElementById('nodes-grid').innerHTML = nodesData.cards.map(c => \`
        <div class="card">
          <div class="node-head">
            <span>\${c.hostname}</span>
            <span class="sev-\${c.severity}">\${c.severity.toUpperCase()}</span>
          </div>
          <div style="font-size:13px; color:#94a3b8;">Node ID: <code>\${c.nodeId}</code> | RAM Used: <b>\${c.memoryUsagePercent}%</b></div>
          <div class="bar-bg"><div class="bar-fill" style="width:\${c.memoryUsagePercent}%"></div></div>
        </div>
      \`).join('');

      const storeRes = await fetch('/client/store/templates');
      const storeData = await storeRes.json();
      document.getElementById('store-grid').innerHTML = storeData.templates.map(t => \`
        <div class="card">
          <div class="node-head">
            <span>\${t.name}</span>
            <span style="font-size:12px; color:#818cf8;">\${t.category}</span>
          </div>
          <div style="font-size:13px; color:#94a3b8;">Image: <code>\${t.image}</code></div>
          <div style="font-size:13px; color:#94a3b8; margin-top:4px;">Quota: \${t.defaultMemoryMb} MB RAM / \${t.defaultCpuCores} CPU</div>
          <button onclick="deployTemplate('\${t.id}')">Deploy 1-Click App</button>
        </div>
      \`).join('');
    }

    async function runCanvasTest(sourceCategory) {
      const res = await fetch('/client/canvas/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceCategory, rawPosition: { x: 113, y: 194 } })
      });
      const data = await res.json();
      document.getElementById('canvas-out').textContent = JSON.stringify(data, null, 2);
    }

    async function runTerminalCrash(suggestedFix, errorCode, humanExplanation) {
      const res = await fetch('/client/logs/recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId: 'svc-prod-01', errorCode, humanExplanation, suggestedFix })
      });
      const data = await res.json();
      const bannerEl = document.getElementById('term-banner');
      bannerEl.style.display = 'flex';
      bannerEl.innerHTML = \`<span>\${data.bannerText}</span><button style="margin:0;background:#dc2626;" onclick="alert('Triggered ' + '\${data.action.apiEndpoint}')">\${data.action.buttonLabel}</button>\`;
      document.getElementById('term-out').textContent = JSON.stringify(data, null, 2);
    }

    async function deployTemplate(templateId) {
      const res = await fetch('/client/store/deploy-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId,
          projectId: 'proj-production',
          serviceId: 'svc-' + templateId + '-01',
          customEnv: { DEPLOYED_BY: 'valence-web-console' }
        })
      });
      const data = await res.json();
      document.getElementById('spec-preview').textContent = JSON.stringify(data, null, 2);
    }

    loadDashboard();
  </script>
</body>
</html>`;

export const webClientServer = createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && (req.url === '/' || req.url === '/client/docs')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(webConsoleHtml);
      return;
    }

    if (req.method === 'GET' && req.url === '/client/telemetry') {
      const cards = sampleClusterNodes.map((node) => telemetryFormatter.formatNodeCard(node));
      sendJson(res, 200, { cards, rawNodes: sampleClusterNodes });
      return;
    }

    if (req.method === 'GET' && req.url === '/client/store/templates') {
      const templates = loadStoreTemplates();
      sendJson(res, 200, { count: templates.length, templates });
      return;
    }

    if (req.method === 'POST' && req.url === '/client/store/deploy-preview') {
      const body = await readJsonBody(req);
      const templates = loadStoreTemplates();
      const chosen = templates.find((t) => t.id === body.templateId) || templates[0];
      const deploySpec = deployWizard.buildDeploySpec(
        chosen,
        body.projectId || 'proj-production',
        body.serviceId || `svc-${chosen.id}-01`,
        body.customEnv || {},
      );
      sendJson(res, 200, { templateId: chosen.id, deploySpec });
      return;
    }

    if (req.method === 'POST' && req.url === '/client/canvas/connect') {
      const body = await readJsonBody(req);
      const snappedPosition = layoutHelper.snapToGrid(body.rawPosition || { x: 113, y: 194 }, 20);
      const sampleBlueprint: ProjectBlueprint = {
        projectId: 'proj-canvas-demo',
        nodes: [
          {
            id: 'node-source',
            label: 'Upstream Service',
            position: snappedPosition,
            spec: {
              category: body.sourceCategory || 'DBAAS',
              image: 'postgres:16-alpine',
              env: {},
              resources: { memoryMb: 1024, cpuCores: 1 },
              ports: [],
              volumes: [],
            },
          },
          {
            id: 'node-target',
            label: 'API Consumer',
            position: { x: 320, y: 200 },
            spec: {
              category: 'WEB_APP',
              image: 'node:22-alpine',
              env: {},
              resources: { memoryMb: 512, cpuCores: 1 },
              ports: [],
              volumes: [],
            },
          },
          {
            id: 'node-unconnected-redis',
            label: 'Isolated Redis Cache',
            position: { x: 500, y: 80 },
            spec: {
              category: 'DBAAS',
              image: 'redis:7-alpine',
              env: {},
              resources: { memoryMb: 256, cpuCores: 0.5 },
              ports: [],
              volumes: [],
            },
          },
        ],
        edges: [],
      };
      const createdEdge = canvasStore.connectNodes(sampleBlueprint, 'node-source', 'node-target');
      const isolatedNodeIds = layoutHelper.findIsolatedNodes(sampleBlueprint);
      sendJson(res, 200, {
        snappedSourcePosition: snappedPosition,
        createdEdge,
        isolatedNodeIds,
      });
      return;
    }

    if (req.method === 'POST' && req.url === '/client/logs/recovery') {
      const body = await readJsonBody(req);
      const diagnostic: SmartLogDiagnostic = {
        serviceId: body.serviceId || 'svc-prod-01',
        errorCode: body.errorCode || 'OOM_KILLED',
        rawLogExcerpt: 'Container exit 137',
        humanExplanation: body.humanExplanation || 'Container exceeded memory limit',
        suggestedFix: body.suggestedFix || 'INCREASE_MEMORY',
      };
      const bannerText = logRecovery.formatTerminalBanner(diagnostic);
      const action = logRecovery.buildRecoveryAction(diagnostic);
      sendJson(res, 200, { bannerText, action });
      return;
    }

    sendJson(res, 404, { error: 'Route not found' });
  } catch (err: any) {
    sendJson(res, 400, { error: err?.message || 'Bad request' });
  }
});

const CLIENT_PORT = Number(process.env.CLIENT_PORT) || 3003;
webClientServer.listen(CLIENT_PORT, () =>
  console.log(`Valence Web Console running on http://localhost:${CLIENT_PORT}/client/docs`),
);
