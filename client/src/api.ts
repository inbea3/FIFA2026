const TOKEN_KEY = 'fifaweb_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '请求失败');
  return data as T;
}

export const api = {
  register: (username: string, password: string) =>
    request<{ token: string; user: import('./types').User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  login: (username: string, password: string) =>
    request<{ token: string; user: import('./types').User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  me: () => request<{ user: import('./types').User }>('/me'),
  todayMatches: () =>
    request<{
      salesDate: string;
      label: string;
      matches: import('./types').Match[];
      count: number;
    }>('/matches/today'),
  allMatches: () => request<{ matches: import('./types').Match[] }>('/matches'),
  placeBet: (body: {
    matchNumber: number;
    betType: string;
    selection: string;
    stake: number;
  }) =>
    request<{ ok: boolean; balance: number; potentialWin: number }>('/bets', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  myBets: () => request<{ bets: import('./types').Bet[] }>('/bets'),
  leaderboard: () => request<{ rankings: import('./types').LeaderboardEntry[] }>('/leaderboard'),
  transactions: () =>
    request<{ transactions: { id: number; type: string; amount: number; balance_after: number; note: string; created_at: string }[] }>(
      '/transactions'
    ),
};
