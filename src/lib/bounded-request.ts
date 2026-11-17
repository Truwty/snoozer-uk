export async function boundedBody(request: Pick<Request, "body" | "headers">, maxBytes: number) {
  if (!request.body || Number(request.headers.get("content-length")) > maxBytes) return null;
  const reader = request.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return Buffer.concat(parts, size);
      size += value.byteLength;
      if (size > maxBytes) {
        void reader.cancel().catch(() => undefined);
        return null;
      }
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
}
