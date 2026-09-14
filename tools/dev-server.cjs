/* Run from any directory: node tools/dev-server.cjs */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 4179);
// Keep the local read credential separate from Vercel's generated env pull.
for (const filename of ['.env.local', '.env.donations.local']) {
  try { process.loadEnvFile(path.join(root, filename)); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}

const donations = require('../api/donations.js');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.pdf': 'application/pdf'
};
const privateDirectories = new Set(['api', 'tools', 'tests', 'tmp', 'output', 'outputs', 'node_modules']);

function reply(res, status, message) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(message);
}

const server = http.createServer(async (req, res) => {
  try {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname); }
    catch (_) { return reply(res, 400, 'Invalid URL'); }

    if (pathname === '/api/donations') return await donations(req, res);
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.setHeader('Allow', 'GET, HEAD');
      return reply(res, 405, 'Method not allowed');
    }

    const redirects = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8')).redirects || [];
    const redirect = redirects.find(entry => decodeURIComponent(entry.source) === pathname);
    if (redirect) {
      res.writeHead(redirect.permanent ? 308 : 307, { Location: redirect.destination });
      return res.end();
    }

    const parts = pathname.split('/').filter(Boolean);
    if (parts.some(part => part.startsWith('.') || part.includes('\\') || part.includes('\0'))
        || privateDirectories.has(parts[0])) return reply(res, 404, 'Not found');

    let file = path.resolve(root, '.' + pathname);
    if (file !== root && !file.startsWith(root + path.sep)) return reply(res, 404, 'Not found');
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file) && !path.extname(file)) file += '.html';
    if (!fs.existsSync(file) || !fs.statSync(file).isFile() || !types[path.extname(file)]) {
      return reply(res, 404, 'Not found');
    }
    const resolved = fs.realpathSync(file);
    if (!resolved.startsWith(root + path.sep)) return reply(res, 404, 'Not found');
    res.writeHead(200, { 'Content-Type': types[path.extname(file)], 'Cache-Control': 'no-store' });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
  } catch (_) {
    if (!res.headersSent) reply(res, 500, 'Local server error');
    else res.destroy();
  }
});

server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? `Port ${port} is already in use.` : 'Unable to start the local dev server.');
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Silicon Hills Project dev server: http://127.0.0.1:${port}/`);
  if (!process.env.STRIPE_DONATIONS_READ_KEY && !process.env.STRIPE_SECRET_KEY) {
    console.log('Donation totals unavailable locally until a Stripe read credential is configured; hosted checkout still works.');
  }
});
