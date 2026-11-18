import * as esbuild from 'esbuild';
import JSZip from 'jszip';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const ROOT_DIR = path.resolve(__dirname, '..');
export const WECHAT_OUT_DIR = path.join(ROOT_DIR, 'dist-wechat');

export const WECHAT_MAIN_PACKAGE_LIMIT_BYTES = 4 * 1024 * 1024;
export const WECHAT_TOTAL_PACKAGE_LIMIT_BYTES = 20 * 1024 * 1024;

function collectFileStats(dir, baseDir = dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFileStats(full, baseDir));
    } else if (entry.isFile()) {
      const size = fs.statSync(full).size;
      const rel = path.relative(baseDir, full).replace(/\\/g, '/');
      files.push({ path: rel, size });
    }
  }
  return files;
}

export function inspectWechatBundle(outDir = WECHAT_OUT_DIR) {
  const exists = fs.existsSync(outDir);
  if (!exists) {
    return {
      ready: false,
      outDir,
      appid: null,
      deviceOrientation: null,
      libVersion: null,
      spriteCount: 0,
      totalBytes: 0,
      mainPackageLimitBytes: WECHAT_MAIN_PACKAGE_LIMIT_BYTES,
      totalLimitBytes: WECHAT_TOTAL_PACKAGE_LIMIT_BYTES,
      withinMainLimit: true,
      withinTotalLimit: true,
      builtAt: null,
      files: [],
    };
  }

  const files = collectFileStats(outDir);
  const totalBytes = files.reduce((acc, f) => acc + f.size, 0);
  const spriteCount = files.filter(
    (f) => f.path.startsWith('assets/sprites/') && f.path.endsWith('.png')
  ).length;

  const gameJsPath = path.join(outDir, 'game.js');
  const gameJsonPath = path.join(outDir, 'game.json');
  const projectConfigPath = path.join(outDir, 'project.config.json');

  let appid = null;
  let libVersion = null;
  let deviceOrientation = null;
  let builtAt = null;

  if (fs.existsSync(gameJsPath)) {
    builtAt = fs.statSync(gameJsPath).mtime.toISOString();
  }
  if (fs.existsSync(gameJsonPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(gameJsonPath, 'utf8'));
      deviceOrientation = parsed.deviceOrientation ?? null;
    } catch {
      // ignore malformed json
    }
  }
  if (fs.existsSync(projectConfigPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(projectConfigPath, 'utf8'));
      appid = parsed.appid ?? null;
      libVersion = parsed.libVersion ?? null;
    } catch {
      // ignore malformed json
    }
  }

  const hasCoreFiles =
    fs.existsSync(gameJsPath) &&
    fs.existsSync(gameJsonPath) &&
    fs.existsSync(projectConfigPath);

  return {
    ready: hasCoreFiles,
    outDir,
    appid,
    deviceOrientation,
    libVersion,
    spriteCount,
    totalBytes,
    mainPackageLimitBytes: WECHAT_MAIN_PACKAGE_LIMIT_BYTES,
    totalLimitBytes: WECHAT_TOTAL_PACKAGE_LIMIT_BYTES,
    withinMainLimit: totalBytes <= WECHAT_MAIN_PACKAGE_LIMIT_BYTES,
    withinTotalLimit: totalBytes <= WECHAT_TOTAL_PACKAGE_LIMIT_BYTES,
    builtAt,
    files: files.sort((a, b) => a.path.localeCompare(b.path)),
  };
}

/**
 * @param {{ quiet?: boolean; appid?: string }} [options]
 */
export async function buildWechatMiniGame({ quiet = false, appid = '' } = {}) {
  fs.rmSync(WECHAT_OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(WECHAT_OUT_DIR, { recursive: true });

  await esbuild.build({
    entryPoints: [path.join(ROOT_DIR, 'src/wechat/game.ts')],
    outfile: path.join(WECHAT_OUT_DIR, 'game.js'),
    bundle: true,
    format: 'cjs',
    platform: 'browser',
    target: ['es2020'],
    minify: true,
    sourcemap: false,
    loader: {
      '.png': 'file',
    },
    assetNames: 'assets/sprites/[name]',
    publicPath: '',
    define: {
      'process.env.NODE_ENV': '"production"',
    },
  });

  const gameJson = {
    deviceOrientation: 'landscape',
    showStatusBar: false,
    networkTimeout: {
      request: 10000,
      connectSocket: 10000,
      uploadFile: 10000,
      downloadFile: 10000,
    },
  };
  fs.writeFileSync(
    path.join(WECHAT_OUT_DIR, 'game.json'),
    `${JSON.stringify(gameJson, null, 2)}\n`,
    'utf8'
  );

  const resolvedAppId =
    (typeof appid === 'string' && appid.trim()) ||
    process.env.WECHAT_APPID?.trim() ||
    'touristappid';

  const projectConfig = {
    description: '部落冲突 · Clash of Clans 微信小游戏版',
    packOptions: {
      ignore: [
        {
          value: 'README.md',
          type: 'file',
        },
      ],
      include: [],
    },
    setting: {
      urlCheck: true,
      es6: true,
      enhance: true,
      postcss: false,
      preloadBackgroundData: false,
      minified: true,
      newFeature: false,
      coverView: true,
      autoAudits: false,
      showShadowRootInWxmlPanel: true,
      scopeDataCheck: false,
      checkInvalidKey: true,
      checkSiteMap: true,
      uploadWithSourceMap: true,
      compileHotReLoad: false,
      babelSetting: {
        ignore: [],
        disablePlugins: [],
        outputPath: '',
      },
    },
    compileType: 'game',
    libVersion: '3.4.0',
    appid: resolvedAppId,
    projectname: 'clash-of-realms-wechat',
    condition: {},
  };
  fs.writeFileSync(
    path.join(WECHAT_OUT_DIR, 'project.config.json'),
    `${JSON.stringify(projectConfig, null, 2)}\n`,
    'utf8'
  );

  const readme = `# 部落冲突 · 微信小游戏打包产物 (dist-wechat)

## 方式一：一键 CI 上传至微信小游戏发布平台
在配置好环境变量 \`WECHAT_APPID\` 与 \`WECHAT_PRIVATE_KEY\`（或 \`WECHAT_PRIVATE_KEY_PATH\`）后运行：
\`\`\`bash
npm run upload:wechat -- --version 1.0.0 --desc "正式发布版本"
\`\`\`
或在游戏内打开「设置 -> 微信小游戏发布平台」点击一键上传。

## 方式二：微信开发者工具导入
1. 打开 **微信开发者工具**，选择 **导入项目**（小游戏项目）。
2. 将目录指向本工程的 \`dist-wechat/\` 文件夹。
3. AppID 默认使用 \`touristappid\`（游客模式可直接真机预览与调试）；绑定正式 AppID 可设置 \`WECHAT_APPID\` 环境变量后重新打包。
4. 点击 **编译 / 预览 / 上传** 即可提交审核发布（横屏模式 \`deviceOrientation: "landscape"\`）。

## 已包含内容
- \`game.js\`：纯原生 Canvas 2D + 触摸交互引擎（无 DOM 依赖，支持单指拖拽、双指缩放、建造/移动/升级、练兵与法术、模拟部落联盟与援军、每日任务、战斗与增援部署、\`wx.setStorageSync\` 本地存档、\`wx.createWebAudioContext\` 音效与循环背景音乐、微信转发分享）。
- \`game.json\`：横屏小游戏配置。
- \`project.config.json\`：微信开发者工具工程配置（\`compileType: "game"\`）。
- \`assets/sprites/*.png\`：全套建筑与兵种透明精灵贴图。
`;
  fs.writeFileSync(path.join(WECHAT_OUT_DIR, 'README.md'), readme, 'utf8');

  const inspection = inspectWechatBundle(WECHAT_OUT_DIR);
  const totalMb = (inspection.totalBytes / (1024 * 1024)).toFixed(2);

  if (!quiet) {
    console.log(
      `[build:wechat] Packaged dist-wechat/ successfully (${inspection.spriteCount} sprites, total ${totalMb} MB, appid=${resolvedAppId}).`
    );
  }

  return inspection;
}

/**
 * @param {{ rebuildIfMissing?: boolean; appid?: string }} [options]
 */
export async function createWechatZipBuffer({ rebuildIfMissing = true, appid = '' } = {}) {
  let info = inspectWechatBundle(WECHAT_OUT_DIR);
  if (!info.ready && rebuildIfMissing) {
    info = await buildWechatMiniGame({ quiet: true, appid });
  }
  if (!info.ready) {
    throw new Error('dist-wechat 构建产物不存在或不完整');
  }

  const zip = new JSZip();
  for (const file of info.files) {
    const absPath = path.join(WECHAT_OUT_DIR, file.path);
    const data = fs.readFileSync(absPath);
    zip.file(file.path, data);
  }

  return zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  buildWechatMiniGame().catch((err) => {
    console.error('[build:wechat] Build failed:', err);
    process.exit(1);
  });
}
