import { FlappyGame } from './game/FlappyGame';
import { GameRenderer } from './renderer/GameRenderer';
import { BrainRenderer } from './renderer/BrainRenderer';
import { SpikeField } from './renderer/SpikeField';
import { FlyBrain } from './brain/FlyBrain';
import { FlyEncoder } from './brain/FlyEncoder';
import { loadManifest } from './brain/BrainLoader';
import { ExperimentHistory } from './experiment/ExperimentHistory';
import { i18n, t, type Locale } from './i18n';
import type { AppState, BrainActivity, BrainResult, Mode } from './types';
import { ActionSound } from './audio/ActionSound';
import { coinIconURL } from './renderer/coins/PipeCoins';

const empty: BrainActivity = { lc4: 0, lplc2: 0, lplc1: 0, lc6: 0, lc16: 0, lc10Left: 0, lc10Right: 0, upward: 0, downward: 0, flowFore: 0, flowBack: 0, h2: 0, lc11: 0, claw: 0, hops: 0, dnp01: 0, loom: 0, hold: 0 };

export class App {
  private state: AppState = 'BOOT';
  private mode: Mode = 'online';
  private slow = false;
  private autoRevive = false;
  private flyId = ExperimentHistory.nextFlyId();
  private seed = Number(new URLSearchParams(location.search).get('seed')) || Date.now();
  private game!: FlappyGame;
  private brain!: FlyBrain;
  private gameRenderer!: GameRenderer;
  private brainRenderer!: BrainRenderer;
  private spikeField!: SpikeField;
  private activity = empty;
  private result?: BrainResult;
  private last = performance.now();
  private brainClock = 0;
  private renderClock = 0;
  private fps = 60;
  private frames = 0;
  private fpsAt = performance.now();
  private latency = 0;
  private autoTimer = 0;
  private deathCause = '';
  private lastError = '';
  private loadLabel = 'boot';
  private loadValue = 0;
  private trainSnapshot?: { done: number; total: number; loss: number };
  private toastKey?: { key: string; vars?: Record<string, string | number> };
  private audio = new ActionSound();
  private stride = 0;
  private closed = false;
  private frame = 0;
  private cleanups: Array<() => void> = [];

  constructor(private root: HTMLElement) {
    this.paint();
    this.bind();
    void this.boot();
  }

  private langSwitch() {
    return `<div class="lang" role="group"><button type="button" data-set-lang="zh">中文</button><button type="button" data-set-lang="en">EN</button></div>`;
  }

  private paint() {
    this.root.innerHTML = `<main><header><div><div class="eyebrow" data-i18n="eyebrow"></div><h1><span>🪰→🦀</span> <span data-i18n="titleA"></span> <em data-i18n="titleB"></em></h1><p data-i18n="subtitle"></p></div><div class="header-side">${this.langSwitch()}<div class="facts"><b>166,700 <small data-i18n="neurons"></small></b><b>~25.6M <small data-i18n="connections"></small></b><b class="frozen">● <span data-i18n="frozen"></span> <small data-i18n="connectome"></small></b></div></div></header>
<section class="workspace"><article class="panel brain"><div class="panel-title"><span data-i18n="panelBrain"></span><i data-i18n="liveActivity"></i></div><div class="brain-map"><canvas id="brain"></canvas><svg class="fly-outline" viewBox="0 0 600 520" preserveAspectRatio="none" aria-hidden="true"><path class="wing" d="M168 348C78 320 8 390 10 452C12 502 90 524 160 492C188 474 172 400 170 362Z"/><path class="wing" d="M432 348C522 320 592 390 590 452C588 502 510 524 440 492C412 474 428 400 430 362Z"/><path class="leg" d="M250 292C170 268 90 286 48 328"/><path class="leg" d="M350 292C430 268 510 286 552 328"/><path class="leg" d="M236 392C150 404 70 450 52 500"/><path class="leg" d="M364 392C450 404 530 450 548 500"/><path class="leg" d="M250 430C190 468 160 508 196 516"/><path class="leg" d="M350 430C410 468 440 508 404 516"/><path class="body" d="M300 18C343 18 392 23 430 32C468 41 503 54 530 72C557 90 585 117 590 140C595 163 580 189 560 210C540 231 490 251 470 268C450 285 447 297 440 312C433 327 430 342 430 358C430 374 441 391 438 408C435 425 424 443 412 458C400 473 387 488 368 498C349 508 323 518 300 518C277 518 251 508 232 498C213 488 200 473 188 458C176 443 165 425 162 408C159 391 170 374 170 358C170 342 167 327 160 312C153 297 150 285 130 268C110 251 60 231 40 210C20 189 5 163 10 140C15 117 43 90 70 72C97 54 132 41 170 32C208 23 257 18 300 18Z"/><path class="segment" d="M200 424Q300 438 400 424"/><path class="segment" d="M188 464Q300 478 412 464"/><path class="segment" d="M230 498Q300 508 370 498"/><path class="antenna" d="M274 48C262 30 246 18 230 12"/><circle class="antenna" cx="228" cy="11" r="4.5"/><path class="antenna" d="M326 48C338 30 354 18 370 12"/><circle class="antenna" cx="372" cy="11" r="4.5"/></svg><div class="brain-tags"><b class="optic" style="left:13%;top:28%" data-i18n="mapOpticL"></b><b class="optic" style="left:87%;top:28%" data-i18n="mapOpticR"></b><b class="visual" style="left:35%;top:10%" data-i18n="mapVisualL"></b><b class="visual" style="left:65%;top:10%" data-i18n="mapVisualR"></b><b class="central" style="left:50%;top:48%" data-i18n="mapCentral"></b><b class="descending" style="left:68%;top:64%" data-i18n="mapDescending"></b><b class="ascending" style="left:32%;top:73%" data-i18n="mapAscending"></b><b class="vnc" style="left:50%;top:88%" data-i18n="mapVnc"></b></div></div><ul class="region-key"><li><i class="optic"></i><span data-i18n="regionOptic"></span></li><li><i class="visual"></i><span data-i18n="regionVisual"></span></li><li><i class="central"></i><span data-i18n="regionCentral"></span></li><li><i class="descending"></i><span data-i18n="regionDescending"></span></li><li><i class="vnc"></i><span data-i18n="regionVnc"></span></li><li><i class="ascending"></i><span data-i18n="regionAscending"></span></li></ul><div class="brain-meta"><strong>166,700</strong><span><span data-i18n="neuronMap"></span><br><span id="memoryMode"></span></span></div><div class="decision"><small data-i18n="decision"></small><strong id="decision" data-i18n="wait"></strong><span id="prob"></span></div><div class="spike-field"><button type="button" id="sequence" class="sequence" data-i18n="seqWait" aria-expanded="true"></button><canvas id="spikes"></canvas></div></article>
<article class="panel game"><div class="panel-title"><span data-i18n="panelGame"></span><i id="flyLabel"></i></div><div class="canvas-wrap"><canvas id="game"></canvas><button type="button" id="pause" class="pause" data-i18n="btnPause" aria-pressed="false" disabled></button><div id="pauseBanner" class="pause-banner hidden" data-i18n="paused"></div><div id="death" class="death hidden"></div></div></article>
<article class="panel data"><button type="button" class="panel-title" id="dataFold" aria-expanded="true"><span data-i18n="panelData"></span><i>50 HZ</i></button><div class="data-visual"><h2 data-i18n="visualInput"></h2><div id="sensors"></div></div><div class="data-motor"><h2 data-i18n="motorOutput"></h2><div id="motor"></div></div><h2><span data-i18n="bestFlies"></span> <small data-i18n="thisBrowser"></small></h2><ol id="leaders"></ol></article></section>
<section class="status"><div class="coin-score"><img class="coin-logo" alt=""><b id="score">0</b></div><div><small data-i18n="best"></small><b id="best">${ExperimentHistory.best()}</b></div><div><small data-i18n="game"></small><b id="fps">60 FPS</b></div><div><small data-i18n="brain"></small><b>50 HZ</b></div><div><small data-i18n="step"></small><b id="step"></b></div><div><small data-i18n="mode"></small><b id="modeLabel"></b></div></section>
<nav><div class="mode"><button type="button" id="pure" data-i18n="btnPure"></button><button type="button" id="trained" class="active" data-i18n="btnOnline"></button></div><button type="button" id="fastTrain" data-i18n="btnFast"></button><button type="button" id="exportModel" data-i18n="btnExport"></button><button type="button" id="importModel" data-i18n="btnImport"></button><input id="modelFile" class="hidden" type="file" accept="application/json,.json"><button type="button" id="slow" data-i18n="btnSlow"></button><label><input id="auto" type="checkbox"> <span data-i18n="btnAuto"></span></label><label><input id="sound" type="checkbox" checked> <span data-i18n="btnSound"></span></label><button type="button" id="restart" data-i18n="btnRestart"></button></nav>
<footer><strong data-i18n="noteTitle"></strong><p data-i18n="note"></p></footer></main>
<div id="training" class="training hidden"><div>${this.langSwitch()}<div class="eyebrow" data-i18n="trainEyebrow"></div><h2 data-i18n="trainTitle"></h2><p id="trainText"></p><div class="track"><i id="trainBar"></i></div><b id="trainPct">0%</b></div></div>
<div id="toast" class="toast hidden"></div>
<div id="loading" class="loading"><div class="loader-card">${this.langSwitch()}<div class="fly-icon">🪰</div><div class="eyebrow" data-i18n="loadEyebrow"></div><h2 data-i18n-html="loadTitle"></h2><div class="load-stat"><span id="loadText"></span><b id="loadPct">0%</b></div><div class="track"><i id="loadBar"></i></div><div class="online"><span data-i18n="loadNeurons"></span><span data-i18n="loadLinks"></span></div><button type="button" id="wake" class="hidden" data-i18n="wake"></button><div id="loadError" class="load-error"></div></div></div>`;
    this.applyStatic();
  }

  private bind() {
    this.root.querySelectorAll<HTMLButtonElement>('[data-set-lang]').forEach((btn) => {
      btn.onclick = () => this.setLocale(btn.dataset.setLang === 'en' ? 'en' : 'zh');
    });
    this.gameRenderer = new GameRenderer(this.$('game'));
    const coinLogo = this.root.querySelector<HTMLImageElement>('.coin-logo');
    if (coinLogo) coinLogo.src = coinIconURL();
    this.brainRenderer = new BrainRenderer(this.$('brain'));
    this.spikeField = new SpikeField(this.$('spikes'));
    this.bindSpikeFold();
    this.bindDataFold();
    this.syncCanvasLabels();
    this.bindGameResize();
    this.game = new FlappyGame(this.seed, (cause) => this.die(cause));
    this.$b('pure').onclick = () => this.setMode('pure');
    this.$b('trained').onclick = () => this.setMode('online');
    this.$b('fastTrain').onclick = () => this.fastTrain();
    this.$b('exportModel').onclick = () => this.exportModel();
    this.$b('importModel').onclick = () => this.$<HTMLInputElement>('modelFile').click();
    this.$<HTMLInputElement>('modelFile').onchange = (e) => void this.importModel((e.target as HTMLInputElement).files?.[0]);
    this.$b('slow').onclick = () => { this.slow = !this.slow; this.$b('slow').classList.toggle('active', this.slow); };
    this.$b('restart').onclick = () => this.restart();
    this.$b('pause').onclick = () => this.togglePause();
    this.$<HTMLInputElement>('auto').onchange = (e) => { this.autoRevive = (e.target as HTMLInputElement).checked; };
    this.$<HTMLInputElement>('sound').onchange = (e) => { this.audio.enabled = (e.target as HTMLInputElement).checked; };
    const onPointerDown = () => this.audio.unlock();
    window.addEventListener('pointerdown', onPointerDown);
    this.cleanups.push(() => window.removeEventListener('pointerdown', onPointerDown));
    this.$b('wake').onclick = () => this.start();
  }

  private setLocale(locale: Locale) {
    i18n.set(locale);
    this.applyStatic();
  }

  private applyChrome() {
    const lang = i18n.locale === 'zh' ? 'zh-CN' : 'en';
    const rootNode = this.root.getRootNode();
    if (rootNode instanceof ShadowRoot) {
      (rootNode.host as HTMLElement).lang = lang;
      return;
    }
    document.documentElement.lang = lang;
    document.title = t('docTitle');
  }

  private applyStatic() {
    this.applyChrome();
    this.root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n || ''); });
    this.root.querySelectorAll<HTMLElement>('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml || ''); });
    this.root.querySelectorAll<HTMLElement>('.lang').forEach((el) => el.setAttribute('aria-label', t('langLabel')));
    this.root.querySelector('.game-resize')?.setAttribute('aria-label', t('resizeGame'));
    this.root.querySelector('.brain-resize')?.setAttribute('aria-label', t('resizeBrain'));
    this.syncSpikeFold();
    this.syncDataFold();
    this.root.querySelectorAll<HTMLButtonElement>('[data-set-lang]').forEach((btn) => {
      const on = btn.dataset.setLang === i18n.locale;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    const memory = this.$('memoryMode');
    if (memory) memory.textContent = crossOriginIsolated ? t('webglShared') : t('webglTransfer');
    const fly = this.$('flyLabel');
    if (fly) fly.textContent = t('flyLabel', { id: this.flyId });
    const modeLabel = this.$('modeLabel');
    if (modeLabel) modeLabel.textContent = this.modeText();
    this.syncCanvasLabels();
    if (this.game) this.gameRenderer.render(this.game, this.eyeCue());
    this.paintLoadLabel();
    if (this.trainSnapshot) this.trainingProgress(this.trainSnapshot.done, this.trainSnapshot.total, this.trainSnapshot.loss);
    else if (this.$('trainText')) this.$('trainText').textContent = t('trainStart');
    if (this.result) this.renderData(this.result);
    else if (this.$('step')) this.$('step').textContent = t('stepEmpty');
    this.renderLeaders();
    if (this.state === 'DEAD') this.renderDeath();
    this.syncPause();
    if (this.state === 'ERROR') this.renderLoadError();
    const toast = this.$('toast');
    if (this.toastKey && toast && !toast.classList.contains('hidden')) toast.textContent = t(this.toastKey.key, this.toastKey.vars);
  }

  private eyeCue() {
    return { ...FlyEncoder.encode(this.game.capture()), dnp01: this.activity.dnp01, loom: this.activity.loom, hold: this.activity.hold };
  }

  private bindGameResize() {
    const workspace = this.root.querySelector<HTMLElement>('.workspace');
    const brain = workspace?.querySelector<HTMLElement>('.panel.brain');
    const game = workspace?.querySelector<HTMLElement>('.panel.game');
    const data = workspace?.querySelector<HTMLElement>('.panel.data');
    if (!workspace || !brain || !game || !data) return;
    const handles = [this.resizeHandle(game, 'game-resize', t('resizeGame')), this.resizeHandle(brain, 'brain-resize', t('resizeBrain'))];

    const columns = () => window.innerWidth > 1000 ? 3 : window.innerWidth > 680 ? 2 : 1;
    const apply = (gameWidth: number, dataW: number) => {
      const mode = columns();
      if (mode === 1) {
        workspace.style.gridTemplateColumns = '';
        return;
      }
      const room = workspace.getBoundingClientRect().width;
      const minGame = 240;
      const minBrain = 200;
      if (mode === 2) {
        const next = Math.round(Math.min(Math.max(minGame, room - minBrain), Math.max(minGame, gameWidth)));
        workspace.style.gridTemplateColumns = `minmax(160px,1fr) ${next}px`;
        localStorage.setItem('fly-game-width', String(next));
      } else {
        const reserved = (dataW > 0 ? dataW : 270) + minBrain;
        const next = Math.round(Math.min(Math.max(minGame, room - reserved), Math.max(minGame, gameWidth)));
        const dataCol = dataW > 0 ? `${Math.round(dataW)}px` : 'minmax(270px,.78fr)';
        workspace.style.gridTemplateColumns = `minmax(180px,1fr) ${next}px ${dataCol}`;
        localStorage.setItem('fly-game-width', String(next));
      }
      if (this.game) this.gameRenderer.render(this.game, this.eyeCue());
    };

    const saved = Number(localStorage.getItem('fly-game-width'));
    if (saved > 0) apply(saved, 0);

    let drag = false;
    let originRight = 0;
    let dataLock = 0;
    const stop = () => {
      drag = false;
      handles.forEach((handle) => handle.classList.remove('dragging'));
    };
    handles.forEach((handle) => {
      handle.addEventListener('pointerdown', (event) => {
        if (columns() === 1) return;
        drag = true;
        originRight = game.getBoundingClientRect().right;
        dataLock = columns() === 3 ? data.getBoundingClientRect().width : 0;
        handle.classList.add('dragging');
        try { handle.setPointerCapture(event.pointerId); } catch { /* pointer already released */ }
        event.preventDefault();
      });
      handle.addEventListener('pointermove', (event) => {
        if (!drag) return;
        apply(originRight - event.clientX, dataLock);
      });
      handle.addEventListener('pointerup', stop);
      handle.addEventListener('pointercancel', stop);
    });
    const onResize = () => {
      if (drag) return;
      const kept = Number(localStorage.getItem('fly-game-width'));
      if (kept > 0) apply(kept, 0);
      else if (columns() === 1) workspace.style.gridTemplateColumns = '';
    };
    window.addEventListener('resize', onResize);
    this.cleanups.push(() => window.removeEventListener('resize', onResize));
  }

  private resizeHandle(host: HTMLElement, className: string, label: string) {
    const handle = document.createElement('div');
    handle.className = className;
    handle.setAttribute('role', 'separator');
    handle.setAttribute('aria-orientation', 'vertical');
    handle.setAttribute('aria-label', label);
    host.append(handle);
    return handle;
  }

  private bindSpikeFold() {
    const field = this.root.querySelector<HTMLElement>('.spike-field');
    const toggle = this.root.querySelector<HTMLButtonElement>('#sequence');
    if (!field || !toggle) return;
    if (localStorage.getItem('fly-spikes-collapsed') === '1') field.classList.add('collapsed');
    toggle.addEventListener('click', () => {
      field.classList.toggle('collapsed');
      localStorage.setItem('fly-spikes-collapsed', field.classList.contains('collapsed') ? '1' : '0');
      this.syncSpikeFold();
    });
    this.syncSpikeFold();
  }

  private syncSpikeFold() {
    const field = this.root.querySelector('.spike-field');
    const toggle = this.root.querySelector('#sequence');
    if (!field || !toggle) return;
    const collapsed = field.classList.contains('collapsed');
    toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    toggle.setAttribute('aria-label', t(collapsed ? 'unfoldSpikes' : 'foldSpikes'));
  }

  private bindDataFold() {
    const panel = this.root.querySelector<HTMLElement>('.panel.data');
    const toggle = this.root.querySelector<HTMLButtonElement>('#dataFold');
    if (!panel || !toggle) return;
    if (localStorage.getItem('fly-data-collapsed') === '1') panel.classList.add('collapsed');
    toggle.addEventListener('click', () => {
      panel.classList.toggle('collapsed');
      localStorage.setItem('fly-data-collapsed', panel.classList.contains('collapsed') ? '1' : '0');
      this.syncDataFold();
    });
    this.syncDataFold();
  }

  private syncDataFold() {
    const panel = this.root.querySelector('.panel.data');
    const toggle = this.root.querySelector('#dataFold');
    if (!panel || !toggle) return;
    const collapsed = panel.classList.contains('collapsed');
    toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    toggle.setAttribute('aria-label', t(collapsed ? 'unfoldData' : 'foldData'));
  }

  private syncCanvasLabels() {
    this.gameRenderer?.setLabels({
      looming: t('looming'),
      score: t('canvasScore'),
      font: i18n.locale === 'zh'
        ? '700 13px "PingFang SC","Hiragino Sans GB","Noto Sans SC","Microsoft YaHei",sans-serif'
        : '700 12px ui-monospace'
    });
  }

  private async boot() {
    this.state = 'LOADING_CONNECTOME';
    try {
      const manifest = await loadManifest((p) => this.progress(p.value, p.label));
      if (this.closed) return;
      this.brain = new FlyBrain();
      this.brain.onProgress = (v, l) => this.progress(v, l);
      this.brain.onResult = (r) => this.onBrain(r);
      this.brain.onTrainingProgress = (done, total, loss) => this.trainingProgress(done, total, loss);
      this.brain.onTrainingDone = (model, samples, loss) => this.trainingDone(model, samples, loss);
      let saved: unknown;
      try { saved = JSON.parse(localStorage.getItem('fly-readout-online-v1') ?? 'null'); } catch { saved = undefined; }
      await this.brain.init(manifest, saved);
      if (this.closed) {
        this.brain.dispose();
        return;
      }
      this.progress(1, 'online');
      this.state = 'READY';
      this.$b('wake').classList.remove('hidden');
    } catch (error) {
      if (this.closed) return;
      this.state = 'ERROR';
      this.lastError = error instanceof Error ? error.message : String(error);
      this.renderLoadError();
    }
  }

  private start() {
    if (this.state === 'ERROR') return;
    this.state = 'RUNNING';
    this.$('loading').classList.add('hidden');
    this.audio.unlock();
    this.audio.wake();
    this.game.start();
    this.last = performance.now();
    this.syncPause();
    this.schedule();
  }

  private togglePause() {
    if (this.state === 'RUNNING') {
      this.state = 'PAUSED';
      this.syncPause();
      return;
    }
    if (this.state !== 'PAUSED') return;
    this.state = 'RUNNING';
    this.last = performance.now();
    this.syncPause();
    this.schedule();
  }

  private syncPause() {
    const button = this.root.querySelector<HTMLButtonElement>('#pause');
    const banner = this.root.querySelector<HTMLElement>('#pauseBanner');
    const paused = this.state === 'PAUSED';
    if (button) {
      button.disabled = this.state !== 'RUNNING' && !paused;
      button.classList.toggle('active', paused);
      button.dataset.i18n = paused ? 'btnResume' : 'btnPause';
      button.textContent = t(button.dataset.i18n);
      button.setAttribute('aria-pressed', paused ? 'true' : 'false');
    }
    banner?.classList.toggle('hidden', !paused);
  }

  private schedule() {
    if (this.closed) return;
    this.frame = requestAnimationFrame((time) => this.loop(time));
  }

  private loop(now: number) {
    if (this.closed || this.state !== 'RUNNING') return;
    const scale = this.slow ? .1 : 1;
    const dt = Math.min(.033, (now - this.last) / 1000) * scale;
    this.last = now;
    const crab = this.game.crab;
    const wasGround = crab.grounded;
    const wasScore = this.game.score;
    const wasX = crab.x;
    const wasHeading = crab.heading;
    this.game.update(dt);
    if (this.state === 'RUNNING') this.cueMotion(wasGround, wasScore, wasX, wasHeading);
    this.brainClock += dt;
    while (this.brainClock >= .02) { this.brainClock -= .02; this.brain.step(this.game.capture(), this.mode, this.game.elapsed); }
    const stimulus = FlyEncoder.encode(this.game.capture());
    this.gameRenderer.render(this.game, { ...stimulus, dnp01: this.activity.dnp01, loom: this.activity.loom, hold: this.activity.hold });
    if (now - this.renderClock >= (this.slow ? 100 : 40)) {
      const frame = this.brain.activity ?? new Uint8Array(this.result?.activityFrame ?? new ArrayBuffer(8192));
      this.brainRenderer.render(frame);
      if (!this.root.querySelector('.spike-field')?.classList.contains('collapsed')) this.spikeField.push(frame);
      this.renderClock = now;
    }
    this.updateHud();
    this.frames++;
    if (now - this.fpsAt >= 1000) { this.fps = this.frames * 1000 / (now - this.fpsAt); this.frames = 0; this.fpsAt = now; }
    this.schedule();
  }

  private cueMotion(wasGround: boolean, wasScore: number, wasX: number, wasHeading: number) {
    const crab = this.game.crab;
    if (this.game.score > wasScore) this.audio.score();
    if (!wasGround && crab.grounded) {
      if (crab.haul > 0.4) this.audio.haul();
      else this.audio.land(crab.impact);
    }
    if (crab.heading < 0 && wasHeading > 0) this.audio.hold();
    if (!crab.grounded) { this.stride = 0; return; }
    this.stride += Math.abs(crab.x - wasX);
    if (this.stride < 22) return;
    this.stride = 0;
    this.audio.step();
  }

  private onBrain(r: BrainResult) {
    if (this.closed) return;
    this.latency = performance.now() - r.timestamp;
    this.result = r;
    this.activity = r.activity;
    if (r.readoutModel && this.mode === 'online') localStorage.setItem('fly-readout-online-v1', JSON.stringify(r.readoutModel));
    if (this.state !== 'RUNNING') return;
    const fromGround = this.game.crab.grounded;
    if (r.decision === 'FLAP' && this.game.flap()) this.audio.jump(fromGround);
    this.game.nerve(r.activity.hold);
    this.renderData(r);
  }

  private die(cause: string) {
    if (this.state !== 'RUNNING') return;
    this.state = 'DEAD';
    this.deathCause = cause;
    ExperimentHistory.add({ flyId: this.flyId, mode: this.mode, score: this.game.score, lifetime: this.game.elapsed, totalSpikes: this.result?.totalSpikes ?? 0, at: Date.now() });
    this.audio.die();
    this.syncPause();
    this.renderDeath();
    this.renderLeaders();
    if (this.autoRevive) this.autoTimer = window.setTimeout(() => this.restart(), 2000);
  }

  private renderDeath() {
    const d = this.$('death');
    d.classList.remove('hidden');
    d.innerHTML = `<small>${t('deathSmall')}</small><h2>${t('deathTitle', { id: this.flyId })}</h2><div class="death-grid"><span>${t('score')}<b>${t('deathPipes', { n: this.game.score })}</b></span><span>${t('deathLife')}<b>${t('deathSec', { n: this.game.elapsed.toFixed(1) })}</b></span><span>${t('deathSpikes')}<b>${(this.result?.totalSpikes ?? 0).toLocaleString()}</b></span></div><h3>${t('deathCause')} <i>${t('deathFun')}</i></h3><p>${this.escape(this.causeText(this.deathCause))}</p><button type="button" id="revive">${t('revive')}</button>`;
    (d.querySelector('#revive') as HTMLButtonElement).onclick = () => this.restart();
  }

  private restart() {
    clearTimeout(this.autoTimer);
    this.flyId++;
    this.seed++;
    this.game.reset(this.seed);
    this.brain?.reset(this.seed);
    this.result = undefined;
    this.activity = empty;
    this.$('death').classList.add('hidden');
    this.$('flyLabel').textContent = t('flyLabel', { id: this.flyId });
    this.audio.unlock();
    if (this.state === 'READY') this.start();
    else {
      this.audio.wake();
      this.state = 'RUNNING';
      this.game.start();
      this.last = performance.now();
      this.syncPause();
      this.schedule();
    }
  }

  private setMode(mode: Mode) {
    this.mode = mode;
    this.$b('pure').classList.toggle('active', mode === 'pure');
    this.$b('trained').classList.toggle('active', mode === 'online');
    this.$b('fastTrain').classList.toggle('active', mode === 'trained');
    this.$('modeLabel').textContent = this.modeText();
    this.renderData(this.result);
  }

  private modeText() {
    return this.mode === 'pure' ? t('modePure') : this.mode === 'online' ? t('modeLearning') : t('modeFast');
  }

  private renderData(r?: BrainResult) {
    const a = r?.activity ?? this.activity;
    const sensors: [string, number][] = [['LC4', a.lc4], ['LPLC1', a.lplc1], ['LC6', a.lc6], ['LC16', a.lc16], ['LC11', a.lc11], [t('flowFore'), a.flowFore], [t('flowBack'), a.flowBack], ['H2', a.h2], [t('stance'), a.claw], [t('hopsLeft'), a.hops], ['LC10a-L', a.lc10Left], ['LC10a-R', a.lc10Right], [t('upward'), a.upward], [t('downward'), a.downward]];
    this.$('sensors').innerHTML = sensors.map(([name, value]) => this.meter(name, value)).join('');
    this.$('motor').innerHTML = this.meter('DNp01', a.dnp01) + this.meter(t('holdNerve'), a.loom);
    const flap = r?.decision === 'FLAP';
    const holding = !flap && a.hold > 0.35;
    this.$('decision').textContent = flap ? t('flap') : holding ? t('hold') : t('wait');
    this.$('decision').classList.toggle('flap', flap);
    this.$('decision').classList.toggle('hold', holding);
    this.$('prob').textContent = this.mode !== 'pure'
      ? t('probLearn', { pct: Math.round((r?.flapProbability ?? 0) * 100), samples: r?.trainingSamples ?? 0, loss: (r?.trainingLoss ?? 0).toFixed(3) })
      : t('probPure');
    this.$('sequence').textContent = this.slow
      ? (a.lc4 > .1 ? (a.dnp01 > .2 ? t('seqMotor') : a.hold > .35 ? t('seqHold') : t('seqVisual')) : t('seqWait'))
      : t('seqLive');
    this.$('step').textContent = r ? t('ms', { n: r.stepTime.toFixed(1) }) : t('stepEmpty');
  }

  private meter(name: string, value: number) {
    return `<div class="meter"><div><b>${name}</b><span>${Math.round(value * 100)}%</span></div><i><em style="width:${value * 100}%"></em></i></div>`;
  }

  private updateHud() {
    this.$('score').textContent = String(this.game.score);
    this.$('best').textContent = String(Math.max(this.game.score, ExperimentHistory.best()));
    this.$('fps').textContent = `${Math.round(this.fps)} FPS`;
    if (location.search.includes('debug=1')) this.$('sequence').title = t('latency', { ms: this.latency.toFixed(2) });
  }

  private renderLeaders() {
    const rows = ExperimentHistory.leaders();
    this.$('leaders').innerHTML = rows.length
      ? rows.map((r, i) => `<li><span>${t('leader', { rank: i + 1, id: String(r.flyId).padStart(3, '0') })}</span><b>${r.score}</b></li>`).join('')
      : `<li><span>${t('noFlights')}</span><b>—</b></li>`;
  }

  private fastTrain() {
    if (!this.brain || this.state === 'LOADING_CONNECTOME' || this.state === 'ERROR') return;
    const resumeLoop = this.state === 'PAUSED';
    if (resumeLoop) this.state = 'RUNNING';
    this.game.stop();
    this.syncPause();
    if (resumeLoop) {
      this.last = performance.now();
      this.schedule();
    }
    this.setMode('trained');
    this.$('training').classList.remove('hidden');
    this.$b('fastTrain').disabled = true;
    this.brain.fastTrain(1200);
  }

  private trainingProgress(done: number, total: number, loss: number) {
    if (this.closed) return;
    this.trainSnapshot = { done, total, loss };
    const value = done / total;
    this.$('trainBar').style.width = `${value * 100}%`;
    this.$('trainPct').textContent = `${Math.round(value * 100)}%`;
    this.$('trainText').textContent = t('trainProgress', { done: done.toLocaleString(), total: total.toLocaleString(), loss: loss.toFixed(3) });
  }

  private trainingDone(model: unknown, samples: number, loss: number) {
    if (this.closed) return;
    localStorage.setItem('fly-readout-fast-v1', JSON.stringify(model));
    this.$('training').classList.add('hidden');
    this.$b('fastTrain').disabled = false;
    if (this.state === 'RUNNING') this.game.start();
    this.toast('toastReady', { samples: samples.toLocaleString(), loss: loss.toFixed(3) });
  }

  private exportModel() {
    const key = this.mode === 'online' ? 'fly-readout-online-v1' : 'fly-readout-fast-v1';
    const raw = localStorage.getItem(key);
    if (!raw) { this.toast('toastNone'); return; }
    const model = { format: 'fly-brain-readout-v3', exportedAt: new Date().toISOString(), model: JSON.parse(raw) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(model, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `fly-readout-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.toast('toastExported');
  }

  private async importModel(file?: File) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const model = parsed.format?.startsWith('fly-brain-readout-v') ? parsed.model : parsed;
      if (!Array.isArray(model?.features) || !Array.isArray(model?.weights) || model.features.length !== model.weights.length) throw new Error('invalid_model');
      this.setMode('trained');
      this.brain.importModel(model);
      this.$<HTMLInputElement>('modelFile').value = '';
    } catch (error) {
      this.toast('toastImportFail', { reason: this.errorText(error) });
    }
  }

  private toast(key: string, vars?: Record<string, string | number>) {
    this.toastKey = { key, vars };
    const el = this.$('toast');
    el.textContent = t(key, vars);
    el.classList.remove('hidden');
    window.setTimeout(() => el.classList.add('hidden'), 2600);
  }

  dispose() {
    if (this.closed) return;
    this.closed = true;
    this.state = 'BOOT';
    cancelAnimationFrame(this.frame);
    clearTimeout(this.autoTimer);
    this.cleanups.forEach((fn) => fn());
    this.cleanups = [];
    this.brain?.dispose();
    this.root.replaceChildren();
  }

  private progress(v: number, label: string) {
    if (this.closed) return;
    this.loadValue = v;
    this.loadLabel = label;
    this.paintLoadLabel();
  }

  private paintLoadLabel() {
    const bar = this.$('loadBar');
    const pct = this.$('loadPct');
    const text = this.$('loadText');
    if (!bar || !pct || !text) return;
    bar.style.width = `${this.loadValue * 100}%`;
    pct.textContent = `${Math.round(this.loadValue * 100)}%`;
    text.textContent = this.loadText(this.loadLabel);
  }

  private loadText(label: string) {
    const weights = /^weights:(\d+)$/.exec(label);
    if (weights) return t('load.weights', { pct: weights[1] });
    const known = ['locate', 'verified', 'cached', 'meta', 'descending', 'online', 'boot'];
    return known.includes(label) ? t(`load.${label}`) : label;
  }

  private renderLoadError() {
    this.$('loadError').innerHTML = `<b>${t('errTitle')}</b><p>${this.escape(this.lastError)}</p><p>${t('errHint')}</p>`;
  }

  private causeText(cause: string) {
    const key = `cause.${cause}`;
    const translated = t(key);
    return translated === key ? cause : translated;
  }

  private errorText(error: unknown) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'invalid_model' || message.includes('incompatible') || message === 'Invalid model structure') return t('invalidModel');
    return message || t('invalidFile');
  }

  private escape(value: string) {
    return value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] ?? ch));
  }

  private $<T extends HTMLElement = HTMLElement>(id: string) { return this.root.querySelector(`#${id}`) as T; }
  private $b(id: string) { return this.$<HTMLButtonElement>(id); }
}
