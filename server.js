// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");

const app = express();

// ──────────────────────────────────────────────────────────────
// CORS — incluye OPTIONS (preflight) y tu header x-api-key
// ──────────────────────────────────────────────────────────────
const allowedOrigins = [
  "http://localhost:3000",
  "https://capacitacionsn.cruzrojamexicana.org.mx",
  "https://capacitacion.cruzrojamexicana.org.mx",
];

const corsOptions = {
  origin(origin, callback) {
    // En Postman/healthchecks puede no venir origin
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    console.log("❌ CORS bloqueó esta petición desde:", origin);
    return callback(new Error("No permitido por CORS"));
  },
  methods: ["GET", "OPTIONS"],
  allowedHeaders: ["Content-Type", "x-api-key"],
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // Responder preflight para todo

app.use(express.json());

// ──────────────────────────────────────────────────────────────
// Auth por API Key (x-api-key)
// ──────────────────────────────────────────────────────────────
const API_KEY = process.env.API_KEY || "supersecreto";
const authMiddleware = (req, res, next) => {
  const apiKey = req.header("x-api-key");
  if (!apiKey || apiKey !== API_KEY) {
    return res.status(403).json({ error: "Acceso no autorizado" });
  }
  next();
};

// ──────────────────────────────────────────────────────────────
// MySQL: Pool robusto con keep-alive + reintento
// Vars: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT
// ──────────────────────────────────────────────────────────────
let pool;

function createPool() {
  const p = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "",
    port: Number(process.env.DB_PORT || 3306),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  });

  p.on("connection", (conn) => {
    // Alargar timeouts de sesión (ajústalo si tu proveedor corta antes)
    conn.query("SET SESSION wait_timeout = 28800");       // 8 h
    conn.query("SET SESSION interactive_timeout = 28800");
  });

  p.on("error", (err) => {
    console.error("❌ Pool error:", err.code, err.message);
  });

  return p;
}

pool = createPool();

// Ping periódico para evitar que el proveedor cierre por inactividad
setInterval(() => {
  pool.query("SELECT 1", (err) => {
    if (err) console.warn("⚠️ Keep-alive ping error:", err.code || err.message);
  });
}, 240000);

// Helper de consulta con reintento si el socket está cerrado
async function dbQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    pool.query(sql, params, (err, rows) => {
      if (!err) return resolve(rows);

      const msg = String(err?.message || "");
      const code = err?.code;
      const isClosed =
        msg.includes("closed state") ||
        code === "PROTOCOL_CONNECTION_LOST" ||
        code === "ECONNRESET" ||
        code === "ECONNREFUSED";

      if (isClosed) {
        console.warn("🔁 Conexión cerrada: recreando pool y reintentando 1 vez…");
        try { pool.end?.(() => {}); } catch (_) {}
        pool = createPool();
        return pool.query(sql, params, (err2, rows2) => {
          if (err2) return reject(err2);
          resolve(rows2);
        });
      }

      reject(err);
    });
  });
}

// Probar conexión al arrancar
dbQuery("SELECT 1 AS ok")
  .then(() => console.log("✅ Conectado a MySQL (pool activo)"))
  .catch((err) => console.error("❌ Error conectando a MySQL:", err.code, err.message));

// ──────────────────────────────────────────────────────────────
/** Healthchecks */
// ──────────────────────────────────────────────────────────────
app.get("/healthz", (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

app.get("/__debug/db-ping", authMiddleware, async (_req, res) => {
  try {
    const rows = await dbQuery("SELECT 1 AS ok");
    res.json({ ok: true, rows });
  } catch (err) {
    res.status(500).json({ error: "DB_CONN_ERROR", code: err.code, message: err.message });
  }
});

// ──────────────────────────────────────────────────────────────
// Rutas de certificados (GET)
// Nota: el front filtra por CURP/folio; si quieres filtro server-side, lo añadimos.
// ──────────────────────────────────────────────────────────────
app.get("/certificadosAPS", authMiddleware, async (_req, res) => {
  try {
    const rows = await dbQuery("SELECT * FROM `certificadosAPS`");
    res.json(rows);
  } catch (err) {
    console.error("❌ Error APS:", err.code, err.message);
    res.status(500).json({ error: "Error en la consulta", code: err.code, message: err.message });
  }
});

app.get("/certificadosFONE", authMiddleware, async (_req, res) => {
  try {
    const rows = await dbQuery("SELECT * FROM `certificadosFONE`");
    res.json(rows);
  } catch (err) {
    console.error("❌ Error FONE:", err.code, err.message);
    res.status(500).json({ error: "Error en la consulta", code: err.code, message: err.message });
  }
});

app.get("/certificadosCECAP", authMiddleware, async (_req, res) => {
  try {
    const rows = await dbQuery("SELECT * FROM `certificadosCECAP`");
    res.json(rows);
  } catch (err) {
    console.error("❌ Error CECAP:", err.code, err.message);
    res.status(500).json({ error: "Error en la consulta", code: err.code, message: err.message });
  }
});

// ──────────────────────────────────────────────────────────────
// Arranque de servidor
// ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});

// Cierre limpio
process.on("SIGTERM", () => {
  console.log("🧹 Cerrando pool MySQL…");
  pool.end(() => process.exit(0));
});
process.on("SIGINT", () => {
  console.log("🧹 Cerrando pool MySQL…");
  pool.end(() => process.exit(0));
});
