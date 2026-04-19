import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  lastLogin: z.string().optional(),
  isNewUser: z.boolean().optional(),
});

export const ItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  price: z.number(),
  image: z.string(),
  sellerId: z.string(),
  sellerName: z.string(),
  status: z.enum(['active', 'pending_payment', 'sold']),
  highestOffer: z.number().nullable(),
  highestOfferBuyer: z.string().nullable(),
  paymentStatus: z.string().optional(),
  paymentConfirmedBy: z.string().optional(),
  paymentConfirmedAt: z.string().optional(),
  createdAt: z.string(),
});

export const MessageSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  senderId: z.string(),
  senderName: z.string(),
  content: z.string(),
  type: z.enum(['text', 'offer', 'system']),
  price: z.number().nullable(),
  originalPrice: z.number().nullable(),
  status: z.enum(['pending', 'accepted', 'rejected']).nullable(),
  timestamp: z.string(),
  readBy: z.array(z.string()).default([]),
});

export const CreateItemSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters').max(100),
  description: z.string().min(10, 'Description must be at least 10 characters').max(1000),
  price: z.number().positive('Price must be a positive number').max(1_000_000),
  image: z.string().url('Must be a valid image URL').or(z.literal('')),
  sellerId: z.string().min(1),
  sellerName: z.string().min(1),
});

export const LoginSchema = z.object({
  name: z.string().min(2, 'Username must be at least 2 characters').max(30),
  password: z.string().min(3, 'Password must be at least 3 characters'),
});

export const OfferSchema = z.object({
  price: z.number()
    .positive('Offer must be positive')
    .max(1_000_000, 'Offer is too high'),
});

export type UserDTO = z.infer<typeof UserSchema>;
export type ItemDTO = z.infer<typeof ItemSchema>;
export type MessageDTO = z.infer<typeof MessageSchema>;
