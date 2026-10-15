
export function previewApiBlocked(pathname: string, method: string, previewOnly: boolean): boolean {
  if (!previewOnly) return false;
  if (pathname !== '/api' && !pathname.startsWith('/api/')) return false;
  return !(pathname === '/api/health' && (method === 'GET' || method === 'HEAD'));
}
