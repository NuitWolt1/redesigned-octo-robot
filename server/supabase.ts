export class DatabaseNotConfiguredError extends Error {
  constructor() { super('Database is not configured.'); this.name = 'DatabaseNotConfiguredError'; }
}

function getConfig() {
  const projectUrl = process.env.SUPABASE_URL?.trim().replace(/\/+$/, '');
  // Prefer the current Supabase secret key. Keep the legacy service-role variable supported.
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!projectUrl || !secretKey) throw new DatabaseNotConfiguredError();
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(projectUrl)) throw new Error('Invalid SUPABASE_URL.');
  return { projectUrl, secretKey };
}

export async function databaseRequest<T>(
  table: 'market_gifts' | 'reviews',
  query: URLSearchParams,
  method: 'GET' | 'POST' | 'DELETE',
  payload?: unknown,
  prefer = 'return=representation'
): Promise<T> {
  const { projectUrl, secretKey } = getConfig();
  const url = `${projectUrl}/rest/v1/${table}?${query.toString()}`;
  const requestHeaders: Record<string, string> = {
    apikey: secretKey,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Prefer: prefer
  };
  // Legacy service_role keys are JWTs and also serve as the PostgREST bearer token.
  // Current sb_secret_ keys are API keys and should only be sent via apikey.
  if (secretKey.startsWith('eyJ')) requestHeaders.Authorization = `Bearer ${secretKey}`;

  const response = await fetch(url, {
    method,
    headers: requestHeaders,
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    cache: 'no-store'
  });

  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try { parsed = JSON.parse(text); }
    catch { parsed = text; }
  }
  if (!response.ok) {
    // Do not leak credentials or raw database details to public clients.
    console.error(`Supabase request failed (${table}, ${method}):`, response.status, parsed);
    throw new Error(`Database request failed (${response.status}).`);
  }
  return parsed as T;
}

export function databaseIsConfigured(): boolean {
  return Boolean(
    process.env.SUPABASE_URL &&
    (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
}
