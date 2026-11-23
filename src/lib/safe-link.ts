export function safeLink(value: string) {
  if (!/^https?:\/\/[a-z0-9.-]+(?::[0-9]{1,5})?(?:[/?#][^\\\s]*)?$/i.test(value)) return false;
  try {
    const url = new URL(value);
    return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(url.hostname)
      && !/\.(?:local|localhost|internal|test|invalid|example|onion)$/i.test(url.hostname);
  } catch {
    return false;
  }
}
