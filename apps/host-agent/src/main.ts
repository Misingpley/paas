import { createServer, IncomingMessage, ServerResponse } from 'http';
import { SmartLogAnalyzerService } from './logs/smart-log-analyzer.service';
import { TraefikLabelBuilder } from './docker/traefik-label-builder';
import { CgroupsConfigBuilder } from './docker/cgroups-config-builder';
import { VerticalAutoScalerService } from './telemetry/auto-scaler.service';

const logAnalyzer = new SmartLogAnalyzerService();
const labelBuilder = new TraefikLabelBuilder();
const cgroupsBuilder = new CgroupsConfigBuilder();
const autoScaler = new VerticalAutoScalerService();

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

const agentDocsHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Valence Host Agent — Node Daemon Explorer (v0.2.0)</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 32px; }
    .container { max-width: 960px; margin: 0 auto; }
    h1 { color: #34d399; margin-bottom: 4px; }
    .badge { background: #059669; color: #fff; padding: 3px 10px; border-radius: 999px; font-size: 13px; vertical-align: middle; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 20px; margin-top: 20px; }
    .method { font-weight: 700; color: #38bdf8; font-family: monospace; }
    button { background: #10b981; color: #06281e; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 700; margin-top: 10px; }
    button:hover { background: #059669; color: #fff; }
    pre { background: #090d16; padding: 12px; border-radius: 6px; overflow-x: auto; color: #a7f3d0; font-size: 13px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Valence Host Agent Daemon <span class="badge">v0.2.0</span></h1>
    <p>Worker node daemon for Linux cgroups v2 isolation, Traefik/Sablier labels, Smart Log Diagnostics, and Vertical Auto-Scaling.</p>

    <div class="card">
      <div><span class="method">POST</span> <code>/agent/docker/spec</code> — Build Container HostConfig (cgroups v2 + Traefik/Sablier Labels)</div>
      <button onclick="runTest('/agent/docker/spec', { subdomain: 'nextcloud' }, 'out-spec')">Execute Test</button>
      <pre id="out-spec">Click "Execute Test" to build Docker Engine payload...</pre>
    </div>

    <div class="card">
      <div><span class="method">POST</span> <code>/agent/logs/analyze</code> — Smart Log Analyzer (Regex Crash Classifier)</div>
      <button onclick="runTest('/agent/logs/analyze', { serviceId: 'svc-minecraft-1', logLine: 'FATAL: java.lang.OutOfMemoryError: Java heap space (exit code 137)' }, 'out-logs')">Execute Test</button>
      <pre id="out-logs">Click "Execute Test" to analyze container stderr line...</pre>
    </div>

    <div class="card">
      <div><span class="method">POST</span> <code>/agent/telemetry/autoscale</code> — Live Vertical Memory Auto-Scaler</div>
      <button onclick="runTest('/agent/telemetry/autoscale', { currentUsageMb: 470, currentLimitMb: 512, maxMemoryMb: 2048, autoScaleEnabled: true }, 'out-scale')">Execute Test</button>
      <pre id="out-scale">Click "Execute Test" to evaluate RAM scale-up...</pre>
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

export const agentServer = createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && (req.url === '/' || req.url === '/agent/docs')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(agentDocsHtml);
      return;
    }

    if (req.method === 'POST' && req.url === '/agent/docker/spec') {
      const body = await readJsonBody(req);
      const sampleSpec = {
        serviceId: 'svc-nextcloud-1',
        projectId: 'proj-cloud',
        category: 'WEB_APP' as const,
        image: 'nextcloud:latest',
        env: { NEXTCLOUD_ADMIN_USER: 'admin' },
        resources: { memoryMb: 1024, cpuCores: 1.5, pidsLimit: 512 },
        ports: [{ internalPort: 80, externalPort: 10005, protocol: 'tcp' as const }],
        volumes: [{ volumeName: 'nc_data', mountPath: '/var/www/html' }],
      };
      const labels = labelBuilder.buildLabels(sampleSpec, body.subdomain || 'app');
      const hostResources = cgroupsBuilder.buildHostResources(sampleSpec.resources);
      sendJson(res, 200, { containerName: `svc-${sampleSpec.serviceId}`, labels, HostConfig: hostResources });
      return;
    }

    if (req.method === 'POST' && req.url === '/agent/logs/analyze') {
      const body = await readJsonBody(req);
      const diagnostic = logAnalyzer.analyzeLine(
        body.serviceId || 'svc-demo',
        body.logLine || 'FATAL: OutOfMemoryError (exit code 137)',
      );
      sendJson(res, 200, { matched: diagnostic !== null, diagnostic });
      return;
    }

    if (req.method === 'POST' && req.url === '/agent/telemetry/autoscale') {
      const body = await readJsonBody(req);
      const newLimitMb = autoScaler.evaluateMemoryScaleUp(
        body.currentUsageMb ?? 470,
        body.currentLimitMb ?? 512,
        body.maxMemoryMb ?? 2048,
        body.autoScaleEnabled ?? true,
      );
      sendJson(res, 200, {
        scaledUp: newLimitMb !== null,
        previousLimitMb: body.currentLimitMb ?? 512,
        newLimitMb,
      });
      return;
    }

    sendJson(res, 404, { error: 'Route not found' });
  } catch (err: any) {
    sendJson(res, 400, { error: err?.message || 'Bad request' });
  }
});

const AGENT_PORT = Number(process.env.AGENT_PORT) || 3001;
agentServer.listen(AGENT_PORT, () => console.log(`Valence Host Agent running on http://localhost:${AGENT_PORT}/agent/docs`));
