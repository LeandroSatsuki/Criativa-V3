import React, { useEffect, useState } from 'react';
import { readLocalPhoto, isLocalPhoto } from '../services/litePhotos';
import { getSession } from '../services/session';

export default function PhotoPreview({ photo, alt, className }: { photo: string; alt: string; className?: string }) {
  const [loaded, setLoaded] = useState<{ id: string; value: string } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!isLocalPhoto(photo)) return;
    let cancelled = false;
    setFailed(false);
    void readLocalPhoto(String(getSession()?.user.id || ''), photo)
      .then(value => { if (!cancelled) setLoaded({ id: photo, value }); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [photo]);
  const value = isLocalPhoto(photo) ? (loaded?.id === photo ? loaded.value : '') : photo;
  if (!value) return <span role="status">{failed ? 'Foto indisponivel' : 'Carregando foto'}</span>;
  return <img loading="lazy" decoding="async" src={`data:image/jpeg;base64,${value}`} alt={alt} className={className} />;
}
