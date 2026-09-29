import { COLLECTIONS } from "./collections.js";
import { getDb } from "./db.js";

export async function ensureDatabase() {
  const db = getDb();
  const existing = new Set((await db.listCollections().toArray()).map((item) => item.name));
  for (const name of COLLECTIONS) {
    if (!existing.has(name)) await db.createCollection(name);
    await db.collection(name).createIndex({ tenant_id: 1 });
    await db.collection(name).createIndex({ created_date: -1 });
  }
  return { database: db.databaseName, collections: COLLECTIONS.length };
}
