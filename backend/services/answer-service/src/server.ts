import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import morgan from "morgan";
import { answerRoutes } from "./routes/answerRoutes.js";

const app = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// Middleware de Log customizado
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[ANSWER SERVICE] 📩 ${req.method} ${req.originalUrl}`);
  next();
});

app.use("/answers", answerRoutes);


app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "OK", service: "answer-service" });
});

app.listen(PORT, () => {
  console.log(`🎯 Answer Service rodando na porta ${PORT}`);
});


