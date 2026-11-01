import {renderEvolution} from './chart.js';
let state, digits='',blank=false,finished=false,busy=false;
const $=id=>document.getElementById(id);
const names={'11':'Ana Silva','22':'Bruno Costa','33':'Clara Lima',blank:'Brancos',null:'Nulos'};
$('explain').onclick=()=>{$('explanation-dialog').showModal();$('explanation-title').focus();};
$('explanation-close').onclick=()=>$('explanation-dialog').close();
async function request(action,extra={}){
 if(busy)return;busy=true;$('message').textContent='';
 try{const response=await fetch(action?'/api/action':'/api/state',action?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...extra})}:{});const data=await response.json();if(!response.ok)throw Error(data.error);state=data;render();return true;}
 catch(error){$('message').textContent=error.message;return false;}finally{busy=false;}
}
function render(){
 const phase=state.phase;const closed=phase==='closed';
 renderEvolution($('evolution'),state);
 $('reset').disabled=false;
 if(phase==='setup'){$('results').hidden=true;$('report').hidden=true;$('bu-report').hidden=true;}
 else zero();
 $('phase').textContent={setup:'● Aguardando abertura',open:'● Seção aberta',closed:'● Seção encerrada'}[phase];
 $('total').textContent=state.total;$('target').disabled=phase!=='setup';$('target').value=state.target;
 $('open').disabled=phase!=='setup';$('authorize').disabled=phase!=='open'||state.authorized;$('close').disabled=phase!=='open'||state.authorized;$('zero').disabled=phase==='setup';
 $('instruction').textContent=phase==='setup'?'Comece emitindo a zerésima. Depois, libere um eleitor por vez.':closed?'Votação encerrada. Consulte as duas apurações abaixo.':state.authorized?'Eleitor liberado. Registre e confirme o voto no terminal.':'Aguardando o mesário liberar o próximo eleitor.';
 document.querySelectorAll('.steps li').forEach((li,i)=>li.classList.toggle('active',i===(phase==='setup'?0:closed?3:state.authorized?2:1)));
 const enabled=phase==='open'&&state.authorized;document.querySelectorAll('.controls button').forEach(b=>b.disabled=!enabled);
 let content='<small>TREINAMENTO · SEM VALIDADE ELEITORAL</small>';
 if(finished)content+='<div class="end">FIM</div><p style="text-align:center">VOTO REGISTRADO</p>';
 else if(!enabled)content+=`<h3>${closed?'Votação encerrada':'Aguarde a liberação'}</h3><p>${phase==='setup'?'O mesário deve emitir a zerésima.':'Terminal do eleitor bloqueado.'}</p>`;
 else content+=`<p>SEU VOTO PARA</p><h3>Representante fictício</h3><div class="digits">${blank?'BRANCO':digits.padEnd(2,'_')}</div><p>${blank?'VOTO EM BRANCO':digits.length===2?(names[digits]||'NÚMERO ERRADO · VOTO NULO'):'Digite os dois números'}</p><p>CORRIGE para reiniciar<br>CONFIRMA para registrar</p>`;
 $('screen').innerHTML=content;
 if(closed){showResults();showBU();}
}
function input(number){if(!state?.authorized||busy)return;finished=false;blank=false;if(digits.length<2)digits+=number;render();}
for(const n of ['1','2','3','4','5','6','7','8','9','0']){const b=document.createElement('button');b.textContent=n;b.setAttribute('aria-label','Número '+n);b.disabled=true;b.onclick=()=>input(n);$('numbers').append(b);}
$('correct').onclick=()=>{digits='';blank=false;render();};
$('blank').onclick=()=>{digits='';blank=true;render();};
$('confirm').onclick=async()=>{if(!blank&&digits.length!==2)return;const choice=blank?'blank':names[digits]?digits:'null';if(await request('vote',{choice})){digits='';blank=false;finished=true;render();}};
$('open').onclick=async()=>{if(await request('open',{target:$('target').value}))zero();};
$('authorize').onclick=async()=>{finished=false;digits='';blank=false;await request('authorize');};
$('close').onclick=()=>request('close');$('zero').onclick=zero;
 $('reset').onclick=()=>{$('reset-error').textContent='';$('reset-password').value='';$('reset-dialog').showModal();$('reset-password').focus();};
 $('reset-cancel').onclick=()=>$('reset-dialog').close();
 $('reset-dialog').addEventListener('close',()=>{$('reset-password').value='';});
 $('reset-form').onsubmit=async event=>{
  event.preventDefault();if(busy)return;
  $('reset-submit').disabled=true;$('reset-cancel').disabled=true;
  const ok=await request('reset',{password:$('reset-password').value});
  $('reset-password').value='';
  if(ok){digits='';blank=false;finished=false;render();$('reset-dialog').close();$('message').textContent='Votação limpa. Você já pode iniciar um novo teste.';}
  else {$('reset-error').textContent=$('message').textContent;$('reset-password').focus();}
  $('reset-submit').disabled=false;$('reset-cancel').disabled=false;
 };
function showBU(){
 const counts=Object.fromEntries(state.real.map(row=>[row.choice,Number(row.total)]));
 const simulated=Object.fromEntries(state.simulated.map(row=>[row.choice,Number(row.total)]));
 const lines=values=>Object.entries(names).map(([key,name])=>`${(name+(['11','22','33'].includes(key)?' ('+key+')':'')).padEnd(22)}${values[key]||0}`).join('\n')+`\n${'TOTAL'.padEnd(22)}${state.total}`;
 const report=$('bu-report');report.hidden=false;
 report.innerHTML=`<h2>BOLETIM DE URNA · REPRESENTAÇÃO DIDÁTICA</h2><p>Seção 0001 · Cargo: representante fictício</p><p>Abertura: ${new Date(state.opened_at).toLocaleString('pt-BR')}<br>Encerramento: ${new Date(state.closed_at).toLocaleString('pt-BR')}</p><h3>APURAÇÃO REAL</h3><pre>${lines(counts)}</pre><h3>APURAÇÃO MANIPULADA · SIMULAÇÃO</h3><p>Alvo da simulação: ${names[state.target]} (${state.target})</p><pre>${lines(simulated)}</pre><p>Documento de treinamento, sem validade eleitoral. O resultado simulado não altera os votos originais.</p>`;
}
function zero(){const report=$('report');report.hidden=false;report.innerHTML=`<h2>ZERÉSIMA · REPRESENTAÇÃO DIDÁTICA</h2><p>Seção 0001 · Cargo: representante fictício</p><p>Emissão: ${new Date(state.opened_at).toLocaleString('pt-BR')}</p><pre>Ana Silva (11)    0\nBruno Costa (22)  0\nClara Lima (33)   0\nBrancos          0\nNulos            0\nTOTAL            0</pre><p>Retrato da abertura, anterior ao primeiro voto.</p>`;}
function card(title,rows,sim){const counts=Object.fromEntries(rows.map(r=>[r.choice,Number(r.total)]));const valid=['11','22','33'];const max=Math.max(...valid.map(k=>counts[k]||0));const winners=max?valid.filter(k=>counts[k]===max).map(k=>names[k]).join(' / '):'Sem votos válidos';return `<div class="result-card ${sim?'sim':''}"><h2>${title}</h2><p>${max?'Maior votação: ':''}${winners}</p><table><tbody>${Object.entries(names).map(([key,name])=>`<tr><td>${name}</td><td>${counts[key]||0}</td></tr>`).join('')}<tr><td>Total</td><td>${Object.values(counts).reduce((a,b)=>a+b,0)}</td></tr></tbody></table></div>`;}
function showResults(){$('results').hidden=false;$('results').innerHTML=`<p class="eyebrow">BOLETIM DE URNA · REPRESENTAÇÃO EM TELA</p><h2>Uma eleição. Duas contagens para comparar.</h2><p>Encerramento: ${new Date(state.closed_at).toLocaleString('pt-BR')}. A contagem manipulada é fictícia e não substitui o registro original. Sem votos válidos, não há vencedor.</p><div class="comparison">${card('Resultado real',state.real,false)}${card('Resultado manipulado · SIMULAÇÃO',state.simulated,true)}</div>`;}
document.addEventListener('keydown',event=>{if(document.querySelector('dialog[open]')||['SELECT','INPUT','BUTTON'].includes(document.activeElement.tagName)||!state?.authorized||busy)return;if(/^\d$/.test(event.key))input(event.key);else if(event.key==='Backspace'){$('correct').click();event.preventDefault();}else if(event.key==='Enter')$('confirm').click();});
request();
// Atualiza apenas a apuração para não interromper digitação, senha ou seleção do alvo.
setInterval(async()=>{
 if(busy||!state||state.phase!=='open'||document.hidden)return;
 const previous=state;
 try{const response=await fetch('/api/state');if(!response.ok)return;const fresh=await response.json();if(busy||state!==previous)return;
  state.history=fresh.history;renderEvolution($('evolution'),state);
 }catch{/* A próxima atualização tentará novamente. */}
},5000);
