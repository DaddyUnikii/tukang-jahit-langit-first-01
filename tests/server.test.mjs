import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
const path=new URL('../server.mjs',import.meta.url);

test('local game server serves index and rejects path escapes without external calls',async()=>{
  assert.ok(existsSync(path),'local static game server is not implemented');
  const {startServer}=await import(path.href);
  const server=await startServer({root:new URL('../game/',import.meta.url).pathname,port:0});
  try {
    const origin=`http://127.0.0.1:${server.address().port}`;
    const r=await fetch(origin+'/');
    assert.equal(r.status,200);
    assert.ok((await r.text()).includes('Tukang Jahit Langit'));
    const denied=await fetch(origin+'/%2e%2e%2fmain.ts');
    assert.equal(denied.status,403);
    assert.equal((await fetch(origin+'/missing.js')).status,404);
  } finally { await new Promise(r=>server.close(r)); }
});
