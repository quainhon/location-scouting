import { createServer } from 'node:http';
import { mkdirSync, existsSync, createReadStream } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openStore } from './store.mjs';
import { Readable } from 'node:stream';
import { photoResponse } from '../shared/photos.mjs';
import { videoResponse } from '../shared/videos.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const filename = process.env.SCOUT_DB || resolve(root,'data/scout.sqlite');
mkdirSync(resolve(filename,'..'), {recursive:true});
const store = openStore(filename);
const port = Number(process.env.PORT || 3001);
const types = {'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server = createServer(async (req,res) => {
  const json = (status, body) => { res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify(body)); };
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (path.startsWith('/api/')) {
      if (!['127.0.0.1','localhost','[::1]'].includes((req.headers.host || '').split(':')[0])) return json(403,{error:'Local access only.'});
      if (req.headers.origin && !['127.0.0.1','localhost'].includes(new URL(req.headers.origin).hostname)) return json(403,{error:'Origin not allowed.'});
      if (path.startsWith('/api/videos/')) {
        const request = new Request('http://' + req.headers.host + path, { method:req.method, headers:req.headers, ...(!['GET','HEAD'].includes(req.method) ? { body:Readable.toWeb(req), duplex:'half' } : {}) });
        const result = await videoResponse(request, path.slice('/api/videos/'.length), store.videos);
        res.writeHead(result.status,Object.fromEntries(result.headers)); res.end(Buffer.from(await result.arrayBuffer())); return;
      }
      if (path.startsWith('/api/photos/')) {
        const request = new Request(`http://${req.headers.host}${path}`, {
          method: req.method, headers: req.headers,
          ...(!['GET','HEAD'].includes(req.method) ? { body: Readable.toWeb(req), duplex: 'half' } : {}),
        });
        const result = await photoResponse(request, path.slice('/api/photos/'.length), store.photos);
        res.writeHead(result.status, Object.fromEntries(result.headers));
        res.end(Buffer.from(await result.arrayBuffer())); return;
      }
      if (path === '/api/workspace' && req.method === 'GET') return json(200,store.read());
      if (path === '/api/workspace' && req.method === 'PUT') {
        if (!req.headers['content-type']?.startsWith('application/json')) return json(415,{error:'JSON required.'});
        const chunks=[]; let size=0;
        for await (const chunk of req) { size+=chunk.length; if (size>5_000_000) return json(413,{error:'Dữ liệu vượt quá 5 MB.'}); chunks.push(chunk); }
        return json(200,store.write(JSON.parse(Buffer.concat(chunks).toString('utf8'))));
      }
      return json(404,{error:'API endpoint not found.'});
    }
    if (req.method !== 'GET') return json(405,{error:'Method not allowed.'});
    const base=resolve(root,'dist');
    let file=resolve(base, '.'+decodeURIComponent(path));
    if (!file.startsWith(base+sep) && file!==base) return json(403,{error:'Forbidden'});
    if (path==='/' || !extname(file)) file=resolve(base,'index.html');
    if (!existsSync(file)) return json(404,{error:'File not found. Run npm run build first.'});
    res.writeHead(200,{'Content-Type':types[extname(file)] || 'application/octet-stream'});
    createReadStream(file).on('error',()=>res.destroy()).pipe(res);
  } catch(error) { json(error.status || (error instanceof SyntaxError ? 400 : 500), {error:error.status ? error.message : 'Không thể lưu hoặc đọc dữ liệu. Kiểm tra đầu vào và thử lại.'}); console.error(error.message); }
});
server.listen(port,'127.0.0.1',()=>console.log(`Location Scout: http://127.0.0.1:${port}`));
for (const event of ['SIGINT','SIGTERM']) process.on(event,()=>server.close(()=>{store.close();process.exit(0);}));
