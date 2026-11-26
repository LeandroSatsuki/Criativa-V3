import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { cameraReport, eventKey, validEvent, DAY } from '../netlify/functions/_shared/camera-signals.ts';
import type { CameraEvent, Outcome } from '../src/services/cameraSignals.ts';
import { appendCameraPhoto, settleCameraDraft } from '../src/services/cameraDraftReceipt.ts';
const now=Date.now();
const event=(result:Outcome,offset=0):CameraEvent=>({id:randomUUID(),mode:'lite',section:'ANTES',at:now+offset,opened:true,build:'index-test.js',result});
test('reenvios, cancelamento, permissão, recuperação e sinais antigos',()=>{
  const e=event('saved',-1000);
  const keys=[eventKey('1',e),eventKey('1',e),eventKey('1',event('open_error',-5000)),eventKey('1',event('timeout',-4000)),eventKey('1',event('cancel',-3000)),eventKey('1',event('denied')),eventKey('2',event('timeout',-DAY-1))];
  const r=cameraReport(keys,now);
  assert.equal(r.rows.length,1); const row=r.rows[0];
  assert.deepEqual([row.liteBefore,row.attempts,row.cancelled,row.denied,row.failures],[1,4,1,1,2]);
  assert.deepEqual(row.alerts,[]);
  assert.deepEqual(cameraReport(keys.slice(2,5),now).rows[0].alerts,['ANTES']);
});
test('alerta coletivo exige três contas, mesma versão e falha em 30 minutos',()=>{
  const keys=['1','2','2','3'].map(id=>eventKey(id,event('timeout',-100)));
  assert.equal(cameraReport(keys,now).clusters[0].count,3);
  keys.pop(); keys.push(eventKey('3',event('timeout',-1800001)),eventKey('4',{...event('timeout'),build:'index-other.js'}));
  assert.deepEqual(cameraReport(keys,now).clusters,[]);
  assert.equal(validEvent({...event('timeout'),section:'ENDERECO/PRIVADO'}),false);
});
test('confirma somente o lote de fotos associado ao rascunho gravado',()=>{
  const results:string[]=[];
  const attempt={ready(){},end(r:Outcome){results.push(r);}};
  const list=appendCameraPhoto([],'imagem',attempt);
  settleCameraDraft({photos:{ANTES:['outra']}} as any,true);assert.deepEqual(results,[]);
  settleCameraDraft({photos:{ANTES:list}} as any,true);
  settleCameraDraft({photos:{ANTES:list}} as any,true);
  assert.deepEqual(results,['saved']);
  const failed=appendCameraPhoto([],'imagem2',attempt);
  settleCameraDraft({industryExecutions:{x:{photos:{ANTES:failed}}}} as any,false);
  assert.deepEqual(results,['saved','write_error']);
});
