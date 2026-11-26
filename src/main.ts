import './style.css';
import { SAVE_KEY } from './game/data';
import { createInitialState, GameEngine } from './game/engine';
import type { GameState, Role } from './game/types';
import { createMapCanvas, setMapSelected } from './ui/mapCanvas';
import {
  renderBoxPage,
  renderHeader,
  renderLedgerPage,
  renderLog,
  renderMapBottom,
  renderModal,
  renderPeoplePage,
  renderTabs,
  renderVillagePanel,
  type Tab,
  type UiState,
} from './ui/render';

function loadState(): GameState {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as GameState;
      if (
        parsed &&
        typeof parsed.dayIndex === 'number' &&
        Array.isArray(parsed.members) &&
        Array.isArray(parsed.ledger) &&
        Array.isArray(parsed.runs) &&
        Array.isArray(parsed.forecast)
      ) {
        return parsed;
      }
    }
  } catch {
    // 存档损坏时直接开新班。
  }
  return createInitialState();
}

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('找不到 #app 根节点');

const engine = new GameEngine(loadState());
const ui: UiState = {
  tab: 'map',
  selectedVillageId: engine.state.currentVillageId,
  selectedPlayId: engine.state.ownedPlayIds[0] ?? null,
  days: 3,
  ledgerFilter: 'all',
  modal: null,
};

app.innerHTML = `
  <header class="app-header" id="header"></header>
  <nav class="tabs" id="tabs" aria-label="主导航"></nav>
  <main>
    <section id="page-map" class="page active">
      <div class="map-layout">
        <div class="map-main">
          <div class="card map-card">
            <div class="canvas-shell">
              <canvas id="mapCanvas" width="1000" height="650" aria-label="渭北村路与戏班行进地图"></canvas>
            </div>
            <div class="map-legend">
              <span class="legend-item"><i class="dot current"></i>戏班/当前村</span>
              <span class="legend-item"><i class="dot fair"></i>庙会前后</span>
              <span class="legend-item"><i class="dot rival"></i>别的戏班</span>
              <span class="legend-item">线上数字为旱路里数，车行三十里/日</span>
            </div>
          </div>
          <div id="mapBottom"></div>
          <div id="logWrap"></div>
        </div>
        <aside id="villagePanel" class="card side-panel" aria-live="polite"></aside>
      </div>
    </section>
    <section id="page-people" class="page">
      <div id="peoplePage"></div>
    </section>
    <section id="page-box" class="page">
      <div id="boxPage"></div>
    </section>
    <section id="page-ledger" class="page">
      <div id="ledgerPage"></div>
    </section>
  </main>
  <div id="modalRoot"></div>
  <div class="toast-stack" id="toastStack" aria-live="polite"></div>
`;

const canvas = document.querySelector<HTMLCanvasElement>('#mapCanvas');
if (!canvas) throw new Error('找不到地图 Canvas');
createMapCanvas(canvas, engine, (villageId) => {
  ui.selectedVillageId = villageId;
  renderAll();
});

const headerEl = document.querySelector<HTMLElement>('#header')!;
const tabsEl = document.querySelector<HTMLElement>('#tabs')!;
const mapBottomEl = document.querySelector<HTMLElement>('#mapBottom')!;
const logWrapEl = document.querySelector<HTMLElement>('#logWrap')!;
const villagePanelEl = document.querySelector<HTMLElement>('#villagePanel')!;
const peoplePageEl = document.querySelector<HTMLElement>('#peoplePage')!;
const boxPageEl = document.querySelector<HTMLElement>('#boxPage')!;
const ledgerPageEl = document.querySelector<HTMLElement>('#ledgerPage')!;
const modalRootEl = document.querySelector<HTMLElement>('#modalRoot')!;

function saveState(): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(engine.state));
  } catch {
    // 隐私模式或存储满时不影响本局。
  }
}

function toast(message: string, type: 'error' | 'good' = 'error'): void {
  const stack = document.querySelector<HTMLElement>('#toastStack');
  if (!stack) return;
  const item = document.createElement('div');
  item.className = `toast ${type}`;
  item.textContent = message;
  stack.appendChild(item);
  window.setTimeout(() => item.remove(), 3400);
}

function renderAll(): void {
  headerEl.innerHTML = renderHeader(engine);
  tabsEl.innerHTML = renderTabs(ui.tab);

  document.querySelectorAll<HTMLElement>('.page').forEach((page) => {
    page.classList.toggle('active', page.id === `page-${ui.tab}`);
  });

  mapBottomEl.innerHTML = renderMapBottom(engine);
  logWrapEl.innerHTML = renderLog(engine);
  villagePanelEl.innerHTML = renderVillagePanel(engine, ui);
  peoplePageEl.innerHTML = renderPeoplePage(engine);
  boxPageEl.innerHTML = renderBoxPage(engine);
  ledgerPageEl.innerHTML = renderLedgerPage(engine, ui);
  modalRootEl.innerHTML = renderModal(engine, ui);
  setMapSelected(canvas, ui.selectedVillageId || engine.state.currentVillageId);
}

engine.subscribe(() => {
  saveState();
  renderAll();
});

document.addEventListener('click', (event) => {
  const target = event.target as HTMLElement | null;
  const actionEl = target?.closest<HTMLElement>('[data-action]');
  if (!actionEl) return;
  const action = actionEl.dataset.action;
  if (!action) return;

  switch (action) {
    case 'tab': {
      ui.tab = (actionEl.dataset.tab as Tab) ?? 'map';
      renderAll();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      break;
    }

    case 'advance': {
      const hadSettlement = Boolean(engine.state.settlement);
      engine.advanceDay();
      if (!hadSettlement && engine.state.settlement) ui.modal = { type: 'settlement' };
      renderAll();
      break;
    }

    case 'settle': {
      const confirmed = window.confirm('现在封箱会结清全年股份并定下年景；封箱后不能再雇人、赏钱或修箱。确定现在算账吗？');
      if (!confirmed) break;
      const settlement = engine.settleYear();
      if (settlement) {
        ui.modal = { type: 'settlement' };
        toast('年终账目已结清', 'good');
      }
      renderAll();
      break;
    }

    case 'restart': {
      const ok = window.confirm('确定要封箱重开吗？当前这一班的自动存档会被清空。');
      if (!ok) break;
      localStorage.removeItem(SAVE_KEY);
      engine.reset();
      ui.tab = 'map';
      ui.selectedVillageId = engine.state.currentVillageId;
      ui.selectedPlayId = engine.state.ownedPlayIds[0] ?? null;
      ui.days = 3;
      ui.ledgerFilter = 'all';
      ui.modal = { type: 'help' };
      saveState();
      renderAll();
      break;
    }

    case 'help':
      ui.modal = { type: 'help' };
      renderAll();
      break;

    case 'close-modal':
      ui.modal = null;
      renderAll();
      break;

    case 'close-and-ledger':
      ui.modal = null;
      ui.tab = 'ledger';
      renderAll();
      break;

    case 'resolve-choice': {
      const choice = actionEl.dataset.choice;
      if (choice) engine.resolveChoice(choice);
      ui.modal = null;
      renderAll();
      break;
    }

    case 'select-village': {
      const id = actionEl.dataset.id;
      if (id) ui.selectedVillageId = id;
      renderAll();
      break;
    }

    case 'travel': {
      const to = actionEl.dataset.to;
      if (!to) break;
      const error = engine.depart(to);
      if (error) toast(error);
      else ui.selectedVillageId = to;
      renderAll();
      break;
    }

    case 'select-play': {
      const play = actionEl.dataset.play;
      if (play) ui.selectedPlayId = play;
      renderAll();
      break;
    }

    case 'set-days': {
      ui.days = Number(actionEl.dataset.days ?? 3);
      renderAll();
      break;
    }

    case 'start-run': {
      const play = actionEl.dataset.play ?? ui.selectedPlayId;
      if (!play) break;
      const error = engine.startRun(play, Number(actionEl.dataset.days ?? ui.days));
      if (error) toast(error);
      else toast('戏单已写好，点“推进一日”开唱', 'good');
      renderAll();
      break;
    }

    case 'treat': {
      const id = actionEl.dataset.id;
      if (!id) break;
      const error = engine.treatMember(id);
      if (error) toast(error);
      else toast('药已抓下，人也将养了些', 'good');
      renderAll();
      break;
    }

    case 'reward': {
      const id = actionEl.dataset.id;
      const amount = Number(actionEl.dataset.amount ?? 0);
      if (!id) break;
      const error = engine.rewardMember(id, amount);
      if (error) toast(error);
      else toast('花红赏下去了', 'good');
      renderAll();
      break;
    }

    case 'hire': {
      const role = actionEl.dataset.role as Role;
      const apprentice = actionEl.dataset.apprentice === 'true';
      const error = engine.hireReplacement(role, apprentice);
      if (error) toast(error);
      else toast('新人已经搭班', 'good');
      renderAll();
      break;
    }

    case 'repair': {
      const id = actionEl.dataset.id;
      if (!id) break;
      const error = engine.repairPuppet(id);
      if (error) toast(error);
      else toast('影人已修整如新', 'good');
      renderAll();
      break;
    }

    case 'repair-all': {
      const error = engine.repairAllPuppets();
      if (error) toast(error);
      else toast('全园影人检修完毕', 'good');
      renderAll();
      break;
    }

    case 'buy': {
      const id = actionEl.dataset.id;
      if (!id) break;
      const error = engine.buyPuppet(id);
      if (error) toast(error);
      else toast('新影人已入箱', 'good');
      renderAll();
      break;
    }

    case 'learn': {
      const id = actionEl.dataset.id;
      if (!id) break;
      const error = engine.beginStudy(id);
      if (error) toast(error);
      else toast('拜师礼已成，开始学戏', 'good');
      renderAll();
      break;
    }

    case 'ledger-filter':
      ui.ledgerFilter = (actionEl.dataset.filter as UiState['ledgerFilter']) ?? 'all';
      renderAll();
      break;

    case 'open-entry': {
      const id = actionEl.dataset.id;
      if (id) ui.modal = { type: 'entry', entryId: id };
      renderAll();
      break;
    }

    case 'open-run': {
      const runId = actionEl.dataset.run;
      if (runId) {
        const highlight = actionEl.dataset.highlight || undefined;
        ui.modal = { type: 'run', runId, highlightDayId: highlight };
      }
      renderAll();
      break;
    }

    case 'open-settlement':
      ui.modal = { type: 'settlement' };
      renderAll();
      break;

    default:
      break;
  }
});

modalRootEl.addEventListener('click', (event) => {
  if (engine.state.pendingChoice) return;
  if (event.target === modalRootEl.firstElementChild) {
    ui.modal = null;
    renderAll();
  }
});

renderAll();
