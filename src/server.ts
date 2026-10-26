import "dotenv/config";
import { app } from "./app.js";
import { pool } from "./db/database.js";
const port = Number(process.env.PORT ?? 3000);
if (!process.env.DATABASE_URL)
  throw new Error("Renseignez DATABASE_URL dans .env.");
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("PORT invalide.");
await pool.query("SELECT 1 FROM trainers LIMIT 1");
const server = app.listen(port, () =>
  console.log(`API Pokémon : http://localhost:${port}`),
);
function shutdown() {
  server.close(() => {
    void pool.end().then(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
