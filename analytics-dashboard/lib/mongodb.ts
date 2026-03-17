import { MongoClient, Db } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME ?? "memoai";

if (!uri) {
  throw new Error("MONGODB_URI is not set in .env.local");
}

// Singleton pattern — reuse connection across hot reloads in dev
declare global {
  // eslint-disable-next-line no-var
  var _mongoClient: MongoClient | undefined;
}

let client: MongoClient;

if (process.env.NODE_ENV === "development") {
  if (!global._mongoClient) {
    global._mongoClient = new MongoClient(uri);
  }
  client = global._mongoClient;
} else {
  client = new MongoClient(uri);
}

export async function getDb(): Promise<Db> {
  if (!client.connect) throw new Error("MongoDB client not initialised");
  await client.connect();
  return client.db(dbName);
}
