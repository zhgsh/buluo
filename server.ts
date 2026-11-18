import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildWechatMiniGame,
  createWechatZipBuffer,
  inspectWechatBundle,
} from './scripts/build-wechat.mjs';
import {
  getWechatPublishCredentials,
  previewWechatMiniGame,
  uploadWechatMiniGame,
  WechatUploadError,
} from './scripts/upload-wechat.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveCliArg(name: string): string | undefined {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === `--${name}` && argv[i + 1]) return argv[i + 1];
    if (arg.startsWith(`--${name}=`)) return arg.slice(name.length + 3);
  }
  return undefined;
}

const envPort = Number(process.env.PORT);
const cliPort = Number(resolveCliArg('port'));
const PORT =
  Number.isFinite(cliPort) && cliPort > 0
    ? cliPort
    : Number.isFinite(envPort) && envPort > 0 && envPort !== 8080
      ? envPort
      : 3000;
const HOST = resolveCliArg('host') || '0.0.0.0';

function readPackageVersion(): string {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')
    ) as { version?: string };
    return pkg.version && pkg.version !== '0.0.0' ? pkg.version : '1.0.0';
  } catch {
    return '1.0.0';
  }
}

async function createApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/wechat/status', (_req: Request, res: Response) => {
    const bundle = inspectWechatBundle();
    const creds = getWechatPublishCredentials();
    res.json({
      ok: true,
      packageVersion: readPackageVersion(),
      bundle,
      credentials: {
        configured: creds.configured,
        hasAppId: creds.hasAppId,
        validAppIdFormat: creds.validAppIdFormat,
        hasPrivateKey: creds.hasPrivateKey,
        maskedAppId: creds.maskedAppId,
        missingFields: creds.missingFields,
      },
    });
  });

  app.post('/api/wechat/build', async (req: Request, res: Response) => {
    try {
      const requestedAppId =
        typeof req.body?.appid === 'string' ? req.body.appid.trim() : undefined;
      const bundle = await buildWechatMiniGame({
        quiet: true,
        appid: requestedAppId || undefined,
      });
      res.json({ ok: true, bundle });
    } catch (err) {
      res.status(500).json({
        ok: false,
        code: 'BUILD_FAILED',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.post('/api/wechat/upload', async (req: Request, res: Response) => {
    const version =
      typeof req.body?.version === 'string' && req.body.version.trim()
        ? req.body.version.trim()
        : readPackageVersion();
    const desc =
      typeof req.body?.desc === 'string' && req.body.desc.trim()
        ? req.body.desc.trim()
        : '天启崛起 · 微信小游戏发布版';
    const robot = Number(req.body?.robot ?? 1);

    try {
      const result = await uploadWechatMiniGame({
        version,
        desc,
        robot,
      });
      res.json(result);
    } catch (err) {
      if (err instanceof WechatUploadError) {
        const status =
          err.code === 'MISSING_CREDENTIALS' || err.code === 'INVALID_APPID'
            ? 400
            : 500;
        res.status(status).json({
          ok: false,
          code: err.code,
          message: err.message,
          ...err.extra,
        });
        return;
      }
      res.status(500).json({
        ok: false,
        code: 'UPLOAD_FAILED',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.post('/api/wechat/preview', async (req: Request, res: Response) => {
    const version =
      typeof req.body?.version === 'string' && req.body.version.trim()
        ? req.body.version.trim()
        : readPackageVersion();
    const desc =
      typeof req.body?.desc === 'string' && req.body.desc.trim()
        ? req.body.desc.trim()
        : '真机预览包';
    const robot = Number(req.body?.robot ?? 1);

    try {
      const result = await previewWechatMiniGame({
        version,
        desc,
        robot,
      });
      res.json(result);
    } catch (err) {
      if (err instanceof WechatUploadError) {
        const status =
          err.code === 'MISSING_CREDENTIALS' || err.code === 'INVALID_APPID'
            ? 400
            : 500;
        res.status(status).json({
          ok: false,
          code: err.code,
          message: err.message,
          ...err.extra,
        });
        return;
      }
      res.status(500).json({
        ok: false,
        code: 'PREVIEW_FAILED',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.get('/api/wechat/download-zip', async (req: Request, res: Response) => {
    try {
      const requestedAppId =
        typeof req.query.appid === 'string' ? req.query.appid.trim() : undefined;
      const zipBuffer = await createWechatZipBuffer({
        rebuildIfMissing: true,
        appid: requestedAppId || undefined,
      });
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="clash-of-clans-wechat.zip"'
      );
      res.setHeader('Content-Length', String(zipBuffer.length));
      res.send(zipBuffer);
    } catch (err) {
      res.status(500).json({
        ok: false,
        code: 'ZIP_FAILED',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  httpServer.listen(PORT, HOST, () => {
    console.log(`[server] 天启崛起 + WeChat CI API running at http://${HOST}:${PORT}`);
    console.log(`  ➜  Local:   http://localhost:${PORT}/`);
  });
}

createApp().catch((err) => {
  console.error('[server] Failed to start:', err);
  process.exit(1);
});
