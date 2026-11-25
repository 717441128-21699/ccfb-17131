import { REGIONS, VILLAGE_MAP } from './data';
import { getAdjacent, travelDaysForLi } from './engine';
import type { GameState } from './types';

const W = 1000;
const H = 620;
const FONT = '"KaiTi","STKaiti","FangSong","SimSun",serif';

export interface TravelAnimation {
  fromId: string;
  toId: string;
  days: number;
}

export interface MapOptions {
  selectedId?: string;
  travelAnimation?: TravelAnimation | null;
  onSelect?: (villageId: string) => void;
}

export interface MapHandle {
  destroy: () => void;
}

function roundedLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  bg = 'rgba(250,241,220,.92)',
  fg = '#5b3a1e',
) {
  ctx.font = `12px ${FONT}`;
  const width = ctx.measureText(text).width + 10;
  const height = 18;
  ctx.fillStyle = bg;
  ctx.strokeStyle = 'rgba(91,58,30,.28)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x - width / 2, y - height / 2, width, height, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 0.5);
}

function drawRegionBlob(
  ctx: CanvasRenderingContext2D,
  points: Array<[number, number]>,
  color: string,
  name: string,
  blurb: string,
) {
  if (!points.length) return;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  if (points.length === 2) {
    ctx.lineTo(points[1][0], points[1][1]);
  } else {
    for (let i = 1; i < points.length; i += 1) {
      const p = points[i];
      const next = points[(i + 1) % points.length];
      const mx = (p[0] + next[0]) / 2;
      const my = (p[1] + next[1]) / 2;
      ctx.quadraticCurveTo(p[0], p[1], mx, my);
    }
    const first = points[0];
    const second = points[1];
    ctx.quadraticCurveTo(points[points.length - 1][0], points[points.length - 1][1], (first[0] + second[0]) / 2, (first[1] + second[1]) / 2);
  }
  ctx.closePath();
  ctx.fillStyle = color + '33';
  ctx.fill();
  ctx.strokeStyle = color + '88';
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 8]);
  ctx.stroke();
  ctx.setLineDash([]);

  const cx = points.reduce((s, p) => s + p[0], 0) / points.length;
  const cy = points.reduce((s, p) => s + p[1], 0) / points.length;
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = '#5b3a1e';
  ctx.font = `bold 34px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, cx, cy - 8);
  ctx.restore();
  ctx.font = `13px ${FONT}`;
  ctx.fillStyle = 'rgba(91,58,30,.58)';
  ctx.textAlign = 'center';
  ctx.fillText(blurb, cx, cy + 22, 270);
}

export function mountMap(canvas: HTMLCanvasElement, state: GameState, options: MapOptions = {}): MapHandle {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { destroy() {} };
  let raf = 0;
  let hoverId = '';
  const started = performance.now();
  const animDuration = options.travelAnimation ? 900 + options.travelAnimation.days * 420 : 0;
  const abort = new AbortController();

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.max(320, rect.width);
    const height = (width * H) / W;
    if (Math.abs(canvas.width - Math.round(width * dpr)) > 1 || Math.abs(canvas.height - Math.round(height * dpr)) > 1) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.height = `${height}px`;
    }
  }

  function eventPoint(ev: MouseEvent | PointerEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((ev.clientX - rect.left) / rect.width) * W,
      y: ((ev.clientY - rect.top) / rect.height) * H,
    };
  }

  function hitVillage(x: number, y: number): string {
    for (const v of state.villages) {
      const r = 24;
      if ((x - v.x) ** 2 + (y - v.y) ** 2 <= r ** 2) return v.id;
    }
    return '';
  }

  canvas.addEventListener('pointermove', (ev) => {
    const p = eventPoint(ev);
    hoverId = hitVillage(p.x, p.y);
    canvas.style.cursor = hoverId || options.onSelect ? 'pointer' : 'default';
  }, { signal: abort.signal });

  canvas.addEventListener('pointerleave', () => { hoverId = ''; }, { signal: abort.signal });
  canvas.addEventListener('click', (ev) => {
    const p = eventPoint(ev as MouseEvent);
    const id = hitVillage(p.x, p.y);
    if (id) options.onSelect?.(id);
  }, { signal: abort.signal });

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  function playerPosition(now: number): { x: number; y: number } {
    const current = VILLAGE_MAP[state.currentVillageId];
    const anim = options.travelAnimation;
    if (!anim) return { x: current.x, y: current.y };
    const from = VILLAGE_MAP[anim.fromId];
    const to = VILLAGE_MAP[anim.toId];
    const raw = Math.min(1, (now - started) / animDuration);
    const t = raw < 0.5 ? 2 * raw * raw : 1 - ((-2 * raw + 2) ** 2) / 2;
    return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
  }

  function draw(now: number) {
    raf = requestAnimationFrame(draw);
    resize();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    ctx!.setTransform((canvas.width / W), 0, 0, canvas.height / H, 0, 0);
    void dpr;

    const bg = ctx!.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#f6e8c8');
    bg.addColorStop(0.55, '#efd9ad');
    bg.addColorStop(1, '#e5c894');
    ctx!.fillStyle = bg;
    ctx!.fillRect(0, 0, W, H);

    for (const region of REGIONS) drawRegionBlob(ctx!, region.points, region.color, region.name, region.blurb);

    // 村路
    for (const edge of state.routes) {
      const a = VILLAGE_MAP[edge.from];
      const b = VILLAGE_MAP[edge.to];
      ctx!.beginPath();
      ctx!.moveTo(a.x, a.y);
      ctx!.lineTo(b.x, b.y);
      ctx!.strokeStyle = 'rgba(92,64,35,.16)';
      ctx!.lineWidth = 11;
      ctx!.lineCap = 'round';
      ctx!.stroke();

      ctx!.beginPath();
      ctx!.moveTo(a.x, a.y);
      ctx!.lineTo(b.x, b.y);
      ctx!.strokeStyle = '#8c6840';
      ctx!.lineWidth = 2.4;
      ctx!.setLineDash([9, 7]);
      ctx!.stroke();
      ctx!.setLineDash([]);

      const days = travelDaysForLi(edge.li);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      roundedLabel(ctx!, `${edge.li}里·${days}日`, mx, my + 1);
    }

    // 邻村可去提示
    const adjacentIds = new Set(getAdjacent(state, state.currentVillageId).map((x) => x.village.id));
    const pulse = 0.5 + Math.sin(now / 360) * 0.5;

    // 村子
    for (const v of state.villages) {
      const radius = 7 + Math.sqrt(v.population) / 4.2;
      const selected = options.selectedId === v.id;
      const hover = hoverId === v.id;
      const isCurrent = state.currentVillageId === v.id;
      const isAdjacent = adjacentIds.has(v.id);

      if (selected || hover) {
        ctx!.beginPath();
        ctx!.arc(v.x, v.y, radius + 10 + pulse * 2, 0, Math.PI * 2);
        ctx!.fillStyle = 'rgba(154,42,30,.16)';
        ctx!.fill();
      }
      if (isAdjacent) {
        ctx!.beginPath();
        ctx!.arc(v.x, v.y, radius + 6 + pulse * 2.5, 0, Math.PI * 2);
        ctx!.strokeStyle = `rgba(34,104,72,${0.35 + pulse * 0.35})`;
        ctx!.lineWidth = 2;
        ctx!.stroke();
      }

      ctx!.beginPath();
      ctx!.arc(v.x, v.y, radius, 0, Math.PI * 2);
      ctx!.fillStyle = isCurrent ? '#9a2a1e' : selected ? '#7c2d1c' : '#fff4d8';
      ctx!.fill();
      ctx!.lineWidth = selected || isCurrent ? 3 : 2;
      ctx!.strokeStyle = selected || isCurrent ? '#5d1710' : '#6e4a25';
      ctx!.stroke();

      ctx!.font = `bold ${Math.max(14, radius + 4)}px ${FONT}`;
      ctx!.textAlign = 'center';
      ctx!.textBaseline = 'middle';
      ctx!.fillStyle = isCurrent ? '#ffe9b8' : '#3f2a16';
      ctx!.fillText(isCurrent ? '班' : '村', v.x, v.y + 0.5);

      ctx!.font = `bold 16px ${FONT}`;
      ctx!.fillStyle = '#2f2113';
      ctx!.strokeStyle = 'rgba(255,244,216,.9)';
      ctx!.lineWidth = 4;
      const labelY = v.y - radius - 15;
      ctx!.strokeText(v.name, v.x, labelY);
      ctx!.fillText(v.name, v.x, labelY);

      const fair = `${v.fairMonth}/${v.fairDay}庙会`;
      ctx!.font = `11.5px ${FONT}`;
      ctx!.fillStyle = '#8a2f20';
      ctx!.strokeStyle = 'rgba(255,244,216,.82)';
      ctx!.lineWidth = 3;
      const fairY = v.y + radius + 13;
      ctx!.strokeText(fair, v.x, fairY);
      ctx!.fillText(fair, v.x, fairY);
    }

    // 其他戏班
    state.rivals.forEach((r, idx) => {
      const v = VILLAGE_MAP[r.villageId];
      let ox = 20 + (idx % 2) * 16;
      let oy = -18 - Math.floor(idx / 2) * 14;
      if (r.villageId === state.currentVillageId) {
        ox = 24 + idx * 4;
        oy = -24 - idx * 16;
      }
      const x = v.x + ox;
      const y = v.y + oy;
      ctx!.beginPath();
      ctx!.arc(x, y, 11, 0, Math.PI * 2);
      ctx!.fillStyle = r.color;
      ctx!.fill();
      ctx!.strokeStyle = '#fff0c8';
      ctx!.lineWidth = 2;
      ctx!.stroke();
      ctx!.font = `bold 12px ${FONT}`;
      ctx!.fillStyle = '#fff7df';
      ctx!.textAlign = 'center';
      ctx!.textBaseline = 'middle';
      ctx!.fillText(r.name[0], x, y + 0.5);
      ctx!.font = `11px ${FONT}`;
      ctx!.fillStyle = r.color;
      ctx!.fillText(r.name, x, y + 21);
    });

    // 玩家令牌
    const p = playerPosition(now);
    ctx!.beginPath();
    ctx!.ellipse(p.x + 3, p.y + 18, 15, 5, 0, 0, Math.PI * 2);
    ctx!.fillStyle = 'rgba(45,28,12,.25)';
    ctx!.fill();

    const bob = options.travelAnimation ? Math.sin(now / 90) * 2.5 : Math.sin(now / 650) * 1.2;
    ctx!.beginPath();
    ctx!.arc(p.x, p.y + bob, 16, 0, Math.PI * 2);
    ctx!.fillStyle = '#b3271c';
    ctx!.fill();
    ctx!.strokeStyle = '#f5d17b';
    ctx!.lineWidth = 3;
    ctx!.stroke();
    ctx!.font = `bold 17px ${FONT}`;
    ctx!.fillStyle = '#ffe8a8';
    ctx!.textAlign = 'center';
    ctx!.textBaseline = 'middle';
    ctx!.fillText('班', p.x, p.y + bob + 1);

    if (options.travelAnimation) {
      ctx!.font = `13px ${FONT}`;
      ctx!.fillStyle = '#7a2418';
      ctx!.fillText(`赶路中：${options.travelAnimation.days}日脚程`, p.x, p.y - 27 + bob);
    }

    // 图例
    ctx!.fillStyle = 'rgba(250,241,220,.86)';
    ctx!.strokeStyle = 'rgba(91,58,30,.25)';
    ctx!.beginPath();
    ctx!.roundRect(18, H - 54, 310, 38, 10);
    ctx!.fill();
    ctx!.stroke();
    ctx!.font = `13px ${FONT}`;
    ctx!.fillStyle = '#4d3219';
    ctx!.textAlign = 'left';
    ctx!.textBaseline = 'middle';
    ctx!.fillText('红“班”为你；绿圈是可去邻村；彩点为其他戏班。点村子看会首与庙会。', 32, H - 35);
  }

  raf = requestAnimationFrame(draw);
  return {
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      abort.abort();
    },
  };
}
