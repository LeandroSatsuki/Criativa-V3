export const DIRECT_VISIT_PAYLOAD_MAX_BYTES = 4 * 1024 * 1024;
export const VISIT_PAYLOAD_CHUNK_MAX_BYTES = Math.floor(1.5 * 1024 * 1024);

const encoder = new TextEncoder();

export const getUtf8ByteLength = (value: string) => encoder.encode(value).byteLength;

const avoidSplittingSurrogatePair = (value: string, index: number) => {
  if (index <= 0 || index >= value.length) return index;

  const previous = value.charCodeAt(index - 1);
  const current = value.charCodeAt(index);
  const splitsPair = previous >= 0xD800 && previous <= 0xDBFF
    && current >= 0xDC00 && current <= 0xDFFF;

  return splitsPair ? index - 1 : index;
};

export const splitUtf8Text = (value: string, maxBytes = VISIT_PAYLOAD_CHUNK_MAX_BYTES) => {
  if (!Number.isInteger(maxBytes) || maxBytes <= 0) {
    throw new Error('O tamanho máximo do fragmento deve ser um inteiro positivo.');
  }

  if (getUtf8ByteLength(value) <= maxBytes) return [value];

  const chunks: string[] = [];
  let start = 0;

  while (start < value.length) {
    let low = start + 1;
    let high = value.length;
    let bestEnd = start;

    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const candidateEnd = avoidSplittingSurrogatePair(value, middle);
      const candidate = value.slice(start, candidateEnd);

      if (getUtf8ByteLength(candidate) <= maxBytes) {
        bestEnd = candidateEnd;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }

    if (bestEnd <= start) {
      throw new Error('Não foi possível dividir o payload da visita com segurança.');
    }

    chunks.push(value.slice(start, bestEnd));
    start = bestEnd;
  }

  return chunks;
};

