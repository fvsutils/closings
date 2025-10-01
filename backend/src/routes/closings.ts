import { Router, Request, Response } from 'express';
import { getTursoClient } from '../config/database.js';
import { Closing, StockCode, ApiResponse } from '../types/index.js';

const router = Router();

// GET /api/closings/latest - Últimos fechamentos de todos os ativos
router.get('/latest', async (req: Request, res: Response) => {
  try {
    const turso = getTursoClient();
    
    const result = await turso.execute(`
      SELECT c1.* 
      FROM closings c1
      INNER JOIN (
        SELECT code, MAX(date) as max_date
        FROM closings
        GROUP BY code
      ) c2 ON c1.code = c2.code AND c1.date = c2.max_date
      ORDER BY c1.code
    `);

    const closings = result.rows as unknown as Closing[];
    
    res.json({
      data: closings,
      count: closings.length
    });
  } catch (error) {
    console.error('Erro ao buscar últimos fechamentos:', error);
    res.status(500).json({ 
      error: 'Erro ao buscar dados' 
    });
  }
});

// GET /api/closings/:code - Histórico de um ativo específico
router.get('/:code', async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const limit = parseInt(req.query.limit as string) || 30;

    if (!code || code.trim() === '') {
      res.status(400).json({ error: 'Código do ativo é obrigatório' });
      return;
    }

    const turso = getTursoClient();
    
    const result = await turso.execute({
      sql: 'SELECT * FROM closings WHERE code = ? ORDER BY date DESC LIMIT ?',
      args: [code.toUpperCase(), limit]
    });

    const closings = result.rows as unknown as Closing[];

    if (closings.length === 0) {
      res.status(404).json({ 
        error: `Nenhum dado encontrado para ${code.toUpperCase()}` 
      });
      return;
    }

    res.json({
      data: closings,
      count: closings.length,
      code: code.toUpperCase()
    });
  } catch (error) {
    console.error('Erro ao buscar histórico:', error);
    res.status(500).json({ 
      error: 'Erro ao buscar dados' 
    });
  }
});

// GET /api/closings/:code/stats - Estatísticas de um ativo
router.get('/:code/stats', async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const turso = getTursoClient();
    
    const result = await turso.execute({
      sql: `
        SELECT 
          code,
          COUNT(*) as total_records,
          MIN(value) as min_value,
          MAX(value) as max_value,
          AVG(value) as avg_value,
          MIN(date) as first_date,
          MAX(date) as last_date
        FROM closings 
        WHERE code = ?
        GROUP BY code
      `,
      args: [code.toUpperCase()]
    });

    if (result.rows.length === 0) {
      res.status(404).json({ 
        error: `Nenhum dado encontrado para ${code.toUpperCase()}` 
      });
      return;
    }

    res.json({
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({ 
      error: 'Erro ao buscar dados' 
    });
  }
});

export default router;