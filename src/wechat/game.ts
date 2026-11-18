import { WechatMiniGameApp } from './miniGameApp';
import type { WxMiniGameGlobal, WxTouchEvent, WxTouchPoint } from './wxTypes';

function getPointCoords(p: WxTouchPoint): { id: number; x: number; y: number } {
  return {
    id: p.identifier,
    x: p.clientX ?? p.pageX ?? p.x ?? 0,
    y: p.clientY ?? p.pageY ?? p.y ?? 0,
  };
}

function bootstrapWechatMiniGame(): void {
  const wxApi = (globalThis as unknown as { wx?: WxMiniGameGlobal }).wx;
  if (!wxApi) {
    throw new Error('WeChat Mini Game runtime (wx) not detected.');
  }

  const canvas = wxApi.createCanvas();
  const sysInfo =
    typeof wxApi.getWindowInfo === 'function'
      ? wxApi.getWindowInfo()
      : wxApi.getSystemInfoSync();

  const width = sysInfo.windowWidth || 667;
  const height = sysInfo.windowHeight || 375;
  const dpr = Math.min(sysInfo.pixelRatio || 1, 2);

  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to acquire 2D context on WeChat Mini Game main canvas.');
  }

  const safeArea = sysInfo.safeArea;
  const safeLeft = safeArea ? safeArea.left : 0;
  const safeTop = safeArea ? safeArea.top : 0;
  const safeRight = safeArea ? Math.max(0, width - safeArea.right) : 0;
  const safeBottom = safeArea ? Math.max(0, height - safeArea.bottom) : 0;

  const app = new WechatMiniGameApp({
    width,
    height,
    dpr,
    safeLeft,
    safeRight,
    safeTop,
    safeBottom,
    ctx,
    nowMs: () => Date.now(),
    nowPerf: () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
    scheduleFrame: (cb) => requestAnimationFrame(cb),
    cancelFrame: (id) => cancelAnimationFrame(id),
  });

  wxApi.onTouchStart((e: WxTouchEvent) => {
    app.handleTouchStart((e.touches || []).map(getPointCoords));
  });
  wxApi.onTouchMove((e: WxTouchEvent) => {
    app.handleTouchMove((e.touches || []).map(getPointCoords));
  });
  wxApi.onTouchEnd((e: WxTouchEvent) => {
    app.handleTouchEnd((e.changedTouches || []).map(getPointCoords));
  });
  wxApi.onTouchCancel((e: WxTouchEvent) => {
    app.handleTouchEnd((e.changedTouches || []).map(getPointCoords));
  });

  wxApi.onShow(() => app.handleAppShow());
  wxApi.onHide(() => app.handleAppHide());

  if (typeof wxApi.showShareMenu === 'function') {
    wxApi.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline'],
    });
  }
  if (typeof wxApi.onShareAppMessage === 'function') {
    wxApi.onShareAppMessage(() => {
      const s = app.getStateSummary();
      return {
        title: `我在《部落冲突》微信小游戏建成了 ${s.village.townHallLevel} 级大本营，奖杯 ${s.village.trophies}！`,
      };
    });
  }

  app.start();
}

bootstrapWechatMiniGame();
