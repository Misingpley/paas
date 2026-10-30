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
  <title>VALENCE // Self-Hosted Container Orchestrator</title>
  <style>
    :root {
      --bg-black: #040507;
      --bg-cell: rgba(8, 10, 14, 0.94);
      --bg-cell-hover: rgba(14, 18, 24, 0.98);
      --line: #1c222b;
      --line-bright: #2e3948;
      --ice-cyan: #72c7e8;
      --ice-deep: #3898bd;
      --amber: #f6b86e;
      --plasma: #fb7185;
      --text-white: #f8fafc;
      --text-muted: #8a94a6;
      --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg-black);
      color: var(--text-white);
      margin: 0;
      padding: 0;
      overflow-x: hidden;
    }

    /* Animated Topographic Halftone/Hatch Background Canvas */
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
      z-index: 3;
      background: var(--ice-cyan);
      color: #040507;
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-align: center;
      padding: 7px 16px;
      text-transform: uppercase;
    }
    .top-ribbon span {
      text-decoration: underline;
      cursor: pointer;
      margin-left: 12px;
    }

    /* Sticky Navbar */
    .navbar-wrap {
      position: sticky;
      top: 0;
      z-index: 10;
      background: rgba(4, 5, 7, 0.92);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--line);
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
      color: #fff;
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
      color: #cbd5e1;
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
      color: #040507;
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
    .btn-cyan:hover { background: #a5e1f9; border-color: #a5e1f9; }
    .btn-white {
      background: #ffffff;
      color: #040507;
      border: 1px solid #ffffff;
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
      background: rgba(8, 10, 14, 0.85);
      color: #f8fafc;
      border: 1px solid #2e3948;
      padding: 10px 18px;
      font-family: var(--font-mono);
      font-size: 11.5px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      cursor: pointer;
      transition: border-color 0.15s, color 0.15s;
    }
    .btn-outline:hover { border-color: var(--ice-cyan); color: var(--ice-cyan); }

    .container {
      position: relative;
      z-index: 1;
      max-width: 1240px;
      margin: 0 auto;
      padding: 0 24px 90px;
    }

    /* =====================================================================
       SECTION 1: HERO SPLIT + ORIGINAL VALENCE "DAG SIGNAL MATRIX" PANEL
       ===================================================================== */
    .hero-split {
      display: grid;
      grid-template-columns: 0.92fr 1.28fr;
      gap: 40px;
      align-items: center;
      padding: 52px 0 68px;
      border-bottom: 1px solid var(--line);
    }
    .bracket-tag {
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--text-muted);
      letter-spacing: 0.12em;
      text-transform: uppercase;
      margin-bottom: 18px;
    }
    .display-title {
      font-family: var(--font-mono);
      font-size: 46px;
      font-weight: 800;
      line-height: 1.04;
      letter-spacing: -0.02em;
      text-transform: uppercase;
      margin: 0 0 22px;
      color: #ffffff;
    }
    .hero-sub {
      font-size: 15.5px;
      line-height: 1.6;
      color: var(--text-muted);
      margin: 0 0 28px;
      max-width: 460px;
    }
    .hero-ctas {
      display: flex;
      gap: 12px;
      margin-bottom: 22px;
    }
    .cli-hint {
      font-family: var(--font-mono);
      font-size: 11.5px;
      color: #64748b;
      letter-spacing: 0.05em;
    }
    .cli-hint code { color: var(--ice-cyan); }

    /* Original Right Hero Composition: Architectural Tile Grid + Signal Block + Connected DAG Production Frame */
    .hero-stage {
      position: relative;
      padding: 36px 0 36px 56px;
      background-image:
        linear-gradient(to right, rgba(30, 38, 49, 0.45) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(30, 38, 49, 0.45) 1px, transparent 1px);
      background-size: 84px 84px;
      border: 1px solid var(--line);
      background-color: rgba(5, 7, 10, 0.85);
    }

    /* Geometric Signal-Stripe Accent Tile (Top-Right & Bottom-Left, in Ice Cyan & Deep Slate) */
    .signal-tile {
      position: absolute;
      width: 84px;
      height: 84px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      overflow: hidden;
      border: 1px solid var(--ice-cyan);
      z-index: 1;
    }
    .signal-tile.top-right { top: 0; right: 0; }
    .signal-tile.bottom-left { bottom: 0; left: 84px; }
    .sig-col-left {
      background: repeating-linear-gradient(
        to bottom,
        #72c7e8 0px,
        #72c7e8 10px,
        #070a0e 10px,
        #070a0e 20px,
        #d8f3ff 20px,
        #d8f3ff 30px
      );
    }
    .sig-col-right {
      background: repeating-linear-gradient(
        to bottom,
        #16222f 0px,
        #16222f 16px,
        #3898bd 16px,
        #3898bd 28px,
        #f6b86e 28px,
        #f6b86e 36px
      );
    }

    /* Floating Command Trigger Badge ($ git push / valence deploy) */
    .trigger-pill {
      position: relative;
      z-index: 3;
      display: inline-flex;
      align-items: center;
      gap: 10px;
      background: #e2e8f0;
      color: #040507;
      font-family: var(--font-mono);
      font-size: 13.5px;
      font-weight: 700;
      padding: 12px 20px;
      margin-left: -24px;
      margin-bottom: 18px;
      cursor: pointer;
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.8);
      transition: background 0.15s, transform 0.15s;
    }
    .trigger-pill:hover {
      background: var(--ice-cyan);
      transform: translateY(-1px);
    }
    .trigger-dot {
      width: 8px;
      height: 8px;
      background: #040507;
      display: inline-block;
    }

    /* 90-degree Orthogonal Connector Wire from Trigger Pill into Production Frame */
    .ortho-wire {
      position: absolute;
      top: 76px;
      left: 52px;
      width: 42px;
      height: 44px;
      border-left: 2px solid var(--ice-cyan);
      border-bottom: 2px solid var(--ice-cyan);
      z-index: 2;
      pointer-events: none;
    }

    /* Main Production Topology Frame */
    .prod-frame {
      position: relative;
      z-index: 2;
      margin-left: 38px;
      background: #080a0e;
      border: 1px solid var(--line-bright);
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.9);
      padding: 20px;
    }
    .prod-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: var(--font-mono);
      font-size: 11.5px;
      letter-spacing: 0.12em;
      color: var(--text-muted);
      margin-bottom: 16px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--line);
    }
    .prod-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      position: relative;
    }
    .svc-card {
      background: #0b0e14;
      border: 1px solid #1e2631;
      padding: 14px;
      transition: border-color 0.2s;
    }
    .svc-card:hover { border-color: var(--ice-cyan); }
    .svc-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 12px;
    }
    .svc-status {
      font-family: var(--font-mono);
      font-size: 11px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .spark-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .spark-box {
      background: #07090d;
      border: 1px solid #171d26;
      padding: 7px 8px;
    }
    .spark-label {
      font-family: var(--font-mono);
      font-size: 9px;
      color: #64748b;
      letter-spacing: 0.06em;
      margin-bottom: 4px;
      display: flex;
      justify-content: space-between;
    }
    .env-pipe {
      margin-top: 10px;
      padding: 5px 8px;
      background: rgba(114, 199, 232, 0.07);
      border-left: 2px solid var(--ice-cyan);
      font-family: var(--font-mono);
      font-size: 10px;
      color: #bae6fd;
      display: flex;
      justify-content: space-between;
    }

    /* =====================================================================
       SECTION 2: ORIGINAL "VALENCE EXECUTION WAVE & KERNEL REACTOR"
       ===================================================================== */
    .reactor-section {
      padding: 72px 0;
      border-bottom: 1px solid var(--line);
    }
    .reactor-grid {
      display: grid;
      grid-template-columns: 1.35fr 1fr;
      border: 1px solid var(--line);
      background: var(--bg-cell);
      margin-top: 28px;
    }
    .reactor-visual {
      padding: 28px;
      border-right: 1px solid var(--line);
      background:
        radial-gradient(circle at 50% 50%, rgba(114, 199, 232, 0.06) 0%, transparent 70%),
        #06080b;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .reactor-controls {
      display: flex;
      flex-direction: column;
    }
    .wave-step {
      padding: 24px 28px;
      border-bottom: 1px solid var(--line);
      cursor: pointer;
      transition: background 0.15s;
    }
    .wave-step:last-child { border-bottom: none; }
    .wave-step:hover, .wave-step.active {
      background: rgba(114, 199, 232, 0.06);
    }
    .wave-step.active {
      border-left: 3px solid var(--ice-cyan);
    }
    .wave-num {
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--ice-cyan);
      letter-spacing: 0.1em;
      margin-bottom: 6px;
    }

    /* =====================================================================
       SECTION 3: SEAMLESS ARCHITECTURAL BENTO GRID
       ===================================================================== */
    .bento-box {
      border-top: 1px solid var(--line);
      border-left: 1px solid var(--line);
      background: var(--bg-cell);
    }
    .bento-row-3 { display: grid; grid-template-columns: repeat(3, 1fr); }
    .bento-row-4 { display: grid; grid-template-columns: repeat(4, 1fr); }
    .bento-full {
      border-right: 1px solid var(--line);
      border-bottom: 1px solid var(--line);
      padding: 32px;
    }
    .bento-cell {
      border-right: 1px solid var(--line);
      border-bottom: 1px solid var(--line);
      padding: 28px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: background 0.15s;
    }
    .bento-cell:hover { background: var(--bg-cell-hover); }
    .cell-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-white);
      margin: 0 0 6px;
    }
    .cell-desc {
      font-size: 13.5px;
      line-height: 1.5;
      color: var(--text-muted);
      margin: 0;
    }
    .cell-meta {
      margin-top: 22px;
      padding-top: 14px;
      border-top: 1px solid #141920;
      font-family: var(--font-mono);
      font-size: 11.5px;
      color: var(--text-muted);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    /* Cryo -> Ionized Gold -> Plasma Rose Telemetry */
    .sev-healthy { color: var(--ice-cyan); font-family: var(--font-mono); font-size: 11px; }
    .sev-warning { color: var(--amber); font-family: var(--font-mono); font-size: 11px; }
    .sev-critical { color: var(--plasma); font-family: var(--font-mono); font-size: 11px; }

    .bar-bg {
      position: relative;
      background: #11151c;
      border: 1px solid #1e2631;
      height: 10px;
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
        rgba(4, 5, 7, 0.78) 5px,
        rgba(4, 5, 7, 0.78) 7px
      );
      pointer-events: none;
    }
    .bar-healthy { background: linear-gradient(90deg, #1e4e68 0%, #3b9ec4 60%, #8be0ff 100%); }
    .bar-warning { background: linear-gradient(90deg, #2b7a9b 0%, #8c7853 45%, #e5993c 88%, #ffd18c 100%); }
    .bar-critical { background: linear-gradient(90deg, #6b304b 0%, #be123c 50%, #fb7185 88%, #fff1f2 100%); }

    pre {
      background: #030406;
      border: 1px solid var(--line);
      padding: 16px;
      overflow-x: auto;
      color: #bae6fd;
      font-family: var(--font-mono);
      font-size: 12px;
      margin: 16px 0 0;
    }
    .banner {
      background: #19070d;
      border: 1px solid #e11d48;
      color: #fecdd3;
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

  <!-- Top Announcement Bar -->
  <div class="top-ribbon">
    &bull; VALENCE ENGINE v0.5.0: TOPOLOGICAL DAG SCHEDULER, CGROUPS V2 &amp; SMART LOG RECOVERY
    <span onclick="document.getElementById('studio-workspace').scrollIntoView()">OPEN LIVE STUDIO &rarr;</span>
  </div>

  <!-- Sticky Navbar -->
  <div class="navbar-wrap">
    <nav class="navbar">
      <div class="nav-left">
        <a href="#" class="brand">
          <svg width="32" height="25" viewBox="0 0 36 28" fill="none">
            <rect x="0"  y="0"  width="8" height="10" fill="#FFFFFF"/>
            <rect x="28" y="0"  width="8" height="10" fill="#FFFFFF"/>
            <rect x="6"  y="10" width="8" height="9"  fill="#FFFFFF"/>
            <rect x="22" y="10" width="8" height="9"  fill="#FFFFFF"/>
            <rect x="13" y="19" width="10" height="9" fill="#72C7E8"/>
          </svg>
          <span class="brand-name">VALENCE</span>
        </a>
        <div class="nav-links">
          <a href="#wave-reactor">Wave Reactor</a>
          <a href="#studio-workspace">DAG Studio</a>
          <a href="#cluster-telemetry">Telemetry</a>
          <a href="#app-store">1-Click Store</a>
          <a href="http://localhost:3000/api/docs" target="_blank">API Docs</a>
        </div>
      </div>
      <div class="nav-right">
        <span style="color:var(--text-muted); margin-right:6px;">[SYS::ONLINE]</span>
        <button class="btn-white" onclick="triggerHeroDeploy()">Trigger Rollout</button>
        <button class="btn-outline" style="padding:8px 14px;" onclick="window.open('http://localhost:3002/builder/docs', '_blank')">Builder API</button>
      </div>
    </nav>
  </div>

  <div class="container">
    <!-- =================================================================
         1. HERO SECTION: LEFT COPY + RIGHT "TOPOLOGICAL PRODUCTION STAGE"
         ================================================================= -->
    <section class="hero-split">
      <div>
        <div class="bracket-tag">[ DETERMINISTIC CONTAINER ORCHESTRATOR ]</div>
        <h1 class="display-title">EVERY SERVICE<br/>GETS A TOPOLOGY.</h1>
        <p class="hero-sub">
          Valence turns your Git repositories, databases, and game servers into a self-healing directed acyclic graph. Push code—we resolve startup waves, inject encrypted secrets, and enforce Linux cgroups v2 quotas.
        </p>
        <div class="hero-ctas">
          <button class="btn-cyan" onclick="triggerHeroDeploy()">$ valence deploy --dag</button>
          <button class="btn-outline" onclick="document.getElementById('studio-workspace').scrollIntoView()">Open DAG Studio</button>
        </div>
        <div class="cli-hint">&gt;_ Click the <code>$ git push</code> trigger on the right to animate a live wave rollout</div>
      </div>

      <!-- Original Right Panel: Grid Stage + Geometric Signal Tiles + Orthogonal Wire + Production DAG Cards -->
      <div class="hero-stage">
        <!-- Geometric Signal-Stripe Tiles (inspired by Render's barcode blocks, in our Ice Cyan + Amber palette) -->
        <div class="signal-tile top-right">
          <div class="sig-col-left"></div>
          <div class="sig-col-right"></div>
        </div>
        <div class="signal-tile bottom-left">
          <div class="sig-col-right"></div>
          <div class="sig-col-left"></div>
        </div>

        <!-- Floating Trigger Box & 90-degree Orthogonal Wire -->
        <div class="trigger-pill" onclick="triggerHeroDeploy()" title="Click to trigger live DAG wave rollout">
          <span class="trigger-dot"></span>
          <span id="trigger-text">$ git push origin main</span>
        </div>
        <div class="ortho-wire" id="hero-wire"></div>

        <!-- Production Cluster Topology Frame -->
        <div class="prod-frame">
          <div class="prod-header">
            <span>PRODUCTION // DAG WAVE EXECUTION</span>
            <span id="prod-wave-badge" style="color:var(--ice-cyan);">[WAVE 2/2 &bull; HEALTHY]</span>
          </div>

          <div class="prod-grid">
            <!-- Service Card 1: PostgreSQL Primary (Wave #1) -->
            <div class="svc-card" id="card-pg">
              <div class="svc-top">
                <span>&#9638; postgres-primary</span>
                <span class="svc-status" style="color:var(--ice-cyan);">&#10003; Wave #1</span>
              </div>
              <div class="spark-grid">
                <div class="spark-box">
                  <div class="spark-label"><span>MEMORY</span><span style="color:#fff">612MB</span></div>
                  <svg width="100%" height="24" viewBox="0 0 100 24">
                    <polyline points="0,18 20,16 40,19 60,11 80,14 100,8" fill="none" stroke="#72c7e8" stroke-width="1.6"/>
                  </svg>
                </div>
                <div class="spark-box">
                  <div class="spark-label"><span>IOPS</span><span style="color:#fff">1.4K/s</span></div>
                  <svg width="100%" height="24" viewBox="0 0 100 24">
                    <polyline points="0,20 20,14 40,15 60,7 80,12 100,6" fill="none" stroke="#3898bd" stroke-width="1.6"/>
                  </svg>
                </div>
              </div>
              <div class="env-pipe">
                <span>EXPORTS &rarr; api-gateway</span>
                <b>{{HOST}}:5432</b>
              </div>
            </div>

            <!-- Service Card 2: API Gateway (Wave #2 - Blue/Green Rollout) -->
            <div class="svc-card" id="card-api" style="border-color:#2e4559;">
              <div class="svc-top">
                <span>&#9670; api-gateway</span>
                <span class="svc-status" id="api-status-badge" style="color:var(--amber);">&#9684; Blue-Green</span>
              </div>
              <div class="spark-grid">
                <div class="spark-box">
                  <div class="spark-label"><span>MEMORY</span><span style="color:#fff">418MB</span></div>
                  <svg width="100%" height="24" viewBox="0 0 100 24">
                    <polyline points="0,19 20,12 40,16 60,9 80,11 100,5" fill="none" stroke="#f6b86e" stroke-width="1.6"/>
                  </svg>
                </div>
                <div class="spark-box">
                  <div class="spark-label"><span>CPU</span><span style="color:#fff">0.85c</span></div>
                  <svg width="100%" height="24" viewBox="0 0 100 24">
                    <polyline points="0,17 20,18 40,10 60,13 80,6 100,9" fill="none" stroke="#72c7e8" stroke-width="1.6"/>
                  </svg>
                </div>
              </div>
              <div class="env-pipe" style="border-left-color:var(--amber);">
                <span>INJECTED: DATABASE_URL</span>
                <b>AES-256-GCM</b>
              </div>
            </div>

            <!-- Service Card 3: Redis Broker (Wave #1) -->
            <div class="svc-card">
              <div class="svc-top">
                <span>&#9638; redis-telemetry</span>
                <span class="svc-status" style="color:var(--ice-cyan);">&#10003; Wave #1</span>
              </div>
              <div class="spark-grid">
                <div class="spark-box">
                  <div class="spark-label"><span>STORAGE</span><span style="color:#fff">128MB</span></div>
                  <svg width="100%" height="24" viewBox="0 0 100 24">
                    <polyline points="0,16 25,15 50,12 75,13 100,9" fill="none" stroke="#72c7e8" stroke-width="1.6"/>
                  </svg>
                </div>
                <div class="spark-box">
                  <div class="spark-label"><span>SOCKETS</span><span style="color:#fff">84</span></div>
                  <svg width="100%" height="24" viewBox="0 0 100 24">
                    <polyline points="0,20 25,11 50,15 75,8 100,7" fill="none" stroke="#3898bd" stroke-width="1.6"/>
                  </svg>
                </div>
              </div>
            </div>

            <!-- Service Card 4: Edge Proxy & Sablier Wake -->
            <div class="svc-card">
              <div class="svc-top">
                <span>&#9671; traefik-edge</span>
                <span class="svc-status" style="color:#e2e8f0;">99.98% SLA</span>
              </div>
              <div class="spark-box" style="width:100%;">
                <div class="spark-label"><span>INGRESS THROUGHPUT (SABLIER WAKE)</span><span style="color:var(--ice-cyan)">2.8 GB/s</span></div>
                <svg width="100%" height="24" viewBox="0 0 200 24">
                  <polyline points="0,19 30,17 60,11 90,15 120,7 150,12 180,5 200,8" fill="none" stroke="#72c7e8" stroke-width="1.6"/>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- =================================================================
         2. ORIGINAL ARCHITECTURE VISUALIZER: "TOPOLOGICAL WAVE & KERNEL REACTOR"
         (Replaces the copied 3-slab graphic with an original interactive blueprint!)
         ================================================================= -->
    <section id="wave-reactor" class="reactor-section">
      <div class="bracket-tag">[ TOPOLOGICAL EXECUTION ENGINE ]</div>
      <h2 class="display-title" style="font-size:38px; max-width:780px;">
        THREE EXECUTION WAVES.<br/>ZERO RACE CONDITIONS.
      </h2>
      <p class="cell-desc" style="max-width:640px;">
        Instead of starting containers blindly at the same time, Valence computes Kahn's topological sort across your project graph, injects internal DNS hostnames, and locks each process inside a Linux cgroups v2 slice.
      </p>

      <div class="reactor-grid">
        <!-- Left Side: Original Interactive Orthogonal Wave Matrix & Kernel Telemetry Blueprint -->
        <div class="reactor-visual">
          <div style="display:flex; justify-content:space-between; font-family:var(--font-mono); font-size:11px; color:var(--text-muted); border-bottom:1px solid var(--line); padding-bottom:10px;">
            <span>SCHEMATIC // KAHN'S DAG WAVE RESOLVER</span>
            <span id="reactor-active-label" style="color:var(--ice-cyan);">ACTIVE INSPECTION: WAVE 01 — STATEFUL STORAGE</span>
          </div>

          <svg width="100%" height="290" viewBox="0 0 660 290" fill="none" style="margin:14px 0;">
            <!-- Background Coordinate Blueprint Grid -->
            <line x1="110" y1="20" x2="110" y2="270" stroke="#151b24" stroke-width="1" stroke-dasharray="4 4"/>
            <line x1="330" y1="20" x2="330" y2="270" stroke="#151b24" stroke-width="1" stroke-dasharray="4 4"/>
            <line x1="550" y1="20" x2="550" y2="270" stroke="#151b24" stroke-width="1" stroke-dasharray="4 4"/>

            <!-- Column Headers -->
            <text x="110" y="18" fill="#64748b" font-family="monospace" font-size="10" text-anchor="middle">WAVE 01 // IN-DEGREE: 0</text>
            <text x="330" y="18" fill="#64748b" font-family="monospace" font-size="10" text-anchor="middle">WAVE 02 // IN-DEGREE: 2</text>
            <text x="550" y="18" fill="#64748b" font-family="monospace" font-size="10" text-anchor="middle">WAVE 03 // EDGE INGRESS</text>

            <!-- Orthogonal Dependency Pipes between Waves -->
            <path d="M185 85 L235 85 L235 135 L255 135" stroke="#72c7e8" stroke-width="2" fill="none"/>
            <path d="M185 205 L235 205 L235 155 L255 155" stroke="#72c7e8" stroke-width="2" fill="none"/>
            <path d="M405 145 L475 145" stroke="#f6b86e" stroke-width="2" stroke-dasharray="5 3" fill="none"/>

            <!-- Env Injection Badges on the Pipes -->
            <rect x="195" y="62" width="76" height="16" fill="#0b131c" stroke="#3898bd" stroke-width="1"/>
            <text x="233" y="73" fill="#72c7e8" font-family="monospace" font-size="8.5" text-anchor="middle">DATABASE_URL</text>

            <rect x="195" y="212" width="76" height="16" fill="#0b131c" stroke="#3898bd" stroke-width="1"/>
            <text x="233" y="223" fill="#72c7e8" font-family="monospace" font-size="8.5" text-anchor="middle">BROKER_URL</text>

            <!-- WAVE 01 NODES (Postgres & RabbitMQ) -->
            <g id="svg-wave-1">
              <rect x="35" y="52" width="150" height="66" fill="#0c1219" stroke="#72c7e8" stroke-width="1.8"/>
              <rect x="35" y="52" width="6" height="66" fill="#72c7e8"/>
              <text x="52" y="74" fill="#ffffff" font-family="monospace" font-size="11" font-weight="bold">svc-postgres-16</text>
              <text x="52" y="90" fill="#8a94a6" font-family="monospace" font-size="9.5">cgroups: 1024MB / 1.0c</text>
              <text x="52" y="106" fill="#72c7e8" font-family="monospace" font-size="9">STATUS: READY FIRST</text>

              <rect x="35" y="172" width="150" height="66" fill="#0c1219" stroke="#72c7e8" stroke-width="1.8"/>
              <rect x="35" y="172" width="6" height="66" fill="#72c7e8"/>
              <text x="52" y="194" fill="#ffffff" font-family="monospace" font-size="11" font-weight="bold">svc-rabbitmq-3</text>
              <text x="52" y="210" fill="#8a94a6" font-family="monospace" font-size="9.5">cgroups: 512MB / 0.5c</text>
              <text x="52" y="226" fill="#72c7e8" font-family="monospace" font-size="9">STATUS: READY FIRST</text>
            </g>

            <!-- WAVE 02 NODE (Central NestJS API Core) -->
            <g id="svg-wave-2">
              <rect x="255" y="102" width="150" height="86" fill="#101722" stroke="#ffffff" stroke-width="1.8"/>
              <rect x="255" y="102" width="6" height="86" fill="#f6b86e"/>
              <text x="272" y="126" fill="#ffffff" font-family="monospace" font-size="11" font-weight="bold">svc-api-backend</text>
              <text x="272" y="143" fill="#8a94a6" font-family="monospace" font-size="9.5">Nixpacks OCI Image</text>
              <text x="272" y="159" fill="#f6b86e" font-family="monospace" font-size="9">Vault: AES-256-GCM</text>
              <text x="272" y="175" fill="#e2e8f0" font-family="monospace" font-size="9">PidsLimit: 512</text>
            </g>

            <!-- WAVE 03 NODE (Traefik v3 + Sablier Edge) -->
            <g id="svg-wave-3">
              <rect x="475" y="102" width="150" height="86" fill="#0c1219" stroke="#3898bd" stroke-width="1.5"/>
              <rect x="475" y="102" width="6" height="86" fill="#3898bd"/>
              <text x="492" y="126" fill="#ffffff" font-family="monospace" font-size="11" font-weight="bold">traefik-v3-edge</text>
              <text x="492" y="143" fill="#8a94a6" font-family="monospace" font-size="9.5">Host(api.paas.local)</text>
              <text x="492" y="159" fill="#72c7e8" font-family="monospace" font-size="9">Sablier Auto-Wake: ON</text>
              <text x="492" y="175" fill="#8a94a6" font-family="monospace" font-size="9">Blue-Green Cutover</text>
            </g>
          </svg>

          <!-- Bottom Telemetry Strip inside Schematic -->
          <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:12px; border-top:1px solid var(--line); padding-top:12px; font-family:var(--font-mono); font-size:10.5px;">
            <div><span style="color:var(--text-muted)">CYCLE CHECK:</span> <b style="color:var(--ice-cyan)">ACYCLIC (VALID)</b></div>
            <div><span style="color:var(--text-muted)">KERNEL QUOTA:</span> <b style="color:#fff">NANO_CPUS + PIDS</b></div>
            <div><span style="color:var(--text-muted)">VAULT CIPHER:</span> <b style="color:var(--amber)">IV:TAG:PAYLOAD</b></div>
          </div>
        </div>

        <!-- Right Side: Interactive Wave Inspector Steps -->
        <div class="reactor-controls">
          <div class="wave-step active" onclick="selectWaveStep(this, 'WAVE 01 — STATEFUL STORAGE (IN-DEGREE 0)')">
            <div class="wave-num">WAVE 01 // ZERO DEPENDENCIES</div>
            <h3 class="cell-title">Stateful Databases &amp; Brokers</h3>
            <p class="cell-desc">
              Kahn's algorithm identifies nodes with <code>inDegree === 0</code> (PostgreSQL, Redis, RabbitMQ) and boots them first on isolated bridge networks.
            </p>
          </div>

          <div class="wave-step" onclick="selectWaveStep(this, 'WAVE 02 — APPLICATION COMPUTE & ENV INJECTION')">
            <div class="wave-num">WAVE 02 // DYNAMIC DNS &amp; VAULT INJECTION</div>
            <h3 class="cell-title">Nixpacks Build &amp; Secret Decryption</h3>
            <p class="cell-desc">
              Once Wave 01 passes health checks, Valence interpolates <code>{{HOST}}</code> into <code>DATABASE_URL</code>, decrypts AES-256-GCM variables, and starts compute containers.
            </p>
          </div>

          <div class="wave-step" onclick="selectWaveStep(this, 'WAVE 03 — ZERO-DOWNTIME BLUE-GREEN EDGE CUTOVER')">
            <div class="wave-num">WAVE 03 // EDGE ROUTING &amp; HIBERNATION</div>
            <h3 class="cell-title">Traefik v3 Cutover &amp; Sablier Scale-to-Zero</h3>
            <p class="cell-desc">
              Traffic switches from the Blue container to the Green container only after HTTP readiness, with automatic idle hibernation via Sablier labels.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- =================================================================
         3. INTERACTIVE STUDIO WORKSPACE (BENTO GRID + LIVE ACTIONS)
         ================================================================= -->
    <div id="studio-workspace" style="padding-top:56px;">
      <div class="bracket-tag">[ INTERACTIVE STUDIO &bull; DAG PIPELINE &amp; LIFECYCLE ]</div>
      <div class="bento-box">
        <div class="bento-row-3">
          <div class="bento-cell">
            <div>
              <h3 class="cell-title">Cgroups v2 Isolation</h3>
              <p class="cell-desc">Hard kernel quotas for container memory, NanoCPUs, and PID limits per project bridge network.</p>
            </div>
          </div>
          <div class="bento-cell">
            <div>
              <h3 class="cell-title">Smart Log Diagnostics</h3>
              <p class="cell-desc">Real-time stderr stream classification for OOM kills, port conflicts, and auth failures.</p>
            </div>
          </div>
          <div class="bento-cell">
            <div>
              <h3 class="cell-title">AES-256-GCM Secret Vault</h3>
              <p class="cell-desc">Encrypted environment variables at rest with per-record initialization vectors and auth tags.</p>
            </div>
          </div>
        </div>

        <div class="bento-full">
          <div style="display:flex; justify-content:space-between; align-items:flex-end;">
            <div>
              <h3 class="cell-title">Interactive DAG Topological Planner</h3>
              <p class="cell-desc">Test coordinate grid snapping (20px), automatic DATABASE_URL / BROKER_URL injection, and isolated node detection.</p>
            </div>
            <div>
              <button class="btn-outline" onclick="runCanvasTest('DBAAS')">Link Postgres &rarr; API</button>
              <button class="btn-outline" onclick="runCanvasTest('MESSAGE_BROKER')">Link Broker &rarr; Worker</button>
            </div>
          </div>
          <pre id="canvas-out" style="display:none;"></pre>
        </div>
      </div>
    </div>

    <!-- Section 4: Cluster Telemetry Bento Grid -->
    <div id="cluster-telemetry" class="bracket-tag" style="margin-top:48px;">[ CLUSTER TELEMETRY &bull; CRYO-TO-PLASMA SPECTRUM ]</div>
    <div class="bento-box">
      <div id="nodes-grid" class="bento-row-3">Loading cluster telemetry...</div>
    </div>

    <!-- Section 5: 1-Click App Store Bento Grid -->
    <div id="app-store" class="bracket-tag" style="margin-top:48px;">[ DEPLOYMENT &bull; 1-CLICK APP STORE ]</div>
    <div class="bento-box">
      <div id="store-grid" class="bento-row-4">Loading store templates...</div>
      <div id="spec-wrap" class="bento-full" style="display:none;">
        <div class="cell-title">Generated ContainerDeploySpec</div>
        <pre id="spec-preview"></pre>
      </div>
    </div>

    <!-- Section 6: Smart Log Terminal Bento Block -->
    <div id="observability-sec" class="bracket-tag" style="margin-top:48px;">[ OBSERVABILITY &bull; SMART LOG 1-CLICK RECOVERY ]</div>
    <div class="bento-box">
      <div class="bento-full">
        <div id="term-banner" class="banner" style="display:none;"></div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <h3 class="cell-title">Runtime Anomaly Classifier</h3>
            <p class="cell-desc">Simulate container stderr crashes to test automated recovery actions.</p>
          </div>
          <div>
            <button class="btn-outline" onclick="runTerminalCrash('INCREASE_MEMORY', 'OOM_KILLED', 'Container exceeded RAM quota (exit 137)')">OOM (Exit 137)</button>
            <button class="btn-outline" onclick="runTerminalCrash('REALLOCATE_PORT', 'PORT_IN_USE', 'Error: listen EADDRINUSE :::3000')">Port Conflict</button>
            <button class="btn-outline" onclick="runTerminalCrash('SYNC_DB_CREDENTIALS', 'DB_AUTH_FAILED', 'FATAL: password authentication failed')">DB Auth Error</button>
          </div>
        </div>
        <pre id="term-out">Waiting for container stderr events...</pre>
      </div>
    </div>
  </div>

  <script>
    // Animated Topographic Dither / Hatch Matrix Background
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
        ctx.fillStyle = '#040507';
        ctx.fillRect(0, 0, width, height);

        for (let y = 0; y < height; y += cell) {
          for (let x = 0; x < width; x += cell) {
            const val = field(x, y, time);
            if (val < 0.38) {
              continue;
            } else if (val < 0.50) {
              ctx.strokeStyle = 'rgba(92, 125, 153, 0.19)';
              ctx.beginPath();
              ctx.moveTo(x, y + cell);
              ctx.lineTo(x + cell, y);
              ctx.stroke();
            } else if (val < 0.68) {
              ctx.fillStyle = 'rgba(110, 193, 228, 0.14)';
              ctx.fillRect(x + 2, y + 2, 1.5, 1.5);
            } else {
              ctx.fillStyle = 'rgba(114, 199, 232, 0.24)';
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

    function triggerHeroDeploy() {
      const badge = document.getElementById('prod-wave-badge');
      const apiBadge = document.getElementById('api-status-badge');
      const triggerText = document.getElementById('trigger-text');
      triggerText.textContent = '$ valence deploy [RUNNING...]';
      badge.textContent = '[WAVE 1/2 • BOOTING DBs]';
      badge.style.color = '#f6b86e';
      apiBadge.textContent = '◌ Building Nixpacks...';

      setTimeout(() => {
        badge.textContent = '[WAVE 2/2 • GREEN HEALTHY]';
        badge.style.color = '#72c7e8';
        apiBadge.textContent = '✓ Active (Green)';
        apiBadge.style.color = '#72c7e8';
        triggerText.textContent = '$ git push origin main';
      }, 1200);
    }

    function selectWaveStep(el, label) {
      document.querySelectorAll('.wave-step').forEach(s => s.classList.remove('active'));
      el.classList.add('active');
      document.getElementById('reactor-active-label').textContent = 'ACTIVE INSPECTION: ' + label;
    }

    async function loadDashboard() {
      const nodesRes = await fetch('/client/telemetry');
      const nodesData = await nodesRes.json();
      const stateLabels = {
        healthy: 'CRYO // NOMINAL',
        warning: 'IONIZED // ELEVATED',
        critical: 'PLASMA // SATURATED'
      };
      document.getElementById('nodes-grid').innerHTML = nodesData.cards.map(c => \`
        <div class="bento-cell">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <h3 class="cell-title" style="margin:0;">\${c.hostname}</h3>
              <span class="sev-\${c.severity}">\${stateLabels[c.severity]}</span>
            </div>
            <p class="cell-desc">Node ID: <code>\${c.nodeId}</code></p>
            <div class="bar-bg"><div class="bar-fill bar-\${c.severity}" style="width:\${c.memoryUsagePercent}%"></div></div>
          </div>
          <div class="cell-meta">
            <span>RAM SATURATION</span>
            <span style="color:#fff; font-weight:700;">\${c.memoryUsagePercent}%</span>
          </div>
        </div>
      \`).join('');

      const storeRes = await fetch('/client/store/templates');
      const storeData = await storeRes.json();
      document.getElementById('store-grid').innerHTML = storeData.templates.map(t => \`
        <div class="bento-cell">
          <div>
            <h3 class="cell-title">\${t.name}</h3>
            <p class="cell-desc">Preconfigured \${t.category} container (\${t.defaultMemoryMb} MB RAM, \${t.defaultCpuCores} CPU).</p>
          </div>
          <div class="cell-meta">
            <span><code>\${t.image}</code></span>
            <button class="btn-outline" style="padding:5px 10px; font-size:10.5px;" onclick="deployTemplate('\${t.id}')">Deploy</button>
          </div>
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
      const out = document.getElementById('canvas-out');
      out.style.display = 'block';
      out.textContent = JSON.stringify(data, null, 2);
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
      bannerEl.innerHTML = \`<span>\${data.bannerText}</span><button class="btn-white" onclick="alert('Triggered ' + '\${data.action.apiEndpoint}')">\${data.action.buttonLabel}</button>\`;
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
      document.getElementById('spec-wrap').style.display = 'block';
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
