import { MongoClient } from "mongodb";
import dns from "dns";

dns.setDefaultResultOrder("ipv4first");

function required(name) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : "";
}

export function databaseName() {
  return required("MONGODB_DB") || "raviqen";
}

export function connectionUri() {
  const explicit = required("MONGODB_URI");
  if (explicit) return explicit;

  const host = required("MONGODB_HOST");
  const user = required("MONGODB_USER");
  const password = required("MONGODB_PASSWORD");
  if (!host) {
    const error = new Error(
      "MONGODB_HOST or MONGODB_URI is not set. ai.mongodb.com is the Voyage AI endpoint, not the database cluster. In Atlas open Database, choose Connect, and copy the cluster host into backend/.env."
    );
    error.code = "MONGODB_HOST_MISSING";
    throw error;
  }
  if (!user || !password) {
    const error = new Error("MONGODB_USER and MONGODB_PASSWORD are required when MONGODB_URI is not set.");
    error.code = "MONGODB_CREDENTIALS_MISSING";
    throw error;
  }
  const db = databaseName();
  return `mongodb+srv://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}/${db}?retryWrites=true&w=majority`;
}

export function redactUri(uri) {
  return String(uri || "").replace(/\/\/([^:@/]+):([^@/]+)@/, "//$1:***@");
}

let client;
let db;

export async function connectDb() {
  if (db) return db;
  const uri = connectionUri();
  client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 15000,
    family: 4,
    autoSelectFamily: false,
  });
  await client.connect();
  db = client.db(databaseName());
  await db.command({ ping: 1 });
  return db;
}

export function getDb() {
  if (!db) throw new Error("Database is not connected.");
  return db;
}

export async function closeDb() {
  if (client) await client.close();
  client = undefined;
  db = undefined;
}
