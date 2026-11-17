import {createServer} from 'node:http';
import {readFile,realpath,stat} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';

const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
export async function startServer({root,port=8080,host='127.0.0.1'}={}) {
  const directory=await realpath(root ?? fileURLToPath(new URL('./game/',import.meta.url)));
  const server=createServer(async(req,res)=>{
    try {
      let name;
      try { name=decodeURIComponent((req.url ?? '/').split('?')[0]); } catch { res.writeHead(400).end('Bad request'); return; }
      if(name==='/' || name==='') name='/index.html';
      const path=resolve(directory,'.'+name);
      if(!path.startsWith(directory+sep)) { res.writeHead(403).end('Forbidden'); return; }
      let actual;
      try { actual=await realpath(path); } catch { res.writeHead(404).end('Not found'); return; }
      if(!actual.startsWith(directory+sep)) { res.writeHead(403).end('Forbidden'); return; }
      if(!(await stat(actual)).isFile()) { res.writeHead(404).end('Not found'); return; }
      if(req.method!=='GET' && req.method!=='HEAD') { res.writeHead(405).end('Method not allowed'); return; }
      const body=await readFile(actual);
      res.writeHead(200,{'Content-Type':types[extname(actual)] ?? 'application/octet-stream','Content-Length':body.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
      res.end(req.method==='HEAD' ? undefined : body);
    } catch { res.writeHead(500).end('Unable to read game file'); }
  });
  await new Promise((ok,fail)=>{server.once('error',fail); server.listen(port,host,ok);});
  return server;
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const server=await startServer({port:Number(process.env.PORT ?? 8080)});
  console.log(`Tukang Jahit Langit: http://127.0.0.1:${server.address().port}`);
}
