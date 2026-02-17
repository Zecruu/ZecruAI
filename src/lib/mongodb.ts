import { MongoClient, Db } from "mongodb";

let cached: { client: MongoClient; db: Db } | null = null;

export async function getDb(): Promise<Db> {
  if (cached) return cached.db;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI environment variable is not set");
  }

  const client = await MongoClient.connect(uri);
  const db = client.db("zecruai");
  cached = { client, db };

  // Create indexes on first connect
  await db.collection("users").createIndex({ email: 1 }, { unique: true });
  await db.collection("users").createIndex({ pairingCode: 1 }, { unique: true });
  await db.collection("projects").createIndex({ userId: 1 });
  await db.collection("conversations").createIndex({ userId: 1, projectId: 1 });
  await db.collection("conversations").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  return db;
}
