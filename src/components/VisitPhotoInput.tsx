import { beginCameraAttempt, type Attempt } from '../services/cameraJournal';
import type { Outcome } from '../services/cameraSignals';
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PHOTO_INITIAL_MAX_LONG_EDGE } from '../services/imageCompression';
import { beginCameraPreview, isPhotoCaptureBusy, liteMode } from '../services/liteMode';
import { cameraChoice, setCameraChoice, supportsVisitCamera } from '../services/visitCameraChoice';
import { getSession } from '../services/session';

export type VisitPhotoSource = File | HTMLCanvasElement;

type Props = {
  section: string;
  disabled: boolean;
  onPhoto: (photo: VisitPhotoSource, attempt?: Attempt) => void;
};

const stopTracks = (stream: MediaStream | null) => stream?.getTracks().forEach(track => track.stop());

export default function VisitPhotoInput({ section, disabled, onPhoto }: Props) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const nativeInput = useRef<HTMLInputElement>(null);
  const handoff = useRef(false);
  const release = useRef<() => void>(() => {});
  const attempt = useRef<Attempt | undefined>(undefined);
  const finish = (result: Outcome) => { attempt.current?.end(result); attempt.current = undefined; };
  const deliver = (source: VisitPhotoSource) => {
    const receipt = attempt.current || beginCameraAttempt(section, 'native');
    attempt.current = undefined;
    receipt.ready();
    onPhoto(source, receipt);
  };
  useEffect(() => {
    const picker = input.current;
    const cancel = () => finish('cancel');
    picker?.addEventListener('cancel',cancel);
    return () => { picker?.removeEventListener('cancel',cancel); finish('interrupted'); };
  }, []);
  const owner = String(getSession()?.user.id || '');

  useEffect(() => {
    if (!open) return;
    const preview = video.current!;
    let active = true;
    let stream: MediaStream | null = null;
    const endPreview = beginCameraPreview();
    const stop = () => {
      active = false;
      window.clearTimeout(timeout);
      if (stream) stream.getTracks().forEach(track => { track.onended = null; });
      stopTracks(stream);
      stream = null;
      preview.srcObject = null;
      endPreview();
    };
    const fail = (result: Outcome) => {
      if (!active) return;
      finish(result);
      stop();
      setReady(false);
      setError(result === 'denied'
        ? 'O acesso à câmera leve está bloqueado. Toque em Usar câmera do aparelho para continuar.'
        : 'A câmera leve não conseguiu abrir. Você pode usar a câmera do aparelho.');
    };
    const close = () => { finish('interrupted'); stop(); setOpen(false); };
    const onHide = () => { if (document.hidden && !handoff.current) close(); };
    const onPageHide = () => { if (!handoff.current) close(); };
    const fallbackPicker = nativeInput.current;
    const onNativeCancel = () => { handoff.current=false; finish('cancel'); stop(); setOpen(false); };
    const timeout = window.setTimeout(() => fail('timeout'), 20000);
    release.current = stop;
    dialog.current!.showModal();
    fallbackPicker?.addEventListener('cancel',onNativeCancel);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
    preview.onplaying = () => {
      if (!active || !preview.videoWidth || !preview.videoHeight) return;
      window.clearTimeout(timeout);
      attempt.current?.ready();
      setReady(true);
    };
    preview.onerror = () => fail('open_error');
    void navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 832, max: 1280 }, height: { ideal: 624, max: 1280 },
        frameRate: { ideal: 12, max: 15 },
      },
    }).then(async result => {
      if (!active) { stopTracks(result); return; }
      stream = result;
      result.getVideoTracks().forEach(track => { track.onended = () => fail('open_error'); });
      preview.srcObject = result;
      await preview.play();
      // Keep the device default when the browser or lens lacks continuous autofocus.
      if (active) {
        const track = result.getVideoTracks()[0];
        try {
          const caps = track?.getCapabilities?.() as MediaTrackCapabilities & {focusMode?: string[]};
          if (caps?.focusMode?.includes('continuous')) {
            void track.applyConstraints({advanced:[{focusMode:'continuous'} as MediaTrackConstraintSet]}).catch(()=>{});
          }
        } catch { /* Focus is optional; preview already works. */ }
      }
    }).catch(error => fail(error?.name === 'NotAllowedError' ? 'denied' : 'open_error'));
    return () => {
      stop();
      preview.onplaying = preview.onerror = null;
      fallbackPicker?.removeEventListener('cancel',onNativeCancel);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [open]);

  const close = () => { release.current(); setOpen(false); };
  const takePhoto = () => {
    const preview = video.current;
    if (disabled || !ready || !preview?.srcObject || preview.readyState < 2) return;
    const frame = document.createElement('canvas');
    try {
      const scale = Math.min(1, PHOTO_INITIAL_MAX_LONG_EDGE / Math.max(preview.videoWidth, preview.videoHeight));
      frame.width = Math.max(1, Math.round(preview.videoWidth * scale));
      frame.height = Math.max(1, Math.round(preview.videoHeight * scale));
      const context = frame.getContext('2d');
      if (!context) throw new Error();
      context.drawImage(preview, 0, 0, frame.width, frame.height);
    } catch {
      finish('capture_error');
      frame.width = frame.height = 1;
      release.current();
      setReady(false);
      setError('Não foi possível capturar a imagem. Use a câmera do aparelho.');
      return;
    }
    close();
    deliver(frame);
  };

  return <>
    <input ref={input} type="file" accept="image/*" capture="environment" aria-label="Adicionar foto"
      disabled={disabled} className="absolute inset-0 opacity-0 cursor-pointer"
      onClick={event => {
        finish('interrupted');
        const choice = cameraChoice(owner);
        if (!supportsVisitCamera() || !(choice === 'lite' || (choice === 'auto' && liteMode))) {
          attempt.current = beginCameraAttempt(section,'native');
          return;
        }
        event.preventDefault();
        if (open || isPhotoCaptureBusy()) return;
        handoff.current = false;
        attempt.current = beginCameraAttempt(section,'lite');
        setError(''); setReady(false); setOpen(true);
      }}
      onChange={event => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        if (file && !disabled) deliver(file); else finish('cancel');
      }}
    />
    {open && createPortal(<dialog ref={dialog} aria-label="Câmera leve" onCancel={() => { finish('cancel'); close(); }}
      className="fixed inset-0 m-auto w-[min(96vw,32rem)] rounded-2xl bg-slate-950 p-4 text-white backdrop:bg-black/75">
      <h2 className="mb-2 font-bold">Câmera leve</h2>
      <video ref={video} muted playsInline className={error ? 'hidden' : 'w-full max-h-[55dvh] object-contain'} />
      {error ? <p role="alert">{error}</p> : !ready && <p role="status">Abrindo a câmera…</p>}
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={takePhoto} disabled={!ready || !!error || disabled}
          className="rounded-xl bg-blue-600 px-4 py-3 font-semibold disabled:opacity-40">Tirar foto</button>
        <button type="button" onClick={() => { finish('cancel'); close(); }} className="rounded-xl px-3 py-3">Cancelar</button>
        <label className="relative rounded-xl px-3 py-3 underline">
          Usar câmera do aparelho
          <input ref={nativeInput} type="file" accept="image/*" capture="environment" aria-label="Usar câmera do aparelho"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0" disabled={disabled}
            onClick={() => {
              finish(handoff.current ? 'interrupted' : 'switched');
              handoff.current = true;
              release.current();
              setReady(false);
              setError('Aguardando a foto da câmera do aparelho.');
              attempt.current = beginCameraAttempt(section,'native');
            }}
            onChange={event => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              handoff.current=false;
              if (file && !disabled) { setCameraChoice(owner,'native'); deliver(file); }
              else finish('cancel');
              close();
            }}
          />
        </label>
      </div>
    </dialog>, document.body)}
  </>;
}
