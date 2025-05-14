import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import morgan from "morgan";
import apiRoutes from "./routes/index";
import { initializeAppIfNeeded } from "./config/firebaseAdmin"; // Corrigido para initializeAppIfNeeded
import { AppError } from "./utils/errors"; 
import { authenticateOptional } from "./middleware/authMiddleware"; 

// Inicializa o Firebase Admin SDK
initializeAppIfNeeded(); // Corrigido para initializeAppIfNeeded

const app: Express = express();

// Middlewares
app.use(cors()); 
app.use(morgan("dev")); 
app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); 

app.use(authenticateOptional);

// Rotas da API
app.use("/api/v1", apiRoutes); 

// Rota de Health Check básica
app.get("/health", (req: Request, res: Response) => {
    res.status(200).json({ status: "UP", timestamp: new Date().toISOString() });
});

// Tratamento de rotas não encontradas (404)
app.use((req: Request, res: Response, next: NextFunction) => {
    const error = new AppError("Rota não encontrada", 404); 
    next(error);
});

// Middleware de tratamento de erros global
app.use((err: AppError, req: Request, res: Response, next: NextFunction) => { 
    console.error("[Global Error Handler]:", err);
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        error: {
            message: err.message || "Ocorreu um erro inesperado no servidor.",
            code: err.errorCode || "INTERNAL_SERVER_ERROR", 
            statusCode: statusCode,
            details: err.details || null,
        },
    });
});

export default app;

