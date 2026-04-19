import { MongoClient, Db, Collection } from 'mongodb';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

// ─── Connection singleton (critical for serverless — reuse between invocations) ───
let client: MongoClient | null = null;
let db: Db | null = null;

export async function getDb(): Promise<Db> {
  if (db) return db;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI environment variable is not set');

  client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000,
    maxPoolSize: 10,
  });

  await client.connect();
  db = client.db('collectmarket');
  await seedIfEmpty(db);
  return db;
}

export const hash = (p: string) => createHash('sha256').update(p).digest('hex');

// ─── Seed initial data on first run ──────────────────────────────────────────
async function seedIfEmpty(db: Db) {
  const users = db.collection('users');
  const items = db.collection('items');
  const messages = db.collection('messages');

  // Only seed if collections are empty
  const userCount = await users.countDocuments();
  if (userCount === 0) {
    await users.insertMany([
      { id: 'user1', name: 'ComicCollector', password: hash('123456'), createdAt: new Date() },
      { id: 'user2', name: 'ToyTrader',      password: hash('123456'), createdAt: new Date() },
      { id: 'user3', name: 'CardMaster',     password: hash('123456'), createdAt: new Date() },
    ]);
  }

  const itemCount = await items.countDocuments();
  if (itemCount === 0) {
    const now = new Date();
    await items.insertMany([
      { id: '1', name: 'Vintage Comic Book — Spider-Man #1',       description: 'Rare collectible in mint condition, CGC graded 9.8.',     price: 500,  image: 'https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?w=600',  sellerId: 'user1', sellerName: 'ComicCollector', status: 'active', highestOffer: null, highestOfferBuyer: null, createdAt: now },
      { id: '2', name: 'Limited Edition Funko Pop — Batman',       description: 'Convention exclusive, original box, holographic sticker.', price: 150,  image: 'https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?w=600',  sellerId: 'user2', sellerName: 'ToyTrader',      status: 'active', highestOffer: 120,  highestOfferBuyer: 'user3', createdAt: now },
      { id: '3', name: 'Pokémon Card — Charizard 1st Edition',     description: 'PSA graded 9. First edition base set Charizard.',         price: 1200, image: 'https://images.unsplash.com/photo-1621274403997-37aace184f49?w=600', sellerId: 'user3', sellerName: 'CardMaster',     status: 'active', highestOffer: null, highestOfferBuyer: null, createdAt: now },
      { id: '4', name: 'Star Wars — Darth Vader 1977 Original',    description: 'Original 1977 Kenner release, sealed in packaging.',      price: 850,  image: 'https://images.unsplash.com/photo-1608889476561-6242cfdbf4f2?w=600',  sellerId: 'user1', sellerName: 'ComicCollector', status: 'active', highestOffer: null, highestOfferBuyer: null, createdAt: now },
      { id: '5', name: 'Magic: The Gathering — Black Lotus Alpha', description: 'Alpha edition, near mint, professionally authenticated.',  price: 3000, image: 'https://images.unsplash.com/photo-1616901826816-7045fc2e8a8d?w=600',  sellerId: 'user2', sellerName: 'ToyTrader',      status: 'active', highestOffer: 2700, highestOfferBuyer: 'user1', createdAt: now },
      { id: '6', name: 'Vintage LEGO Space — Galaxy Explorer 497', description: 'Complete 1979 set, all original pieces and instructions.', price: 320,  image: 'https://images.unsplash.com/photo-1581235725079-7c7783e6a2df?w=600',  sellerId: 'user3', sellerName: 'CardMaster',     status: 'active', highestOffer: null, highestOfferBuyer: null, createdAt: now },
    ]);
  }

  const msgCount = await messages.countDocuments();
  if (msgCount === 0) {
    await messages.insertMany([
      { id: 'msg1', itemId: '1', senderId: 'user2', senderName: 'ToyTrader',      content: 'Is this still available?',    type: 'text',  price: null, originalPrice: null, status: null,      timestamp: new Date(Date.now()-86400000), readBy: ['user2'] },
      { id: 'msg2', itemId: '1', senderId: 'user1', senderName: 'ComicCollector', content: 'Yes, CGC 9.8 mint condition!', type: 'text',  price: null, originalPrice: null, status: null,      timestamp: new Date(Date.now()-86000000), readBy: ['user1'] },
      { id: 'msg3', itemId: '1', senderId: 'user2', senderName: 'ToyTrader',      content: 'Offer: $450',                 type: 'offer', price: 450,  originalPrice: 500,  status: 'pending', timestamp: new Date(Date.now()-85000000), readBy: ['user2'] },
    ]);
  }
}
