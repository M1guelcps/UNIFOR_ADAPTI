import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import morgan from "morgan";
import { userRoutes } from "./routes/userRoutes.js";

const app = express();
const PORT = process.env.PORT || 3004;

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[USER SERVICE] 📩 ${req.method} ${req.originalUrl}`);
  next();
});

app.use("/users", userRoutes);

app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "OK", service: "user-service" });
});

app.listen(PORT, () => {
  console.log(`👤 User Service rodando na porta ${PORT}`);
});