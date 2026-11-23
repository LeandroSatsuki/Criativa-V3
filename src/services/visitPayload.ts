export const DIRECT_VISIT_PAYLOAD_MAX_BYTES = 4 * 1024 * 1024;
export const VISIT_PAYLOAD_CHUNK_MAX_BYTES = Math.floor(1.5 * 1024 * 1024);

// Check without serializing or copying image strings. Leave headroom for JSON
// escaping and request metadata; large legacy drafts also use bounded streaming.
export const hasLargeVisitStrings = (value: unknown, budget = 1024 * 1024): boolean => {
  let remaining = budget;
  const visit = (item: unknown): boolean => {
    if (typeof item === 'string') { remaining -= item.length; return remaining > 0; }
    if (Array.isArray(item)) return item.every(visit);
    if (item && typeof item === 'object') return Object.values(item).every(visit);
    return true;
  };
  return !visit(value);
};

// Count UTF-8 bytes without allocating a second copy of the photo payload.
const utf8Character = (value: string, index: number) => {
  const code = value.charCodeAt(index);
  if (code < 0x80) return 1;
  if (code < 0x800) return 2;
  if (code >= 0xD800 && code <= 0xDBFF) {
    const next = value.charCodeAt(index + 1);
    if (next >= 0xDC00 && next <= 0xDFFF) return 4;
  }
  // TextEncoder also uses three bytes for an unpaired surrogate (U+FFFD).
  return 3;
};

export const getUtf8ByteLength = (value: string) => {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const size = utf8Character(value, index);
    bytes += size;
    if (size === 4) index += 1;
  }
  return bytes;
};

export const getMissingChunkIndexes = (total: number, receivedIndexes: unknown) => {
  const received = new Set(
    Array.isArray(receivedIndexes)
      ? receivedIndexes.filter((index): index is number => Number.isInteger(index) && index >= 0 && index < total)
      : [],
  );

  return Array.from({ length: total }, (_, index) => index)
    .filter((index) => !received.has(index));
};

export const splitUtf8Text = (value: string, maxBytes = VISIT_PAYLOAD_CHUNK_MAX_BYTES) => {
  if (!Number.isInteger(maxBytes) || maxBytes <= 0) {
    throw new Error('O tamanho máximo do fragmento deve ser um inteiro positivo.');
  }

  const chunks: string[] = [];
  let start = 0;
  let bytes = 0;

  for (let index = 0; index < value.length; index += 1) {
    const size = utf8Character(value, index);
    if (size > maxBytes) {
      throw new Error('Não foi possível dividir o payload da visita com segurança.');
    }
    if (bytes + size > maxBytes) {
      chunks.push(value.slice(start, index));
      start = index;
      bytes = 0;
    }
    bytes += size;
    if (size === 4) index += 1;
  }

  chunks.push(value.slice(start));
  return chunks;
};

