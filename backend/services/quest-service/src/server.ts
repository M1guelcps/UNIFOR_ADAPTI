import "dotenv/config";
import express from "express";
import cors from "cors";
import { questRoutes } from "./routes/questRoutes.js";

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

app.use("/quests", questRoutes);

app.get("/health", (req, res) => {
  res.json({ status: "OK", service: "quest-service" });
});

app.listen(PORT, () => {
  console.log(`📚 Quest Service rodando na porta ${PORT}`);
});

