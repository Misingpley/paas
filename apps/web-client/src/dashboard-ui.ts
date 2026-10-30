export const dashboardConsoleHtml = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <title>VALENCE // Control Panel & Server Manager</title>
  <style>
    :root {
      --bg-petrol: #060c12;
      --bg-cell: rgba(8, 16, 24, 0.97);
      --bg-cell-hover: rgba(13, 25, 36, 0.99);
      --line: #253d4f;
      --line-bright: #3d6480;
      --ice-cyan: #82ccf0;
      --amber: #f6b86e;
      --plasma: #fb7185;
      --emerald: #34d399;
      --paper-white: #edf5fa;
      --text-body: #b8cedc;
      --text-muted: #8aa6ba;
      --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      --font-serif: 'Georgia', 'Times New Roman', Times, serif;
    }
    * { box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg-petrol);
      color: var(--paper-white);
      margin: 0;
      padding: 0;
      overflow-x: hidden;
    }
    body::before {
      content: '';
      position: fixed;
      inset: 0;
      background:
        radial-gradient(circle at 50% 45%, transparent 65%, rgba(2, 6, 10, 0.32) 100%),
        repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.10) 0px, rgba(0, 0, 0, 0.10) 1px, transparent 1px, transparent 3px);
      pointer-events: none;
      z-index: 98;
    }
    #topo-canvas {
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      z-index: 0;
      pointer-events: none;
    }
    .top-ribbon {
      position: relative;
      z-index: 10;
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
    .navbar-wrap {
      position: sticky;
      top: 0;
      z-index: 15;
      background: rgba(6, 12, 18, 0.96);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--line-bright);
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.65);
    }
    .navbar {
      max-width: 1320px;
      margin: 0 auto;
      height: 62px;
      padding: 0 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
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
    .lang-switch {
      display: inline-flex;
      border: 1px solid var(--line-bright);
      background: #07111a;
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
    }
    .lang-btn:last-child { border-right: none; }
    .lang-btn.active { background: var(--ice-cyan); color: #04080b; }

    .btn-cyan {
      background: var(--ice-cyan);
      color: #04080b;
      border: 1px solid var(--ice-cyan);
      padding: 9px 16px;
      font-family: var(--font-mono);
      font-size: 11.5px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      cursor: pointer;
    }
    .btn-cyan:hover { background: #b4e4fc; }
    .btn-outline {
      background: #0a151f;
      color: var(--paper-white);
      border: 1px solid var(--line-bright);
      padding: 8px 14px;
      font-family: var(--font-mono);
      font-size: 11px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      cursor: pointer;
    }
    .btn-outline:hover { border-color: var(--ice-cyan); color: var(--ice-cyan); }

    /* Workspace Layout */
    .workspace-shell {
      position: relative;
      z-index: 5;
      max-width: 1320px;
      margin: 28px auto 80px;
      padding: 0 24px;
      display: grid;
      grid-template-columns: 260px 1fr;
      gap: 24px;
      align-items: start;
    }
    .sidebar {
      background: var(--bg-cell);
      border: 1px solid var(--line-bright);
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.8);
    }
    .user-box {
      padding: 18px;
      border-bottom: 1px solid var(--line-bright);
      background: #091722;
    }
    .user-role {
      display: inline-block;
      background: rgba(130, 204, 240, 0.16);
      border: 1px solid var(--ice-cyan);
      color: var(--ice-cyan);
      font-family: var(--font-mono);
      font-size: 10px;
      padding: 2px 7px;
      margin-bottom: 6px;
    }
    .side-nav-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 15px 18px;
      border-bottom: 1px solid var(--line);
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--text-body);
      cursor: pointer;
      transition: all 0.15s;
    }
    .side-nav-item:hover {
      background: rgba(130, 204, 240, 0.08);
      color: #fff;
    }
    .side-nav-item.active {
      background: rgba(130, 204, 240, 0.14);
      border-left: 4px solid var(--ice-cyan);
      color: #fff;
      font-weight: 700;
    }

    .panel-box {
      background: var(--bg-cell);
      border: 1px solid var(--line-bright);
      box-shadow: 0 18px 46px rgba(0, 0, 0, 0.82);
      padding: 26px;
      margin-bottom: 24px;
    }
    .panel-hdr {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--line-bright);
      padding-bottom: 14px;
      margin-bottom: 20px;
    }
    .panel-title {
      font-family: var(--font-serif);
      font-size: 24px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin: 0;
    }
    .form-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 14px;
      margin-bottom: 16px;
    }
    .field-label {
      display: block;
      font-family: var(--font-mono);
      font-size: 10.5px;
      color: var(--ice-cyan);
      margin-bottom: 6px;
      text-transform: uppercase;
    }
    .input-ctrl {
      width: 100%;
      background: #050c12;
      border: 1px solid var(--line-bright);
      color: #fff;
      padding: 9px 12px;
      font-family: var(--font-mono);
      font-size: 12.5px;
    }
    .input-ctrl:focus {
      outline: none;
      border-color: var(--ice-cyan);
    }

    .cards-grid-3 {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }
    .cards-grid-2 {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }
    .item-card {
      background: #0a1620;
      border: 1px solid var(--line-bright);
      padding: 18px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .bar-bg {
      position: relative;
      background: #0d1a26;
      border: 1px solid var(--line-bright);
      height: 10px;
      margin-top: 10px;
    }
    .bar-fill { height: 100%; transition: width 0.3s; }
    .bar-healthy { background: linear-gradient(90deg, #1e4e68 0%, #3b9ec4 60%, #8be0ff 100%); }
    .bar-warning { background: linear-gradient(90deg, #2b7a9b 0%, #8c7853 45%, #e5993c 88%, #ffd18c 100%); }
    .bar-critical { background: linear-gradient(90deg, #6b304b 0%, #be123c 50%, #fb7185 88%, #fff1f2 100%); }

    .tab-pane { display: none; }
    .tab-pane.active { display: block; }
    pre {
      background: #04090e;
      border: 1px solid var(--line-bright);
      padding: 14px;
      color: #c8ebfc;
      font-family: var(--font-mono);
      font-size: 12px;
      overflow-x: auto;
    }
  </style>
</head>
<body>
  <canvas id="topo-canvas"></canvas>

  <div class="top-ribbon">
    <div>
      <span>VALENCE WORKSPACE // CONTROL PANEL (v1.0.0)</span>
    </div>
    <div>
      <span id="session-token-badge" style="color:var(--amber); margin-right:16px;">SESSION: ACTIVE</span>
      <span style="cursor:pointer; text-decoration:underline;" onclick="window.location.href='/client/docs'">[&larr; НА ГЛАВНУЮ / SHOWCASE]</span>
    </div>
  </div>

  <div class="navbar-wrap">
    <nav class="navbar">
      <a href="/client/docs" class="brand">
        <svg width="32" height="25" viewBox="0 0 36 28" fill="none">
          <rect x="0"  y="0"  width="8" height="10" fill="#EDF5FA"/>
          <rect x="28" y="0"  width="8" height="10" fill="#EDF5FA"/>
          <rect x="6"  y="10" width="8" height="9"  fill="#EDF5FA"/>
          <rect x="22" y="10" width="8" height="9"  fill="#EDF5FA"/>
          <rect x="13" y="19" width="10" height="9" fill="#82CCF0"/>
        </svg>
        <span class="brand-name">VALENCE // STUDIO</span>
      </a>

      <div style="display:flex; align-items:center; gap:12px;">
        <div class="lang-switch">
          <button class="lang-btn active" id="lang-ru" onclick="setDashLang('ru')">RU</button>
          <button class="lang-btn" id="lang-uk" onclick="setDashLang('uk')">UA</button>
          <button class="lang-btn" id="lang-en" onclick="setDashLang('en')">EN</button>
        </div>
        <button class="btn-outline" onclick="logoutSession()" data-i18n="btn_logout">Выйти</button>
      </div>
    </nav>
  </div>

  <div class="workspace-shell">
    <!-- Left Navigation Sidebar -->
    <aside class="sidebar">
      <div class="user-box">
        <div class="user-role" id="user-role-label">OWNER // ADMIN</div>
        <div style="font-family:var(--font-mono); font-size:13px; font-weight:700; color:#fff; word-break:break-all;" id="user-email-label">admin@valence.local</div>
        <div style="font-size:11.5px; color:var(--text-muted); margin-top:4px;" data-i18n="side_status">Полный доступ к кластеру</div>
      </div>

      <div class="side-nav-item active" onclick="switchTab('servers', this)">
        <span data-i18n="tab_servers">01 // Мои серверы</span>
        <span id="count-servers" style="color:var(--ice-cyan)">3</span>
      </div>
      <div class="side-nav-item" onclick="switchTab('services', this)">
        <span data-i18n="tab_services">02 // Приложения</span>
        <span id="count-services" style="color:var(--amber)">4</span>
      </div>
      <div class="side-nav-item" onclick="switchTab('vault', this)">
        <span data-i18n="tab_vault">03 // Пароли и S3 Бэкапы</span>
        <span>AES</span>
      </div>
      <div class="side-nav-item" onclick="switchTab('logs', this)">
        <span data-i18n="tab_logs">04 // Логи и Диагностика</span>
        <span style="color:var(--plasma)">LIVE</span>
      </div>
    </aside>

    <!-- Main Interactive Workspace -->
    <main>
      <!-- TAB 1: SERVERS MANAGEMENT -->
      <div id="pane-servers" class="tab-pane active">
        <div class="panel-box">
          <div class="panel-hdr">
            <div>
              <h2 class="panel-title" data-i18n="srv_add_title">Подключить новый сервер (VPS / Linux)</h2>
              <div style="font-size:13px; color:var(--text-body); margin-top:4px;" data-i18n="srv_add_sub">Добавьте ваш Linux-сервер в кластер для размещения сайтов, баз данных и игровых серверов.</div>
            </div>
          </div>
          <div class="form-grid">
            <div>
              <label class="field-label" data-i18n="lbl_hostname">Имя сервера (Hostname)</label>
              <input class="input-ctrl" id="in-srv-host" value="kyiv-worker-04" />
            </div>
            <div>
              <label class="field-label" data-i18n="lbl_ip">IP-адрес узла</label>
              <input class="input-ctrl" id="in-srv-ip" value="185.44.12.90" />
            </div>
            <div>
              <label class="field-label" data-i18n="lbl_ram">Объем ОЗУ (MB)</label>
              <select class="input-ctrl" id="in-srv-ram">
                <option value="8192">8 192 MB (8 GB)</option>
                <option value="16384" selected>16 384 MB (16 GB)</option>
                <option value="32768">32 768 MB (32 GB)</option>
                <option value="65536">65 536 MB (64 GB)</option>
              </select>
            </div>
            <div>
              <label class="field-label" data-i18n="lbl_cpu">Ядра процессора (CPU)</label>
              <select class="input-ctrl" id="in-srv-cpu">
                <option value="4">4 vCPU</option>
                <option value="8" selected>8 vCPU</option>
                <option value="16">16 vCPU</option>
              </select>
            </div>
          </div>
          <button class="btn-cyan" onclick="addServerNode()" data-i18n="btn_add_srv">+ Подключить сервер к платформе</button>
        </div>

        <div class="panel-box">
          <div class="panel-hdr">
            <h2 class="panel-title" data-i18n="srv_list_title">Активные серверы кластера</h2>
            <span style="font-family:var(--font-mono); font-size:11px; color:var(--ice-cyan);">DOCKER ENGINE API // ONLINE</span>
          </div>
          <div id="dash-servers-grid" class="cards-grid-3"></div>
        </div>
      </div>

      <!-- TAB 2: SERVICES & CONTAINERS DEPLOYMENT -->
      <div id="pane-services" class="tab-pane">
        <div class="panel-box">
          <div class="panel-hdr">
            <div>
              <h2 class="panel-title" data-i18n="app_add_title">Создать и запустить приложение</h2>
              <div style="font-size:13px; color:var(--text-body); margin-top:4px;" data-i18n="app_add_sub">Разверните код из GitHub или готовый шаблон базы данных / игрового сервера в 1 клик.</div>
            </div>
          </div>
          <div class="form-grid">
            <div>
              <label class="field-label" data-i18n="lbl_app_name">Название сервиса</label>
              <input class="input-ctrl" id="in-app-name" value="shop-backend-api" />
            </div>
            <div>
              <label class="field-label" data-i18n="lbl_app_type">Источник / Шаблон</label>
              <select class="input-ctrl" id="in-app-image">
                <option value="github:nixpacks/node:22">GitHub Repo (Auto-Build Nixpacks)</option>
                <option value="postgres:16-alpine">PostgreSQL 16 (Database)</option>
                <option value="redis:7-alpine">Redis 7 (Cache &amp; Queue)</option>
                <option value="itzg/minecraft-server:java21">Minecraft Java Server (Game)</option>
                <option value="nextcloud:29-apache">Nextcloud Private Cloud</option>
              </select>
            </div>
            <div>
              <label class="field-label" data-i18n="lbl_app_ram">Лимит памяти (MB)</label>
              <select class="input-ctrl" id="in-app-ram">
                <option value="512">512 MB</option>
                <option value="1024" selected>1 024 MB (1 GB)</option>
                <option value="2048">2 048 MB (2 GB)</option>
                <option value="4096">4 096 MB (4 GB)</option>
              </select>
            </div>
            <div>
              <label class="field-label" data-i18n="lbl_app_domain">Домен или порт</label>
              <input class="input-ctrl" id="in-app-domain" value="shop.paas.local" />
            </div>
          </div>
          <button class="btn-cyan" onclick="deployNewService()" data-i18n="btn_deploy_app">$ Запустить контейнер</button>
        </div>

        <div class="panel-box">
          <div class="panel-hdr">
            <h2 class="panel-title" data-i18n="app_list_title">Запущенные контейнеры и сервисы</h2>
            <span style="font-family:var(--font-mono); font-size:11px; color:var(--amber);">ZERO-DOWNTIME BLUE-GREEN</span>
          </div>
          <div id="dash-services-grid" class="cards-grid-2"></div>
        </div>
      </div>

      <!-- TAB 3: VAULT & S3 BACKUPS -->
      <div id="pane-vault" class="tab-pane">
        <div class="panel-box">
          <div class="panel-hdr">
            <div>
              <h2 class="panel-title" data-i18n="vault_title">Защищенное хранилище паролей (Secret Vault)</h2>
              <div style="font-size:13px; color:var(--text-body); margin-top:4px;" data-i18n="vault_sub">Пароли от баз данных и API-ключи шифруются перед сохранением и передаются контейнерам при старте.</div>
            </div>
          </div>
          <div class="form-grid" style="grid-template-columns: 1fr 1fr auto;">
            <div>
              <label class="field-label">Имя переменной (KEY)</label>
              <input class="input-ctrl" id="in-sec-key" value="DATABASE_PASSWORD" />
            </div>
            <div>
              <label class="field-label">Значение (SECRET VALUE)</label>
              <input class="input-ctrl" id="in-sec-val" value="super_secret_prod_2026" />
            </div>
            <div style="display:flex; align-items:flex-end;">
              <button class="btn-cyan" onclick="saveEncryptedSecret()" data-i18n="btn_save_sec">Зашифровать и сохранить</button>
            </div>
          </div>
          <pre id="vault-out">Нажмите «Зашифровать и сохранить» для генерации криптографического контейнера AES-256-GCM...</pre>
        </div>

        <div class="panel-box">
          <div class="panel-hdr">
            <div>
              <h2 class="panel-title" data-i18n="backup_title">Резервные копии томов (S3 / MinIO Snapshots)</h2>
              <div style="font-size:13px; color:var(--text-body); margin-top:4px;" data-i18n="backup_sub">Создание архива данных контейнера и автоматическая очистка старых копий.</div>
            </div>
            <button class="btn-cyan" onclick="triggerS3Backup()" data-i18n="btn_create_backup">+ Создать S3-бэкап</button>
          </div>
          <pre id="backup-out">Нажмите «+ Создать S3-бэкап» для архивации тома базы данных...</pre>
        </div>
      </div>

      <!-- TAB 4: SMART LOGS & CRASH RECOVERY -->
      <div id="pane-logs" class="tab-pane">
        <div class="panel-box">
          <div class="panel-hdr">
            <div>
              <h2 class="panel-title" data-i18n="logs_title">Живой терминал и авто-исправление сбоев в 1 клик</h2>
              <div style="font-size:13px; color:var(--text-body); margin-top:4px;" data-i18n="logs_sub">Выберите тип сбоя для проверки автоматического анализатора логов и быстрого восстановления.</div>
            </div>
            <div style="display:flex; gap:8px;">
              <button class="btn-outline" onclick="simulateDashCrash('INCREASE_MEMORY', 'OOM_KILLED', 'Container exceeded RAM limit (exit 137)')">OOM (+50% ОЗУ)</button>
              <button class="btn-outline" onclick="simulateDashCrash('REALLOCATE_PORT', 'PORT_IN_USE', 'Error: listen EADDRINUSE :::3000')">Конфликт порта</button>
              <button class="btn-outline" onclick="simulateDashCrash('SYNC_DB_CREDENTIALS', 'DB_AUTH_FAILED', 'FATAL: password authentication failed')">Пароль БД</button>
            </div>
          </div>
          <div id="dash-crash-banner" style="display:none; background:#210911; border:1px solid #fb7185; padding:14px 18px; margin-bottom:14px; justify-content:space-between; align-items:center; font-family:var(--font-mono); font-size:12.5px;"></div>
          <pre id="dash-logs-out">[04:19:12] INFO  host-agent: Monitoring container stdout/stderr streams...
[04:19:14] INFO  postgres-16: database system is ready to accept connections (port 5432)
[04:19:15] INFO  api-gateway: Connected to postgres-16, listening on https://api.paas.local</pre>
        </div>
      </div>
    </main>
  </div>

  <script>
    (function initTopoCanvas() {
      const canvas = document.getElementById('topo-canvas');
      const ctx = canvas.getContext('2d');
      let width = 0, height = 0, time = 0;
      const cell = 6;
      function resize() { width = canvas.width = window.innerWidth; height = canvas.height = window.innerHeight; }
      window.addEventListener('resize', resize);
      resize();
      function render() {
        ctx.fillStyle = '#060c12';
        ctx.fillRect(0, 0, width, height);
        for (let y = 0; y < height; y += cell) {
          for (let x = 0; x < width; x += cell) {
            const nx = x * 0.0028, ny = y * 0.0028;
            const val = (Math.sin(nx * 1.7 + ny * 1.3 + time) + Math.cos(nx * 1.4 - ny * 1.6 - time * 0.7) * 0.6 + 2.0) / 3.6;
            if (val > 0.56) {
              ctx.fillStyle = 'rgba(130, 204, 240, 0.14)';
              ctx.fillRect(x + 2, y + 2, 1.5, 1.5);
            }
          }
        }
        time += 0.005;
        requestAnimationFrame(render);
      }
      render();
    })();

    const dashDict = {
      ru: {
        btn_logout: 'Выйти',
        side_status: 'Полный доступ к кластеру',
        tab_servers: '01 // Мои серверы',
        tab_services: '02 // Приложения',
        tab_vault: '03 // Пароли и Бэкапы',
        tab_logs: '04 // Логи и Сбои',
        srv_add_title: 'Подключить новый сервер (VPS / Linux)',
        srv_add_sub: 'Добавьте ваш Linux-сервер в кластер для размещения сайтов, баз данных и игровых серверов.',
        lbl_hostname: 'Имя сервера (Hostname)',
        lbl_ip: 'IP-адрес узла',
        lbl_ram: 'Объем ОЗУ (MB)',
        lbl_cpu: 'Ядра процессора (CPU)',
        btn_add_srv: '+ Подключить сервер к платформе',
        srv_list_title: 'Активные серверы кластера',
        app_add_title: 'Создать и запустить приложение',
        app_add_sub: 'Разверните код из GitHub или готовый шаблон базы данных / игрового сервера в 1 клик.',
        lbl_app_name: 'Название сервиса',
        lbl_app_type: 'Источник / Шаблон',
        lbl_app_ram: 'Лимит памяти (MB)',
        lbl_app_domain: 'Домен или порт',
        btn_deploy_app: '$ Запустить контейнер',
        app_list_title: 'Запущенные контейнеры и сервисы',
        vault_title: 'Защищенное хранилище паролей (Secret Vault)',
        vault_sub: 'Пароли от баз данных и API-ключи шифруются перед сохранением и передаются контейнерам при старте.',
        btn_save_sec: 'Зашифровать и сохранить',
        backup_title: 'Резервные копии томов (S3 / MinIO Snapshots)',
        backup_sub: 'Создание архива данных контейнера и автоматическая очистка старых копий.',
        btn_create_backup: '+ Создать S3-бэкап',
        logs_title: 'Живой терминал и авто-исправление сбоев в 1 клик',
        logs_sub: 'Выберите тип сбоя для проверки автоматического анализатора логов и быстрого восстановления.'
      },
      uk: {
        btn_logout: 'Вийти',
        side_status: 'Повний доступ до кластера',
        tab_servers: '01 // Мої сервери',
        tab_services: '02 // Застосунки',
        tab_vault: '03 // Паролі та Бекапи',
        tab_logs: '04 // Логи та Збої',
        srv_add_title: 'Підключити новий сервер (VPS / Linux)',
        srv_add_sub: 'Додайте ваш Linux-сервер у кластер для розміщення сайтів, баз даних та ігрових серверів.',
        lbl_hostname: 'Ім’я сервера (Hostname)',
        lbl_ip: 'IP-адреса вузла',
        lbl_ram: 'Обсяг ОЗП (MB)',
        lbl_cpu: 'Ядра процесора (CPU)',
        btn_add_srv: '+ Підключити сервер до платформи',
        srv_list_title: 'Активні сервери кластера',
        app_add_title: 'Створити та запустити застосунок',
        app_add_sub: 'Розгорніть код із GitHub або готовий шаблон бази даних / ігрового сервера в 1 клік.',
        lbl_app_name: 'Назва сервісу',
        lbl_app_type: 'Джерело / Шаблон',
        lbl_app_ram: 'Ліміт пам’яті (MB)',
        lbl_app_domain: 'Домен або порт',
        btn_deploy_app: '$ Запустити контейнер',
        app_list_title: 'Запущені контейнери та сервіси',
        vault_title: 'Захищене сховище паролів (Secret Vault)',
        vault_sub: 'Паролі від баз даних та API-ключі шифруються перед збереженням і передаються контейнерам під час старту.',
        btn_save_sec: 'Зашифрувати та зберегти',
        backup_title: 'Резервні копії томів (S3 / MinIO Snapshots)',
        backup_sub: 'Створення архіву даних контейнера та автоматичне очищення старих копій.',
        btn_create_backup: '+ Створити S3-бекап',
        logs_title: 'Живий термінал та авто-виправлення збоїв в 1 клік',
        logs_sub: 'Оберіть тип збою для перевірки автоматичного аналізатора логів та швидкого відновлення.'
      },
      en: {
        btn_logout: 'Sign Out',
        side_status: 'Full Cluster Access',
        tab_servers: '01 // My Servers',
        tab_services: '02 // Applications',
        tab_vault: '03 // Passwords & Backups',
        tab_logs: '04 // Logs & Recovery',
        srv_add_title: 'Connect New Server (VPS / Linux)',
        srv_add_sub: 'Add your Linux server to the cluster to host websites, databases, and game servers.',
        lbl_hostname: 'Server Hostname',
        lbl_ip: 'Node IP Address',
        lbl_ram: 'Total RAM (MB)',
        lbl_cpu: 'CPU Cores',
        btn_add_srv: '+ Connect Server to Platform',
        srv_list_title: 'Active Cluster Servers',
        app_add_title: 'Create & Launch Application',
        app_add_sub: 'Deploy code from GitHub or pick a 1-click database / game server template.',
        lbl_app_name: 'Service Name',
        lbl_app_type: 'Source / Template',
        lbl_app_ram: 'Memory Limit (MB)',
        lbl_app_domain: 'Domain or Port',
        btn_deploy_app: '$ Launch Container',
        app_list_title: 'Running Containers & Services',
        vault_title: 'Encrypted Password Storage (Secret Vault)',
        vault_sub: 'Database passwords and API keys are encrypted at rest and injected into containers on startup.',
        btn_save_sec: 'Encrypt & Save',
        backup_title: 'Volume Backups (S3 / MinIO Snapshots)',
        backup_sub: 'Create compressed container volume archives and automatically rotate old snapshots.',
        btn_create_backup: '+ Create S3 Snapshot',
        logs_title: 'Live Terminal & 1-Click Crash Recovery',
        logs_sub: 'Select a sample failure to test automated log diagnostics and instant recovery.'
      }
    };

    function setDashLang(lang) {
      document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
      const btn = document.getElementById('lang-' + lang);
      if (btn) btn.classList.add('active');
      const d = dashDict[lang] || dashDict.ru;
      document.querySelectorAll('[data-i18n]').forEach(el => {
        const k = el.getAttribute('data-i18n');
        if (d[k]) el.innerHTML = d[k];
      });
    }

    function switchTab(tabId, navEl) {
      document.querySelectorAll('.side-nav-item').forEach(el => el.classList.remove('active'));
      navEl.classList.add('active');
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      document.getElementById('pane-' + tabId).classList.add('active');
    }

    function loadSessionHeader() {
      try {
        const raw = localStorage.getItem('valence_session');
        if (raw) {
          const sess = JSON.parse(raw);
          document.getElementById('user-email-label').textContent = sess.email;
          document.getElementById('user-role-label').textContent = sess.role + ' // VERIFIED';
          document.getElementById('session-token-badge').textContent = 'TOKEN: ' + sess.token.slice(0, 12) + '...';
        }
      } catch (e) {}
    }

    function logoutSession() {
      localStorage.removeItem('valence_session');
      window.location.href = '/client/docs';
    }

    async function refreshWorkspaceData() {
      const nodesRes = await fetch('/client/telemetry');
      const nodesData = await nodesRes.json();
      document.getElementById('count-servers').textContent = nodesData.cards.length;
      document.getElementById('dash-servers-grid').innerHTML = nodesData.cards.map((c, idx) => {
        const raw = nodesData.rawNodes[idx] || {};
        return \`
          <div class="item-card">
            <div>
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <b style="font-size:15px; color:#fff;">\${c.hostname}</b>
                <span style="font-family:var(--font-mono); font-size:10.5px; color:var(--ice-cyan);">ONLINE</span>
              </div>
              <div style="font-family:var(--font-mono); font-size:11.5px; color:var(--text-muted); margin-top:4px;">
                IP: \${raw.publicIp || '10.10.0.15'} &bull; \${raw.cpuCores || 8} vCPU
              </div>
              <div class="bar-bg"><div class="bar-fill bar-\${c.severity}" style="width:\${c.memoryUsagePercent}%"></div></div>
            </div>
            <div style="display:flex; justify-content:space-between; margin-top:14px; padding-top:10px; border-top:1px solid var(--line); font-family:var(--font-mono); font-size:11px; color:var(--text-body);">
              <span>RAM: \${raw.usedMemoryMb || 512} / \${raw.totalMemoryMb || 16384} MB</span>
              <b style="color:#fff;">\${c.memoryUsagePercent}%</b>
            </div>
          </div>
        \`;
      }).join('');

      const svcRes = await fetch('/client/services');
      const svcData = await svcRes.json();
      document.getElementById('count-services').textContent = svcData.services.length;
      document.getElementById('dash-services-grid').innerHTML = svcData.services.map(s => \`
        <div class="item-card">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <b style="font-size:15.5px; color:#fff;">\${s.name}</b>
              <span style="font-family:var(--font-mono); font-size:10.5px; padding:2px 8px; border:1px solid \${s.status === 'RUNNING' ? 'var(--ice-cyan)' : 'var(--amber)'}; color:\${s.status === 'RUNNING' ? 'var(--ice-cyan)' : 'var(--amber)'};">\${s.status}</span>
            </div>
            <div style="font-family:var(--font-mono); font-size:11.5px; color:var(--text-body); margin-top:6px;">
              Image: <code>\${s.image}</code>
            </div>
            <div style="font-family:var(--font-mono); font-size:11px; color:var(--text-muted); margin-top:4px;">
              Endpoint: <b style="color:var(--ice-cyan)">\${s.domain}</b> &bull; RAM Limit: \${s.memoryMb} MB
            </div>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:14px; padding-top:10px; border-top:1px solid var(--line);">
            <span style="font-family:var(--font-mono); font-size:10.5px; color:var(--text-muted);">Node: \${s.nodeHostname}</span>
            <div style="display:flex; gap:6px;">
              <button class="btn-outline" style="padding:4px 10px; font-size:10px;" onclick="toggleServiceStatus('\${s.id}')">\${s.status === 'RUNNING' ? 'Sleep / Stop' : 'Wake / Start'}</button>
            </div>
          </div>
        </div>
      \`).join('');
    }

    async function addServerNode() {
      const hostname = document.getElementById('in-srv-host').value;
      const publicIp = document.getElementById('in-srv-ip').value;
      const totalMemoryMb = Number(document.getElementById('in-srv-ram').value);
      const cpuCores = Number(document.getElementById('in-srv-cpu').value);
      await fetch('/client/nodes/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostname, publicIp, totalMemoryMb, cpuCores })
      });
      await refreshWorkspaceData();
    }

    async function deployNewService() {
      const name = document.getElementById('in-app-name').value;
      const image = document.getElementById('in-app-image').value;
      const memoryMb = Number(document.getElementById('in-app-ram').value);
      const domain = document.getElementById('in-app-domain').value;
      await fetch('/client/services/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, image, memoryMb, domain })
      });
      await refreshWorkspaceData();
    }

    async function toggleServiceStatus(serviceId) {
      await fetch('/client/services/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId })
      });
      await refreshWorkspaceData();
    }

    async function saveEncryptedSecret() {
      const k = document.getElementById('in-sec-key').value || 'SECRET_KEY';
      const v = document.getElementById('in-sec-val').value || 'secret_val';
      const res = await fetch('/client/vault/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: k, value: v })
      });
      const data = await res.json();
      document.getElementById('vault-out').textContent = JSON.stringify(data, null, 2);
    }

    async function triggerS3Backup() {
      const res = await fetch('/client/backups/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: 'proj-production', serviceId: 'postgres-16' })
      });
      const data = await res.json();
      document.getElementById('backup-out').textContent = JSON.stringify(data, null, 2);
    }

    async function simulateDashCrash(suggestedFix, errorCode, humanExplanation) {
      const res = await fetch('/client/logs/recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId: 'shop-backend-api', errorCode, humanExplanation, suggestedFix })
      });
      const data = await res.json();
      const banner = document.getElementById('dash-crash-banner');
      banner.style.display = 'flex';
      banner.innerHTML = \`<span>\${data.bannerText}</span><button class="btn-cyan" style="padding:5px 12px;" onclick="this.parentElement.style.display='none'">\${data.action.buttonLabel}</button>\`;
      document.getElementById('dash-logs-out').textContent = JSON.stringify(data, null, 2);
    }

    loadSessionHeader();
    refreshWorkspaceData();
  </script>
</body>
</html>`;
