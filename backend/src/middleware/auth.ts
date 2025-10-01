import { Request, Response, NextFunction } from 'express';

export const authenticateApiKey = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    const apiKey = req.headers['x-api-key'] as string;
    const validApiKey = process.env.API_KEY;

    if (!validApiKey) {
        console.error('⚠️  API_KEY não configurada no servidor');
        res.status(500).json({
            error: 'Configuração do servidor incompleta'
        });
        return;
    }

    if (!apiKey) {
        res.status(401).json({
            error: 'API Key não fornecida. Inclua o header x-api-key'
        });
        return;
    }

    if (apiKey !== validApiKey) {
        res.status(403).json({
            error: 'API Key inválida'
        });
        return;
    }

    next();
};