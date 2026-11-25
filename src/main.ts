import './styles.css';
import { mountMap, type MapHandle } from './mapCanvas';
import {
  borrowMoney,
  buyPuppet,
  hireMember,
  learnPlay,
  newGame,
  rehearsePlay,
  repairPuppet,
  resolveEvent,
  restDay,
  rewardTroupe,
  settleYear,
  signAndPerform,
  startNewYear,
  travelTo,
  treatMember,
  type ActionResult,
} from './engine';
import { getPerformance } from './engine';
import type { GameState, RoleId, TabId } from './types';
import {
  bookingModal,
  eventModal,
  helpModal,
  performanceModal,
  renderChestTab,
  renderLedgerTab,
  renderMapTab,
  renderTroupeTab,
  settlementBanner,
  settlementModal,
  tabs,
  toastStack,
  topStats,
  type LedgerFilter,
} from './ui';

const SAVE_KEY = 'shadow-puppet-troupe-save-v1';

type ModalState =
  | { type: 'help' }
  | { type: 'booking' }
  | { type: 'performance'; id: string }
  | { type: 'settlement' }
  | null;

interface Toast {
  id: number;
  text: string;
  tone: '' | 'error' | 'good';
}

function loadState(): GameState {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as GameState;
      if (parsed && parsed.schemaVersion === 1 && Array.isArray(parsed.members)) {
        if (typeof parsed.debt !== 'number') parsed.debt = 0;
        return parsed;
      }
    }
  } catch {
    // 存档损坏时直接开新班。
  }
  return newGame();
}

let state = loadState();
let activeTab: TabId = 'map';
let selectedVillageId = state.currentVillageId;
let ledgerFilter: LedgerFilter = 'all';
let ledgerYear = state.year;
let modal: ModalState = null;
let pendingTravel: { fromId: string; toId: string; days: number } | null = null;
let mapHandle: MapHandle | null = null;
let toasts: Toast[] = [];
let toastSeq = 1;

const app = document.querySelector<HTMLDivElement>('#app')!;

function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // 隐私模式或存储满时不影响本局。
  }
}

function toast(text: string, tone: Toast['tone'] = '') {
  const id = toastSeq++;
  toasts = [...toasts, { id, text, tone }];
  window.setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    render();
  }, 3600);
}

function afterAction(res: ActionResult, okMessage?: string, options?: { openReport?: boolean }) {
  if (!res.ok) {
    toast(res.error ?? '这一步做不成', 'error');
  } else if (okMessage) {
    toast(okMessage, 'good');
  }
  if (state.settlement && modal?.type !== 'settlement' && !state.pendingEvent) {
    modal = { type: 'settlement' };
  }
  if (options?.openReport && res.performanceIds?.length) {
    modal = { type: 'performance', id: res.performanceIds[res.performanceIds.length - 1] };
  }
  save();
  render();
}

function render() {
  mapHandle?.destroy();
  mapHandle = null;
  if (ledgerYear > state.year && ![...new Set(state.ledger.map((e) => e.year))].includes(ledgerYear)) {
    ledgerYear = state.year;
  }

  let view = '';
  if (activeTab === 'map') view = renderMapTab(state, selectedVillageId);
  if (activeTab === 'troupe') view = renderTroupeTab(state);
  if (activeTab === 'chest') view = renderChestTab(state);
  if (activeTab === 'ledger') view = renderLedgerTab(state, ledgerFilter, ledgerYear);

  let modalHtml = '';
  if (modal?.type === 'help') modalHtml = helpModal();
  if (modal?.type === 'booking') modalHtml = bookingModal(state);
  if (modal?.type === 'performance') {
    const perf = getPerformance(state, modal.id);
    if (perf) {
      const entry = state.ledger.find((e) => e.performanceId === perf.id);
      modalHtml = performanceModal(state, perf, entry);
    } else {
      modal = null;
    }
  }
  if (modal?.type === 'settlement' || (!modal && state.settlement && false)) {
    modalHtml = settlementModal(state);
  }

  app.innerHTML = `
    <div class="app-shell">
      ${topStats(state)}
      ${tabs(activeTab)}
      ${state.settlement ? settlementBanner(state) : ''}
      <main>${view}</main>
      ${modalHtml}
      ${eventModal(state)}
      ${toastStack(toasts)}
    </div>
  `;

  const canvas = document.querySelector<HTMLCanvasElement>('#map-canvas');
  if (canvas && activeTab === 'map') {
    const travelAnimation = pendingTravel;
    pendingTravel = null;
    mapHandle = mountMap(canvas, state, {
      selectedId: selectedVillageId,
      travelAnimation,
      onSelect: (id) => {
        selectedVillageId = id;
        render();
      },
    });
  }
}

document.addEventListener('click', (ev) => {
  const target = ev.target as HTMLElement;
  const actionEl = target.closest<HTMLElement>('[data-action]');
  if (!actionEl) return;
  const action = actionEl.dataset.action ?? '';

  if (action === 'close-modal-overlay' || action === 'close-booking-overlay' || action === 'overlay-settlement') {
    if (ev.target !== actionEl) return;
    modal = null;
    render();
    return;
  }
  if (action === 'overlay-event') return;

  switch (action) {
    case 'tab': {
      activeTab = (actionEl.dataset.tab as TabId) ?? 'map';
      if (activeTab === 'ledger') ledgerYear = state.year;
      render();
      break;
    }
    case 'close-modal': {
      modal = null;
      render();
      break;
    }
    case 'travel':
    case 'travel-selected': {
      const id = actionEl.dataset.id!;
      const fromId = state.currentVillageId;
      const res = travelTo(state, id);
      if (res.ok) {
        selectedVillageId = id;
        pendingTravel = { fromId, toId: id, days: res.days ?? 1 };
        toast(`已到${state.villages.find((v) => v.id === id)?.name}，路程和饭钱已入账。`, 'good');
        if (state.settlement && !state.pendingEvent) modal = { type: 'settlement' };
      } else {
        toast(res.error ?? '去不成', 'error');
      }
      save();
      render();
      break;
    }
    case 'borrow':
      afterAction(borrowMoney(state, Number(actionEl.dataset.amount ?? 500)), '银钱到手，年关却多了一笔债。');
      break;
    case 'rest':
      afterAction(restDay(state), '休整一日，人马气力恢复了些。');
      break;
    case 'reward':
      afterAction(rewardTroupe(state), '全班打了顿牙祭。');
      break;
    case 'open-help':
      modal = { type: 'help' };
      render();
      break;
    case 'open-booking':
      modal = { type: 'booking' };
      render();
      break;
    case 'open-entry': {
      const entry = state.ledger.find((e) => e.id === actionEl.dataset.id);
      if (entry?.performanceId) {
        modal = { type: 'performance', id: entry.performanceId };
        render();
      }
      break;
    }
    case 'open-settlement':
    case 'settle': {
      if (action === 'settle' && !state.settlement) settleYear(state);
      modal = { type: 'settlement' };
      save();
      render();
      break;
    }
    case 'ledger-filter':
      ledgerFilter = (actionEl.dataset.filter as LedgerFilter) ?? 'all';
      render();
      break;
    case 'ledger-year':
      ledgerYear = Number(actionEl.dataset.year ?? state.year);
      render();
      break;
    case 'event-choice': {
      const choice = actionEl.dataset.choice!;
      const res = resolveEvent(state, choice);
      afterAction(res, choice === 'counter' ? '留住了一把好手。' : undefined);
      break;
    }
    case 'medicine-member':
      afterAction(treatMember(state, actionEl.dataset.id!), '大夫看过，药也抓了。');
      break;
    case 'hire':
      afterAction(hireMember(state, actionEl.dataset.role as RoleId), '新人已挑箱入班。');
      break;
    case 'repair':
      afterAction(repairPuppet(state, actionEl.dataset.id!), '影人整修一新。');
      break;
    case 'buy-puppet':
      afterAction(buyPuppet(state, actionEl.dataset.id!), '新影人已入箱。');
      break;
    case 'rehearse':
      afterAction(rehearsePlay(state, actionEl.dataset.id!), '排了一日，熟度见长。');
      break;
    case 'learn':
      afterAction(learnPlay(state, actionEl.dataset.id!), '一本新戏学到手。');
      break;
    case 'new-year': {
      state = startNewYear(state);
      selectedVillageId = state.currentVillageId;
      ledgerYear = state.year;
      activeTab = 'map';
      modal = null;
      pendingTravel = null;
      save();
      toast('新岁开封，愿今年庙会不断、对台常胜。', 'good');
      render();
      break;
    }
    case 'reset-game': {
      if (window.confirm('确定清空当前存档，重新开一个皮影班吗？')) {
        localStorage.removeItem(SAVE_KEY);
        state = newGame();
        activeTab = 'map';
        selectedVillageId = state.currentVillageId;
        ledgerFilter = 'all';
        ledgerYear = state.year;
        modal = null;
        pendingTravel = null;
        toasts = [];
        save();
        render();
      }
      break;
    }
    default:
      break;
  }
});

document.addEventListener('submit', (ev) => {
  const form = ev.target as HTMLFormElement;
  if (form.id !== 'booking-form') return;
  ev.preventDefault();
  const offerNights = form.querySelectorAll<HTMLSelectElement>('select[data-night]').length;
  const playIds = Array.from({ length: offerNights }, (_, i) => {
    const select = form.querySelector<HTMLSelectElement>(`select[name="night-${i}"]`);
    return select?.value ?? '';
  }).filter(Boolean);
  const res = signAndPerform(state, playIds);
  if (res.ok) {
    toast('这台戏唱完了，每一场都可到账本点开核对。', 'good');
    modal = res.performanceIds?.length
      ? { type: 'performance', id: res.performanceIds[0] }
      : null;
  } else {
    toast(res.error ?? '台口没唱成', 'error');
    if (res.performanceIds?.length) {
      modal = { type: 'performance', id: res.performanceIds[res.performanceIds.length - 1] };
    } else {
      modal = null;
    }
  }
  if (state.settlement) modal = { type: 'settlement' };
  save();
  render();
});

// 供页面控制台/自动化冒烟检查使用。
declare global {
  interface Window {
    __troupe?: { state: GameState; render: () => void; ledgerTabName?: string };
  }
}
window.__troupe = {
  get state() {
    return state;
  },
  render,
};

render();
