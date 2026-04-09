export const formatResult = (result: unknown): string => {
  if (typeof result === 'string') return result;
  if (result === null || result === undefined) return '';
  return JSON.stringify(result, null, 2);
};

export const formatValue = (value: unknown): string => {
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
};

export const extractFilename = (path: string): string => path.split('/').pop() ?? path;

export const extractDomain = (url: string): string => {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url.length > 30 ? `${url.slice(0, 27)}\u2026` : url;
  }
};
