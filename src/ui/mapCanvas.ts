import { REGION_NAMES, ROUTES, VILLAGES } from '../game/data';
import type { GameEngine } from '../game/engine';
import type { GameState, Village } from '../game/types';
import { fairCountdown } from '../game/world';

const W = 1000;
const H = 650;

interface MapHandle {
  destroy(): void;
}

export function createMapCanvas(
  canvas: HTMLCanvasElement,
  engine: GameEngine,
  onSelectVillage: (id: string) => void,
): MapHandle {
  const context = canvas.getContext('2d');
  if (!context) return { destroy() {} };
  const ctx: CanvasRenderingContext2D = context;

  let cssWidth = W;
  let cssHeight = H;
  let dpr = Math.max(1, window.devicePixelRatio || 1);
  let hoveredId: string | null = null;
  let selectedId = engine.state.currentVillageId;
  const visual = { x: 145, y: 302 };
  let raf = 0;
  let lastTime = performance.now();

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    cssWidth = rect.width || W;
    cssHeight = rect.height || cssWidth * (H / W);
    dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  function toLogical(event: PointerEvent | MouseEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * W,
      y: ((event.clientY - rect.top) / rect.height) * H,
    };
  }

  function hitTest(x: number, y: number): Village | null {
    for (const village of VILLAGES) {
      const radius = villageRadius(village) + 8;
      if ((x - village.x) ** 2 + (y - village.y) ** 2 <= radius ** 2) return village;
    }
    return null;
  }

  const onPointerMove = (event: PointerEvent) => {
    const p = toLogical(event);
    const hit = hitTest(p.x, p.y);
    hoveredId = hit?.id ?? null;
    canvas.style.cursor = hit ? 'pointer' : 'default';
  };
  const onPointerLeave = () => { hoveredId = null; };
  const onClick = (event: MouseEvent) => {
    const p = toLogical(event);
    const hit = hitTest(p.x, p.y);
    if (hit) {
      selectedId = hit.id;
      onSelectVillage(hit.id);
    }
  };

  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('click', onClick);

  function setSelected(id: string) {
    selectedId = id;
  }
  (canvas as HTMLCanvasElement & { __setSelected?: (id: string) => void }).__setSelected = setSelected;

  function draw(now: number) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    const state = engine.state;

    let target = VILLAGES.find((v) => v.id === state.currentVillageId) ?? VILLAGES[0];
    if (state.travel) {
      const from = VILLAGES.find((v) => v.id === state.travel!.fromVillageId) ?? target;
      const to = VILLAGES.find((v) => v.id === state.travel!.toVillageId) ?? target;
      const progress = Math.min(1, state.travel.elapsedDays / state.travel.totalDays);
      target = {
        ...to,
        x: from.x + (to.x - from.x) * progress,
        y: from.y + (to.y - from.y) * progress,
      };
    }
    const smoothing = 1 - Math.exp(-dt * 7);
    visual.x += (target.x - visual.x) * smoothing;
    visual.y += (target.y - visual.y) * smoothing;

    ctx!.setTransform((cssWidth / W) * dpr, 0, 0, (cssHeight / H) * dpr, 0, 0);
    drawMap(state, now);
    raf = requestAnimationFrame(draw);
  }

  function drawMap(state: GameState, now: number) {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);

    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#f1dfb4');
    bg.addColorStop(0.55, '#e8cf99');
    bg.addColorStop(1, '#d9b978');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    drawRegions();
    drawRiver();
    drawRoutes(state);
    drawFairHalos(state, now);
    drawRivals(state, now);
    drawVillages(state, now);
    drawPlayer(visual.x, visual.y, now, Boolean(state.travel), Boolean(state.activeRunId));
    drawCompass();
  }

  function drawRegions() {
    const regions = [
      { name: REGION_NAMES.beimang, x: 38, y: 28, w: 850, h: 178, color: 'rgba(126, 92, 47, .13)', rotate: -0.015 },
      { name: REGION_NAMES.weihe, x: 70, y: 214, w: 850, h: 205, color: 'rgba(47, 98, 84, .12)', rotate: 0.01 },
      { name: REGION_NAMES.nanshan, x: 70, y: 448, w: 850, h: 176, color: 'rgba(65, 103, 58, .14)', rotate: -0.006 },
    ];
    regions.forEach((r) => {
      ctx!.save();
      ctx!.translate(r.x + r.w / 2, r.y + r.h / 2);
      ctx!.rotate(r.rotate);
      roundRect(ctx!, -r.w / 2, -r.h / 2, r.w, r.h, 42);
      ctx!.fillStyle = r.color;
      ctx!.fill();
      ctx!.strokeStyle = 'rgba(91, 61, 29, .16)';
      ctx!.setLineDash([10, 12]);
      ctx!.lineWidth = 2;
      ctx!.stroke();
      ctx!.setLineDash([]);
      ctx!.restore();

      ctx!.save();
      ctx!.font = '900 34px "Noto Serif SC", "Songti SC", serif';
      ctx!.fillStyle = 'rgba(83, 52, 24, .18)';
      ctx!.fillText(r.name, r.x + 28, r.y + 48);
      ctx!.restore();
    });

    // 北蟒塬褶皱
    ctx.strokeStyle = 'rgba(93, 61, 25, .16)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      const x = 70 + i * 105;
      ctx.beginPath();
      ctx.moveTo(x, 190);
      ctx.quadraticCurveTo(x + 35, 150 + (i % 3) * 12, x + 75, 188);
      ctx.stroke();
    }
    // 南山
    for (let i = 0; i < 8; i++) {
      const x = 80 + i * 115;
      ctx.fillStyle = 'rgba(47, 98, 84, .12)';
      ctx.beginPath();
      ctx.moveTo(x, 620);
      ctx.lineTo(x + 55, 475 + (i % 2) * 28);
      ctx.lineTo(x + 110, 620);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawRiver() {
    ctx.save();
    ctx.strokeStyle = 'rgba(43, 103, 137, .28)';
    ctx.lineWidth = 18;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 430);
    ctx.bezierCurveTo(170, 390, 235, 455, 380, 425);
    ctx.bezierCurveTo(560, 388, 650, 445, 820, 405);
    ctx.bezierCurveTo(910, 384, 960, 398, 1000, 386);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(220, 244, 255, .35)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(20, 427);
    ctx.bezierCurveTo(180, 397, 250, 448, 382, 423);
    ctx.bezierCurveTo(560, 394, 650, 438, 815, 405);
    ctx.stroke();
    ctx.restore();
  }

  function drawRoutes(state: GameState) {
    ROUTES.forEach((route) => {
      const a = VILLAGES.find((v) => v.id === route.from)!;
      const b = VILLAGES.find((v) => v.id === route.to)!;
      const isCurrentRoute = state.travel?.fromVillageId === route.from && state.travel?.toVillageId === route.to
        || state.travel?.fromVillageId === route.to && state.travel?.toVillageId === route.from;
      ctx!.save();
      ctx!.lineCap = 'round';
      ctx!.strokeStyle = isCurrentRoute ? 'rgba(141, 36, 27, .72)' : 'rgba(91, 55, 24, .34)';
      ctx!.lineWidth = isCurrentRoute ? 6 : 4;
      ctx!.setLineDash(isCurrentRoute ? [] : [2, 10]);
      ctx!.beginPath();
      ctx!.moveTo(a.x, a.y);
      ctx!.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 - 18, b.x, b.y);
      ctx!.stroke();
      ctx!.setLineDash([]);

      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2 - 18;
      ctx!.font = '700 11px system-ui, sans-serif';
      const text = `${route.li}里`;
      const width = ctx!.measureText(text).width + 10;
      ctx!.fillStyle = 'rgba(248, 237, 207, .86)';
      roundRect(ctx!, mx - width / 2, my - 9, width, 17, 8);
      ctx!.fill();
      ctx!.fillStyle = 'rgba(75, 43, 27, .78)';
      ctx!.textAlign = 'center';
      ctx!.textBaseline = 'middle';
      ctx!.fillText(text, mx, my);
      ctx!.restore();
    });
  }

  function drawFairHalos(state: any, now: number) {
    VILLAGES.forEach((v) => {
      const d = fairCountdown(state, v);
      if (d < -2 || d > 5) return;
      const pulse = 0.5 + Math.sin(now / 280 + v.x) * 0.5;
      ctx!.save();
      ctx!.beginPath();
      ctx!.arc(v.x, v.y, villageRadius(v) + 12 + pulse * 5, 0, Math.PI * 2);
      ctx!.fillStyle = `rgba(224, 189, 104, ${0.12 + pulse * 0.12})`;
      ctx!.fill();
      ctx!.strokeStyle = 'rgba(189, 138, 47, .75)';
      ctx!.lineWidth = 2;
      ctx!.stroke();
      ctx!.restore();
    });
  }

  function drawVillages(state: any, now: number) {
    VILLAGES.forEach((v) => {
      const radius = villageRadius(v);
      const selected = selectedId === v.id;
      const hovered = hoveredId === v.id;
      const current = state.currentVillageId === v.id && !state.travel;

      if (selected || hovered) {
        ctx!.beginPath();
        ctx!.arc(v.x, v.y, radius + 9 + Math.sin(now / 220) * 1.5, 0, Math.PI * 2);
        ctx!.strokeStyle = selected ? 'rgba(141,36,27,.9)' : 'rgba(75,43,27,.45)';
        ctx!.lineWidth = selected ? 3 : 2;
        ctx!.stroke();
      }

      ctx!.beginPath();
      ctx!.arc(v.x, v.y, radius + 2, 0, Math.PI * 2);
      ctx!.fillStyle = '#f8edcf';
      ctx!.fill();
      ctx!.beginPath();
      ctx!.arc(v.x, v.y, radius, 0, Math.PI * 2);
      ctx!.fillStyle = v.population >= 600 ? '#7d1d14' : v.region === 'beimang' ? '#8a5a24' : v.region === 'nanshan' ? '#2f6254' : '#9b6a27';
      ctx!.fill();
      ctx!.lineWidth = 2;
      ctx!.strokeStyle = '#fff0c4';
      ctx!.stroke();

      if (fairCountdown(state, v) >= -1 && fairCountdown(state, v) <= 3) {
        ctx!.font = '16px "Noto Serif SC", serif';
        ctx!.textAlign = 'center';
        ctx!.fillText('🏮', v.x + radius + 5, v.y - radius - 2);
      }

      ctx!.font = `${v.population >= 600 ? 900 : 800} ${v.population >= 600 ? 17 : 15}px "Noto Serif SC","Songti SC",serif`;
      ctx!.textAlign = 'center';
      ctx!.textBaseline = 'top';
      ctx!.lineWidth = 4;
      ctx!.strokeStyle = 'rgba(248,237,207,.92)';
      ctx!.strokeText(v.name, v.x, v.y + radius + 5);
      ctx!.fillStyle = current ? '#7d1d14' : '#3a2417';
      ctx!.fillText(v.name, v.x, v.y + radius + 5);
    });
  }

  function drawRivals(state: any, now: number) {
    state.rivals.forEach((rival: any, index: number) => {
      const v = VILLAGES.find((item) => item.id === rival.villageId);
      if (!v) return;
      const x = v.x - villageRadius(v) - 12;
      const y = v.y - villageRadius(v) - 12 + Math.sin(now / 500 + index) * 2;
      ctx!.save();
      ctx!.translate(x, y);
      ctx!.fillStyle = rival.color;
      ctx!.strokeStyle = '#f7e4ad';
      ctx!.lineWidth = 2;
      ctx!.beginPath();
      ctx!.moveTo(-9, 9);
      ctx!.lineTo(-9, -12);
      ctx!.lineTo(12, -7);
      ctx!.lineTo(-9, -1);
      ctx!.closePath();
      ctx!.fill();
      ctx!.stroke();
      ctx!.font = '900 10px "Noto Serif SC", serif';
      ctx!.fillStyle = '#fff1c9';
      ctx!.textAlign = 'center';
      ctx!.fillText(rival.name[0], 0, -1);
      ctx!.restore();
    });
  }

  function drawPlayer(x: number, y: number, now: number, traveling: boolean, performing: boolean) {
    const bob = traveling ? Math.sin(now / 90) * 2.5 : Math.sin(now / 700) * 0.8;
    ctx!.save();
    ctx!.translate(x, y - 24 + bob);

    // 戏箱
    ctx!.fillStyle = '#6b3f1d';
    roundRect(ctx!, -18, 13, 36, 18, 4);
    ctx!.fill();
    ctx!.strokeStyle = '#d7ad55';
    ctx!.lineWidth = 2;
    ctx!.stroke();
    ctx!.beginPath();
    ctx!.moveTo(-18, 21); ctx!.lineTo(18, 21);
    ctx!.moveTo(0, 13); ctx!.lineTo(0, 31);
    ctx!.stroke();

    // 班主/签手令牌
    ctx!.beginPath();
    ctx!.arc(0, 0, 17, 0, Math.PI * 2);
    ctx!.fillStyle = '#a3271d';
    ctx!.fill();
    ctx!.lineWidth = 4;
    ctx!.strokeStyle = '#f2c866';
    ctx!.stroke();
    ctx!.font = '900 17px "Noto Serif SC","Songti SC",serif';
    ctx!.fillStyle = '#fff0c4';
    ctx!.textAlign = 'center';
    ctx!.textBaseline = 'middle';
    ctx!.fillText('班', 0, 1);

    if (performing) {
      ctx!.font = '18px serif';
      ctx!.fillText('🎭', 22, -15);
    }
    if (traveling) {
      ctx!.font = '16px serif';
      ctx!.fillText('🧳', -27, -12);
    }
    ctx!.restore();
  }

  function drawCompass() {
    ctx!.save();
    ctx!.translate(948, 54);
    ctx!.beginPath();
    ctx!.arc(0, 0, 27, 0, Math.PI * 2);
    ctx!.fillStyle = 'rgba(248,237,207,.72)';
    ctx!.fill();
    ctx!.strokeStyle = 'rgba(91,55,24,.35)';
    ctx!.stroke();
    ctx!.font = '900 15px "Noto Serif SC", serif';
    ctx!.fillStyle = '#7d1d14';
    ctx!.textAlign = 'center';
    ctx!.textBaseline = 'middle';
    ctx!.fillText('北', 0, -12);
    ctx!.beginPath();
    ctx!.moveTo(0, -4); ctx!.lineTo(7, 12); ctx!.lineTo(0, 8); ctx!.lineTo(-7, 12); ctx!.closePath();
    ctx!.fillStyle = '#7d1d14';
    ctx!.fill();
    ctx!.restore();
  }

  raf = requestAnimationFrame(draw);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      observer.disconnect();
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('click', onClick);
    },
  };
}

function villageRadius(v: Village): number {
  return 8 + Math.sqrt(v.population) / 5.2;
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + radius, y);
  c.arcTo(x + w, y, x + w, y + h, radius);
  c.arcTo(x + w, y + h, x, y + h, radius);
  c.arcTo(x, y + h, x, y, radius);
  c.arcTo(x, y, x + w, y, radius);
  c.closePath();
}

export function setMapSelected(canvas: HTMLCanvasElement | null, id: string) {
  const extended = canvas as (HTMLCanvasElement & { __setSelected?: (id: string) => void }) | null;
  extended?.__setSelected?.(id);
}
