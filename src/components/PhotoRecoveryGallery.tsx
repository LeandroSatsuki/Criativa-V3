import React, { useState } from 'react';
import { getQueuedVisit } from '../services/syncQueue';
import { readLocalPhoto, LocalPhotoUnavailableError } from '../services/litePhotos';
import { photoRecoverySlots, type MissingPhotoSlot } from '../services/photoRecoverySlots';
import { restorePhotoFromGallery } from '../services/restorePhotoFromGallery';
import { getSession } from '../services/session';
import { isPhotoCaptureBusy, setPhotoCaptureBusy } from '../services/liteMode';

export default function PhotoRecoveryGallery({ ownerId, visitId, onRecovered }: { ownerId: string; visitId: string; onRecovered: () => void }) {
  const [slots, setSlots] = useState<MissingPhotoSlot[] | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const discover = async () => {
    if (busy) return; setBusy(true); setMessage('Conferindo as referencias, uma por vez...');
    try {
      const queued = await getQueuedVisit(ownerId, visitId); if (!queued) throw new Error('Registro nao encontrado nesta fila.');
      const missing: MissingPhotoSlot[] = [];
      for (const slot of photoRecoverySlots(queued.payload)) {
        if (getSession()?.user.id !== ownerId) throw new Error('A sessao mudou.');
        try { await readLocalPhoto(ownerId, slot.photoId); }
        catch (error) { if (error instanceof LocalPhotoUnavailableError && error.reason === 'missing') missing.push(slot); else throw error; }
      }
      setSlots(missing); setMessage(missing.length ? 'Selecione somente os arquivos originais desta visita. As fotos acessiveis nao serao substituidas.' : 'Todas as fotos estao acessiveis. Tente enviar a visita salva.');
    } catch (error: any) { setMessage(error.message || 'Nao foi possivel conferir as fotos.'); }
    finally { setBusy(false); }
  };
  const restore = async (slot: MissingPhotoSlot, input: HTMLInputElement) => {
    const file = input.files?.[0]; if (!file || busy) return;
    if (isPhotoCaptureBusy()) { setMessage('Aguarde a outra foto terminar.'); input.value = ''; return; }
    if (!window.confirm(`Restaurar ${slot.section}, ${slot.industry || 'visita'}, foto ${slot.number}, usando ${file.name}? Selecione apenas o original desta mesma visita.`)) { input.value = ''; return; }
    setBusy(true); setPhotoCaptureBusy(true); setMessage('Protegendo e restaurando a foto selecionada...');
    try {
      await restorePhotoFromGallery(ownerId, visitId, slot.photoId, file);
      setSlots(current => current?.filter(item => item.photoId !== slot.photoId) || []);
      setMessage(slots?.length === 1 ? 'Todos os originais foram recuperados. Toque em Enviar visita salva para continuar.' : 'Foto original recuperada. As demais fotos e a visita foram preservadas.'); onRecovered();
    } catch (error: any) { setMessage(error.message || 'Nao foi possivel recuperar a imagem. Nenhuma foto foi removida.'); }
    finally { input.value = ''; setPhotoCaptureBusy(false); setBusy(false); }
  };
  return <div className="space-y-2">
    <button type="button" disabled={busy} onClick={() => void discover()} className="w-full border border-slate-300 text-slate-700 py-3 rounded-xl font-bold disabled:opacity-50">Recuperar originais da galeria</button>
    {message && <p role="status">{message}</p>}
    {slots?.map(slot => <label key={slot.photoId} className="block rounded-lg border border-slate-200 p-3 space-y-2">
      <span className="block font-semibold">{slot.industry ? `${slot.industry} / ` : ''}{slot.section} - foto {slot.number}</span>
      <span className="block">Arquivo original ausente</span>
      <input aria-label={`Restaurar ${slot.section} foto ${slot.number}`} type="file" accept="image/*" disabled={busy} onChange={event => void restore(slot, event.currentTarget)} className="block w-full max-w-full text-xs" />
    </label>)}
  </div>;
}
