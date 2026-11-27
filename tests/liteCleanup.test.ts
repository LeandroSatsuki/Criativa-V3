import assert from 'node:assert/strict';
import test from 'node:test';
import 'fake-indexeddb/auto';
import { storeLocalPhoto, readLocalPhoto, markPhotosConfirmed, pruneConfirmedPhotos, PHOTO_RETENTION_MS } from '../src/services/litePhotos.ts';
import { confirmQueuedVisit } from '../src/services/confirmQueuedVisit.ts';
import { saveVisitDraft } from '../src/services/visitStorage.ts';
import { upsertQueuedVisit, getQueuedVisit, removeQueuedVisit } from '../src/services/syncQueue.ts';

const memory = new Map<string,string>();
Object.assign(globalThis,{window:globalThis,localStorage:{getItem:(k:string)=>memory.get(k)||null,setItem:(k:string,v:string)=>memory.set(k,v),removeItem:(k:string)=>memory.delete(k)}});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:{request:async(_name:string,fn:()=>Promise<unknown>)=>fn()}}});

test('limpeza exige confirmacao, retencao, dono correto e ausencia de fila e rascunho', async()=>{
  const owner='cleanup'; const visitId='VISIT-CLEAN';
  const ref=await storeLocalPhoto(owner,'foto-preservada',{visitId,storeId:'store',section:'ANTES',industry:'Teste',capturedAt:new Date().toISOString()});
  const orphan=await storeLocalPhoto(owner,'orfao-preservado');
  const other=await storeLocalPhoto('other','outro-preservado');
  const draft={user:{id:owner},draftOwnerId:owner,visitId,step:'ANTES',checkInDone:true,photos:{ANTES:[ref]},industryExecutions:{}} as any;
  await saveVisitDraft('cleanup',draft);
  await upsertQueuedVisit(owner,draft,visitId);
  await assert.rejects(confirmQueuedVisit(owner,visitId,'enviando'));
  assert.ok(await getQueuedVisit(owner,visitId));
  await confirmQueuedVisit(owner,visitId,'enviado');
  assert.equal(await getQueuedVisit(owner,visitId),null);
  assert.equal(await pruneConfirmedPhotos(owner),0);
  const future=Date.now()+PHOTO_RETENTION_MS+1000;
  assert.equal(await pruneConfirmedPhotos(owner,future),0);
  await saveVisitDraft('cleanup',{...draft,visitId:null,checkInDone:false,photos:{}});
  await upsertQueuedVisit('other',{user:{id:'other'},photos:{}},'VISIT-OTHER');
  assert.equal(await pruneConfirmedPhotos(owner,future),0);
  await removeQueuedVisit('other','VISIT-OTHER');
  assert.equal(await pruneConfirmedPhotos('other',future),0);
  assert.equal(await pruneConfirmedPhotos(owner),0);
  assert.equal(await readLocalPhoto(owner,ref),'foto-preservada');
  assert.equal(await pruneConfirmedPhotos(owner,future),1);
  await assert.rejects(readLocalPhoto(owner,ref),/indisponivel/);
  assert.equal(await readLocalPhoto(owner,orphan),'orfao-preservado');
  assert.equal(await readLocalPhoto('other',other),'outro-preservado');
});

test('sem Web Locks a limpeza preserva fotos confirmadas',async()=>{
 const ref=await storeLocalPhoto('no-lock','foto',{visitId:'VISIT-NOLOCK',storeId:'s',section:'ANTES',industry:'I',capturedAt:''});
 await markPhotosConfirmed('no-lock','VISIT-NOLOCK',{photos:[ref]});
 const original=navigator.locks;
 Object.defineProperty(navigator,'locks',{configurable:true,value:undefined});
 try{assert.equal(await pruneConfirmedPhotos('no-lock',Date.now()+PHOTO_RETENTION_MS+1000),0);assert.equal(await readLocalPhoto('no-lock',ref),'foto');}
 finally{Object.defineProperty(navigator,'locks',{configurable:true,value:original});}
});

test('limpeza interrompida reverte exclusoes e pode ser repetida',async()=>{
 const owner='rollback',visitId='VISIT-ROLLBACK';
 const ref=await storeLocalPhoto(owner,'foto-rollback',{visitId,storeId:'s',section:'ANTES',industry:'I',capturedAt:''});
 await markPhotosConfirmed(owner,visitId,{photos:[ref]});
 const original=IDBObjectStore.prototype.delete;
 IDBObjectStore.prototype.delete=function(key:IDBValidKey){
  const request=original.call(this,key);
  if(this.name==='photos'){
   const tx=this.transaction;request.addEventListener('success',()=>tx.abort());
  }
  return request;
 };
 const future=Date.now()+PHOTO_RETENTION_MS+1000;
 try{await assert.rejects(pruneConfirmedPhotos(owner,future));}
 finally{IDBObjectStore.prototype.delete=original;}
 assert.equal(await readLocalPhoto(owner,ref),'foto-rollback');
 assert.equal(await pruneConfirmedPhotos(owner,future),1);
 await assert.rejects(readLocalPhoto(owner,ref),/indisponivel/);
});
