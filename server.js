import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {pool} from './db/connection.js';
import {validResetPassword} from './reset-auth.js';
let resetAttempts=0, resetWindow=0;
const candidates=[{number:'11',name:'Ana Silva'},{number:'22',name:'Bruno Costa'},{number:'33',name:'Clara Lima'}];
async function state(client){
 const {rows:[e]}=await client.query('SELECT * FROM election WHERE id=1');
 const {rows:[{total}]}=await client.query('SELECT count(*)::int AS total FROM votes');
 const history=(await client.query("SELECT recorded_at AS time, choice, count(*)::int AS total FROM votes WHERE choice IN ('11','22','33') GROUP BY recorded_at,choice ORDER BY recorded_at NULLS FIRST,choice")).rows;
 let real=[],simulated=[];
 if(e.phase==='closed'){
  real=(await client.query("SELECT choice,count(*)::int AS total FROM votes GROUP BY choice")).rows;
  simulated=(await client.query('SELECT * FROM simulated_result')).rows;
 }
 return {...e,total,candidates,real,simulated,history};
}
async function action(client,action,data){
 const {rows:[e]}=await client.query('SELECT * FROM election WHERE id=1 FOR UPDATE');
 const fail=message=>{throw new Error(message)};
 switch(action){
 case 'reset':
  if(!process.env.RESET_PASSWORD||process.env.RESET_PASSWORD.length<12)fail('Configure RESET_PASSWORD com pelo menos 12 caracteres no servidor.');
  if(Date.now()-resetWindow>=60000){resetAttempts=0;resetWindow=Date.now();}
  if(resetAttempts>=5)fail('Limite de tentativas atingido. Aguarde um minuto.');
  resetAttempts++;
  if(!validResetPassword(data.password))fail('Senha de limpeza incorreta.');
  await client.query('DELETE FROM votes');
  await client.query('DELETE FROM simulated_result');
  await client.query("UPDATE election SET phase='setup',authorized=false,target='11',opened_at=NULL,closed_at=NULL WHERE id=1");
  resetAttempts=0;
  break;
 case 'open':
  if(e.phase!=='setup')fail('A zerésima já foi emitida.');
  if(!candidates.some(c=>c.number===data.target))fail('Candidato inválido.');
  if((await client.query('SELECT 1 FROM votes LIMIT 1')).rowCount)fail('A urna contém votos.');
  await client.query("UPDATE election SET phase='open',target=$1,opened_at=now() WHERE id=1",[data.target]);break;
 case 'authorize':
  if(e.phase!=='open'||e.authorized)fail('Aguarde a votação atual ou abra a seção.');
  await client.query('UPDATE election SET authorized=true WHERE id=1');break;
 case 'vote':
  if(e.phase!=='open'||!e.authorized)fail('O mesário precisa liberar a votação.');
  if(!['11','22','33','blank','null'].includes(data.choice))fail('Voto inválido.');
  await client.query('INSERT INTO votes(choice) VALUES($1)',[data.choice]);
  await client.query('UPDATE election SET authorized=false WHERE id=1');break;
 case 'close':
  if(e.phase!=='open'||e.authorized)fail('Conclua o voto liberado antes de encerrar.');
  await client.query("UPDATE election SET phase='closed',closed_at=now() WHERE id=1");
  await client.query('CALL simulate_manipulation()');break;
 default:fail('Ação desconhecida.');
 }
}
const files={'/':['index.html','text/html'],'/app.js':['app.js','text/javascript'],'/chart.js':['chart.js','text/javascript'],'/style.css':['style.css','text/css']};
http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Cache-Control','no-store');
 try{
  if(req.url==='/api/state'&&req.method==='GET'){
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify(await state(pool)));return;
  }
  if(req.url==='/api/action'&&req.method==='POST'){
   if(req.headers.origin){
    const origin=new URL(req.headers.origin);
    if(!['http:','https:'].includes(origin.protocol)||origin.host!==req.headers.host)throw new Error('Origem não autorizada.');
   }
   let body='';for await(const chunk of req){body+=chunk;if(body.length>4096)throw new Error('Requisição muito grande.');}
   const data=JSON.parse(body);const client=await pool.connect();
   try{await client.query('BEGIN');await action(client,data.action,data);const result=await state(client);await client.query('COMMIT');res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));}
   catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}return;
  }
  const file=files[req.url];if(!file||req.method!=='GET'){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',file[1]+'; charset=utf-8');res.end(await readFile(new URL('./public/'+file[0],import.meta.url)));
 }catch(error){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.code?'Banco indisponível ou não inicializado. Verifique a configuração.':error.message}));}
}).listen(process.env.PORT||3000,process.env.HOST||(process.env.RENDER?'0.0.0.0':'127.0.0.1'),()=>console.log('Urna didática iniciada na porta '+(process.env.PORT||3000)));
