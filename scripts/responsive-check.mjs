import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = 9344;
rmSync('.tmp/resp-profile', { recursive: true, force: true });
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-sandbox', `--remote-debugging-port=${PORT}`,
  '--user-data-dir=D:\\codex\\runs\\17131\\workspace\\.tmp\\resp-profile',
  'http://127.0.0.1:4180/',
], { stdio: 'ignore' });

try {
  let list;
  for (let i = 0; i < 30; i++) {
    try { list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); if (list[0]?.webSocketDebuggerUrl) break; } catch {}
    await sleep(200);
  }
  const ws = new WebSocket(list[0].webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id) pending.get(m.id)?.(m); pending.delete(m.id); };
  const send = (method, params={}) => new Promise((resolve) => { const mid=++id; pending.set(mid, resolve); ws.send(JSON.stringify({id:mid,method,params})); });
  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true });
    return r.result.result.value;
  };
  await send('Runtime.enable');
  await sleep(1000);
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
  await sleep(500);
  const info = await evalJs(`(() => {
    const tabs=document.querySelector('.tabs');
    const btn=document.querySelector('.tab-btn');
    const cs=getComputedStyle(tabs);
    return {
      innerWidth,
      docScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      tabsWidth: tabs.getBoundingClientRect().width,
      tabsGrid: cs.gridTemplateColumns,
      tabsRect: tabs.getBoundingClientRect().toJSON(),
      btnWidth: btn.getBoundingClientRect().width,
      headerSideWidth: document.querySelector('.header-side').getBoundingClientRect().width,
      overflowNodes: [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).slice(0,12).map(el => ({tag:el.tagName, cls:el.className, right:Math.round(el.getBoundingClientRect().right), width:Math.round(el.getBoundingClientRect().width)}))
    };
  })()`);
  console.log(JSON.stringify(info, null, 2));
  ws.close();
} finally {
  chrome.kill();
}
