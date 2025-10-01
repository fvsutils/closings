import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import closingsRouter from './routes/closings.js';
import { getTursoClient } from './config/database.js';
import { authenticateApiKey } from './middleware/auth.js';

// Carregar variáveis de ambiente
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Log de requisições (desenvolvimento)
if (process.env.NODE_ENV !== 'production') {
  app.use((req: Request, res: Response, next: NextFunction) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// Health check
app.get('/', (req: Request, res: Response) => {
  res.json({ 
    message: 'Closings API',
    version: '1.0.0',
    status: 'ok'
  });
});

app.get('/health', async (req: Request, res: Response) => {
  try {
    const turso = getTursoClient();
    await turso.execute('SELECT 1');
    
    res.json({ 
      status: 'ok',
      database: 'connected'
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error',
      database: 'disconnected'
    });
  }
});

// Rotas
app.use('/api', authenticateApiKey);

app.use('/api/closings', closingsRouter);

// Rota para listar todos os códigos de ativos
app.get('/api/stocks', async (req: Request, res: Response) => {
  try {
    const turso = getTursoClient();
    const result = await turso.execute(
      'SELECT DISTINCT code FROM closings ORDER BY code'
    );
    
    res.json({
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Erro ao buscar códigos:', error);
    res.status(500).json({ 
      error: 'Erro ao buscar dados' 
    });
  }
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ 
    error: 'Rota não encontrada' 
  });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Erro não tratado:', err);
  res.status(500).json({ 
    error: 'Erro interno do servidor' 
  });
});

// Inicializar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log(`📊 Ambiente: ${process.env.NODE_ENV || 'development'}`);
});