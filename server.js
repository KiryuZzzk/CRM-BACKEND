require("dotenv").config();
const express = require("express");
const mysql = require('mysql2');
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json()); // Para recibir JSON en las peticiones

const allowedOrigins = [
    "http://localhost:3000", // Desarrollo local
    "https://capacitacionsn.cruzrojamexicana.org.mx", // Producción
    "https://capacitacion.cruzrojamexicana.org.mx", // Producción
];

app.use(cors({
    origin: function (origin, callback) {
        // Si no hay origin (como en Postman) o está permitido, deja pasar
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.log("❌ CORS bloqueó esta petición desde:", origin);
            callback(new Error("No permitido por CORS"));
        }
    },
    methods: ["GET"],
    allowedHeaders: ["Content-Type", "x-api-key"],
}));


app.use(express.json()); // Permitir JSON en las peticiones

// Configuración de la conexión a MySQL
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
});

// Conectar a MySQL
db.connect((err) => {
  if (err) {
    console.error("❌ Error conectando a MySQL:", err);
    return;
  }
  console.log("✅ Conectado a MySQL");
});

const API_KEY = process.env.API_KEY || "supersecreto";

const authMiddleware = (req, res, next) => {
  const apiKey = req.headers["x-api-key"];
  if (apiKey !== API_KEY) {
    return res.status(403).json({ error: "Acceso no autorizado" });
  }
  next();
};




// Ruta para obtener certificadosFONE (Protegida con API Key)
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

// Ruta para obtener certificadosCECAP (Protegida con API Key)
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



// Iniciar servidor
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
});
