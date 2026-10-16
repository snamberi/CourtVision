/*
 * Compact storage for restore points: the league as JSON, gzip-compressed with the browser's CompressionStream. A long
 * league shrinks to a fraction of its size, and a compressed point is one binary value, so listing a save's backups no
 * longer rebuilds every league in memory. Browsers without CompressionStream keep plain JSON bytes; unpacking reads both.
 */

async function pipe(bytes: Uint8Array, transform: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const writer = transform.writable.getWriter();
  // The write settles only as the output is read, so it is not awaited here; a failure surfaces through read().
  writer.write(bytes as Uint8Array<ArrayBuffer>).catch(() => {});
  writer.close().catch(() => {});
  const reader = transform.readable.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.byteLength; }
  return out;
}

export const isGzip = (bytes: Uint8Array) => bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;

export async function packJson(value: unknown): Promise<Uint8Array> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return typeof CompressionStream === 'undefined' ? bytes : pipe(bytes, new CompressionStream('gzip'));
}

export async function unpackJson<T>(bytes: Uint8Array): Promise<T> {
  if (isGzip(bytes) && typeof DecompressionStream === 'undefined') throw new Error('This browser cannot open compressed backups. Try a current Chrome, Edge, Firefox or Safari.');
  const raw = isGzip(bytes) ? await pipe(bytes, new DecompressionStream('gzip')) : bytes;
  return JSON.parse(new TextDecoder().decode(raw)) as T;
}
