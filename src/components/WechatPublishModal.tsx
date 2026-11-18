import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Hammer,
  Package,
  QrCode,
  RefreshCw,
  ShieldAlert,
  UploadCloud,
  X,
} from 'lucide-react';
import { GAME_ICON_URL } from '../game/gameIconAsset';

interface BundleFileStat {
  path: string;
  size: number;
}

interface WechatBundleInfo {
  ready: boolean;
  appid: string | null;
  deviceOrientation: string | null;
  libVersion: string | null;
  spriteCount: number;
  totalBytes: number;
  mainPackageLimitBytes: number;
  totalLimitBytes: number;
  withinMainLimit: boolean;
  withinTotalLimit: boolean;
  builtAt: string | null;
  files: BundleFileStat[];
}

interface WechatCredentialsStatus {
  configured: boolean;
  hasAppId: boolean;
  validAppIdFormat: boolean;
  hasPrivateKey: boolean;
  maskedAppId: string;
  missingFields: string[];
}

interface PublishStep {
  stage: string;
  detail: string;
  timestamp: string;
}

interface WechatStatusResponse {
  ok: boolean;
  packageVersion: string;
  bundle: WechatBundleInfo;
  credentials: WechatCredentialsStatus;
}

interface WechatPublishModalProps {
  onClose: () => void;
  onNotify?: (msg: string) => void;
}

function formatBytesMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatBytesKb(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export const WechatPublishModal: React.FC<WechatPublishModalProps> = ({
  onClose,
  onNotify,
}) => {
  const [status, setStatus] = useState<WechatStatusResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [building, setBuilding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  const [version, setVersion] = useState('1.0.0');
  const [desc, setDesc] = useState('天启崛起微信小游戏发布版本');
  const [robot, setRobot] = useState(1);

  const [steps, setSteps] = useState<PublishStep[]>([]);
  const [feedback, setFeedback] = useState<{
    kind: 'success' | 'warning' | 'error';
    title: string;
    detail: string;
    missingFields?: string[];
  } | null>(null);
  const [previewQrUrl, setPreviewQrUrl] = useState<string | null>(null);
  const [showFiles, setShowFiles] = useState(false);
  const versionInitializedRef = useRef(false);

  const fetchStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch('/api/wechat/status');
      const data = (await res.json()) as WechatStatusResponse;
      if (data.ok) {
        setStatus(data);
        if (data.packageVersion && !versionInitializedRef.current) {
          versionInitializedRef.current = true;
          setVersion(data.packageVersion);
        }
      }
    } catch {
      setFeedback({
        kind: 'error',
        title: '无法连接本地构建服务',
        detail: '请确认服务端正在运行（npm run dev）后重试。',
      });
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  const handleRebuild = async () => {
    setBuilding(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/wechat/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = (await res.json()) as {
        ok: boolean;
        bundle?: WechatBundleInfo;
        message?: string;
      };
      if (data.ok && data.bundle) {
        setStatus((prev) => (prev ? { ...prev, bundle: data.bundle! } : prev));
        setFeedback({
          kind: 'success',
          title: '微信小游戏包体构建完成',
          detail: `已生成 dist-wechat/（${data.bundle.spriteCount} 张精灵贴图 · 总计 ${formatBytesMb(data.bundle.totalBytes)}）`,
        });
        onNotify?.('微信小游戏包体构建完成');
      } else {
        setFeedback({
          kind: 'error',
          title: '构建失败',
          detail: data.message ?? '未知构建错误',
        });
      }
    } catch (err) {
      setFeedback({
        kind: 'error',
        title: '构建请求失败',
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBuilding(false);
    }
  };

  const handleOneClickUpload = async () => {
    setUploading(true);
    setFeedback(null);
    setPreviewQrUrl(null);
    setSteps([
      {
        stage: 'init',
        detail: '正在触发一键构建与微信发布平台上传流程...',
        timestamp: new Date().toISOString(),
      },
    ]);

    try {
      const res = await fetch('/api/wechat/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: version.trim() || '1.0.0',
          desc: desc.trim() || '天启崛起微信小游戏发布版本',
          robot,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        code?: string;
        message?: string;
        version?: string;
        maskedAppId?: string;
        missingFields?: string[];
        bundle?: WechatBundleInfo;
        steps?: PublishStep[];
      };

      if (data.bundle) {
        setStatus((prev) => (prev ? { ...prev, bundle: data.bundle! } : prev));
      }
      if (Array.isArray(data.steps) && data.steps.length > 0) {
        setSteps(data.steps);
      }

      if (data.ok) {
        setFeedback({
          kind: 'success',
          title: `版本 v${data.version} 已上传至微信小游戏发布平台`,
          detail: `目标 AppID：${data.maskedAppId} · 可前往微信公众平台（mp.weixin.qq.com）版本管理中设为体验版或提交审核。`,
        });
        onNotify?.(`版本 v${data.version} 上传成功`);
      } else if (data.code === 'MISSING_CREDENTIALS' || data.code === 'INVALID_APPID') {
        setFeedback({
          kind: 'warning',
          title: '已完成本地构建校验，等待配置微信发布凭证',
          detail: data.message ?? '请配置 WECHAT_APPID 与 WECHAT_PRIVATE_KEY 后即可直传微信平台。',
          missingFields: data.missingFields,
        });
      } else {
        setFeedback({
          kind: 'error',
          title: '上传至微信平台失败',
          detail: data.message ?? '请检查网络连接、IP 白名单或上传密钥是否正确。',
        });
      }
    } catch (err) {
      setFeedback({
        kind: 'error',
        title: '网络异常',
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setUploading(false);
    }
  };

  const handleGeneratePreview = async () => {
    setPreviewing(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/wechat/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: version.trim() || '1.0.0',
          desc: desc.trim() || '真机预览包',
          robot,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        code?: string;
        message?: string;
        missingFields?: string[];
        qrcodeDataUrl?: string;
        bundle?: WechatBundleInfo;
      };
      if (data.bundle) {
        setStatus((prev) => (prev ? { ...prev, bundle: data.bundle! } : prev));
      }
      if (data.ok && data.qrcodeDataUrl) {
        setPreviewQrUrl(data.qrcodeDataUrl);
        setFeedback({
          kind: 'success',
          title: '已生成微信真机预览二维码',
          detail: '请使用项目成员微信号扫描下方二维码体验实机运行效果。',
        });
      } else {
        setFeedback({
          kind: data.code === 'MISSING_CREDENTIALS' ? 'warning' : 'error',
          title: '无法生成预览二维码',
          detail: data.message ?? '请确认微信发布凭证配置无误。',
          missingFields: data.missingFields,
        });
      }
    } catch (err) {
      setFeedback({
        kind: 'error',
        title: '预览请求失败',
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setPreviewing(false);
    }
  };

  const handleDownloadZip = () => {
    window.location.assign('/api/wechat/download-zip');
    onNotify?.('正在打包下载 clash-of-clans-wechat.zip');
  };

  const bundle = status?.bundle;
  const creds = status?.credentials;
  const mainLimitRatio = bundle
    ? Math.min(100, Math.round((bundle.totalBytes / bundle.mainPackageLimitBytes) * 100))
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div
        role="dialog"
        aria-label="微信小游戏一键发布平台"
        className="w-full max-w-2xl rounded-2xl bg-[#2a1c11] border-4 border-[#8b5e34] shadow-2xl overflow-hidden text-amber-100 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#1c120a] border-b-2 border-[#6e4723] shrink-0">
          <div className="flex items-center gap-3">
            <img
              src={GAME_ICON_URL}
              alt="天启崛起游戏图标"
              referrerPolicy="no-referrer"
              className="w-10 h-10 rounded-xl border border-amber-400/80 object-cover shrink-0 shadow-md"
            />
            <div>
              <h2 className="text-lg font-extrabold text-amber-100">
                微信小游戏发布平台
              </h2>
              <p className="text-xs text-amber-300/80 mt-0.5">
                一键构建产物 · miniprogram-ci 直传公众平台 · 导出开发者工具包
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="关闭发布窗口"
            onClick={onClose}
            className="clash-btn w-9 h-9 rounded-xl bg-red-700 border border-red-950 text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Bundle Readiness & Package Budget */}
          <section className="rounded-xl bg-[#1c120a]/85 border-2 border-[#6e4723] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-extrabold text-amber-100">小游戏构建产物检查</h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={building || loadingStatus}
                  onClick={handleRebuild}
                  className="clash-btn px-3 py-1.5 rounded-lg bg-[#3a2614] border border-[#7c5329] text-amber-100 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {building ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Hammer className="w-3.5 h-3.5 text-amber-300" />
                  )}
                  {building ? '构建中...' : '重新构建'}
                </button>

                <button
                  type="button"
                  onClick={handleDownloadZip}
                  className="clash-btn px-3 py-1.5 rounded-lg bg-sky-600 border border-sky-950 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  下载 .zip
                </button>
              </div>
            </div>

            {loadingStatus ? (
              <div className="text-xs text-amber-300/75 py-2">正在检测 dist-wechat/ 构建产物...</div>
            ) : bundle?.ready ? (
              <>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-amber-200/85 tabular-nums">
                  <span>包体大小：{formatBytesMb(bundle.totalBytes)} / 4.00 MB 主包上限</span>
                  <span aria-hidden="true">·</span>
                  <span>精灵贴图：{bundle.spriteCount} 张</span>
                  <span aria-hidden="true">·</span>
                  <span>横屏模式：{bundle.deviceOrientation ?? 'landscape'}</span>
                  <span aria-hidden="true">·</span>
                  <span>基础库：v{bundle.libVersion ?? '3.4.0'}</span>
                </div>

                <div className="w-full h-2 rounded-full bg-[#2a1c11] overflow-hidden border border-[#4a311b]">
                  <div
                    className={`h-full transition-all ${
                      bundle.withinMainLimit ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                    style={{ width: `${mainLimitRatio}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-amber-300/75 tabular-nums">
                  <span>
                    {bundle.withinMainLimit
                      ? '符合微信小游戏 4 MB 单包体积规范，无需分包即可极速首屏加载'
                      : '包体超过 4 MB，建议开启分包加载'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowFiles((prev) => !prev)}
                    className="text-amber-300 underline hover:text-amber-100 cursor-pointer shrink-0 ml-2"
                  >
                    {showFiles ? '收起文件清单' : `查看 ${bundle.files.length} 个产物文件`}
                  </button>
                </div>

                {showFiles && (
                  <div className="max-h-36 overflow-y-auto rounded-lg bg-[#140c06] border border-[#4a311b] p-2.5 text-[11px] font-mono text-amber-200/80 space-y-1 tabular-nums">
                    {bundle.files.map((f) => (
                      <div key={f.path} className="flex items-center justify-between gap-4">
                        <span className="truncate">{f.path}</span>
                        <span className="shrink-0 text-amber-300/70">{formatBytesKb(f.size)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="text-xs text-amber-300/85">
                尚未生成 dist-wechat/ 产物，点击「一键构建并上传」或「重新构建」即可自动打包。
              </div>
            )}
          </section>

          {/* Server Credential Status (Read-only, zero secret input in UI) */}
          <section className="rounded-xl bg-[#1c120a]/85 border-2 border-[#6e4723] p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-extrabold text-amber-100">服务端发布凭证状态</h3>
              <span
                className={`text-xs font-extrabold ${
                  creds?.configured ? 'text-emerald-400' : 'text-amber-300'
                }`}
              >
                {creds?.configured ? '已就绪 · 支持直传微信平台' : '待配置环境变量'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs tabular-nums">
              <div className="rounded-lg bg-[#24170d] border border-[#4a311b] px-3 py-2 flex items-center justify-between">
                <span className="text-amber-200/80">WECHAT_APPID</span>
                <span className={creds?.hasAppId ? 'text-emerald-300 font-bold' : 'text-amber-400'}>
                  {creds?.hasAppId ? creds.maskedAppId : '未设置（游客模式）'}
                </span>
              </div>
              <div className="rounded-lg bg-[#24170d] border border-[#4a311b] px-3 py-2 flex items-center justify-between">
                <span className="text-amber-200/80">WECHAT_PRIVATE_KEY</span>
                <span className={creds?.hasPrivateKey ? 'text-emerald-300 font-bold' : 'text-amber-400'}>
                  {creds?.hasPrivateKey ? '已安全注入服务端' : '未配置上传密钥'}
                </span>
              </div>
            </div>

            {!creds?.configured && (
              <p className="text-[11px] text-amber-200/75 leading-relaxed">
                为保障密钥安全，上传私钥仅通过服务端环境变量读取。请在微信公众平台（mp.weixin.qq.com → 开发管理 → 开发设置 → 小程序代码上传）下载上传密钥并配置 <code className="text-amber-300">WECHAT_APPID</code> 与 <code className="text-amber-300">WECHAT_PRIVATE_KEY</code>（并将运行环境出口 IP 加入上传白名单），或直接下载上方 <code className="text-amber-300">.zip</code> 包导入微信开发者工具上传。
              </p>
            )}
          </section>

          {/* Release Metadata Form */}
          <section className="rounded-xl bg-[#3a2717] border-2 border-[#6e4723] p-4 space-y-3">
            <h3 className="text-sm font-extrabold text-amber-100">本次上传版本信息</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="wx-version" className="block text-[11px] font-bold text-amber-200/80 mb-1">
                  发布版本号
                </label>
                <input
                  id="wx-version"
                  type="text"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="1.0.0"
                  className="w-full rounded-lg bg-[#1c120a] border border-[#6e4723] px-3 py-2 text-sm text-amber-100 tabular-nums focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label htmlFor="wx-robot" className="block text-[11px] font-bold text-amber-200/80 mb-1">
                  CI 机器人编号 (1-30)
                </label>
                <input
                  id="wx-robot"
                  type="number"
                  min={1}
                  max={30}
                  value={robot}
                  onChange={(e) => setRobot(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
                  className="w-full rounded-lg bg-[#1c120a] border border-[#6e4723] px-3 py-2 text-sm text-amber-100 tabular-nums focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label htmlFor="wx-desc" className="block text-[11px] font-bold text-amber-200/80 mb-1">
                  版本更新备注
                </label>
                <input
                  id="wx-desc"
                  type="text"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="修复与性能优化"
                  className="w-full rounded-lg bg-[#1c120a] border border-[#6e4723] px-3 py-2 text-sm text-amber-100 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
              <button
                type="button"
                disabled={uploading || previewing}
                onClick={handleOneClickUpload}
                className="clash-btn flex-1 px-5 py-3 rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-600 border-2 border-emerald-950 shadow-[0_4px_0_#064e3b] text-emerald-950 font-extrabold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {uploading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <UploadCloud className="w-4 h-4" />
                )}
                {uploading ? '正在构建并上传...' : '一键构建并上传至微信小游戏平台'}
              </button>

              <button
                type="button"
                disabled={uploading || previewing}
                onClick={handleGeneratePreview}
                className="clash-btn px-4 py-3 rounded-xl bg-[#24170d] border-2 border-[#7c5329] text-amber-100 font-extrabold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {previewing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <QrCode className="w-4 h-4 text-sky-300" />
                )}
                真机预览码
              </button>
            </div>
          </section>

          {/* Feedback & Steps */}
          {feedback && (
            <section
              className={`rounded-xl border-2 p-4 space-y-2 ${
                feedback.kind === 'success'
                  ? 'bg-emerald-950/60 border-emerald-500/80 text-emerald-100'
                  : feedback.kind === 'warning'
                    ? 'bg-amber-950/65 border-amber-500/80 text-amber-100'
                    : 'bg-red-950/70 border-red-500/80 text-red-100'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {feedback.kind === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0 space-y-1">
                  <div className="text-sm font-extrabold">{feedback.title}</div>
                  <p className="text-xs opacity-90 leading-relaxed break-words">{feedback.detail}</p>
                </div>
              </div>

              {feedback.missingFields && feedback.missingFields.length > 0 && (
                <div className="pt-2 border-t border-amber-500/25 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-amber-200/90">
                    或本地终端执行：<code className="text-amber-300 font-mono">WECHAT_APPID=你的AppID WECHAT_PRIVATE_KEY_PATH=./private.key npm run upload:wechat</code>
                  </span>
                  <button
                    type="button"
                    onClick={handleDownloadZip}
                    className="clash-btn px-3 py-1.5 rounded-lg bg-amber-400 border border-amber-950 text-amber-950 font-extrabold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    下载开发者工具包 (.zip)
                  </button>
                </div>
              )}
            </section>
          )}

          {previewQrUrl && (
            <section className="rounded-xl bg-[#1c120a] border-2 border-sky-500/70 p-4 flex flex-col items-center gap-2">
              <img
                src={previewQrUrl}
                alt="微信小游戏真机预览二维码"
                referrerPolicy="no-referrer"
                className="w-40 h-40 rounded-lg bg-white p-2"
              />
              <span className="text-xs text-sky-200 font-bold">
                请使用微信扫码打开小游戏预览版
              </span>
            </section>
          )}

          {steps.length > 0 && (
            <section className="rounded-xl bg-[#140c06] border border-[#4a311b] p-3.5 space-y-1.5">
              <div className="text-[11px] font-bold text-amber-300/80">发布流水线日志</div>
              <div className="space-y-1 font-mono text-[11px] text-amber-100/85">
                {steps.map((s, idx) => (
                  <div key={`${s.stage}_${idx}`} className="flex items-start gap-2">
                    <span className="text-amber-400 shrink-0">[{s.stage}]</span>
                    <span className="break-all">{s.detail}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
