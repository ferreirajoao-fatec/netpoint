import { useAuth } from '@/store/auth';

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

export function buildUrl(path: string, query?: Query) {
  const base = useAuth.getState().apiUrl;
  const qs = query
    ? Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : '';
  return `${base}${path}${qs ? `?${qs}` : ''}`;
}

export function authHeader(): Record<string, string> {
  const token = useAuth.getState().token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Chamada à API do NetPoint com token e mensagens de erro amigáveis. */
export async function api<T>(
  path: string,
  opts: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown; query?: Query; form?: FormData } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method: opts.method ?? 'GET',
      headers: {
        ...authHeader(),
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    });
  } catch {
    throw new ApiError('Não foi possível conectar ao servidor. Verifique o endereço da API e a rede.', 0);
  }

  if (res.status === 401 && useAuth.getState().token) {
    await useAuth.getState().logout();
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = Array.isArray(data?.message) ? data.message.join('\n') : data?.message;
    throw new ApiError(msg || `Erro ${res.status}`, res.status);
  }
  return data as T;
}
