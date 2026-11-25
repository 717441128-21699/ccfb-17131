import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9333;
const URL = 'http://127.0.0.1:4180/';
rmSync('.tmp/cdp-profile', { recursive: true, force: true });
mkdirSync('.tmp/cdp-profile', { recursive: true });

const chrome = spawn(CHROME, [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  `--remote-debugging-port=${PORT}`,
  '--user-data-dir=D:\\codex\\runs\\17131\\workspace\\.tmp\\cdp-profile',
  URL,
], { stdio: 'ignore' });

const errors = [];
let ws;
let msgId = 0;
const pending = new Map();

function onMessage(event) {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result);
    return;
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
  }
  if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
    const text = msg.params.entry.text;
    const url = msg.params.entry.url || '';
    if (text.includes('favicon') || url.includes('favicon.ico')) return;
    errors.push(url ? `${text} (${url})` : text);
  }
}

async function main() {
  let list;
  for (let i = 0; i < 30; i += 1) {
    try {
      list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      if (list?.some((t) => t.type === 'page')) break;
    } catch {}
    await sleep(300);
  }
  const page = list.find((t) => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  ws.addEventListener('message', onMessage);

  function send(method, params = {}) {
    const id = ++msgId;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    }
    return result.result.value;
  }

  await send('Runtime.enable');
  await send('Log.enable');
  await sleep(1400);

  const initial = await evaluate(`({
    h1: document.querySelector('h1')?.textContent,
    canvas: !!document.querySelector('#map-canvas'),
    bookingButton: !!document.querySelector('[data-action="open-booking"]'),
    state: !!window.__troupe
  })`);
  if (!initial.canvas || !initial.bookingButton || !initial.state) throw new Error(`首屏不完整: ${JSON.stringify(initial)}`);

  await evaluate(`document.querySelector('[data-action="open-booking"]').click()`);
  await sleep(100);
  const booking = await evaluate(`!!document.querySelector('#booking-form')`);
  if (!booking) throw new Error('订票弹窗没有打开');

  await evaluate(`document.querySelector('#booking-form button[type="submit"]').click()`);
  await sleep(300);
  const afterShow = await evaluate(`({
    modalTitle: document.querySelector('.modal-head h3')?.textContent || '',
    performances: window.__troupe.state.performances.length,
    ledger: window.__troupe.state.ledger.length,
    cash: window.__troupe.state.cash
  })`);
  if (afterShow.performances < 1) throw new Error(`签约后没有演出记录: ${JSON.stringify(afterShow)}`);
  if (!afterShow.modalTitle.includes('演出明细')) throw new Error(`没有打开演出明细: ${JSON.stringify(afterShow)}`);

  await evaluate(`document.querySelector('.modal-head [data-action="close-modal"]').click()`);
  await sleep(100);

  await evaluate(`document.querySelector('[data-tab="troupe"]').click()`);
  await sleep(100);
  const troupeCards = await evaluate(`document.querySelectorAll('.member-card').length`);
  if (troupeCards < 6) throw new Error(`人员卡数量不对: ${troupeCards}`);

  await evaluate(`document.querySelector('[data-tab="chest"]').click()`);
  await sleep(100);
  const chest = await evaluate(`({
    puppets: document.querySelectorAll('.chest-card').length,
    scripts: document.querySelectorAll('.script-card').length
  })`);
  if (chest.puppets < 9 || chest.scripts < 9) throw new Error(`戏箱/唱本卡不足: ${JSON.stringify(chest)}`);

  await evaluate(`document.querySelector('[data-tab="ledger"]').click()`);
  await sleep(100);
  const ledgerRows = await evaluate(`document.querySelectorAll('.ledger-row').length`);
  if (ledgerRows < 3) throw new Error(`账本条目不足: ${ledgerRows}`);
  await evaluate(`document.querySelector('.ledger-row.income[data-action="open-entry"]')?.click()`);
  await sleep(100);
  const detailTitle = await evaluate(`document.querySelector('.modal-head h3')?.textContent || ''`);
  if (!detailTitle.includes('演出明细')) throw new Error(`账本进项没有打开场次明细: ${detailTitle}`);

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync('.tmp/browser-ledger.png', Buffer.from(shot.data, 'base64'));

  if (errors.length) throw new Error(`浏览器控制台错误:\n${errors.join('\n')}`);
  console.log(JSON.stringify({ ok: true, initial, afterShow, troupeCards, chest, ledgerRows, detailTitle }, null, 2));
}

main().catch((err) => {
  console.error(err);
  console.error('captured errors:', errors);
  process.exitCode = 1;
}).finally(() => {
  try { ws?.close(); } catch {}
  chrome.kill();
  setTimeout(() => process.exit(process.exitCode || 0), 300);
});
