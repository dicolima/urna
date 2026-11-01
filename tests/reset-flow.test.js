import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {once} from 'node:events';
import net from 'node:net';
import pg from 'pg';

test('fluxo completo e limpeza com senha em schema isolado', {skip:process.env.RUN_DB_TESTS!=='1'}, async()=>{
 const admin=new pg.Pool({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:5000});
 const schema='test_urna_'+Date.now();
 let child, scoped;
 try{
  await admin.query(`CREATE SCHEMA ${schema}`);
  const url=new URL(process.env.DATABASE_URL);url.searchParams.set('options',`-c search_path=${schema}`);
  scoped=new pg.Pool({connectionString:url.href});
  await scoped.query(await readFile(new URL('../db/schema.sql',import.meta.url),'utf8'));
  const probe=net.createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
  const password='senha-isolada-para-teste';
  child=spawn(process.execPath,['server.js'],{cwd:new URL('..',import.meta.url),env:{...process.env,DATABASE_URL:url.href,PORT:String(port),HOST:'127.0.0.1',RESET_PASSWORD:password},stdio:['ignore','pipe','pipe']});
  await Promise.race([once(child.stdout,'data'),new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('Servidor não iniciou')),5000);timer.unref();})]);
  const base=`http://127.0.0.1:${port}`;
  async function action(action,extra={}){const response=await fetch(base+'/api/action',{method:'POST',headers:{'Content-Type':'application/json','Origin':base},body:JSON.stringify({action,...extra})});return {status:response.status,data:await response.json()};}
  assert.equal((await action('open',{target:'11'})).status,200);
  await action('authorize');await action('vote',{choice:'22'});
  const closed=await action('close');assert.equal(closed.data.total,1);assert.equal(closed.data.phase,'closed');
  assert.equal(closed.data.real.find(r=>r.choice==='22').total,1);
  assert.equal(closed.data.history.length,1);
  assert.equal(closed.data.history[0].choice,'22');
  assert.ok(Number.isFinite(Date.parse(closed.data.history[0].time)));
  assert.equal(closed.data.simulated.find(r=>r.choice==='11').total,1);
  assert.equal((await action('reset',{password:'errada'})).status,400);
  assert.equal((await (await fetch(base+'/api/state')).json()).total,1);
  const reset=await action('reset',{password});assert.equal(reset.status,200);
  assert.equal(reset.data.total,0);assert.equal(reset.data.phase,'setup');assert.equal(reset.data.authorized,false);assert.equal(reset.data.opened_at,null);assert.equal(reset.data.closed_at,null);
  assert.deepEqual(reset.data.history,[]);
  assert.equal((await scoped.query('SELECT * FROM simulated_result')).rowCount,0);
  assert.equal((await action('open',{target:'33'})).status,200);
  // Limitação de tentativas e preservação da seção em caso de falha.
  for(let i=0;i<5;i++)assert.equal((await action('reset',{password:'errada'})).status,400);
  const blocked=await action('reset',{password});assert.match(blocked.data.error,/Limite/);
 }finally{
  if(child){const exited=once(child,'exit');child.kill();await exited;}
  await scoped?.end();
  await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await admin.end();
 }
});
