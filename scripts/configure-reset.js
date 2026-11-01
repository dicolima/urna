import {readFile, appendFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';

const file=new URL('../.env',import.meta.url);
const contents=await readFile(file,'utf8');
if(!/^\s*RESET_PASSWORD\s*=/m.test(contents)){
 await appendFile(file,`\nRESET_PASSWORD=${randomBytes(18).toString('base64url')}\n`);
 console.log('Senha de limpeza gerada em RESET_PASSWORD no .env.');
}else console.log('RESET_PASSWORD já existe no .env e foi preservada.');
