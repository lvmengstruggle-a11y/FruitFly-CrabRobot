import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Connect, type Plugin } from 'vite';

const jumperRoot = path.resolve(__dirname, '../jumper-main/assets/jumper');

/** Serves jumper-main's robot (jumper.xml and its STL meshes) at /jumper. */
function jumperAssets(): Plugin {
  const serve: Connect.NextHandleFunction = (req, res, next) => {
    const rel = decodeURIComponent((req.url ?? '/').split('?')[0]).replace(/^\//, '');
    const file = path.resolve(jumperRoot, rel);
    if (file !== jumperRoot && !file.startsWith(jumperRoot + path.sep)) return next();
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return next();
    const ext = path.extname(file).toLowerCase();
    const type = ext === '.xml' ? 'application/xml' : 'application/octet-stream';
    res.setHeader('Content-Type', type);
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    fs.createReadStream(file).pipe(res);
  };
  return {
    name: 'jumper-assets',
    configureServer(server) { server.middlewares.use('/jumper', serve); },
    configurePreviewServer(server) { server.middlewares.use('/jumper', serve); },
    writeBundle() { fs.cpSync(jumperRoot, path.resolve(__dirname, 'dist/jumper'), { recursive: true }); }
  };
}

export default defineConfig({
  plugins: [jumperAssets()],
  server: {
    fs: { allow: [path.resolve(__dirname, '..')] },
    headers: { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' }
  },
  preview: { headers: { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' } },
  worker: { format: 'es' }
});
