export function kofiProfileUrl(value: string | undefined) {
  const match = value?.trim().match(/^https:\/\/(?:www\.)?ko-fi\.com\/([a-z0-9_-]{1,64})\/?$/i);
  return match ? "https://ko-fi.com/" + match[1] : null;
}
