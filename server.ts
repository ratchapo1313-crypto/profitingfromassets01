import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { initialDatabase } from './src/data/initialData.ts';
import { AppDatabase } from './src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProd = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

const app = express();
app.use(express.json({ limit: '10mb' }));

// Database persistence directory & file
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadDatabase(): AppDatabase {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed && Array.isArray(parsed.contracts)) {
        return parsed as AppDatabase;
      }
      return { ...initialDatabase, ...parsed };
    }
  } catch (err) {
    console.error('Error reading database file, using initial data:', err);
  }
  saveDatabase(initialDatabase);
  return initialDatabase;
}

function saveDatabase(data: AppDatabase): void {
  try {
    data.lastUpdated = new Date().toISOString();
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    broadcastUpdate(data);
  } catch (err) {
    console.error('Error saving database:', err);
  }
}

// In-memory reference
let db: AppDatabase = loadDatabase();

// SSE (Server-Sent Events) for real-time synchronization across multiple clients
interface SSEClient {
  id: number;
  res: Response;
}
let sseClients: SSEClient[] = [];
let nextClientId = 1;

function broadcastUpdate(updatedDb: AppDatabase) {
  const payload = JSON.stringify({
    type: 'DATA_UPDATE',
    data: updatedDb,
    lastUpdated: updatedDb.lastUpdated
  });
  sseClients.forEach((client) => {
    try {
      client.res.write(`data: ${payload}\n\n`);
    } catch {
      // client disconnected
    }
  });
}

// Periodic keepalive for SSE connections to keep proxies alive
setInterval(() => {
  sseClients.forEach((client) => {
    try {
      client.res.write(': keepalive\n\n');
    } catch {
      // client disconnected
    }
  });
}, 20000);

// SSE endpoint
app.get('/api/events', (req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive'
  });
  res.write('\n');

  const clientId = nextClientId++;
  const newClient: SSEClient = { id: clientId, res };
  sseClients.push(newClient);

  req.on('close', () => {
    sseClients = sseClients.filter((c) => c.id !== clientId);
  });
});

// GET full database
app.get('/api/data', (_req: Request, res: Response) => {
  res.json({ success: true, data: db });
});

// POST update stalls count
app.post('/api/markets/:type/stalls', (req: Request, res: Response) => {
  const { type } = req.params;
  const { totalStalls } = req.body;

  if (typeof totalStalls !== 'number' || totalStalls < 0) {
    res.status(400).json({ error: 'จำนวนล็อคต้องเป็นตัวเลขที่มากกว่าหรือเท่ากับ 0' });
    return;
  }

  if (type === 'night') {
    db.nightMarketConfig.totalStalls = totalStalls;
  } else if (type === 'fresh') {
    db.freshMarketConfig.totalStalls = totalStalls;
  } else {
    res.status(400).json({ error: 'ประเภทตลาดไม่ถูกต้อง' });
    return;
  }

  saveDatabase(db);
  res.json({ success: true, data: db });
});

// POST add contract
app.post('/api/contracts', (req: Request, res: Response) => {
  const contract = req.body;
  if (!contract || !contract.assetName || !contract.contractNo) {
    res.status(400).json({ error: 'กรุณากรอกข้อมูลสัญญาให้ครบถ้วน' });
    return;
  }

  const existingIdx = db.contracts.findIndex((c) => c.id === contract.id);
  if (existingIdx >= 0) {
    db.contracts[existingIdx] = contract;
  } else {
    // Generate ID if missing
    if (!contract.id) {
      contract.id = `ct-${contract.marketType}-${Date.now()}`;
    }
    // Set order
    const sameMarket = db.contracts.filter((c) => c.marketType === contract.marketType);
    contract.order = sameMarket.length + 1;
    contract.updatedAt = new Date().toISOString();
    db.contracts.push(contract);
  }

  saveDatabase(db);
  res.json({ success: true, data: db });
});

// PUT update contract
app.put('/api/contracts/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const contract = req.body;

  const idx = db.contracts.findIndex((c) => c.id === id);
  if (idx === -1) {
    res.status(404).json({ error: 'ไม่พบสัญญาเช่าที่ต้องการแก้ไข' });
    return;
  }

  contract.updatedAt = new Date().toISOString();
  db.contracts[idx] = { ...db.contracts[idx], ...contract };
  saveDatabase(db);
  res.json({ success: true, data: db });
});

// DELETE contract
app.delete('/api/contracts/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const target = db.contracts.find((c) => c.id === id);
  if (!target) {
    res.status(404).json({ error: 'ไม่พบสัญญาเช่าที่ต้องการลบ' });
    return;
  }

  const targetType = target.marketType;
  db.contracts = db.contracts.filter((c) => c.id !== id);

  // Re-index order
  let orderCounter = 1;
  db.contracts.forEach((c) => {
    if (c.marketType === targetType) {
      c.order = orderCounter++;
    }
  });

  saveDatabase(db);
  res.json({ success: true, data: db });
});

// POST add or update daily revenue
app.post('/api/revenues', (req: Request, res: Response) => {
  const revenue = req.body;
  if (!revenue || !revenue.receiptNo || !revenue.amount) {
    res.status(400).json({ error: 'กรุณากรอกข้อมูลรายรับให้ครบถ้วน' });
    return;
  }

  if (!revenue.id) {
    revenue.id = `rev-${Date.now()}`;
  }

  const idx = db.dailyRevenues.findIndex((r) => r.id === revenue.id);
  if (idx >= 0) {
    db.dailyRevenues[idx] = revenue;
  } else {
    db.dailyRevenues.unshift(revenue);
  }

  saveDatabase(db);
  res.json({ success: true, data: db });
});

// DELETE daily revenue
app.delete('/api/revenues/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  db.dailyRevenues = db.dailyRevenues.filter((r) => r.id !== id);
  saveDatabase(db);
  res.json({ success: true, data: db });
});

// POST approval update
app.post('/api/approvals', (req: Request, res: Response) => {
  const { role, action, comment, name } = req.body;

  if (role === 'Director') {
    db.memoApproval.directorStatus = action === 'verify' ? 'verified' : 'returned';
    db.memoApproval.directorComment = comment || db.memoApproval.directorComment;
    if (name) db.memoApproval.directorName = name;
    db.memoApproval.directorVerifiedAt = new Date().toISOString();
  } else if (role === 'Executive') {
    db.memoApproval.executiveStatus = action === 'approve' ? 'approved' : action === 'acknowledge' ? 'acknowledged' : 'returned';
    db.memoApproval.executiveComment = comment || db.memoApproval.executiveComment;
    if (name) db.memoApproval.executiveName = name;
    db.memoApproval.executiveApprovedAt = new Date().toISOString();
  }

  saveDatabase(db);
  res.json({ success: true, data: db });
});

// POST batch import or replace
app.post('/api/import', (req: Request, res: Response) => {
  const { target, mode, items, totalStalls } = req.body;

  if (!Array.isArray(items)) {
    res.status(400).json({ error: 'รูปแบบข้อมูลไม่ถูกต้อง' });
    return;
  }

  if (target === 'night' || target === 'fresh') {
    if (mode === 'replace') {
      db.contracts = db.contracts.filter((c) => c.marketType !== target).concat(items);
    } else {
      // append
      const startOrder = db.contracts.filter((c) => c.marketType === target).length;
      items.forEach((item: any, i: number) => {
        item.order = startOrder + i + 1;
        item.marketType = target;
        if (!item.id) item.id = `ct-${target}-${Date.now()}-${i}`;
        db.contracts.push(item);
      });
    }

    if (typeof totalStalls === 'number' && totalStalls > 0) {
      if (target === 'night') db.nightMarketConfig.totalStalls = totalStalls;
      if (target === 'fresh') db.freshMarketConfig.totalStalls = totalStalls;
    }
  } else if (target === 'revenues') {
    if (mode === 'replace') {
      db.dailyRevenues = items;
    } else {
      items.forEach((item: any, i: number) => {
        if (!item.id) item.id = `rev-${Date.now()}-${i}`;
        db.dailyRevenues.unshift(item);
      });
    }
  }

  saveDatabase(db);
  res.json({ success: true, data: db });
});

// POST reset to initial demo data
app.post('/api/reset', (_req: Request, res: Response) => {
  db = JSON.parse(JSON.stringify(initialDatabase));
  saveDatabase(db);
  res.json({ success: true, data: db });
});

// Start server with Vite middleware in dev or static files in prod
async function startServer() {
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
