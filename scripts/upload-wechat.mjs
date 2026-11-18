import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildWechatMiniGame,
  WECHAT_OUT_DIR,
  WECHAT_TOTAL_PACKAGE_LIMIT_BYTES,
} from './build-wechat.mjs';

const __filename = fileURLToPath(import.meta.url);

async function loadMiniprogramCi() {
  const ciModule = await import('miniprogram-ci');
  return ciModule?.default ?? ciModule;
}

const VALID_APPID_RE = /^wx[a-f0-9]{16}$/i;

export function maskAppId(appid) {
  if (!appid) return '';
  if (appid === 'touristappid') return 'touristappid';
  if (appid.length <= 8) return `${appid.slice(0, 2)}****`;
  return `${appid.slice(0, 4)}****${appid.slice(-4)}`;
}

export function normalizePrivateKey(raw) {
  if (!raw || typeof raw !== 'string') return '';
  return raw.replace(/\\n/g, '\n').trim();
}

export function getWechatPublishCredentials(env = process.env) {
  const rawAppId = (env.WECHAT_APPID || '').trim();
  const hasAppId = Boolean(rawAppId && rawAppId !== 'touristappid');
  const validAppIdFormat = VALID_APPID_RE.test(rawAppId);

  const rawPrivateKey = normalizePrivateKey(env.WECHAT_PRIVATE_KEY || '');
  const rawKeyPath = (env.WECHAT_PRIVATE_KEY_PATH || '').trim();
  const hasPrivateKeyFile = Boolean(rawKeyPath && fs.existsSync(rawKeyPath));
  const hasPrivateKey = Boolean(rawPrivateKey) || hasPrivateKeyFile;

  const missingFields = [];
  if (!hasAppId) {
    missingFields.push('WECHAT_APPID');
  }
  if (!hasPrivateKey) {
    missingFields.push('WECHAT_PRIVATE_KEY');
  }

  return {
    configured: hasAppId && validAppIdFormat && hasPrivateKey,
    hasAppId,
    validAppIdFormat,
    hasPrivateKey,
    maskedAppId: maskAppId(rawAppId || 'touristappid'),
    missingFields,
    appid: rawAppId,
    privateKey: rawPrivateKey || undefined,
    privateKeyPath: !rawPrivateKey && hasPrivateKeyFile ? rawKeyPath : undefined,
  };
}

export class WechatUploadError extends Error {
  /**
   * @param {string} message
   * @param {string} code
   * @param {Record<string, any>} [extra]
   */
  constructor(message, code, extra = {}) {
    super(message);
    this.name = 'WechatUploadError';
    this.code = code;
    /** @type {Record<string, any>} */
    this.extra = extra;
  }
}

function sanitizeVersion(version) {
  const v = typeof version === 'string' ? version.trim() : '';
  return v || '1.0.0';
}

function sanitizeRobot(robot) {
  const n = Number(robot);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(30, Math.floor(n)));
}

export async function uploadWechatMiniGame({
  version = '1.0.0',
  desc = '天启崛起 · 微信小游戏发布版本',
  robot = process.env.WECHAT_ROBOT || 1,
  env = process.env,
  onStep,
} = {}) {
  const steps = [];
  const pushStep = (stage, detail) => {
    const entry = {
      stage,
      detail,
      timestamp: new Date().toISOString(),
    };
    steps.push(entry);
    onStep?.(entry);
  };

  const creds = getWechatPublishCredentials(env);
  const targetVersion = sanitizeVersion(version);
  const targetDesc = (typeof desc === 'string' && desc.trim()) || '天启崛起 · 微信小游戏发布版本';
  const targetRobot = sanitizeRobot(robot);

  pushStep('build', '正在打包微信小游戏产物 (dist-wechat)...');
  const bundle = await buildWechatMiniGame({
    quiet: true,
    appid: creds.hasAppId ? creds.appid : undefined,
  });
  const totalMb = (bundle.totalBytes / (1024 * 1024)).toFixed(2);
  pushStep(
    'validate',
    `构建完成：${bundle.spriteCount} 张精灵贴图，总包体 ${totalMb} MB（主包上限 4.00 MB）`
  );

  if (bundle.totalBytes > WECHAT_TOTAL_PACKAGE_LIMIT_BYTES) {
    throw new WechatUploadError(
      `包体大小 ${totalMb} MB 超出微信小游戏 20 MB 上限`,
      'PACKAGE_TOO_LARGE',
      { bundle, steps }
    );
  }

  if (!creds.hasAppId || !creds.hasPrivateKey) {
    throw new WechatUploadError(
      `服务端尚未配置微信发布凭证：缺少 ${creds.missingFields.join('、')}。请在环境变量/Secrets 中配置后重试，或直接下载 dist-wechat.zip 导入微信开发者工具上传。`,
      'MISSING_CREDENTIALS',
      {
        missingFields: creds.missingFields,
        bundle,
        steps,
      }
    );
  }

  if (!creds.validAppIdFormat) {
    throw new WechatUploadError(
      `WECHAT_APPID 格式无效（当前为 ${creds.maskedAppId}），应为 wx 开头的 18 位正式小游戏 AppID`,
      'INVALID_APPID',
      {
        missingFields: ['WECHAT_APPID'],
        bundle,
        steps,
      }
    );
  }

  pushStep(
    'upload',
    `正在通过 miniprogram-ci 上传版本 v${targetVersion}（Robot #${targetRobot}，AppID ${creds.maskedAppId}）...`
  );

  try {
    const ci = await loadMiniprogramCi();
    const project = new ci.Project({
      appid: creds.appid,
      type: 'miniGame',
      projectPath: WECHAT_OUT_DIR,
      privateKey: creds.privateKey,
      privateKeyPath: creds.privateKeyPath,
      ignores: ['README.md'],
    });

    const uploadResult = await ci.upload({
      project,
      version: targetVersion,
      desc: targetDesc,
      robot: targetRobot,
      setting: {
        es6: true,
        minify: true,
        minifyJS: true,
        minifyWXML: true,
        minifyWXSS: true,
        autoPrefixWXSS: true,
      },
      onProgressUpdate: (task) => {
        if (typeof task === 'string') {
          pushStep('ci', task);
        } else if (task && typeof task === 'object' && task.message) {
          pushStep('ci', `${task.message}${task.status ? ` (${task.status})` : ''}`);
        }
      },
    });

    pushStep('done', `版本 v${targetVersion} 已成功上传至微信公众平台体验/版本管理列表！`);
    return {
      ok: true,
      version: targetVersion,
      desc: targetDesc,
      robot: targetRobot,
      maskedAppId: creds.maskedAppId,
      bundle,
      uploadResult,
      steps,
    };
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    pushStep('error', `上传失败：${rawMsg}`);
    throw new WechatUploadError(
      `微信发布平台上传失败：${rawMsg}`,
      'UPLOAD_FAILED',
      {
        bundle,
        steps,
        rawError: rawMsg,
      }
    );
  }
}

export async function previewWechatMiniGame({
  version = '1.0.0',
  desc = '真机预览包',
  robot = process.env.WECHAT_ROBOT || 1,
  env = process.env,
} = {}) {
  const creds = getWechatPublishCredentials(env);
  const bundle = await buildWechatMiniGame({
    quiet: true,
    appid: creds.hasAppId ? creds.appid : undefined,
  });

  if (!creds.hasAppId || !creds.hasPrivateKey) {
    throw new WechatUploadError(
      `服务端尚未配置微信发布凭证：缺少 ${creds.missingFields.join('、')}`,
      'MISSING_CREDENTIALS',
      { missingFields: creds.missingFields, bundle }
    );
  }
  if (!creds.validAppIdFormat) {
    throw new WechatUploadError(
      `WECHAT_APPID 格式无效（${creds.maskedAppId}）`,
      'INVALID_APPID',
      { missingFields: ['WECHAT_APPID'], bundle }
    );
  }

  const tmpQrPath = path.join(os.tmpdir(), `wx-preview-${Date.now()}.txt`);
  try {
    const ci = await loadMiniprogramCi();
    const project = new ci.Project({
      appid: creds.appid,
      type: 'miniGame',
      projectPath: WECHAT_OUT_DIR,
      privateKey: creds.privateKey,
      privateKeyPath: creds.privateKeyPath,
      ignores: ['README.md'],
    });

    const previewResult = await ci.preview({
      project,
      version: sanitizeVersion(version),
      desc: (typeof desc === 'string' && desc.trim()) || '真机预览包',
      robot: sanitizeRobot(robot),
      setting: {
        es6: true,
        minify: true,
      },
      qrcodeFormat: 'base64',
      qrcodeOutputDest: tmpQrPath,
    });

    const qrBase64 = fs.existsSync(tmpQrPath) ? fs.readFileSync(tmpQrPath, 'utf8').trim() : '';
    const qrcodeDataUrl = qrBase64.startsWith('data:')
      ? qrBase64
      : qrBase64
        ? `data:image/png;base64,${qrBase64}`
        : '';

    return {
      ok: true,
      maskedAppId: creds.maskedAppId,
      bundle,
      previewResult,
      qrcodeDataUrl,
    };
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    throw new WechatUploadError(
      `生成微信预览二维码失败：${rawMsg}`,
      'PREVIEW_FAILED',
      { bundle, rawError: rawMsg }
    );
  } finally {
    if (fs.existsSync(tmpQrPath)) {
      fs.rmSync(tmpQrPath, { force: true });
    }
  }
}

function parseCliArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--version' && argv[i + 1]) out.version = argv[++i];
    else if (arg === '--desc' && argv[i + 1]) out.desc = argv[++i];
    else if (arg === '--robot' && argv[i + 1]) out.robot = Number(argv[++i]);
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const args = parseCliArgs(process.argv.slice(2));
  uploadWechatMiniGame({
    version: args.version || process.env.npm_package_version || '1.0.0',
    desc: args.desc || 'CLI 一键发布微信小游戏',
    robot: args.robot,
    onStep: (step) => {
      console.log(`[upload:wechat] [${step.stage}] ${step.detail}`);
    },
  })
    .then((res) => {
      console.log(
        `[upload:wechat] Success! Version v${res.version} uploaded for ${res.maskedAppId}.`
      );
    })
    .catch((err) => {
      console.error(`[upload:wechat] ${err.message}`);
      process.exit(1);
    });
}
