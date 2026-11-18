export interface WxTouchPoint {
  identifier: number;
  clientX?: number;
  clientY?: number;
  pageX?: number;
  pageY?: number;
  x?: number;
  y?: number;
}

export interface WxTouchEvent {
  touches: WxTouchPoint[];
  changedTouches: WxTouchPoint[];
  timeStamp: number;
}

export interface WxCanvas {
  width: number;
  height: number;
  getContext(type: '2d'): CanvasRenderingContext2D | null;
}

export interface WxSystemInfo {
  windowWidth: number;
  windowHeight: number;
  pixelRatio: number;
  safeArea?: {
    left: number;
    right: number;
    top: number;
    bottom: number;
    width: number;
    height: number;
  };
}

export interface WxMiniGameGlobal {
  createCanvas(): WxCanvas;
  createImage(): HTMLImageElement;
  getSystemInfoSync(): WxSystemInfo;
  getWindowInfo?: () => WxSystemInfo;
  onTouchStart(cb: (e: WxTouchEvent) => void): void;
  onTouchMove(cb: (e: WxTouchEvent) => void): void;
  onTouchEnd(cb: (e: WxTouchEvent) => void): void;
  onTouchCancel(cb: (e: WxTouchEvent) => void): void;
  onShow(cb: () => void): void;
  onHide(cb: () => void): void;
  showShareMenu?: (opts: { withShareTicket?: boolean; menus?: string[] }) => void;
  onShareAppMessage?: (cb: () => { title: string; imageUrl?: string }) => void;
  showToast?: (opts: { title: string; icon?: 'success' | 'error' | 'loading' | 'none'; duration?: number }) => void;
  getStorageSync(key: string): unknown;
  setStorageSync(key: string, data: string): void;
  removeStorageSync(key: string): void;
}

export interface MiniGamePlatformAdapter {
  width: number;
  height: number;
  dpr: number;
  safeLeft: number;
  safeRight: number;
  safeTop: number;
  safeBottom: number;
  ctx: CanvasRenderingContext2D;
  nowMs: () => number;
  nowPerf: () => number;
  scheduleFrame: (cb: (time: number) => void) => number;
  cancelFrame: (id: number) => void;
  onShowToast?: (message: string) => void;
}
