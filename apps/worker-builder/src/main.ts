import { createServer, IncomingMessage, ServerResponse } from 'http';
import { readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { NixpacksCommandBuilder } from './nixpacks-command.builder';
import { BlueGreenRolloutService } from './blue-green-rollout.service';
import { ConfigParserService } from './config-parser.service';

const nixpacksBuilder = new NixpacksCommandBuilder();
const rolloutService = new BlueGreenRolloutService();
const configParser = new ConfigParserService();

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

function loadStoreTemplates(): unknown[] {
  const templatesDir = resolve(__dirname, '../../../templates');
  const files = readdirSync(templatesDir).filter((f) => f.endsWith('.json'));
  return files.map((file) => JSON.parse(readFileSync(resolve(templatesDir, file), 'utf-8')));
}

const builderDocsHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Valence Worker Builder — CI/CD & Store Explorer (v0.3.0)</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 32px; }
    .container { max-width: 960px; margin: 0 auto; }
    h1 { color: #f59e0b; margin-bottom: 4px; }
    .badge { background: #d97706; color: #fff; padding: 3px 10px; border-radius: 999px; font-size: 13px; vertical-align: middle; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 20px; margin-top: 20px; }
    .method { font-weight: 700; color: #38bdf8; font-family: monospace; }
    button { background: #f59e0b; color: #0f172a; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 700; margin-top: 10px; }
    button:hover { background: #d97706; color: #fff; }
    pre { background: #090d16; padding: 12px; border-radius: 6px; overflow-x: auto; color: #fde68a; font-size: 13px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Valence Worker Builder <span class="badge">v0.3.0</span></h1>
    <p>CI/CD worker for Nixpacks image builds, Blue-Green zero-downtime rollouts, 1-Click App Store templates, and bidirectional config parsing.</p>

    <div class="card">
      <div><span class="method">POST</span> <code>/builder/nixpacks/command</code> — Generate OCI Image Tag & Nixpacks CLI Args</div>
      <button onclick="runPost('/builder/nixpacks/command', { serviceId: 'web-api', commitSha: '9f8a7b6c5d4e3f2a1b0c', workDir: '/tmp/builds/web-api' }, 'out-nix')">Execute Test</button>
      <pre id="out-nix">Click "Execute Test" to build deterministic image tag and Nixpacks CLI arguments...</pre>
    </div>

    <div class="card">
      <div><span class="method">POST</span> <code>/builder/rollout/evaluate</code> — Blue-Green Deployment Rollout Decision</div>
      <button onclick="runPost('/builder/rollout/evaluate', { blueContainerId: 'blue-v1', greenContainerId: 'green-v2', isGreenHealthy: true }, 'out-bg')">Execute Test</button>
      <pre id="out-bg">Click "Execute Test" to evaluate Blue-Green traffic cutover...</pre>
    </div>

    <div class="card">
      <div><span class="method">GET</span> <code>/builder/templates</code> — 1-Click App Store Catalog</div>
      <button onclick="runGet('/builder/templates', 'out-tpl')">Execute Test</button>
      <pre id="out-tpl">Click "Execute Test" to load 1-Click Store manifests...</pre>
    </div>

    <div class="card">
      <div><span class="method">POST</span> <code>/builder/config/parse</code> — Bidirectional server.properties Parser</div>
      <button onclick="runPost('/builder/config/parse', { rawText: '# Minecraft Server Properties\\nonline-mode=true\\nmax-players=20\\nmotd=Valence Game Node' }, 'out-cfg')">Execute Test</button>
      <pre id="out-cfg">Click "Execute Test" to parse and serialize server.properties...</pre>
    </div>
  </div>
  <script>
    async function runPost(url, body, targetId) {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      document.getElementById(targetId).textContent = JSON.stringify(data, null, 2);
    }
    async function runGet(url, targetId) {
      const res = await fetch(url);
      const data = await res.json();
      document.getElementById(targetId).textContent = JSON.stringify(data, null, 2);
    }
  </script>
</body>
</html>`;

export const builderServer = createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && (req.url === '/' || req.url === '/builder/docs')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(builderDocsHtml);
      return;
    }

    if (req.method === 'POST' && req.url === '/builder/nixpacks/command') {
      const body = await readJsonBody(req);
      const imageTag = nixpacksBuilder.buildImageTag(
        body.serviceId || 'web-api',
        body.commitSha || '9f8a7b6c5d4e3f2a1b0c',
      );
      const args = nixpacksBuilder.buildNixpacksArgs(body.workDir || '/tmp/builds/web-api', imageTag);
      sendJson(res, 200, { binary: 'nixpacks', imageTag, args, fullCommandPreview: `nixpacks ${args.join(' ')}` });
      return;
    }

    if (req.method === 'POST' && req.url === '/builder/rollout/evaluate') {
      const body = await readJsonBody(req);
      const decision = rolloutService.decideRolloutAction(
        body.blueContainerId || 'blue-v1',
        body.greenContainerId || 'green-v2',
        body.isGreenHealthy ?? true,
      );
      sendJson(res, 200, decision);
      return;
    }

    if (req.method === 'GET' && req.url === '/builder/templates') {
      const templates = loadStoreTemplates();
      sendJson(res, 200, { count: templates.length, templates });
      return;
    }

    if (req.method === 'POST' && req.url === '/builder/config/parse') {
      const body = await readJsonBody(req);
      const rawText =
        body.rawText ?? '# Server Config\nonline-mode=true\nmax-players=20\nmotd=Valence Game Node';
      const parsedFields = configParser.parseProperties(rawText);
      const serializedText = configParser.serializeProperties(parsedFields);
      sendJson(res, 200, { parsedFields, serializedText });
      return;
    }

    sendJson(res, 404, { error: 'Route not found' });
  } catch (err: any) {
    sendJson(res, 400, { error: err?.message || 'Bad request' });
  }
});

const BUILDER_PORT = Number(process.env.BUILDER_PORT) || 3002;
builderServer.listen(BUILDER_PORT, () =>
  console.log(`Valence Worker Builder running on http://localhost:${BUILDER_PORT}/builder/docs`),
);
