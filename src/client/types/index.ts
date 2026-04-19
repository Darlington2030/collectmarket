// ─────────────────────────────────────────────
//  Domain Types
// ─────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  createdAt: string;
  lastLogin?: string;
}

export type ItemStatus = 'active' | 'pending_payment' | 'sold';

export interface Item {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  sellerId: string;
  sellerName: string;
  status: ItemStatus;
  highestOffer: number | null;
  highestOfferBuyer: string | null;
  paymentStatus?: 'paid';
  paymentConfirmedBy?: string;
  paymentConfirmedAt?: string;
  createdAt: string;
}

export type MessageType = 'text' | 'offer' | 'system';
export type OfferStatus = 'pending' | 'accepted' | 'rejected';

export interface Message {
  id: string;
  itemId: string;
  senderId: string;
  senderName: string;
  content: string;
  type: MessageType;
  price: number | null;
  originalPrice: number | null;
  status: OfferStatus | null;
  timestamp: string;
  readBy: string[];
}

export interface PollResponse {
  messages: Message[];
  lastTimestamp: string;
  hasNew: boolean;
  pollAgainAfter: number;
}

// ─────────────────────────────────────────────
//  Store / State Types
// ─────────────────────────────────────────────

export interface AppState {
  user: User | null;
  items: Item[];
  searchQuery: string;
  isLoading: boolean;
  error: string | null;
  activeItemId: string | null;
  messages: Record<string, Message[]>;
  unreadCounts: Record<string, number>;
}

export type AppAction =
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_ITEMS'; payload: Item[] }
  | { type: 'ADD_ITEM'; payload: Item }
  | { type: 'UPDATE_ITEM'; payload: Item }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'SET_SEARCH'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_ACTIVE_ITEM'; payload: string | null }
  | { type: 'SET_MESSAGES'; payload: { itemId: string; messages: Message[] } }
  | { type: 'ADD_MESSAGE'; payload: Message }
  | { type: 'UPDATE_MESSAGE'; payload: Message }
  | { type: 'SET_UNREAD'; payload: Record<string, number> };

export type Listener = () => void;

// ─────────────────────────────────────────────
//  API Request/Response Types
// ─────────────────────────────────────────────

export interface CreateItemInput {
  name: string;
  description: string;
  price: number;
  image: string;
  sellerId: string;
  sellerName: string;
}

export interface SendMessageInput {
  itemId: string;
  senderId: string;
  senderName: string;
  content: string;
  type?: MessageType;
  price?: number;
  originalPrice?: number;
}

export interface LoginInput {
  name: string;
  password: string;
}
