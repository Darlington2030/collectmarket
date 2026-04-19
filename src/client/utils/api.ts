import type { Item, Message, User, CreateItemInput, SendMessageInput, LoginInput, PollResponse } from '../types/index.js';

const API_BASE = (window as any).__API_BASE__ || '/api';

export class APIError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'APIError';
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
  } catch (networkErr: any) {
    // fetch() itself threw — network down or connection refused
    throw new APIError(0, 'Cannot reach server. Make sure the backend is running.');
  }

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      msg = body.error || body.message || msg;
    } catch { /* body not JSON */ }
    throw new APIError(res.status, msg);
  }

  if (res.status === 204) return undefined as T;

  try {
    return await res.json();
  } catch {
    throw new APIError(0, 'Invalid response from server');
  }
}

export const itemsApi = {
  getAll: (search?: string): Promise<Item[]> =>
    request<Item[]>(`/items${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  getById: (id: string): Promise<Item> => request<Item>(`/items/${id}`),
  create: (data: CreateItemInput): Promise<Item> =>
    request<Item>('/items', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Item>): Promise<Item> =>
    request<Item>(`/items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string): Promise<void> =>
    request<void>(`/items/${id}`, { method: 'DELETE' }),
  checkout: (id: string, buyerId: string): Promise<{ success: boolean; item: Item }> =>
    request(`/items/${id}/checkout`, { method: 'POST', body: JSON.stringify({ buyerId }) }),
  confirmSale: (id: string, sellerId: string): Promise<{ success: boolean; item: Item }> =>
    request(`/items/${id}/confirm-sale`, { method: 'POST', body: JSON.stringify({ sellerId }) }),
};

export const messagesApi = {
  getForItem: (itemId: string): Promise<Message[]> =>
    request<Message[]>(`/messages/item/${itemId}`),
  send: (data: SendMessageInput): Promise<Message> =>
    request<Message>('/messages', { method: 'POST', body: JSON.stringify(data) }),
  poll: (itemId: string, since: string): Promise<PollResponse> =>
    request<PollResponse>(`/messages/item/${itemId}/poll/${encodeURIComponent(since)}`),
  respondToOffer: (msgId: string, status: 'accepted' | 'rejected'): Promise<Message> =>
    request<Message>(`/messages/${msgId}/offer-response`, { method: 'PUT', body: JSON.stringify({ status }) }),
  markRead: (userId: string, itemId: string): Promise<void> =>
    request<void>('/messages/read', { method: 'POST', body: JSON.stringify({ userId, itemId }) }),
  getUnread: (userId: string): Promise<{ total: number; byItem: Record<string, number> }> =>
    request(`/messages/unread/${userId}`),
};

export const usersApi = {
  login: (data: LoginInput): Promise<User & { isNewUser?: boolean }> =>
    request('/users/login', { method: 'POST', body: JSON.stringify(data) }),
  register: (data: LoginInput): Promise<User> =>
    request('/users/register', { method: 'POST', body: JSON.stringify(data) }),
  getById: (id: string): Promise<User> =>
    request<User>(`/users/${id}`),
};
