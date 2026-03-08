import { MongoClient, Db } from "mongodb";
import bcrypt from "bcryptjs";

let cached: { client: MongoClient; db: Db } | null = null;

export async function getDb(): Promise<Db> {
  if (cached) return cached.db;

  const uri = process.env.MONGODB_URI || "mongodb+srv://Michael:Darkzone12@zecrumongoai.6dync5p.mongodb.net/?appName=ZecruMongoAI";

  const client = await MongoClient.connect(uri);
  const db = client.db("zecruai");
  cached = { client, db };

  // Create indexes on first connect
  await db.collection("users").createIndex({ email: 1 }, { unique: true });
  await db.collection("users").createIndex({ pairingCode: 1 }, { unique: true });
  await db.collection("projects").createIndex({ userId: 1 });
  await db.collection("conversations").createIndex({ userId: 1, projectId: 1 });
  await db.collection("conversations").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection("deployments").createIndex({ userId: 1, projectId: 1 });

  // Seed default admin user if not exists
  const adminEmail = "michael@zecru.ai";
  const existing = await db.collection("users").findOne({ email: adminEmail });
  if (!existing) {
    const passwordHash = await bcrypt.hash("Darkzone12", 12);
    await db.collection("users").insertOne({
      email: adminEmail,
      passwordHash,
      pairingCode: "ZECRU1",
      dangerousMode: false,
      createdAt: Date.now(),
    });
  }

  return db;
}
