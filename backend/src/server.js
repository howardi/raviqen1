import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import { ObjectId } from "mongodb";
import { COLLECTIONS } from "./collections.js";
import { connectDb, getDb, redactUri, connectionUri } from "./db.js";
import { ensureDatabase } from "./setup.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = express();
const port = Number(process.env.PORT || 4000);
const allowed = new Set(COLLECTIONS);

app.use(cors());
app.use(express.json({ limit: "2mb" }));

function collectionOr404(name, res) {
  if (!allowed.has(name)) {
    res.status(404).json({ error: "Unknown collection." });
    return null;
  }
  return getDb().collection(name);
}

function idFilter(id) {
  if (ObjectId.isValid(id) && String(new ObjectId(id)) === id) return { _id: new ObjectId(id) };
  return { id };
}

app.get("/api/health", async (_req, res) => {
  try {
    const db = getDb();
    await db.command({ ping: 1 });
    res.json({ ok: true, database: db.databaseName, host: redactUri(connectionUri()) });
  } catch (error) {
    res.status(503).json({ ok: false, error: error.message });
  }
});

app.get("/api/collections", (_req, res) => {
  res.json({ collections: COLLECTIONS });
});

app.get("/api/:collection", async (req, res) => {
  const collection = collectionOr404(req.params.collection, res);
  if (!collection) return;
  const filter = {};
  if (req.query.tenant_id) filter.tenant_id = String(req.query.tenant_id);
  const limit = Math.min(Number(req.query.limit) || 100, 200);
  const rows = await collection.find(filter).sort({ created_date: -1 }).limit(limit).toArray();
  res.json(rows);
});

app.post("/api/:collection", async (req, res) => {
  const collection = collectionOr404(req.params.collection, res);
  if (!collection) return;
  const now = new Date().toISOString();
  const doc = { ...req.body, created_date: req.body?.created_date || now, updated_date: now };
  const result = await collection.insertOne(doc);
  res.status(201).json({ ...doc, _id: result.insertedId });
});

app.get("/api/:collection/:id", async (req, res) => {
  const collection = collectionOr404(req.params.collection, res);
  if (!collection) return;
  const row = await collection.findOne(idFilter(req.params.id));
  if (!row) return res.status(404).json({ error: "Not found." });
  res.json(row);
});

app.patch("/api/:collection/:id", async (req, res) => {
  const collection = collectionOr404(req.params.collection, res);
  if (!collection) return;
  const update = { ...req.body, updated_date: new Date().toISOString() };
  delete update._id;
  const result = await collection.findOneAndUpdate(idFilter(req.params.id), { $set: update }, { returnDocument: "after" });
  if (!result) return res.status(404).json({ error: "Not found." });
  res.json(result);
});

const frontendDist = path.resolve(__dirname, "../../frontend/dist");
app.use(express.static(frontendDist));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(frontendDist, "index.html"), (error) => {
    if (error) res.status(404).json({ error: "Frontend build not found. Run npm run build from the project root." });
  });
});

async function start() {
  try {
    await connectDb();
    const setup = await ensureDatabase();
    console.log(`Connected to MongoDB database "${setup.database}" (${setup.collections} collections).`);
  } catch (error) {
    console.error(error.message);
    if (error.code !== "MONGODB_HOST_MISSING") process.exitCode = 1;
  }
  app.listen(port, () => {
    console.log(`Raviqen backend listening on http://localhost:${port}`);
  });
}

start();
