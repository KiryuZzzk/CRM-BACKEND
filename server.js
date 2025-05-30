require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();
app.use(express.json()); // Para recibir JSON en las peticiones

// 🔐 Orígenes permitidos
const allowedOrigins = [
  "http://localhost:3000", // Desarrollo local
  "https://capacitacionsn.cruzrojamexicana.org.mx", // Producción real
  "https://capacitacion.cruzrojamexicana.org.mx", // Producción real
];

// 🛡️ Configuración avanzada de CORS
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log("❌ CORS bloqueó esta petición desde:", origin);
      callback(new Error("No permitido por CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "x-api-key"],
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

// ✨ Este es el hack mágico para que responda bien a los preflight
app.options("*", cors(corsOptions));

// Configuración de la conexión a MySQL
const db = mysql.createPool({
  connectionLimit: 10,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
});


// 🔐 Middleware para validar API Key
const API_KEY = process.env.API_KEY || "supersecreto";
const authMiddleware = (req, res, next) => {
  const apiKey = req.headers["x-api-key"];
  if (apiKey !== API_KEY) {
    return res.status(403).json({ error: "Acceso no autorizado" });
  }
  next();
};

// ✅ Rutas protegidas con API Key
app.get("/certificadosFONE", authMiddleware, (req, res) => {
  const sql = "SELECT * FROM certificadosFONE";
  db.query(sql, (err, results) => {
    if (err) {
      res.status(500).json({ error: "Error en la consulta" });
      return;
    }
    res.json(results);
  });
});

app.get("/certificadosCECAP", authMiddleware, (req, res) => {
  const sql = "SELECT * FROM certificadosCECAP";
  db.query(sql, (err, results) => {
    if (err) {
      console.error("❌ Error en la consulta:", err);
      res.status(500).json({ error: "Error en la consulta" });
      return;
    }
    res.json(results);
  });
});

// 🚀 Iniciar servidor
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
});
