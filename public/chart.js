const ids=['11','22','33'];
const colors=['#238343','#dc3955','#6889c0'];
const fmt=value=>value.toLocaleString('pt-BR',{maximumFractionDigits:2});
const timeLabel=value=>new Date(value).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});

export function evolution(history){
 const totals={'11':0,'22':0,'33':0},groups=new Map();
 for(const row of history){
  if(!ids.includes(row.choice))continue;
  const key=row.time||null;
  if(!groups.has(key))groups.set(key,{'11':0,'22':0,'33':0});
  groups.get(key)[row.choice]+=Number(row.total);
 }
 return [...groups].sort(([a],[b])=>a===b?0:a===null?-1:b===null?1:new Date(a)-new Date(b)).map(([time,counts])=>{
  for(const id of ids)totals[id]+=counts[id];
  const total=ids.reduce((sum,id)=>sum+totals[id],0);
  return {time,total,counts:{...totals},percent:Object.fromEntries(ids.map(id=>[id,total?totals[id]/total*100:0]))};
 });
}

// Reconstrução retrospectiva das transferências finais, mantendo os horários.
// Não altera votos nem representa um histórico observado de manipulações.
export function manipulatedHistory(history,finalResult,target){
 const real=evolution(history).at(-1)?.counts||{'11':0,'22':0,'33':0};
 const final=Object.fromEntries(finalResult.map(row=>[row.choice,Number(row.total)]));
 const remaining=Object.fromEntries(ids.map(id=>[id,Math.max(0,real[id]-(final[id]||0))]));
 const sorted=[...history].sort((a,b)=>a.time===b.time?0:!a.time?-1:!b.time?1:new Date(a.time)-new Date(b.time));
 const result=[];
 for(const row of sorted){
  if(!ids.includes(row.choice))continue;
  const moved=row.choice===target?0:Math.min(remaining[row.choice],Number(row.total));
  remaining[row.choice]-=moved;
  if(Number(row.total)>moved)result.push({...row,total:Number(row.total)-moved});
  if(moved)result.push({time:row.time,choice:target,total:moved});
 }
 return result;
}

function graph(state,history,sim,start,end){
 const points=evolution(history),latest=points.at(-1),known=points.filter(point=>point.time),legacy=points.find(point=>!point.time);
 const title=sim?'Evolução manipulada · SIMULAÇÃO':'Evolução real dos votos';
 const stats=state.candidates.map((candidate,i)=>`<div class="chart-stat"><span style="color:${colors[i]}">●</span> ${candidate.name} <strong>${fmt(latest?.percent[candidate.number]||0)}%</strong><small>${latest?.counts[candidate.number]||0} votos</small></div>`).join('');
 let chart='<p class="chart-empty">A evolução aparecerá aqui após o primeiro voto válido com horário registrado.</p>';
 if(points.length){
  const x=time=>60+(new Date(time).getTime()-start)/Math.max(1,end-start)*610;
  const y=value=>280-value*2.3;
  const plotted=legacy?[{...legacy,time:new Date(start).toISOString()},...known]:known;
  const grid=[0,25,50,75,100].map(value=>`<line x1="60" y1="${y(value)}" x2="670" y2="${y(value)}" stroke="#e0e5dc" stroke-dasharray="3 4"/><text x="48" y="${y(value)+4}" text-anchor="end">${value}</text>`).join('');
  const ticks=Array.from({length:5},(_,i)=>{const time=start+(end-start)*i/4;return `<text x="${60+610*i/4}" y="307" text-anchor="${i===0?'start':i===4?'end':'middle'}">${timeLabel(time)}</text>`;}).join('');
  const labels=ids.map((id,i)=>({id,i,y:y(latest.percent[id])})).sort((a,b)=>a.y-b.y);
  labels.forEach((label,i)=>{label.labelY=Math.max(label.y,i?labels[i-1].labelY+34:50);});
  if(labels.at(-1).labelY>280){const delta=labels.at(-1).labelY-280;labels.forEach(label=>{label.labelY-=delta;});}
  const paths=ids.map((id,i)=>{
   const d=plotted.map((point,index)=>`${index?'L':'M'} ${x(point.time)} ${y(point.percent[id])}`).join(' ')+` L 670 ${y(latest.percent[id])}`;
   const label=labels.find(item=>item.id===id);
   return `<path d="${d}" fill="none" stroke="${colors[i]}" stroke-width="2"/><path d="M 670 ${y(latest.percent[id])} L 692 ${label.labelY}" fill="none" stroke="${colors[i]}"/><circle cx="670" cy="${y(latest.percent[id])}" r="3.5" fill="${colors[i]}"/><text x="701" y="${label.labelY-4}" style="fill:${colors[i]};font-size:12px">${state.candidates[i].name}<tspan x="701" dy="15">${fmt(latest.percent[id])}%</tspan></text>`+
    known.map(point=>`<circle cx="${x(point.time)}" cy="${y(point.percent[id])}" r="3" fill="${colors[i]}" tabindex="0"><title>${state.candidates[i].name} · ${timeLabel(point.time)} · ${fmt(point.percent[id])}% · ${point.counts[id]}/${point.total} votos válidos</title></circle>`).join('');
  }).join('');
  chart=`<div class="chart-scroll"><svg viewBox="0 0 860 350" role="img" aria-label="${title}: percentual acumulado da abertura ao encerramento"><title>${title}</title><text x="16" y="25">em %</text>${grid}${ticks}${paths}<text x="60" y="329">Início</text><text x="365" y="329" text-anchor="middle">Horário da votação</text><text x="670" y="329" text-anchor="end">${state.phase==='closed'?'Encerramento':'Agora'}</text></svg></div>`;
 }
 return `<article class="evolution-chart ${sim?'simulated-chart':''}"><h3>${title}</h3><p>${sim?'Reconstrução retrospectiva a partir da contagem final da procedure.':'Percentual acumulado dos votos válidos registrados.'}</p><div class="chart-stats">${stats}</div>${chart}${legacy?`<p class="note">${legacy.total} voto(s) válido(s) sem horário: saldo anterior, sem cronologia reconstruída.</p>`:''}</article>`;
}

export function renderEvolution(container,state){
 const start=state.opened_at?new Date(state.opened_at).getTime():Date.now();
 const end=state.closed_at?new Date(state.closed_at).getTime():Date.now();
 const period=state.opened_at?`${timeLabel(start)} → ${state.closed_at?timeLabel(end):'em andamento'}`:'Aguardando abertura';
 const real=graph(state,state.history||[],false,start,end);
 const simulated=state.phase==='closed'?
  graph(state,manipulatedHistory(state.history||[],state.simulated||[],state.target),true,start,end):
  '<article class="evolution-chart simulated-chart"><h3>Evolução manipulada · SIMULAÇÃO</h3><p class="chart-empty">O gráfico simulado será gerado ao encerrar a votação, quando a procedure produzir a contagem manipulada.</p></article>';
 container.innerHTML=`<div class="section-title"><h2>Evolução dos votos em %</h2><span>${period}</span></div><p>Da abertura ao encerramento da seção. Brancos e nulos ficam fora do cálculo. Os dois gráficos usam o mesmo intervalo e a escala de 0 a 100%.</p>${real}${simulated}<p class="note">Passe o cursor sobre os pontos para consultar horário, percentual e votos. No gráfico manipulado, as transferências finais são atribuídas aos primeiros votos dos candidatos doadores, nos mesmos horários; trata-se de uma reconstrução didática, não de alterações observadas ao longo da votação.</p>`;
}
