import { createServer, IncomingMessage, ServerResponse } from 'http';
import { readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { ProjectBlueprint, SmartLogDiagnostic } from '@paas/shared-types';
import { TelemetryFormatter } from './utils/telemetry-formatter';
import { TemplateDeployWizard, StoreTemplateManifest } from './store/template-deploy-wizard';
import { LogRecoveryController } from './logs/log-recovery.controller';
import { BlueprintCanvasStore } from './canvas/blueprint-canvas.store';
import { CanvasLayoutHelper } from './canvas/canvas-layout.helper';
import { WorkspaceSessionService } from './auth/workspace-session.service';
import { dashboardConsoleHtml } from './dashboard-ui';
import { randomBytes, createCipheriv, scryptSync } from 'crypto';

const telemetryFormatter = new TelemetryFormatter();
const deployWizard = new TemplateDeployWizard();
const logRecovery = new LogRecoveryController();
const canvasStore = new BlueprintCanvasStore();
const layoutHelper = new CanvasLayoutHelper();
const sessionService = new WorkspaceSessionService();

const managedServicesList = [
  {
    id: 'svc-pg-01',
    name: 'postgres-16',
    image: 'postgres:16-alpine',
    status: 'RUNNING',
    memoryMb: 1024,
    domain: 'internal:5432',
    nodeHostname: 'eu-central-worker-01',
  },
  {
    id: 'svc-api-01',
    name: 'api-gateway',
    image: 'github:nixpacks/node:22',
    status: 'RUNNING',
    memoryMb: 512,
    domain: 'https://api.paas.local',
    nodeHostname: 'eu-central-worker-01',
  },
  {
    id: 'svc-redis-01',
    name: 'redis-broker',
    image: 'redis:7-alpine',
    status: 'RUNNING',
    memoryMb: 256,
    domain: 'internal:6379',
    nodeHostname: 'eu-central-worker-02',
  },
  {
    id: 'svc-mc-01',
    name: 'minecraft-survival',
    image: 'itzg/minecraft-server:java21',
    status: 'SLEEPING',
    memoryMb: 4096,
    domain: 'mc.paas.local:25565',
    nodeHostname: 'us-east-game-01',
  },
];

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

const hybridConsoleHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>VALENCE // Self-Hosted Container Orchestrator</title>
  <style>
    :root {
      /* High-Contrast Petrol-Cyan Color Grading */
      --bg-petrol: #060c12;
      --bg-cell: rgba(8, 16, 24, 0.97);
      --bg-cell-hover: rgba(13, 25, 36, 0.99);
      --line: #253d4f;
      --line-bright: #3d6480;
      --ice-cyan: #82ccf0;
      --amber: #f6b86e;
      --plasma: #fb7185;
      --paper-white: #edf5fa;
      --text-body: #b8cedc;
      --text-muted: #8aa6ba;
      --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      --font-serif: 'Georgia', 'Times New Roman', Times, serif;
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg-petrol);
      color: var(--paper-white);
      margin: 0;
      padding: 0;
      overflow-x: hidden;
    }

    /* Subtle CRT Pixel-Mesh & Lightened Vignette (high readability!) */
    body::before {
      content: '';
      position: fixed;
      inset: 0;
      background:
        radial-gradient(circle at 50% 45%, transparent 65%, rgba(2, 6, 10, 0.32) 100%),
        repeating-linear-gradient(
          0deg,
          rgba(0, 0, 0, 0.10) 0px,
          rgba(0, 0, 0, 0.10) 1px,
          transparent 1px,
          transparent 3px
        ),
        repeating-linear-gradient(
          90deg,
          rgba(130, 204, 240, 0.025) 0px,
          rgba(130, 204, 240, 0.025) 1px,
          transparent 1px,
          transparent 3px
        );
      pointer-events: none;
      z-index: 98;
    }

    /* Animated Topographic + Film Grain Canvas */
    #topo-canvas {
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      z-index: 0;
      pointer-events: none;
    }

    /* Top Status Announcement Ribbon */
    .top-ribbon {
      position: relative;
      z-index: 5;
      background: #09151f;
      border-bottom: 1px solid var(--line-bright);
      color: var(--ice-cyan);
      font-family: var(--font-mono);
      font-size: 11px;
      padding: 7px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      letter-spacing: 0.08em;
    }

    /* Sticky Navbar */
    .navbar-wrap {
      position: sticky;
      top: 0;
      z-index: 10;
      background: rgba(6, 12, 18, 0.95);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--line-bright);
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.6);
    }
    .navbar {
      max-width: 1240px;
      margin: 0 auto;
      height: 62px;
      padding: 0 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .nav-left {
      display: flex;
      align-items: center;
      gap: 36px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      text-decoration: none;
      color: var(--paper-white);
    }
    .brand-name {
      font-family: var(--font-mono);
      font-size: 18px;
      font-weight: 800;
      letter-spacing: 0.14em;
    }
    .nav-links {
      display: flex;
      gap: 24px;
      font-family: var(--font-mono);
      font-size: 11.5px;
      letter-spacing: 0.08em;
      color: var(--text-body);
      text-transform: uppercase;
    }
    .nav-links a {
      color: inherit;
      text-decoration: none;
      transition: color 0.15s;
    }
    .nav-links a:hover { color: var(--ice-cyan); }
    .nav-right {
      display: flex;
      align-items: center;
      gap: 10px;
      font-family: var(--font-mono);
      font-size: 11.5px;
    }
    .btn-cyan {
      background: var(--ice-cyan);
      color: #04080b;
      border: 1px solid var(--ice-cyan);
      padding: 10px 18px;
      font-family: var(--font-mono);
      font-size: 11.5px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      cursor: pointer;
      transition: all 0.15s;
    }
    .btn-cyan:hover { background: #b4e4fc; }
    .btn-white {
      background: var(--paper-white);
      color: #04080b;
      border: 1px solid var(--paper-white);
      padding: 8px 16px;
      font-family: var(--font-mono);
      font-size: 11.5px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      cursor: pointer;
    }
    .btn-white:hover { background: var(--ice-cyan); border-color: var(--ice-cyan); }
    .btn-outline {
      background: #0a151f;
      color: var(--paper-white);
      border: 1px solid var(--line-bright);
      padding: 10px 18px;
      font-family: var(--font-mono);
      font-size: 11.5px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      cursor: pointer;
      transition: border-color 0.15s, color 0.15s, background 0.15s;
    }
    .btn-outline:hover { background: #102130; border-color: var(--ice-cyan); color: var(--ice-cyan); }

    .lang-switch {
      display: inline-flex;
      border: 1px solid var(--line-bright);
      background: #07111a;
      margin-right: 6px;
    }
    .lang-btn {
      background: transparent;
      color: var(--text-body);
      border: none;
      border-right: 1px solid var(--line);
      padding: 6px 10px;
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s;
    }
    .lang-btn:last-child { border-right: none; }
    .lang-btn:hover { color: var(--ice-cyan); }
    .lang-btn.active {
      background: var(--ice-cyan);
      color: #04080b;
    }

    .container {
      position: relative;
      z-index: 1;
      max-width: 1240px;
      margin: 0 auto;
      padding: 0 24px 90px;
    }

    /* =====================================================================
       NEWSPAPER / PRESS CLIPPING BACKGROUND WATERMARKS & GIANT "§" STAMPS
       ===================================================================== */
    .newspaper-backdrop {
      position: absolute;
      top: 14px;
      left: -8px;
      width: 540px;
      font-family: var(--font-serif);
      font-size: 15.5px;
      line-height: 1.48;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: rgba(165, 215, 240, 0.13);
      text-shadow: 0 0 10px rgba(130, 204, 240, 0.16);
      pointer-events: none;
      user-select: none;
      z-index: 0;
    }
    .section-symbol {
      position: absolute;
      right: 12px;
      top: 14px;
      font-family: var(--font-serif);
      font-size: 88px;
      font-weight: 700;
      line-height: 0.85;
      color: rgba(210, 235, 248, 0.22);
      text-shadow: 0 0 18px rgba(130, 204, 240, 0.28);
      writing-mode: vertical-rl;
      pointer-events: none;
      user-select: none;
      z-index: 1;
    }

    /* =====================================================================
       SECTION 1: HERO SPLIT
       ===================================================================== */
    .hero-split {
      position: relative;
      display: grid;
      grid-template-columns: 0.98fr 1.22fr;
      gap: 40px;
      align-items: center;
      padding: 50px 0 56px;
      border-bottom: 1px solid var(--line-bright);
    }

    .press-clipping {
      position: relative;
      z-index: 2;
      display: inline-block;
      background: #0b1824;
      border: 1px solid var(--line-bright);
      border-left: 3px solid var(--ice-cyan);
      padding: 6px 14px;
      font-family: var(--font-serif);
      font-size: 11.5px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--ice-cyan);
      margin-bottom: 16px;
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.65);
    }

    .display-title {
      position: relative;
      z-index: 2;
      font-family: var(--font-serif);
      font-size: 44px;
      font-weight: 700;
      line-height: 1.08;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      margin: 0 0 18px;
      color: #ffffff;
      text-shadow: 0 0 18px rgba(130, 204, 240, 0.25);
    }
    .display-title .censor-bar {
      background: #061018;
      color: var(--ice-cyan);
      border: 1px solid var(--ice-cyan);
      padding: 0 10px;
      font-family: var(--font-mono);
      font-size: 36px;
      display: inline-block;
      transform: rotate(-0.6deg);
    }

    /* High-contrast, clearly readable Product Card */
    .hero-sub {
      position: relative;
      z-index: 2;
      font-size: 15px;
      line-height: 1.65;
      color: var(--paper-white);
      margin: 0 0 18px;
      max-width: 510px;
      background: #08131d;
      border: 1px solid var(--line-bright);
      border-left: 4px solid var(--ice-cyan);
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.75);
      padding: 16px 20px;
    }

    .press-quote {
      position: relative;
      z-index: 2;
      font-family: var(--font-serif);
      font-size: 13px;
      line-height: 1.5;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: #cfe4f2;
      background: rgba(8, 19, 29, 0.88);
      border: 1px dashed var(--line-bright);
      padding: 10px 14px;
      margin-bottom: 22px;
      max-width: 510px;
    }

    .hero-ctas {
      position: relative;
      z-index: 2;
      display: flex;
      gap: 12px;
      margin-bottom: 14px;
    }

    /* Newspaper Editorial Columns Strip below Hero (More texts & clippings!) */
    .gazette-strip {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      background: #07111a;
      border-left: 1px solid var(--line-bright);
      border-right: 1px solid var(--line-bright);
      border-bottom: 1px solid var(--line-bright);
      box-shadow: 0 14px 36px rgba(0, 0, 0, 0.75);
    }
    .gazette-col {
      padding: 20px 24px;
      border-right: 1px solid var(--line);
    }
    .gazette-col:last-child { border-right: none; }
    .gazette-tag {
      font-family: var(--font-serif);
      font-size: 11px;
      color: var(--ice-cyan);
      letter-spacing: 0.12em;
      text-transform: uppercase;
      margin-bottom: 6px;
      border-bottom: 1px solid #192d3d;
      padding-bottom: 4px;
      display: flex;
      justify-content: space-between;
    }
    .gazette-text {
      font-size: 13.5px;
      line-height: 1.55;
      color: var(--text-body);
      margin: 0;
    }

    /* RIGHT PANEL: SATELLITE RECON MONITOR (HIGH CONTRAST) */
    .recon-monitor {
      position: relative;
      z-index: 2;
      background: #071018;
      border: 1px solid var(--line-bright);
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.9), inset 0 1px 0 rgba(130, 204, 240, 0.15);
      padding: 18px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: filter 0.25s;
    }
    .recon-monitor.nvg-mode { filter: hue-rotate(300deg) saturate(1.4) contrast(1.1); }
    .recon-monitor.thermal-mode { filter: contrast(1.18) brightness(1.05); }

    .hud-corner {
      position: absolute;
      width: 14px;
      height: 14px;
      border-color: var(--ice-cyan);
      border-style: solid;
      pointer-events: none;
    }
    .hud-tl { top: 6px; left: 6px; border-width: 2px 0 0 2px; }
    .hud-tr { top: 6px; right: 6px; border-width: 2px 2px 0 0; }
    .hud-bl { bottom: 6px; left: 6px; border-width: 0 0 2px 2px; }
    .hud-br { bottom: 6px; right: 6px; border-width: 0 2px 2px 0; }

    .recon-hud-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--ice-cyan);
      border-bottom: 1px solid var(--line);
      padding-bottom: 10px;
      margin-bottom: 12px;
    }
    .compass-tape {
      font-family: var(--font-mono);
      font-size: 10px;
      color: #8aa6ba;
      text-align: center;
      letter-spacing: 0.22em;
      padding: 5px 0;
      margin-bottom: 12px;
      background: #0a1722;
      border: 1px solid var(--line);
    }
    .intercept-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #0d1d2b;
      border: 1px solid var(--ice-cyan);
      padding: 9px 14px;
      margin-bottom: 14px;
      font-family: var(--font-mono);
      font-size: 11.5px;
      cursor: pointer;
    }
    .intercept-bar:hover { background: #132a3d; }

    .prod-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      position: relative;
    }
    .svc-card {
      background: #0a151f;
      border: 1px solid var(--line);
      padding: 12px;
      position: relative;
      transition: border-color 0.2s;
    }
    .svc-card:hover { border-color: var(--ice-cyan); }
    .svc-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: var(--font-mono);
      font-size: 11.5px;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 10px;
    }
    .spark-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .spark-box {
      background: #060d14;
      border: 1px solid #1c3142;
      padding: 6px 8px;
    }
    .spark-label {
      font-family: var(--font-mono);
      font-size: 9px;
      color: #8aa6ba;
      letter-spacing: 0.06em;
      margin-bottom: 4px;
      display: flex;
      justify-content: space-between;
    }
    .env-pipe {
      margin-top: 8px;
      padding: 5px 8px;
      background: rgba(130, 204, 240, 0.11);
      border-left: 2px solid var(--ice-cyan);
      font-family: var(--font-mono);
      font-size: 9.5px;
      color: #d0ecfa;
      display: flex;
      justify-content: space-between;
    }
    .recon-hud-bottom {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 14px;
      padding-top: 10px;
      border-top: 1px solid var(--line);
      font-family: var(--font-mono);
      font-size: 10.5px;
      color: var(--text-body);
    }
    .cam-modes span {
      padding: 3px 8px;
      border: 1px solid var(--line);
      cursor: pointer;
      margin-left: 4px;
      color: var(--text-body);
    }
    .cam-modes span.active {
      border-color: var(--ice-cyan);
      color: var(--ice-cyan);
      background: rgba(130, 204, 240, 0.14);
    }

    /* =====================================================================
       SECTION 2: CENTER PANEL (3-WAVE KAHN'S DAG SCHEMATIC + §3 STAMP)
       ===================================================================== */
    .reactor-section {
      position: relative;
      padding: 68px 0;
      border-bottom: 1px solid var(--line-bright);
    }
    .reactor-grid {
      position: relative;
      z-index: 2;
      display: grid;
      grid-template-columns: 1.35fr 1fr;
      border: 1px solid var(--line-bright);
      background: var(--bg-cell);
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.85), inset 0 1px 0 rgba(130, 204, 240, 0.14);
      margin-top: 24px;
    }
    .reactor-visual {
      padding: 26px;
      border-right: 1px solid var(--line-bright);
      background:
        radial-gradient(circle at 50% 50%, rgba(130, 204, 240, 0.08) 0%, transparent 70%),
        #060e15;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .wave-step {
      padding: 22px 26px;
      border-bottom: 1px solid var(--line);
      cursor: pointer;
      transition: background 0.15s;
    }
    .wave-step:last-child { border-bottom: none; }
    .wave-step:hover, .wave-step.active {
      background: rgba(130, 204, 240, 0.09);
    }
    .wave-step.active {
      border-left: 4px solid var(--ice-cyan);
    }
    .wave-num {
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--ice-cyan);
      letter-spacing: 0.1em;
      margin-bottom: 6px;
    }

    @keyframes pipeFlow {
      to { stroke-dashoffset: -24; }
    }
    .pipe-active {
      stroke-dasharray: 7 5 !important;
      animation: pipeFlow 0.75s linear infinite;
    }
    .svg-col-group {
      cursor: pointer;
      transition: opacity 0.28s ease, filter 0.28s ease;
    }
    #svg-focus-box {
      transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);
    }
    .step-console {
      margin-top: 10px;
      background: #040a10;
      border: 1px solid var(--line-bright);
      border-left: 3px solid var(--ice-cyan);
      padding: 10px 14px;
      font-family: var(--font-mono);
      font-size: 11.5px;
      line-height: 1.55;
      color: #d0ecfa;
    }

    /* =====================================================================
       SECTION 3: SEAMLESS ARCHITECTURAL BENTO GRID (HIGH CONTRAST)
       ===================================================================== */
    .bracket-tag {
      font-family: var(--font-mono);
      font-size: 12px;
      font-weight: 700;
      color: var(--ice-cyan);
      background: #08131d;
      border: 1px solid var(--line-bright);
      border-left: 3px solid var(--ice-cyan);
      display: inline-block;
      padding: 6px 14px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      margin-bottom: 14px;
    }
    .bento-box {
      border-top: 1px solid var(--line-bright);
      border-left: 1px solid var(--line-bright);
      background: var(--bg-cell);
      box-shadow: 0 18px 44px rgba(0, 0, 0, 0.82), inset 0 1px 0 rgba(130, 204, 240, 0.12);
    }
    .bento-row-3 { display: grid; grid-template-columns: repeat(3, 1fr); }
    .bento-row-4 { display: grid; grid-template-columns: repeat(4, 1fr); }
    .bento-full {
      border-right: 1px solid var(--line-bright);
      border-bottom: 1px solid var(--line-bright);
      padding: 28px;
    }
    .bento-cell {
      border-right: 1px solid var(--line-bright);
      border-bottom: 1px solid var(--line-bright);
      padding: 26px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: background 0.15s;
    }
    .bento-cell:hover { background: var(--bg-cell-hover); }
    .cell-title {
      font-size: 16px;
      font-weight: 700;
      color: #ffffff;
      margin: 0 0 8px;
    }
    .cell-desc {
      font-size: 14px;
      line-height: 1.58;
      color: var(--text-body);
      margin: 0;
    }
    .cell-meta {
      margin-top: 20px;
      padding-top: 12px;
      border-top: 1px solid var(--line);
      font-family: var(--font-mono);
      font-size: 11.5px;
      color: var(--text-body);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    /* Cryo -> Ionized Gold -> Plasma Rose Telemetry */
    .sev-healthy { color: var(--ice-cyan); font-family: var(--font-mono); font-size: 11px; font-weight: 700; }
    .sev-warning { color: var(--amber); font-family: var(--font-mono); font-size: 11px; font-weight: 700; }
    .sev-critical { color: var(--plasma); font-family: var(--font-mono); font-size: 11px; font-weight: 700; }

    .bar-bg {
      position: relative;
      background: #0d1a26;
      border: 1px solid var(--line-bright);
      height: 11px;
      overflow: hidden;
      margin-top: 12px;
    }
    .bar-fill { height: 100%; transition: width 0.3s ease; }
    .bar-bg::after {
      content: '';
      position: absolute;
      inset: 0;
      background-image: repeating-linear-gradient(
        to right,
        transparent 0px,
        transparent 5px,
        rgba(6, 12, 18, 0.78) 5px,
        rgba(6, 12, 18, 0.78) 7px
      );
      pointer-events: none;
    }
    .bar-healthy { background: linear-gradient(90deg, #1e4e68 0%, #3b9ec4 60%, #8be0ff 100%); }
    .bar-warning { background: linear-gradient(90deg, #2b7a9b 0%, #8c7853 45%, #e5993c 88%, #ffd18c 100%); }
    .bar-critical { background: linear-gradient(90deg, #6b304b 0%, #be123c 50%, #fb7185 88%, #fff1f2 100%); }

    pre {
      background: #04090e;
      border: 1px solid var(--line-bright);
      padding: 16px;
      overflow-x: auto;
      color: #c8ebfc;
      font-family: var(--font-mono);
      font-size: 12.5px;
      margin: 16px 0 0;
    }
    .banner {
      background: #210911;
      border: 1px solid #fb7185;
      color: #ffe4e6;
      padding: 14px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      font-family: var(--font-mono);
      font-size: 12.5px;
    }
  </style>
</head>
<body>
  <canvas id="topo-canvas"></canvas>

  <!-- Top Telemetry & Press Archive Bar -->
  <div class="top-ribbon">
    <div>
      <span>ARCHIVE // &sect;1–&sect;5 // VALENCE SELF-HOSTED CONTAINER PLATFORM (RELEASE v1.0.0)</span>
    </div>
    <div>
      <span id="zulu-clock">04:19:00 ZULU</span>
      <span style="margin-left:16px; color:var(--amber); cursor:pointer; text-decoration:underline;" onclick="window.location.href='/client/bento'">[CLASSIC BENTO BACKUP]</span>
    </div>
  </div>

  <!-- Sticky Navbar -->
  <div class="navbar-wrap">
    <nav class="navbar">
      <div class="nav-left">
        <a href="#" class="brand">
          <svg width="32" height="25" viewBox="0 0 36 28" fill="none">
            <rect x="0"  y="0"  width="8" height="10" fill="#EDF5FA"/>
            <rect x="28" y="0"  width="8" height="10" fill="#EDF5FA"/>
            <rect x="6"  y="10" width="8" height="9"  fill="#EDF5FA"/>
            <rect x="22" y="10" width="8" height="9"  fill="#EDF5FA"/>
            <rect x="13" y="19" width="10" height="9" fill="#82CCF0"/>
          </svg>
          <span class="brand-name">VALENCE</span>
        </a>
        <div class="nav-links">
          <a href="#wave-reactor" data-i18n="nav_s1">&sect;1 Порядок запуска</a>
          <a href="#studio-workspace" data-i18n="nav_s2">&sect;2 Преимущества</a>
          <a href="http://localhost:3000/api/docs" target="_blank">API Docs</a>
        </div>
      </div>
      <div class="nav-right">
        <span style="color:var(--ice-cyan); margin-right:8px;">[00:03 // SECTOR EU-01]</span>
        <div class="lang-switch">
          <button class="lang-btn active" id="lang-ru" onclick="setLanguage('ru')">RU</button>
          <button class="lang-btn" id="lang-uk" onclick="setLanguage('uk')">UA</button>
          <button class="lang-btn" id="lang-en" onclick="setLanguage('en')">EN</button>
        </div>
      </div>
    </nav>
  </div>

  <div class="container">
    <!-- =================================================================
         1. HERO: NEWSPAPER PRESS CLIPPING WATERMARK + NORMAL PRODUCT COPY
            + INLINE LOGIN / REGISTRATION BOX + RIGHT SATELLITE RECON PANEL
         ================================================================= -->
    <section class="hero-split">
      <!-- Ghosted Newspaper Column Clipping in Background -->
      <div class="newspaper-backdrop">
        IMMEDIATELY AFTER THE INFRASTRUCTURE AUDIT WAS ANNOUNCED, ENGINEERING TEAMS GATHERED TO INSPECT THE DECENTRALIZED NODES. OPERATORS ATTEMPTED TO ISOLATE CONTAINER WORKLOADS USING LINUX CGROUPS V2 AND KAHN'S TOPOLOGICAL GRAPH ENGINE. FOLLOWING THE DEPLOYMENT OF VALENCE, ZERO-DOWNTIME BLUE-GREEN CUTOVER AND AES-256-GCM SECRET VAULTS BECAME STANDARD ACROSS ALL BARE-METAL CLUSTERS.
      </div>
      <div class="section-symbol" style="left:41%; right:auto; top:28px;">&sect;1</div>

      <div>
        <div class="press-clipping" data-i18n="hero_badge">
          PRESS ARCHIVE // VOL. IV &bull; INFRASTRUCTURE BRIEFING &bull; &sect;1
        </div>

        <h1 class="display-title" data-i18n="hero_title">
          YOUR CODE.<br/>
          YOUR <span class="censor-bar">SERVERS.</span>
        </h1>

        <p class="hero-sub" data-i18n="hero_sub">
          <b>Valence</b> — это удобная платформа для запуска сайтов, бэкендов, баз данных и игровых серверов на вашем собственном оборудовании или VPS. Подключите репозиторий с кодом или выберите готовое приложение из каталога — система сама соберет проект, свяжет его с базой данных, настроит домен и проследит за стабильной работой без переплаты за облака.
        </p>

        <!-- INLINE LOGIN / REGISTRATION PANEL RIGHT ON THE HERO SCREEN -->
        <div style="position:relative; z-index:2; max-width:510px; background:#07111a; border:1px solid var(--ice-cyan); box-shadow:0 16px 40px rgba(0,0,0,0.85); padding:18px 20px;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--line-bright); padding-bottom:10px; margin-bottom:14px;">
            <div style="display:flex; gap:8px;">
              <button id="tab-auth-login" class="btn-cyan" style="padding:5px 12px; font-size:10.5px;" onclick="switchAuthMode('login')" data-i18n="auth_tab_login">Вход</button>
              <button id="tab-auth-reg" class="btn-outline" style="padding:5px 12px; font-size:10.5px;" onclick="switchAuthMode('register')" data-i18n="auth_tab_reg">Регистрация</button>
            </div>
            <span style="font-family:var(--font-mono); font-size:10px; color:var(--ice-cyan);">ACCESS GATE // &sect;1</span>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:10px;">
            <div>
              <label style="display:block; font-family:var(--font-mono); font-size:10px; color:var(--ice-cyan); margin-bottom:4px;" data-i18n="auth_lbl_email">EMAIL АДМИНИСТРАТОРА</label>
              <input id="auth-email" value="admin@valence.local" style="width:100%; background:#040a10; border:1px solid var(--line-bright); color:#fff; padding:8px 10px; font-family:var(--font-mono); font-size:12px;" />
            </div>
            <div>
              <label style="display:block; font-family:var(--font-mono); font-size:10px; color:var(--ice-cyan); margin-bottom:4px;" data-i18n="auth_lbl_pass">ПАРОЛЬ</label>
              <input id="auth-pass" type="password" value="••••••••••••" style="width:100%; background:#040a10; border:1px solid var(--line-bright); color:#fff; padding:8px 10px; font-family:var(--font-mono); font-size:12px;" />
            </div>
          </div>

          <div id="auth-role-wrap" style="display:none; margin-bottom:10px;">
            <label style="display:block; font-family:var(--font-mono); font-size:10px; color:var(--amber); margin-bottom:4px;" data-i18n="auth_lbl_role">РОЛЬ В ПРОЕКТЕ</label>
            <select id="auth-role" style="width:100%; background:#040a10; border:1px solid var(--line-bright); color:#fff; padding:8px 10px; font-family:var(--font-mono); font-size:12px;">
              <option value="OWNER">OWNER (Владелец кластера — полный доступ)</option>
              <option value="ADMIN">ADMIN (Администратор — деплой и секреты)</option>
              <option value="DEVELOPER">DEVELOPER (Разработчик — деплой сервисов)</option>
            </select>
          </div>

          <button id="auth-submit-btn" class="btn-cyan" style="width:100%; padding:11px; margin-top:4px;" onclick="submitAuthForm()" data-i18n="auth_btn_submit">
            Войти в панель управления серверами &rarr;
          </button>
        </div>
      </div>

      <!-- RIGHT PANEL: Satellite Recon HUD + 4 Connected Service Cards -->
      <div class="recon-monitor" id="recon-monitor">
        <div class="hud-corner hud-tl"></div>
        <div class="hud-corner hud-tr"></div>
        <div class="hud-corner hud-bl"></div>
        <div class="hud-corner hud-br"></div>

        <div>
          <div class="recon-hud-top">
            <span>OPTICAL FEED // TARGET: CLUSTER-EU-01</span>
            <span id="prod-wave-badge">[LOCK ACQUIRED &bull; WAVE 2/2]</span>
          </div>

          <div class="compass-tape" id="compass-tape">
            330&deg; &bull; &bull; 345&deg; &bull; &bull; <b>[ N 000&deg; ]</b> &bull; &bull; 015&deg; &bull; &bull; 030&deg; &bull; &bull; 045&deg;
          </div>

          <div class="intercept-bar" onclick="triggerHeroDeploy()">
            <span>&gt;_ TRIGGER PIPELINE: <b id="trigger-text" style="color:#fff">$ git push origin main</b></span>
            <span style="color:var(--amber);">[CLICK TO ROLLOUT]</span>
          </div>

          <div class="prod-grid">
            <div class="svc-card">
              <div class="svc-top">
                <span>[TGT-01] postgres-16</span>
                <span style="color:var(--ice-cyan); font-size:10px;">WAVE #1 // READY</span>
              </div>
              <div class="spark-grid">
                <div class="spark-box">
                  <div class="spark-label"><span>MEMORY</span><span id="val-pg-mem" style="color:#fff">612MB</span></div>
                  <svg width="100%" height="24" viewBox="0 0 100 24">
                    <polygon id="area-pg-mem" points="0,24 0,17 100,7 100,24" fill="rgba(130, 204, 240, 0.14)"/>
                    <polyline id="line-pg-mem" points="0,17 20,15 40,18 60,10 80,13 100,7" fill="none" stroke="#82ccf0" stroke-width="1.6"/>
                    <circle id="dot-pg-mem" cx="98" cy="7" r="2.2" fill="#ffffff"/>
                  </svg>
                </div>
                <div class="spark-box">
                  <div class="spark-label"><span>DISK IOPS</span><span id="val-pg-iops" style="color:#fff">1.4K/s</span></div>
                  <svg width="100%" height="24" viewBox="0 0 100 24">
                    <polygon id="area-pg-iops" points="0,24 0,19 100,5 100,24" fill="rgba(56, 152, 189, 0.14)"/>
                    <polyline id="line-pg-iops" points="0,19 20,13 40,14 60,6 80,11 100,5" fill="none" stroke="#3898bd" stroke-width="1.6"/>
                    <circle id="dot-pg-iops" cx="98" cy="5" r="2.2" fill="#82ccf0"/>
                  </svg>
                </div>
              </div>
              <div class="env-pipe">
                <span>EXPORTS &rarr; TGT-02</span>
                <b>{{HOST}}:5432</b>
              </div>
            </div>

            <div class="svc-card" style="border-color:var(--line-bright);">
              <div class="svc-top">
                <span>[TGT-02] api-gateway</span>
                <span id="api-status-badge" style="color:var(--amber); font-size:10px;">BLUE-GREEN // ACTIVE</span>
              </div>
              <div class="spark-grid">
                <div class="spark-box">
                  <div class="spark-label"><span>MEMORY</span><span id="val-api-mem" style="color:#fff">418MB</span></div>
                  <svg width="100%" height="24" viewBox="0 0 100 24">
                    <polygon id="area-api-mem" points="0,24 0,18 100,4 100,24" fill="rgba(246, 184, 110, 0.14)"/>
                    <polyline id="line-api-mem" points="0,18 20,11 40,15 60,8 80,10 100,4" fill="none" stroke="#f6b86e" stroke-width="1.6"/>
                    <circle id="dot-api-mem" cx="98" cy="4" r="2.2" fill="#f6b86e"/>
                  </svg>
                </div>
                <div class="spark-box">
                  <div class="spark-label"><span>NANO_CPUS</span><span id="val-api-cpu" style="color:#fff">0.85c</span></div>
                  <svg width="100%" height="24" viewBox="0 0 100 24">
                    <polygon id="area-api-cpu" points="0,24 0,16 100,8 100,24" fill="rgba(130, 204, 240, 0.14)"/>
                    <polyline id="line-api-cpu" points="0,16 20,17 40,9 60,12 80,5 100,8" fill="none" stroke="#82ccf0" stroke-width="1.6"/>
                    <circle id="dot-api-cpu" cx="98" cy="8" r="2.2" fill="#ffffff"/>
                  </svg>
                </div>
              </div>
              <div class="env-pipe" style="border-left-color:var(--amber);">
                <span>INJECTED: DATABASE_URL</span>
                <b>AES-256-GCM</b>
              </div>
            </div>

            <div class="svc-card">
              <div class="svc-top">
                <span>[TGT-03] redis-broker</span>
                <span style="color:var(--ice-cyan); font-size:10px;">WAVE #1 // READY</span>
              </div>
              <div class="spark-grid">
                <div class="spark-box">
                  <div class="spark-label"><span>STORAGE</span><span id="val-redis-mem" style="color:#fff">128MB</span></div>
                  <svg width="100%" height="24" viewBox="0 0 100 24">
                    <polygon id="area-redis-mem" points="0,24 0,15 100,8 100,24" fill="rgba(130, 204, 240, 0.14)"/>
                    <polyline id="line-redis-mem" points="0,15 25,14 50,11 75,12 100,8" fill="none" stroke="#82ccf0" stroke-width="1.6"/>
                    <circle id="dot-redis-mem" cx="98" cy="8" r="2.2" fill="#ffffff"/>
                  </svg>
                </div>
                <div class="spark-box">
                  <div class="spark-label"><span>SOCKETS</span><span id="val-redis-sock" style="color:#fff">84</span></div>
                  <svg width="100%" height="24" viewBox="0 0 100 24">
                    <polygon id="area-redis-sock" points="0,24 0,19 100,6 100,24" fill="rgba(56, 152, 189, 0.14)"/>
                    <polyline id="line-redis-sock" points="0,19 25,10 50,14 75,7 100,6" fill="none" stroke="#3898bd" stroke-width="1.6"/>
                    <circle id="dot-redis-sock" cx="98" cy="6" r="2.2" fill="#82ccf0"/>
                  </svg>
                </div>
              </div>
            </div>

            <div class="svc-card">
              <div class="svc-top">
                <span>[TGT-04] traefik-edge</span>
                <span style="color:#e2e8f0; font-size:10px;">SABLIER // ZERO-IDLE</span>
              </div>
              <div class="spark-box" style="width:100%;">
                <div class="spark-label"><span>HTTP INGRESS WAVE</span><span id="val-traefik-bw" style="color:var(--ice-cyan)">2.84 GB/s</span></div>
                <svg width="100%" height="24" viewBox="0 0 200 24">
                  <polygon id="area-traefik-bw" points="0,24 0,18 200,7 200,24" fill="rgba(130, 204, 240, 0.15)"/>
                  <polyline id="line-traefik-bw" points="0,18 30,16 60,10 90,14 120,6 150,11 180,4 200,7" fill="none" stroke="#82ccf0" stroke-width="1.6"/>
                  <circle id="dot-traefik-bw" cx="197" cy="7" r="2.5" fill="#ffffff"/>
                </svg>
              </div>
            </div>
          </div>
        </div>

        <div class="recon-hud-bottom">
          <span id="recon-feed-timer">FEED: 00:03:12 // NORVINSK-BLUELUT</span>
          <div class="cam-modes">
            OPTICS:
            <span class="active" onclick="setOptics(this, '')">PETROL-STD</span>
            <span onclick="setOptics(this, 'nvg-mode')">NVG-IR</span>
            <span onclick="setOptics(this, 'thermal-mode')">HI-CONTRAST</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Newspaper Gazette Press Columns (Extra editorial text & architectural context) -->
    <div class="gazette-strip">
      <div class="gazette-col">
        <div class="gazette-tag"><span data-i18n="gaz1_tag">ARTICLE &sect;1.1 // ЛЕГКАЯ УСТАНОВКА</span><span>[VPS / LINUX]</span></div>
        <p class="gazette-text" data-i18n="gaz1_text">
          Работает на любом обычном VPS или домашнем Linux-сервере. Не требует сложного администрирования — управляет приложениями напрямую и не тратит ресурсы сервера впустую.
        </p>
      </div>
      <div class="gazette-col">
        <div class="gazette-tag"><span data-i18n="gaz2_tag">ARTICLE &sect;1.2 // АВТОСБОРКА КОДА</span><span>[GIT PUSH]</span></div>
        <p class="gazette-text" data-i18n="gaz2_text">
          Просто отправьте код из GitHub. Платформа сама определит язык проекта (Node.js, Python, Go, Rust), соберет рабочую версию и обновит сайт без единого разрыва соединения.
        </p>
      </div>
      <div class="gazette-col">
        <div class="gazette-tag"><span data-i18n="gaz3_tag">ARTICLE &sect;1.3 // СПЯЩИЙ РЕЖИМ</span><span>[IDLE SAVE]</span></div>
        <p class="gazette-text" data-i18n="gaz3_text">
          Тестовые стенды и редко посещаемые сервисы автоматически переходят в режим ожидания для экономии памяти и мгновенно просыпаются, когда на сайт заходит пользователь.
        </p>
      </div>
    </div>

    <!-- =================================================================
         2. CENTER PANEL: 3-WAVE KAHN'S DAG SCHEMATIC + §3 STAMP
         ================================================================= -->
    <section id="wave-reactor" class="reactor-section">
      <div class="newspaper-backdrop" style="top:34px; left:auto; right:80px; width:480px; text-align:right;">
        TOPOLOGICAL SORTING ENSURES THAT NO APPLICATION CONTAINER ATTEMPTS TO ESTABLISH A TCP SOCKET PRIOR TO UPSTREAM DATABASE READINESS. CYCLIC DEPENDENCIES ARE REJECTED AT THE CONTROL PLANE GATEWAY.
      </div>
      <div class="section-symbol">&sect;3</div>
      <div class="press-clipping" data-i18n="sec2_badge">
        TECHNICAL SUPPLEMENT // &sect;3 &bull; SMART LAUNCH SEQUENCE
      </div>
      <h2 class="display-title" style="font-size:36px; max-width:820px;" data-i18n="sec2_title">
        THREE LAUNCH STEPS. ZERO BROKEN CONNECTIONS.
      </h2>
      <p class="cell-desc" style="max-width:740px; background:#08131d; border:1px solid var(--line-bright); border-left:4px solid var(--ice-cyan); padding:12px 16px;" data-i18n="sec2_desc">
        Вместо того чтобы запускать всё вперемешку, <b>Valence</b> включает части вашего проекта по очереди: сначала базы данных, затем само приложение с уже готовыми настройками доступа, и в финале открывает доступ для пользователей.
      </p>

      <div class="reactor-grid">
        <div class="reactor-visual">
          <div style="display:flex; justify-content:space-between; font-family:var(--font-mono); font-size:11px; color:var(--text-body); border-bottom:1px solid var(--line); padding-bottom:10px;">
            <span data-i18n="schem_title">SCHEMATIC // ПОРЯДОК ЗАПУСКА ПРОЕКТА</span>
            <span id="reactor-active-label" style="color:var(--ice-cyan);" data-i18n="schem_active">ШАГ 01 — БАЗЫ ДАННЫХ И ХРАНИЛИЩА</span>
          </div>

          <svg width="100%" height="265" viewBox="0 0 660 265" fill="none" style="margin:10px 0;">
            <line x1="110" y1="20" x2="110" y2="255" stroke="#1b3142" stroke-width="1" stroke-dasharray="4 4"/>
            <line x1="330" y1="20" x2="330" y2="255" stroke="#1b3142" stroke-width="1" stroke-dasharray="4 4"/>
            <line x1="550" y1="20" x2="550" y2="255" stroke="#1b3142" stroke-width="1" stroke-dasharray="4 4"/>

            <text x="110" y="16" fill="#82ccf0" id="svg-hdr-01" font-family="monospace" font-size="10.5" font-weight="bold" text-anchor="middle" style="cursor:pointer" onclick="selectWaveStepByNum('01')">[ STEP 01 // DATABASES ]</text>
            <text x="330" y="16" fill="#8aa6ba" id="svg-hdr-02" font-family="monospace" font-size="10.5" text-anchor="middle" style="cursor:pointer" onclick="selectWaveStepByNum('02')">STEP 02 // BACKEND APP</text>
            <text x="550" y="16" fill="#8aa6ba" id="svg-hdr-03" font-family="monospace" font-size="10.5" text-anchor="middle" style="cursor:pointer" onclick="selectWaveStepByNum('03')">STEP 03 // PUBLIC DOMAIN</text>

            <!-- Active Target Highlight Frame that slides between Step 01, 02, 03 -->
            <rect id="svg-focus-box" x="26" y="42" width="168" height="206" fill="rgba(130, 204, 240, 0.05)" stroke="#82ccf0" stroke-width="1.5" stroke-dasharray="6 4"/>

            <!-- Connection Pipes -->
            <path id="pipe-1-2a" d="M185 85 L235 85 L235 135 L255 135" stroke="#2c536d" stroke-width="2.2" fill="none"/>
            <path id="pipe-1-2b" d="M185 205 L235 205 L235 155 L255 155" stroke="#2c536d" stroke-width="2.2" fill="none"/>
            <path id="pipe-2-3" d="M405 145 L475 145" stroke="#2c536d" stroke-width="2.4" stroke-dasharray="5 3" fill="none"/>

            <g id="badge-link-db" style="opacity:0.45; transition:opacity 0.25s;">
              <rect x="195" y="62" width="76" height="16" fill="#091722" stroke="#3898bd" stroke-width="1"/>
              <text x="233" y="73" fill="#82ccf0" font-family="monospace" font-size="8.5" text-anchor="middle">DB LINKED</text>
              <rect x="195" y="212" width="76" height="16" fill="#091722" stroke="#3898bd" stroke-width="1"/>
              <text x="233" y="223" fill="#82ccf0" font-family="monospace" font-size="8.5" text-anchor="middle">QUEUE LINKED</text>
            </g>

            <!-- STEP 01 NODES -->
            <g id="svg-col-01" class="svg-col-group" style="opacity:1;" onclick="selectWaveStepByNum('01')">
              <rect x="35" y="52" width="150" height="66" fill="#0b1824" stroke="#82ccf0" stroke-width="1.8"/>
              <rect x="35" y="52" width="6" height="66" fill="#82ccf0"/>
              <text x="52" y="74" fill="#ffffff" font-family="monospace" font-size="11" font-weight="bold">postgres-db</text>
              <text x="52" y="90" fill="#b8cedc" font-family="monospace" font-size="9.5">RAM: 1024 MB / 1 CPU</text>
              <text x="52" y="106" fill="#82ccf0" font-family="monospace" font-size="9">PORT: 5432 // READY</text>

              <rect x="35" y="172" width="150" height="66" fill="#0b1824" stroke="#82ccf0" stroke-width="1.8"/>
              <rect x="35" y="172" width="6" height="66" fill="#82ccf0"/>
              <text x="52" y="194" fill="#ffffff" font-family="monospace" font-size="11" font-weight="bold">rabbitmq-queue</text>
              <text x="52" y="210" fill="#b8cedc" font-family="monospace" font-size="9.5">RAM: 512 MB / 0.5 CPU</text>
              <text x="52" y="226" fill="#82ccf0" font-family="monospace" font-size="9">PORT: 5672 // READY</text>
            </g>

            <!-- STEP 02 NODE -->
            <g id="svg-col-02" class="svg-col-group" style="opacity:0.42;" onclick="selectWaveStepByNum('02')">
              <rect x="255" y="102" width="150" height="86" fill="#0f2030" stroke="#ffffff" stroke-width="1.8"/>
              <rect x="255" y="102" width="6" height="86" fill="#f6b86e"/>
              <text x="272" y="126" fill="#ffffff" font-family="monospace" font-size="11" font-weight="bold">api-backend</text>
              <text x="272" y="143" fill="#b8cedc" font-family="monospace" font-size="9.5">Auto-Build from Git</text>
              <text x="272" y="159" fill="#f6b86e" font-family="monospace" font-size="9">DB &amp; Passwords: OK</text>
              <text x="272" y="175" fill="#ffffff" font-family="monospace" font-size="9">Status: Online</text>
            </g>

            <!-- STEP 03 NODE -->
            <g id="svg-col-03" class="svg-col-group" style="opacity:0.42;" onclick="selectWaveStepByNum('03')">
              <rect x="475" y="102" width="150" height="86" fill="#0b1824" stroke="#3898bd" stroke-width="1.8"/>
              <rect x="475" y="102" width="6" height="86" fill="#82ccf0"/>
              <text x="492" y="126" fill="#ffffff" font-family="monospace" font-size="11" font-weight="bold">web-router</text>
              <text x="492" y="143" fill="#b8cedc" font-family="monospace" font-size="9.5">https://api.paas.local</text>
              <text x="492" y="159" fill="#82ccf0" font-family="monospace" font-size="9">Auto-Wake: ON</text>
              <text x="492" y="175" fill="#b8cedc" font-family="monospace" font-size="9">Zero-Downtime Switch</text>
            </g>
          </svg>

          <!-- Live Interactive Console Output for Selected Step -->
          <div class="step-console" id="step-live-console">
            <div style="color:var(--ice-cyan); font-weight:700; margin-bottom:3px;" id="step-console-hdr">[ШАГ 01 АКТИВЕН] Запуск баз данных и проверка готовности...</div>
            <div id="step-console-line1">&gt; Контейнеры <b>postgres-db:5432</b> и <b>rabbitmq-queue:5672</b> запущены первыми.</div>
            <div id="step-console-line2" style="color:#8aa6ba;">&gt; Проверка связи: база данных готова принимать запросы (отклик 9 мс).</div>
          </div>
        </div>

        <div class="reactor-controls">
          <div class="wave-step active" id="wave-card-01" onclick="selectWaveStepByNum('01')">
            <div class="wave-num" data-i18n="w1_num">ШАГ 01 // ПОДГОТОВКА ДАННЫХ</div>
            <h3 class="cell-title" data-i18n="w1_title">Сначала включаются базы данных</h3>
            <p class="cell-desc" data-i18n="w1_desc">
              Платформа первой запускает PostgreSQL, Redis или очереди сообщений и дожидается их полной готовности, чтобы ваше приложение не выдавало ошибку при старте.
            </p>
          </div>

          <div class="wave-step" id="wave-card-02" onclick="selectWaveStepByNum('02')">
            <div class="wave-num" data-i18n="w2_num">ШАГ 02 // СВЯЗЬ БЕЗ РУЧНОЙ НАСТРОЙКИ</div>
            <h3 class="cell-title" data-i18n="w2_title">Автоподключение приложения к базе</h3>
            <p class="cell-desc" data-i18n="w2_desc">
              Когда база данных готова, система сама передает вашему сайту или бэкенду нужные адреса и пароли подключения — ничего не нужно копировать вручную.
            </p>
          </div>

          <div class="wave-step" id="wave-card-03" onclick="selectWaveStepByNum('03')">
            <div class="wave-num" data-i18n="w3_num">ШАГ 03 // ВЫХОД В ОНЛАЙН</div>
            <h3 class="cell-title" data-i18n="w3_title">Обновление сайта без остановки</h3>
            <p class="cell-desc" data-i18n="w3_desc">
              Новая версия приложения запускается параллельно со старой. Как только она готова, посетители мгновенно переводятся на обновленный сайт без единой секунды простоя.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- =================================================================
         3. CLEAN BENTO GRID WORKSPACE (HIGH READABILITY)
         ================================================================= -->
    <div id="studio-workspace" style="padding-top:56px;">
      <div class="bracket-tag" data-i18n="sec3_tag">[ &sect;2 // УПРАВЛЕНИЕ ПРОЕКТАМИ И НАДЕЖНОСТЬ ]</div>
      <div class="bento-box">
        <div class="bento-row-3">
          <div class="bento-cell">
            <div>
              <h3 class="cell-title" data-i18n="b1_title">Защита от перегрузок</h3>
              <p class="cell-desc" data-i18n="b1_desc">Каждому приложению выделяется четкий лимит памяти и процессора. Даже если один сервис зависнет или получит пиковую нагрузку, остальные сайты на сервере продолжат стабильно работать.</p>
            </div>
          </div>
          <div class="bento-cell">
            <div>
              <h3 class="cell-title" data-i18n="b2_title">Умный поиск и исправление ошибок</h3>
              <p class="cell-desc" data-i18n="b2_desc">Платформа сама читает системные логи и простым языком объясняет причину сбоя (нехватка памяти, занятый порт или неверный пароль БД), предлагая кнопку исправления в 1 клик.</p>
            </div>
          </div>
          <div class="bento-cell">
            <div>
              <h3 class="cell-title" data-i18n="b3_title">Безопасное хранение паролей</h3>
              <p class="cell-desc" data-i18n="b3_desc">Все пароли, ключи API и токены надежно зашифрованы. Они никогда не светятся в открытом виде в логах и передаются приложению только в момент его запуска.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    setInterval(() => {
      const d = new Date();
      document.getElementById('zulu-clock').textContent = d.toISOString().slice(11, 19) + ' ZULU';
    }, 1000);

    function setOptics(el, modeClass) {
      document.querySelectorAll('.cam-modes span').forEach(s => s.classList.remove('active'));
      el.classList.add('active');
      const mon = document.getElementById('recon-monitor');
      mon.className = 'recon-monitor ' + modeClass;
    }

    // Animated Topographic Dither / Hatch Matrix + Subtle Blue Film Grain Noise
    (function initTopoCanvas() {
      const canvas = document.getElementById('topo-canvas');
      const ctx = canvas.getContext('2d');
      let width = 0, height = 0, time = 0;
      const cell = 6;

      function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
      }
      window.addEventListener('resize', resize);
      resize();

      function field(x, y, t) {
        const nx = x * 0.0045;
        const ny = y * 0.0045;
        const v1 = Math.sin(nx * 1.7 + t) * Math.cos(ny * 1.4 - t * 0.8);
        const v2 = Math.sin((nx + ny) * 1.2 - t * 0.6) * 0.6;
        const v3 = Math.cos(nx * 0.8 - ny * 1.9 + t * 0.5) * 0.4;
        return (v1 + v2 + v3 + 2.0) / 4.0;
      }

      function render() {
        ctx.fillStyle = '#060c12';
        ctx.fillRect(0, 0, width, height);

        for (let y = 0; y < height; y += cell) {
          for (let x = 0; x < width; x += cell) {
            const val = field(x, y, time);
            const grain = (Math.random() - 0.5) * 0.035;
            const v = val + grain;
            if (v < 0.37) {
              continue;
            } else if (v < 0.49) {
              ctx.strokeStyle = 'rgba(96, 152, 190, 0.22)';
              ctx.beginPath();
              ctx.moveTo(x, y + cell);
              ctx.lineTo(x + cell, y);
              ctx.stroke();
            } else if (v < 0.67) {
              ctx.fillStyle = 'rgba(124, 196, 232, 0.16)';
              ctx.fillRect(x + 2, y + 2, 1.5, 1.5);
            } else {
              ctx.fillStyle = 'rgba(148, 214, 245, 0.25)';
              ctx.fillRect(x + 1, y + 1, 2, 2);
              ctx.fillRect(x + 4, y + 4, 1, 1);
            }
          }
        }
        time += 0.006;
        requestAnimationFrame(render);
      }
      render();
    })();

    // Slow, Step-by-Step Telemetry Engine for Right Panel (shifts in small discrete chunks every ~950ms)
    let telemetrySurge = 0;
    (function initReconLiveGraphs() {
      const streams = [
        {
          id: 'pg-mem', width: 100, points: [16, 15, 16, 13, 14, 12, 13, 11],
          baseVal: 612, ampVal: 14, format: (v) => Math.round(v) + 'MB'
        },
        {
          id: 'pg-iops', width: 100, points: [17, 14, 15, 11, 13, 9, 11, 8],
          baseVal: 1.4, ampVal: 0.35, format: (v) => v.toFixed(1) + 'K/s'
        },
        {
          id: 'api-mem', width: 100, points: [17, 13, 15, 10, 11, 9, 10, 8],
          baseVal: 418, ampVal: 18, format: (v) => Math.round(v) + 'MB'
        },
        {
          id: 'api-cpu', width: 100, points: [15, 16, 12, 13, 9, 11, 8, 9],
          baseVal: 0.85, ampVal: 0.16, format: (v) => v.toFixed(2) + 'c'
        },
        {
          id: 'redis-mem', width: 100, points: [15, 14, 13, 13, 12, 11, 12, 10],
          baseVal: 128, ampVal: 5, format: (v) => Math.round(v) + 'MB'
        },
        {
          id: 'redis-sock', width: 100, points: [17, 13, 14, 11, 12, 9, 10, 8],
          baseVal: 84, ampVal: 10, format: (v) => String(Math.round(v))
        },
        {
          id: 'traefik-bw', width: 200, points: [17, 15, 12, 14, 10, 12, 8, 10, 7, 9],
          baseVal: 2.8, ampVal: 0.45, format: (v) => v.toFixed(2) + ' GB/s'
        }
      ];

      function renderStreamStep(st) {
        const count = st.points.length;
        const pts = [];
        for (let i = 0; i < count; i++) {
          const x = (i / (count - 1)) * (st.width - 3);
          const y = st.points[i];
          pts.push(x.toFixed(1) + ',' + y.toFixed(1));
        }
        const lastY = st.points[count - 1];
        const endX = (st.width - 3).toFixed(1);

        const lineEl = document.getElementById('line-' + st.id);
        const areaEl = document.getElementById('area-' + st.id);
        const dotEl = document.getElementById('dot-' + st.id);

        if (lineEl) lineEl.setAttribute('points', pts.join(' '));
        if (areaEl) areaEl.setAttribute('points', '0,24 ' + pts.join(' ') + ' ' + endX + ',24');
        if (dotEl) {
          dotEl.setAttribute('cx', endX);
          dotEl.setAttribute('cy', lastY.toFixed(1));
        }

        const valEl = document.getElementById('val-' + st.id);
        if (valEl) {
          const norm = (13 - lastY) / 6.0;
          const liveVal = st.baseVal + norm * st.ampVal;
          valEl.textContent = st.format(Math.max(0.1, liveVal));
        }
      }

      // Initial render
      streams.forEach(renderStreamStep);

      let stepCounter = 0;
      setInterval(() => {
        stepCounter++;
        if (telemetrySurge > 0.05) {
          telemetrySurge *= 0.65;
        } else {
          telemetrySurge = 0;
        }

        for (let s = 0; s < streams.length; s++) {
          const st = streams[s];
          const prevY = st.points[st.points.length - 1];
          // Small discrete step toward center (11.5) + slight random nudge
          const pullToCenter = (11.5 - prevY) * 0.35;
          const stepDelta = (Math.random() - 0.5) * 3.2 + pullToCenter - telemetrySurge * 3.0;
          const nextY = Math.max(4.5, Math.min(19.5, prevY + stepDelta));

          st.points.shift();
          st.points.push(nextY);
          renderStreamStep(st);
        }

        const feedEl = document.getElementById('recon-feed-timer');
        if (feedEl) {
          const sec = String(stepCounter % 60).padStart(2, '0');
          feedEl.textContent = \`FEED: 00:03:\${sec} // NORVINSK-BLUELUT\`;
        }
      }, 950);
    })();

    function triggerHeroDeploy() {
      telemetrySurge = 1.35;
      const badge = document.getElementById('prod-wave-badge');
      const apiBadge = document.getElementById('api-status-badge');
      const triggerText = document.getElementById('trigger-text');
      triggerText.textContent = '$ valence deploy [WAVE #1 EXECUTING...]';
      badge.textContent = '[WAVE 1/2 • BOOTING DBs]';
      badge.style.color = '#f6b86e';
      apiBadge.textContent = 'BUILDING NIXPACKS...';

      setTimeout(() => {
        badge.textContent = '[LOCK ACQUIRED • WAVE 2/2]';
        badge.style.color = '#82ccf0';
        apiBadge.textContent = 'BLUE-GREEN // ACTIVE';
        apiBadge.style.color = '#82ccf0';
        triggerText.textContent = '$ git push origin main';
      }, 1400);
    }

    let currentLang = 'ru';
    let currentStepNum = '01';

    const i18nDict = {
      ru: {
        nav_s1: '§1 Порядок запуска',
        nav_s2: '§2 Преимущества',
        auth_tab_login: 'Вход',
        auth_tab_reg: 'Регистрация',
        auth_lbl_email: 'EMAIL АДМИНИСТРАТОРА',
        auth_lbl_pass: 'ПАРОЛЬ',
        auth_lbl_role: 'РОЛЬ В ПРОЕКТЕ',
        auth_btn_submit: 'Войти в панель управления серверами →',
        hero_badge: 'АРХИВ ПРЕССЫ // ВЫП. IV • ОБЗОР ПЛАТФОРМЫ • §1',
        hero_title: 'ВАШ КОД.<br/>ВАШИ <span class="censor-bar">СЕРВЕРЫ.</span>',
        hero_sub: '<b>Valence</b> — это удобная платформа для запуска сайтов, бэкендов, баз данных и игровых серверов на вашем собственном оборудовании или VPS. Подключите репозиторий с кодом или выберите готовое приложение из каталога — система сама соберет проект, свяжет его с базой данных, настроит домен и проследит за стабильной работой без переплаты за облака.',
        hero_quote: '"СВОДКА (§1.4): АВТОМАТИЧЕСКАЯ СБОРКА ПОСЛЕ GIT PUSH, ОБНОВЛЕНИЕ САЙТОВ БЕЗ СЕКУНДЫ ПРОСТОЯ И ИСПРАВЛЕНИЕ СБОЕВ В ОДИН КЛИК — ПОЛНЫЙ КОНТРОЛЬ НАД ВАШИМ СЕРВЕРОМ."',
        hero_btn_primary: '$ Запустить проект',
        hero_btn_secondary: 'Панель управления',
        gaz1_tag: 'СТАТЬЯ §1.1 // ЛЕГКАЯ УСТАНОВКА',
        gaz1_text: 'Работает на любом обычном VPS или домашнем Linux-сервере. Не требует сложного администрирования — управляет приложениями напрямую и не тратит ресурсы сервера впустую.',
        gaz2_tag: 'СТАТЬЯ §1.2 // АВТОСБОРКА КОДА',
        gaz2_text: 'Просто отправьте код из GitHub. Платформа сама определит язык проекта (Node.js, Python, Go, Rust), соберет рабочую версию и обновит сайт без единого разрыва соединения.',
        gaz3_tag: 'СТАТЬЯ §1.3 // СПЯЩИЙ РЕЖИМ',
        gaz3_text: 'Тестовые стенды и редко посещаемые сервисы автоматически переходят в режим ожидания для экономии памяти и мгновенно просыпаются, когда на сайт заходит пользователь.',
        sec2_badge: 'ТЕХНИЧЕСКОЕ ПРИЛОЖЕНИЕ // §3 • УМНЫЙ ПОРЯДОК ЗАПУСКА',
        sec2_title: 'ТРИ ШАГА ЗАПУСКА. НИ ОДНОГО ОБРЫВА СВЯЗИ.',
        sec2_desc: 'Вместо того чтобы запускать всё вперемешку, <b>Valence</b> включает части вашего проекта по очереди: сначала базы данных, затем само приложение с уже готовыми настройками доступа, и в финале открывает доступ для пользователей.',
        schem_title: 'СХЕМА // ПОРЯДОК ЗАПУСКА ПРОЕКТА',
        step_01_label: 'ШАГ 01 — БАЗЫ ДАННЫХ И ХРАНИЛИЩА',
        step_02_label: 'ШАГ 02 — АВТОМАТИЧЕСКАЯ НАСТРОЙКА И СБОРКА',
        step_03_label: 'ШАГ 03 — ПЕРЕКЛЮЧЕНИЕ ТРАФИКА БЕЗ ПРОСТОЯ',
        w1_num: 'ШАГ 01 // ПОДГОТОВКА ДАННЫХ',
        w1_title: 'Сначала включаются базы данных',
        w1_desc: 'Платформа первой запускает PostgreSQL, Redis или очереди сообщений и дожидается их полной готовности, чтобы ваше приложение не выдавало ошибку при старте.',
        w2_num: 'ШАГ 02 // СВЯЗЬ БЕЗ РУЧНОЙ НАСТРОЙКИ',
        w2_title: 'Автоподключение приложения к базе',
        w2_desc: 'Когда база данных готова, система сама передает вашему сайту или бэкенду нужные адреса и пароли подключения — ничего не нужно копировать вручную.',
        w3_num: 'ШАГ 03 // ВЫХОД В ОНЛАЙН',
        w3_title: 'Обновление сайта без остановки',
        w3_desc: 'Новая версия приложения запускается параллельно со старой. Как только она готова, посетители мгновенно переводятся на обновленный сайт без единой секунды простоя.',
        sec3_tag: '[ §2 // УПРАВЛЕНИЕ ПРОЕКТАМИ И НАДЕЖНОСТЬ ]',
        b1_title: 'Защита от перегрузок',
        b1_desc: 'Каждому приложению выделяется четкий лимит памяти и процессора. Даже если один сервис зависнет или получит пиковую нагрузку, остальные сайты на сервере продолжат стабильно работать.',
        b2_title: 'Умный поиск и исправление ошибок',
        b2_desc: 'Платформа сама читает системные логи и простым языком объясняет причину сбоя (нехватка памяти, занятый порт или неверный пароль БД), предлагая кнопку исправления в 1 клик.',
        b3_title: 'Безопасное хранение паролей',
        b3_desc: 'Все пароли, ключи API и токены надежно зашифрованы. Они никогда не светятся в открытом виде в логах и передаются приложению только в момент его запуска.',
        b4_title: 'Визуальный конструктор связей',
        b4_desc: 'Соедините базу данных с вашим приложением — платформа автоматически создаст внутреннюю сеть и пропишет настройки подключения.',
        b4_btn1: 'Связать Postgres → API',
        b4_btn2: 'Связать Очередь → Воркер',
        sec4_tag: '[ §3 // МОНИТОРИНГ СЕРВЕРОВ В РЕАЛЬНОМ ВРЕМЕНИ ]',
        sec5_tag: '[ §4 // КАТАЛОГ ГОТОВЫХ ПРИЛОЖЕНИЙ В 1 КЛИК ]',
        sec6_tag: '[ §5 // ДИАГНОСТИКА СБОЕВ И БЫСТРОЕ ВОССТАНОВЛЕНИЕ ]',
        sec6_title: 'Автоматический помощник при сбоях',
        sec6_desc: 'Нажмите на любой пример сбоя ниже, чтобы увидеть, как система распознает проблему и предлагает решение в 1 клик.',
        crash_btn1: 'Нехватка памяти (OOM)',
        crash_btn2: 'Конфликт порта',
        crash_btn3: 'Ошибка пароля БД'
      },
      uk: {
        nav_s1: '§1 Порядок запуску',
        nav_s2: '§2 Переваги',
        auth_tab_login: 'Вхід',
        auth_tab_reg: 'Реєстрація',
        auth_lbl_email: 'EMAIL АДМІНІСТРАТОРА',
        auth_lbl_pass: 'ПАРОЛЬ',
        auth_lbl_role: 'РОЛЬ У ПРОЄКТІ',
        auth_btn_submit: 'Увійти в панель керування серверами →',
        hero_badge: 'АРХІВ ПРЕСИ // ВИП. IV • ОГЛЯД ПЛАТФОРМИ • §1',
        hero_title: 'ВАШ КОД.<br/>ВАШІ <span class="censor-bar">СЕРВЕРИ.</span>',
        hero_sub: '<b>Valence</b> — це зручна платформа для запуску сайтів, бекендів, баз даних та ігрових серверів на вашому власному обладнанні або VPS. Підключіть репозиторій із кодом або оберіть готовий застосунок із каталогу — система сама збере проєкт, з’єднає його з базою даних, налаштує домен і подбає про стабільну роботу без переплати за хмари.',
        hero_quote: '"ЗВЕДЕННЯ (§1.4): АВТОМАТИЧНА ЗБІРКА ПІСЛЯ GIT PUSH, ОНОВЛЕННЯ САЙТІВ БЕЗ ЖОДНОЇ СЕКУНДИ ПРОСТОЮ ТА ВИПРАВЛЕННЯ ЗБОЇВ В ОДИН КЛІК — ПОВНИЙ КОНТРОЛЬ НАД ВАШИМ СЕРВЕРОМ."',
        hero_btn_primary: '$ Запустити проєкт',
        hero_btn_secondary: 'Панель керування',
        gaz1_tag: 'СТАТТЯ §1.1 // ЛЕГКЕ ВСТАНОВЛЕННЯ',
        gaz1_text: 'Працює на будь-якому звичайному VPS або домашньому Linux-сервері. Не потребує складного адміністрування — керує застосунками напряму й не витрачає ресурси сервера даремно.',
        gaz2_tag: 'СТАТТЯ §1.2 // АВТОЗБІРКА КОДУ',
        gaz2_text: 'Просто надішліть код із GitHub. Платформа сама визначить мову проєкту (Node.js, Python, Go, Rust), збере робочу версію та оновить сайт без розриву з’єднання.',
        gaz3_tag: 'СТАТТЯ §1.3 // СПЛЯЧИЙ РЕЖИМ',
        gaz3_text: 'Тестові стенди та сервіси з рідкісними відвідуваннями автоматично переходять у режим очікування для економії пам’яті й миттєво прокидаються, коли заходить користувач.',
        sec2_badge: 'ТЕХНІЧНИЙ ДОДАТОК // §3 • РОЗУМНИЙ ПОРЯДОК ЗАПУСКУ',
        sec2_title: 'ТРИ КРОКИ ЗАПУСКУ. ЖОДНОГО ОБРИВУ ЗВ’ЯЗКУ.',
        sec2_desc: 'Замість того щоб запускати все хаотично, <b>Valence</b> вмикає частини вашого проєкту по черзі: спершу бази даних, потім сам застосунок із уже готовими налаштуваннями доступу, і у фіналі відкриває доступ для відвідувачів.',
        schem_title: 'СХЕМА // ПОРЯДОК ЗАПУСКУ ПРОЄКТУ',
        step_01_label: 'КРОК 01 — БАЗИ ДАНИХ ТА СХОВИЩА',
        step_02_label: 'КРОК 02 — АВТОМАТИЧНЕ НАЛАШТУВАННЯ ТА ЗБІРКА',
        step_03_label: 'КРОК 03 — ПЕРЕМИКАННЯ ТРАФІКУ БЕЗ ПРОСТОЮ',
        w1_num: 'КРОК 01 // ПІДГОТОВКА ДАНИХ',
        w1_title: 'Спершу вмикаються бази даних',
        w1_desc: 'Платформа першою запускає PostgreSQL, Redis або черги повідомлень і чекає на їхню повну готовність, щоб ваш застосунок не видавав помилку під час старту.',
        w2_num: 'КРОК 02 // ЗВ’ЯЗОК БЕЗ РУЧНОГО НАЛАШТУВАННЯ',
        w2_title: 'Автопідключення застосунку до бази',
        w2_desc: 'Коли база даних готова, система сама передає вашому сайту чи бекенду потрібні адреси та паролі підключення — нічого не потрібно копіювати вручну.',
        w3_num: 'КРОК 03 // ВИХІД В ОНЛАЙН',
        w3_title: 'Оновлення сайту без зупинки',
        w3_desc: 'Нова версія застосунку запускається паралельно зі старою. Щойно вона готова, відвідувачі миттєво переводяться на оновлений сайт без жодної секунди простою.',
        sec3_tag: '[ §2 // КЕРУВАННЯ ПРОЄКТАМИ ТА НАДІЙНІСТЬ ]',
        b1_title: 'Захист від перевантажень',
        b1_desc: 'Кожному застосунку виділяється чіткий ліміт пам’яті та процесора. Навіть якщо один сервіс зависне або отримає пікове навантаження, інші сайти на сервері продовжать стабільно працювати.',
        b2_title: 'Розумний пошук і виправлення помилок',
        b2_desc: 'Платформа сама читає системні логи й простою мовою пояснює причину збою (нестача пам’яті, зайнятий порт або невірний пароль БД), пропонуючи кнопку виправлення в 1 клік.',
        b3_title: 'Безпечне зберігання паролів',
        b3_desc: 'Усі паролі, ключі API та токени надійно зашифровані. Вони ніколи не відображаються у відкритому вигляді в логах і передаються застосунку лише в момент його запуску.',
        b4_title: 'Візуальний конструктор зв’язків',
        b4_desc: 'З’єднайте базу даних із вашим застосунком — платформа автоматично створить внутрішню мережу та пропише налаштування підключення.',
        b4_btn1: 'З’єднати Postgres → API',
        b4_btn2: 'З’єднати Чергу → Воркер',
        sec4_tag: '[ §3 // МОНІТОРИНГ СЕРВЕРІВ У РЕАЛЬНОМУ ЧАСІ ]',
        sec5_tag: '[ §4 // КАТАЛОГ ГОТОВИХ ЗАСТОСУНКІВ В 1 КЛІК ]',
        sec6_tag: '[ §5 // ДІАГНОСТИКА ЗБОЇВ ТА ШВИДКЕ ВІДНОВЛЕННЯ ]',
        sec6_title: 'Автоматичний помічник при збоях',
        sec6_desc: 'Натисніть на будь-який приклад збою нижче, щоб побачити, як система розпізнає проблему та пропонує рішення в 1 клік.',
        crash_btn1: 'Нестача пам’яті (OOM)',
        crash_btn2: 'Конфлікт порту',
        crash_btn3: 'Помилка пароля БД'
      },
      en: {
        nav_s1: '§1 Launch Order',
        nav_s2: '§2 Key Benefits',
        auth_tab_login: 'Sign In',
        auth_tab_reg: 'Register',
        auth_lbl_email: 'ADMIN EMAIL',
        auth_lbl_pass: 'PASSWORD',
        auth_lbl_role: 'PROJECT ROLE',
        auth_btn_submit: 'Open Server Control Panel →',
        hero_badge: 'PRESS ARCHIVE // VOL. IV • PLATFORM OVERVIEW • §1',
        hero_title: 'YOUR CODE.<br/>YOUR <span class="censor-bar">SERVERS.</span>',
        hero_sub: '<b>Valence</b> is an easy-to-use platform for running websites, backends, databases, and game servers on your own hardware or VPS. Connect your GitHub repository or pick a ready-made app from the catalog — the platform automatically builds your project, links the database, sets up your domain, and keeps everything running smoothly without cloud lock-in.',
        hero_quote: '"BRIEFING (§1.4): AUTOMATIC BUILDS ON GIT PUSH, ZERO-DOWNTIME UPDATES, AND ONE-CLICK CRASH RECOVERY — COMPLETE CONTROL OVER YOUR OWN SERVERS."',
        hero_btn_primary: '$ Launch Project',
        hero_btn_secondary: 'Control Panel',
        gaz1_tag: 'ARTICLE §1.1 // EASY SETUP',
        gaz1_text: 'Runs on any standard VPS or home Linux server. No complex administration required — manages your apps directly without wasting server memory.',
        gaz2_tag: 'ARTICLE §1.2 // AUTO CODE BUILD',
        gaz2_text: 'Just push your code from GitHub. Valence automatically detects your language (Node.js, Python, Go, Rust), builds a ready image, and updates your site without dropping connections.',
        gaz3_tag: 'ARTICLE §1.3 // SLEEP MODE',
        gaz3_text: 'Staging environments and rarely visited apps automatically go to sleep to save RAM and wake up in milliseconds as soon as a visitor opens the site.',
        sec2_badge: 'TECHNICAL SUPPLEMENT // §3 • SMART LAUNCH SEQUENCE',
        sec2_title: 'THREE LAUNCH STEPS. ZERO BROKEN CONNECTIONS.',
        sec2_desc: 'Instead of starting everything at once at random, <b>Valence</b> launches your project step by step: first the databases, then your application with all connection settings pre-filled, and finally opens public traffic.',
        schem_title: 'SCHEMATIC // PROJECT LAUNCH ORDER',
        step_01_label: 'STEP 01 — DATABASES & STORAGE',
        step_02_label: 'STEP 02 — AUTO-CONFIGURATION & BUILD',
        step_03_label: 'STEP 03 — ZERO-DOWNTIME TRAFFIC SWITCH',
        w1_num: 'STEP 01 // DATA PREPARATION',
        w1_title: 'Databases start first',
        w1_desc: 'The platform starts PostgreSQL, Redis, or message queues first and waits until they are completely ready so your app never crashes on startup.',
        w2_num: 'STEP 02 // AUTOMATIC CONNECTION',
        w2_title: 'App connects to the database automatically',
        w2_desc: 'Once the database is ready, the system automatically passes the connection address and password to your backend — no manual copy-pasting needed.',
        w3_num: 'STEP 03 // GOING LIVE',
        w3_title: 'Update your site without downtime',
        w3_desc: 'The new version of your app starts alongside the old one. As soon as it is ready, visitors are seamlessly switched over with zero downtime.',
        sec3_tag: '[ §2 // PROJECT MANAGEMENT & RELIABILITY ]',
        b1_title: 'Overload Protection',
        b1_desc: 'Every app gets a clear memory and CPU limit. Even if one service freezes or hits a traffic spike, all other websites on your server keep running smoothly.',
        b2_title: 'Smart Error Detection & 1-Click Fix',
        b2_desc: 'The platform reads system logs and explains crashes in plain language (out of memory, port conflict, or wrong DB password), offering a 1-click fix button.',
        b3_title: 'Secure Password Storage',
        b3_desc: 'All passwords, API keys, and tokens are safely encrypted. They are never exposed in plain text in logs and are passed to your app only when it starts.',
        b4_title: 'Visual Connection Builder',
        b4_desc: 'Link your database to your app on the canvas — the platform automatically creates a private network and fills in the connection settings.',
        b4_btn1: 'Link Postgres → API',
        b4_btn2: 'Link Queue → Worker',
        sec4_tag: '[ §3 // LIVE SERVER MONITORING ]',
        sec5_tag: '[ §4 // 1-CLICK APP CATALOG ]',
        sec6_tag: '[ §5 // CRASH DIAGNOSTICS & QUICK RECOVERY ]',
        sec6_title: 'Automated Crash Assistant',
        sec6_desc: 'Click any sample error below to see how the platform spots the issue and offers a one-click fix.',
        crash_btn1: 'Out of Memory (OOM)',
        crash_btn2: 'Port Conflict',
        crash_btn3: 'DB Password Error'
      }
    };

    const stepConsoleDict = {
      ru: {
        '01': {
          hdr: '[ШАГ 01 АКТИВЕН] Запуск баз данных и проверка готовности...',
          l1: '&gt; Контейнеры <b>postgres-db:5432</b> и <b>rabbitmq-queue:5672</b> запущены первыми.',
          l2: '&gt; Проверка связи: база данных готова принимать запросы (отклик 9 мс).'
        },
        '02': {
          hdr: '[ШАГ 02 АКТИВЕН] Автоматическая передача доступов и сборка кода...',
          l1: '&gt; Переданы настройки: <code>DATABASE_URL=postgres://postgres-db:5432/app</code>',
          l2: '&gt; Приложение <b>api-backend</b> собрано из GitHub и успешно подключено к базе.'
        },
        '03': {
          hdr: '[ШАГ 03 АКТИВЕН] Бесшовное переключение домена на новую версию...',
          l1: '&gt; HTTPS-домен <b>https://api.paas.local</b> переключен на новый контейнер.',
          l2: '&gt; Статус: 0 потерянных запросов, спящий режим ожидания активирован.'
        }
      },
      uk: {
        '01': {
          hdr: '[КРОК 01 АКТИВНИЙ] Запуск баз даних та перевірка готовності...',
          l1: '&gt; Контейнери <b>postgres-db:5432</b> та <b>rabbitmq-queue:5672</b> запущені першими.',
          l2: '&gt; Перевірка зв’язку: база даних готова приймати запити (відгук 9 мс).'
        },
        '02': {
          hdr: '[КРОК 02 АКТИВНИЙ] Автоматична передача доступів та збірка коду...',
          l1: '&gt; Передані налаштування: <code>DATABASE_URL=postgres://postgres-db:5432/app</code>',
          l2: '&gt; Застосунок <b>api-backend</b> зібрано з GitHub та успішно підключено до бази.'
        },
        '03': {
          hdr: '[КРОК 03 АКТИВНИЙ] Безшовне перемикання домену на нову версію...',
          l1: '&gt; HTTPS-домен <b>https://api.paas.local</b> перемкнуто на новий контейнер.',
          l2: '&gt; Статус: 0 втрачених запитів, сплячий режим очікування активовано.'
        }
      },
      en: {
        '01': {
          hdr: '[STEP 01 ACTIVE] Starting databases & running readiness checks...',
          l1: '&gt; Containers <b>postgres-db:5432</b> and <b>rabbitmq-queue:5672</b> booted first.',
          l2: '&gt; Healthcheck: database is ready to accept connections (latency 9ms).'
        },
        '02': {
          hdr: '[STEP 02 ACTIVE] Auto-linking credentials & building backend...',
          l1: '&gt; Injected settings: <code>DATABASE_URL=postgres://postgres-db:5432/app</code>',
          l2: '&gt; Service <b>api-backend</b> built from GitHub and connected to the database.'
        },
        '03': {
          hdr: '[STEP 03 ACTIVE] Zero-downtime domain traffic switch...',
          l1: '&gt; Public domain <b>https://api.paas.local</b> switched to the new container.',
          l2: '&gt; Status: 0 dropped requests, auto-sleep idle mode enabled.'
        }
      }
    };

    function setLanguage(lang) {
      currentLang = i18nDict[lang] ? lang : 'ru';
      document.querySelectorAll('.lang-btn').forEach(btn => btn.classList.remove('active'));
      const activeBtn = document.getElementById('lang-' + currentLang);
      if (activeBtn) activeBtn.classList.add('active');

      const dict = i18nDict[currentLang];
      document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dict[key]) {
          el.innerHTML = dict[key];
        }
      });

      selectWaveStepByNum(currentStepNum);
      if (typeof switchAuthMode === 'function') {
        switchAuthMode(currentAuthMode);
      }
    }

    function selectWaveStepByNum(stepNum) {
      currentStepNum = stepNum;
      document.querySelectorAll('.wave-step').forEach(s => s.classList.remove('active'));
      const activeCard = document.getElementById('wave-card-' + stepNum);
      if (activeCard) activeCard.classList.add('active');

      const dict = i18nDict[currentLang];
      const activeLabel = document.getElementById('reactor-active-label');
      if (activeLabel) {
        activeLabel.textContent = dict['step_' + stepNum + '_label'];
      }

      // Highlight SVG Columns, Pipes & Sliding Target Frame
      const col1 = document.getElementById('svg-col-01');
      const col2 = document.getElementById('svg-col-02');
      const col3 = document.getElementById('svg-col-03');
      const hdr1 = document.getElementById('svg-hdr-01');
      const hdr2 = document.getElementById('svg-hdr-02');
      const hdr3 = document.getElementById('svg-hdr-03');
      const focusBox = document.getElementById('svg-focus-box');
      const pipe12a = document.getElementById('pipe-1-2a');
      const pipe12b = document.getElementById('pipe-1-2b');
      const pipe23 = document.getElementById('pipe-2-3');
      const badgeDb = document.getElementById('badge-link-db');

      if (col1) col1.style.opacity = stepNum === '01' ? '1' : '0.45';
      if (col2) col2.style.opacity = stepNum === '02' ? '1' : '0.45';
      if (col3) col3.style.opacity = stepNum === '03' ? '1' : '0.45';

      if (hdr1) { hdr1.setAttribute('fill', stepNum === '01' ? '#82ccf0' : '#8aa6ba'); hdr1.textContent = stepNum === '01' ? '[ STEP 01 // DATABASES ]' : 'STEP 01 // DATABASES'; }
      if (hdr2) { hdr2.setAttribute('fill', stepNum === '02' ? '#f6b86e' : '#8aa6ba'); hdr2.textContent = stepNum === '02' ? '[ STEP 02 // BACKEND APP ]' : 'STEP 02 // BACKEND APP'; }
      if (hdr3) { hdr3.setAttribute('fill', stepNum === '03' ? '#82ccf0' : '#8aa6ba'); hdr3.textContent = stepNum === '03' ? '[ STEP 03 // PUBLIC DOMAIN ]' : 'STEP 03 // PUBLIC DOMAIN'; }

      if (focusBox) {
        if (stepNum === '01') {
          focusBox.setAttribute('x', '26'); focusBox.setAttribute('y', '42');
          focusBox.setAttribute('width', '168'); focusBox.setAttribute('height', '206');
          focusBox.setAttribute('stroke', '#82ccf0');
        } else if (stepNum === '02') {
          focusBox.setAttribute('x', '246'); focusBox.setAttribute('y', '92');
          focusBox.setAttribute('width', '168'); focusBox.setAttribute('height', '106');
          focusBox.setAttribute('stroke', '#f6b86e');
        } else {
          focusBox.setAttribute('x', '466'); focusBox.setAttribute('y', '92');
          focusBox.setAttribute('width', '168'); focusBox.setAttribute('height', '106');
          focusBox.setAttribute('stroke', '#82ccf0');
        }
      }

      if (pipe12a && pipe12b) {
        const active12 = stepNum === '02' || stepNum === '03';
        pipe12a.setAttribute('stroke', active12 ? '#82ccf0' : '#2c536d');
        pipe12b.setAttribute('stroke', active12 ? '#82ccf0' : '#2c536d');
        pipe12a.classList.toggle('pipe-active', stepNum === '02');
        pipe12b.classList.toggle('pipe-active', stepNum === '02');
      }
      if (badgeDb) {
        badgeDb.style.opacity = (stepNum === '02' || stepNum === '03') ? '1' : '0.45';
      }
      if (pipe23) {
        pipe23.setAttribute('stroke', stepNum === '03' ? '#f6b86e' : '#2c536d');
        pipe23.classList.toggle('pipe-active', stepNum === '03');
      }

      const cLog = stepConsoleDict[currentLang][stepNum];
      const hdrEl = document.getElementById('step-console-hdr');
      const l1El = document.getElementById('step-console-line1');
      const l2El = document.getElementById('step-console-line2');
      if (hdrEl && cLog) {
        hdrEl.textContent = cLog.hdr;
        hdrEl.style.color = stepNum === '02' ? '#f6b86e' : '#82ccf0';
        l1El.innerHTML = cLog.l1;
        l2El.innerHTML = cLog.l2;
      }
    }

    let currentAuthMode = 'login';

    function switchAuthMode(mode) {
      currentAuthMode = mode;
      const loginBtn = document.getElementById('tab-auth-login');
      const regBtn = document.getElementById('tab-auth-reg');
      const roleWrap = document.getElementById('auth-role-wrap');
      const submitBtn = document.getElementById('auth-submit-btn');

      if (mode === 'register') {
        loginBtn.className = 'btn-outline';
        regBtn.className = 'btn-cyan';
        roleWrap.style.display = 'block';
        submitBtn.textContent = currentLang === 'en'
          ? 'Create Account & Open Control Panel →'
          : currentLang === 'uk'
          ? 'Створити акаунт і відкрити панель →'
          : 'Создать аккаунт и открыть панель →';
      } else {
        loginBtn.className = 'btn-cyan';
        regBtn.className = 'btn-outline';
        roleWrap.style.display = 'none';
        submitBtn.textContent = i18nDict[currentLang].auth_btn_submit;
      }
    }

    async function submitAuthForm() {
      const email = document.getElementById('auth-email').value || 'admin@valence.local';
      const role = document.getElementById('auth-role').value || 'OWNER';
      const res = await fetch('/client/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role })
      });
      const data = await res.json();
      localStorage.setItem('valence_session', JSON.stringify(data.session));
      window.location.href = '/dashboard';
    }
  </script>
</body>
</html>`;

export const webClientServer = createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && (req.url === '/' || req.url === '/client/docs')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(hybridConsoleHtml);
      return;
    }

    if (req.method === 'GET' && req.url === '/dashboard') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(dashboardConsoleHtml);
      return;
    }

    if (req.method === 'POST' && req.url === '/client/auth/session') {
      const body = await readJsonBody(req);
      const session = sessionService.issueSession(body.email || 'admin@valence.local', body.role || 'OWNER');
      sendJson(res, 200, { session });
      return;
    }

    if (req.method === 'POST' && req.url === '/client/nodes/register') {
      const body = await readJsonBody(req);
      const newNode = sessionService.registerServerNode(
        body.hostname || 'worker-node-new',
        body.publicIp || '10.10.0.99',
        Number(body.totalMemoryMb) || 16384,
        Number(body.cpuCores) || 8,
      );
      sampleClusterNodes.push(newNode as any);
      sendJson(res, 200, { registeredNode: newNode, totalNodes: sampleClusterNodes.length });
      return;
    }

    if (req.method === 'GET' && req.url === '/client/services') {
      sendJson(res, 200, { services: managedServicesList });
      return;
    }

    if (req.method === 'POST' && req.url === '/client/services/deploy') {
      const body = await readJsonBody(req);
      const targetNode = sampleClusterNodes[sampleClusterNodes.length - 1] || sampleClusterNodes[0];
      const newSvc = {
        id: 'svc-' + Date.now(),
        name: (body.name || 'custom-service').trim(),
        image: body.image || 'github:nixpacks/node:22',
        status: 'RUNNING',
        memoryMb: Number(body.memoryMb) || 1024,
        domain: (body.domain || 'app.paas.local').trim(),
        nodeHostname: targetNode.hostname,
      };
      managedServicesList.unshift(newSvc);
      targetNode.usedMemoryMb = Math.min(targetNode.totalMemoryMb, targetNode.usedMemoryMb + newSvc.memoryMb);
      targetNode.activeContainers += 1;
      sendJson(res, 200, { deployedService: newSvc });
      return;
    }

    if (req.method === 'POST' && req.url === '/client/services/toggle') {
      const body = await readJsonBody(req);
      const svc = managedServicesList.find((s) => s.id === body.serviceId);
      if (svc) {
        svc.status = svc.status === 'RUNNING' ? 'SLEEPING' : 'RUNNING';
      }
      sendJson(res, 200, { updatedService: svc });
      return;
    }

    if (req.method === 'POST' && req.url === '/client/vault/preview') {
      const body = await readJsonBody(req);
      const keyBuf = scryptSync('valence-master-secret', 'valence-salt', 32);
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', keyBuf, iv);
      const payload = JSON.stringify({ [body.key || 'SECRET']: body.value || 'value' });
      const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
      const tag = cipher.getAuthTag();
      sendJson(res, 200, {
        algorithm: 'AES-256-GCM',
        variableKey: body.key,
        encryptedVaultRecord: `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`,
        status: 'STORED_AND_SEALED',
      });
      return;
    }

    if (req.method === 'POST' && req.url === '/client/backups/trigger') {
      const body = await readJsonBody(req);
      const safeTs = new Date().toISOString().replace(/[:.]/g, '-');
      const s3ObjectKey = `backups/${body.projectId || 'proj-prod'}/${body.serviceId || 'postgres-16'}/snapshot-${safeTs}.tar.gz`;
      sendJson(res, 200, {
        status: 'SNAPSHOT_UPLOADED_TO_S3',
        bucket: 'valence-backups',
        s3ObjectKey,
        retentionPolicy: 'KEEP_LAST_5_ARCHIVES',
        timestampIso: new Date().toISOString(),
      });
      return;
    }

    if (req.method === 'GET' && (req.url === '/client/bento' || req.url === '/client/clean')) {
      const backupSrc = readFileSync(resolve(__dirname, '../../src/design-clean-bento.backup.ts'), 'utf-8');
      const startIdx = backupSrc.indexOf('<!DOCTYPE html>');
      const endIdx = backupSrc.lastIndexOf('</html>') + 7;
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(backupSrc.slice(startIdx, endIdx));
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
