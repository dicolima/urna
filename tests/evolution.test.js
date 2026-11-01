import test from 'node:test';
import assert from 'node:assert/strict';
import {evolution,renderEvolution,manipulatedHistory} from '../public/chart.js';

test('percentuais acumulados, empates e votos no mesmo instante',()=>{
 const result=evolution([
  {time:'2026-11-01T10:00:00Z',choice:'11',total:1},
  {time:'2026-11-01T10:01:00Z',choice:'22',total:1},
  {time:'2026-11-01T10:02:00Z',choice:'33',total:2},
  {time:'2026-11-01T10:02:00Z',choice:'11',total:1},
  {time:'2026-11-01T10:03:00Z',choice:'blank',total:10},
 ]);
 assert.equal(result.length,3);
 assert.equal(result[0].percent['11'],100);
 assert.equal(result[1].percent['11'],50);
 assert.deepEqual(result[2].percent,{'11':40,'22':20,'33':40});
 assert.equal(result[2].total,5);
});

test('reconstrução manipulada conserva total em cada instante e termina no BU',()=>{
 const history=[
  {time:null,choice:'22',total:2},
  {time:'2026-11-01T10:01:00Z',choice:'22',total:2},
  {time:'2026-11-01T10:02:00Z',choice:'33',total:2},
  {time:'2026-11-01T10:03:00Z',choice:'11',total:1},
 ];
 const original=JSON.stringify(history);
 const final=[{choice:'11',total:4},{choice:'22',total:1},{choice:'33',total:2}];
 const real=evolution(history);
 const manipulated=evolution(manipulatedHistory(history,final,'11'));
 assert.deepEqual(manipulated.map(p=>[p.time,p.total]),real.map(p=>[p.time,p.total]));
 assert.deepEqual(manipulated.at(-1).counts,{'11':4,'22':1,'33':2});
 assert.equal(JSON.stringify(history),original);
});

test('dois gráficos têm início e fim iguais e rótulos dos resultados finais',()=>{
 const element={innerHTML:''};
 const state={candidates:[{number:'11',name:'Ana Silva'},{number:'22',name:'Bruno Costa'},{number:'33',name:'Clara Lima'}],phase:'closed',target:'11',opened_at:'2026-11-01T10:00:00Z',closed_at:'2026-11-01T11:00:00Z',history:[{time:'2026-11-01T10:30:00Z',choice:'22',total:1}],simulated:[{choice:'11',total:1},{choice:'22',total:0},{choice:'33',total:0}]};
 renderEvolution(element,state);
 assert.equal((element.innerHTML.match(/<svg /g)||[]).length,2);
 assert.equal((element.innerHTML.match(/>Início</g)||[]).length,2);
 assert.equal((element.innerHTML.match(/>Encerramento</g)||[]).length,2);
 // Primeiro voto ocorre exatamente no meio dos dois eixos (60 + 610/2).
 assert.equal((element.innerHTML.match(/M 365 /g)||[]).length,6);
 assert.match(element.innerHTML,/reconstrução didática/);
 assert.doesNotMatch(element.innerHTML,/NaN|Infinity/);
});
test('saldo antigo sem horário é preservado e não recebe data inventada',()=>{
 const result=evolution([{time:'2026-11-01T11:00:00Z',choice:'22',total:1},{time:null,choice:'11',total:3}]);
 assert.equal(result[0].time,null);
 assert.deepEqual(result[1].percent,{'11':75,'22':25,'33':0});
 assert.deepEqual(evolution([]),[]);
});
test('renderização vazia e primeiro voto não geram coordenadas inválidas',()=>{
 const element={innerHTML:''};
 const state={candidates:[{number:'11',name:'Ana Silva'},{number:'22',name:'Bruno Costa'},{number:'33',name:'Clara Lima'}],phase:'closed',opened_at:'2026-11-01T10:00:00Z',closed_at:'2026-11-01T10:00:00Z',history:[]};
 renderEvolution(element,state);assert.match(element.innerHTML,/primeiro voto válido/);
 state.history=[{time:state.opened_at,choice:'11',total:1}];
 renderEvolution(element,state);assert.match(element.innerHTML,/<svg/);assert.doesNotMatch(element.innerHTML,/NaN|Infinity/);
});
