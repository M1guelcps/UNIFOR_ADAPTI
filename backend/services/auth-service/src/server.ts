import "dotenv/config";
import express from "express";
import cors from "cors"; // <-- Importe o cors
import { authRoutes } from "./routes/authRoutes";

const app = express();
const PORT = process.env.PORT || 3001;

// Habilita o CORS para permitir requisições do frontend
app.use(cors());
app.use(express.json());

app.use("/auth", authRoutes);

app.get("/health", (req, res) => {
  res.json({ status: "OK", service: "auth-service" });
});

app.listen(PORT, () => {
  console.log(`🚀 Auth Service rodando na porta ${PORT}`);
});