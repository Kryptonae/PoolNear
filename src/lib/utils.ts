export function getSafeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let safeUrl = url.trim();
  const lowerUrl = safeUrl.toLowerCase();
  if (!lowerUrl.startsWith('http://') && !lowerUrl.startsWith('https://')) {
    safeUrl = 'https://' + safeUrl;
  }
  try {
    const parsed = new URL(safeUrl);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {
    return null;
  }
  return null;
}
