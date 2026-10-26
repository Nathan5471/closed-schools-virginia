import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pkg from "pg";
import * as dotenv from "dotenv";
import * as schema from "./db/schema";

dotenv.config();

const { Pool } = pkg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const db = drizzle({
  client: pool,
  relations: schema.relations,
});

async function main() {
  await migrate(db, { migrationsFolder: "drizzle" });
}

main().catch((err) => {
  console.error("Migration failed!", err);
  process.exit(1);
});
