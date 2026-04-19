import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getDb, hash } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// In Vercel serverless, __dirname points to the compiled function directory.
// We climb up to find views/ and public/ relative to the project root.
const rootDir = join(__dirname, process.env.VERCEL ? '../..' : '../..');

export const app = express();

app.use(cors({ origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static assets (Vite build output)
app.use('/dist', express.static(join(rootDir, 'public/dist')));

// View engine
app.set('view engine', 'ejs');
app.set('views', join(rootDir, 'views'));

// ─── Page ─────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.render('index', {
    title: 'CollectMarket — Rare Finds, Fair Deals',
    apiBase: '/api',
    components: ['auth-modal','search-bar','item-grid','list-item-modal','chat-panel','item-detail-modal','toast-notification'],
  });
});

// ─── Health ───────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ─── Users ───────────────────────────────────────────────
app.post('/api/users/login', async (req, res) => {
  try {
    const { name, password } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Username is required' });
    if (!password?.trim()) return res.status(400).json({ error: 'Password is required' });

    const db = await getDb();
    const users = db.collection('users');
    const hashed = hash(password);
    let user = await users.findOne({ name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } });

    if (!user) {
      // Auto-register on first login
      const newUser = { id: uuidv4(), name: name.trim(), password: hashed, createdAt: new Date(), lastLogin: new Date() };
      await users.insertOne(newUser);
      const { password: _, _id, ...safe } = newUser as any;
      return res.json({ ...safe, isNewUser: true });
    }

    if (user.password !== hashed) return res.status(401).json({ error: 'Incorrect password' });
    await users.updateOne({ id: user.id }, { $set: { lastLogin: new Date() } });
    const { password: _, _id, ...safe } = user as any;
    res.json({ ...safe, isNewUser: false });
  } catch (e: any) { res.status(500).json({ error: `Login failed: ${e.message}` }); }
});

app.post('/api/users/register', async (req, res) => {
  try {
    const { name, password } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Username is required' });
    if (!password || password.length < 3) return res.status(400).json({ error: 'Password must be at least 3 characters' });

    const db = await getDb();
    const users = db.collection('users');
    const existing = await users.findOne({ name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } });
    if (existing) return res.status(409).json({ error: 'Username already taken' });

    const newUser = { id: uuidv4(), name: name.trim(), password: hash(password), createdAt: new Date(), lastLogin: new Date() };
    await users.insertOne(newUser);
    const { password: _, _id, ...safe } = newUser as any;
    res.status(201).json(safe);
  } catch (e: any) { res.status(500).json({ error: `Registration failed: ${e.message}` }); }
});

app.get('/api/users', async (_req, res) => {
  try {
    const db = await getDb();
    const users = await db.collection('users').find({}).toArray();
    res.json(users.map(({ password, _id, ...u }) => u));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── Items ────────────────────────────────────────────────
app.get('/api/items', async (req, res) => {
  try {
    const db = await getDb();
    const query: any = { status: 'active' };
    const { search } = req.query as { search?: string };
    if (search?.trim()) {
      const q = { $regex: search.trim(), $options: 'i' };
      query.$or = [{ name: q }, { description: q }];
    }
    const items = await db.collection('items').find(query).sort({ createdAt: -1 }).toArray();
    res.json(items.map(({ _id, ...i }) => i));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/items/:id', async (req, res) => {
  try {
    const db = await getDb();
    const item = await db.collection('items').findOne({ id: req.params.id });
    if (!item) return res.status(404).json({ error: 'Item not found' });
    const { _id, ...safe } = item as any;
    res.json(safe);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/items', async (req, res) => {
  try {
    const { name, description, price, image, sellerId, sellerName } = req.body;
    if (!name || !price || !sellerId) return res.status(400).json({ error: 'name, price, sellerId required' });
    const db = await getDb();
    const item = { id: uuidv4(), name, description: description || '', price: parseFloat(price), image: image || 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=600', sellerId, sellerName: sellerName || 'Anonymous', status: 'active', highestOffer: null, highestOfferBuyer: null, createdAt: new Date() };
    await db.collection('items').insertOne(item);
    const { _id, ...safe } = item as any;
    res.status(201).json(safe);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.put('/api/items/:id', async (req, res) => {
  try {
    const db = await getDb();
    const { _id, ...update } = req.body;
    const result = await db.collection('items').findOneAndUpdate(
      { id: req.params.id }, { $set: update }, { returnDocument: 'after' }
    );
    if (!result) return res.status(404).json({ error: 'Item not found' });
    const { _id: rid, ...safe } = result as any;
    res.json(safe);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/items/:id', async (req, res) => {
  try {
    const db = await getDb();
    await db.collection('items').deleteOne({ id: req.params.id });
    res.status(204).send();
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/items/:id/checkout', async (req, res) => {
  try {
    const db = await getDb();
    const result = await db.collection('items').findOneAndUpdate(
      { id: req.params.id },
      { $set: { paymentStatus: 'paid', paymentConfirmedBy: req.body.buyerId, paymentConfirmedAt: new Date() } },
      { returnDocument: 'after' }
    );
    if (!result) return res.status(404).json({ error: 'Item not found' });
    const { _id, ...safe } = result as any;
    res.json({ success: true, item: safe });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/items/:id/confirm-sale', async (req, res) => {
  try {
    const db = await getDb();
    const item = await db.collection('items').findOneAndDelete({ id: req.params.id });
    if (!item) return res.status(404).json({ error: 'Item not found' });
    const { _id, ...safe } = item as any;
    res.json({ success: true, item: safe });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── Messages ─────────────────────────────────────────────
app.get('/api/messages/item/:itemId', async (req, res) => {
  try {
    const db = await getDb();
    const msgs = await db.collection('messages').find({ itemId: req.params.itemId }).sort({ timestamp: 1 }).toArray();
    res.json(msgs.map(({ _id, ...m }) => m));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/messages', async (req, res) => {
  try {
    const { itemId, senderId, senderName, content, type, price, originalPrice } = req.body;
    if (!itemId || !senderId || !content) return res.status(400).json({ error: 'itemId, senderId, content required' });
    const db = await getDb();
    const msg = { id: uuidv4(), itemId, senderId, senderName: senderName || 'Anonymous', content, type: type || 'text', price: price ? parseFloat(price) : null, originalPrice: originalPrice ? parseFloat(originalPrice) : null, status: type === 'offer' ? 'pending' : null, timestamp: new Date(), readBy: [senderId] };
    await db.collection('messages').insertOne(msg);
    const { _id, ...safe } = msg as any;
    res.status(201).json(safe);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.put('/api/messages/:id/offer-response', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['accepted','rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const db = await getDb();
    const result = await db.collection('messages').findOneAndUpdate(
      { id: req.params.id }, { $set: { status } }, { returnDocument: 'after' }
    );
    if (!result) return res.status(404).json({ error: 'Message not found' });
    const { _id, ...safe } = result as any;
    res.json(safe);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/messages/item/:itemId/poll/:timestamp', async (req, res) => {
  try {
    const since = new Date(decodeURIComponent(req.params.timestamp));
    if (isNaN(since.getTime())) return res.status(400).json({ error: 'Invalid timestamp' });
    const db = await getDb();
    const msgs = await db.collection('messages').find({ itemId: req.params.itemId, timestamp: { $gt: since } }).sort({ timestamp: 1 }).toArray();
    const safe = msgs.map(({ _id, ...m }) => m);
    res.json({ messages: safe, lastTimestamp: safe.length ? safe[safe.length-1].timestamp : req.params.timestamp, hasNew: safe.length > 0, pollAgainAfter: 2000 });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/messages/unread/:userId', async (req, res) => {
  try {
    const db = await getDb();
    const msgs = await db.collection('messages').find({ senderId: { $ne: req.params.userId }, readBy: { $not: { $elemMatch: { $eq: req.params.userId } } } }).toArray();
    const byItem: Record<string,number> = {};
    msgs.forEach(m => { byItem[m.itemId] = (byItem[m.itemId]||0)+1; });
    res.json({ total: msgs.length, byItem });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/messages/read', async (req, res) => {
  try {
    const { userId, itemId } = req.body;
    const db = await getDb();
    await db.collection('messages').updateMany(
      { itemId, senderId: { $ne: userId }, readBy: { $not: { $elemMatch: { $eq: userId } } } },
      { $push: { readBy: userId } as any }
    );
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/messages/:id', async (req, res) => {
  try {
    const db = await getDb();
    await db.collection('messages').deleteOne({ id: req.params.id });
    res.status(204).send();
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── Local dev server start ────────────────────────────────
// Only runs when executed directly, NOT when imported by Vercel
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  const PORT = parseInt(process.env.PORT || '4000');
  app.listen(PORT, () => {
    console.log(`\n✅  CollectMarket running at http://localhost:${PORT}\n`);
  });
}

export default app;
