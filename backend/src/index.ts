import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import closingsRouter from './routes/closings.js';
import { getTursoClient } from './config/database.js';
import { authenticateApiKey } from './middleware/auth.js';

dotenv.config();

console.log('🔧 Inicializando aplicação...');
console.log('📦 NODE_ENV:', process.env.NODE_ENV);
console.log('🚪 PORT do ambiente:', process.env.PORT);

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json());

// Log de requisições
if (process.env.NODE_ENV !== 'production') {
  app.use((req: Request, res: Response, next: NextFunction) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// Rotas públicas
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

// Aplicar autenticação em todas as rotas /api
app.use('/api', authenticateApiKey);

// Rotas protegidas
app.use('/api/closings', closingsRouter);

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

// Inicializar servidor - IMPORTANTE: bind em 0.0.0.0
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor rodando em http://0.0.0.0:${PORT}`);
  console.log(`📊 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔐 Autenticação: ${process.env.API_KEY ? 'Ativada' : '⚠️  NÃO CONFIGURADA'}`);
});

server.on('error', (error: any) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Porta ${PORT} já está em uso`);
  } else {
    console.error('❌ Erro ao iniciar servidor:', error);
  }
  process.exit(1);
});