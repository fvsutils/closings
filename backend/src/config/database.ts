import { createClient, Client } from '@libsql/client';

let tursoClient: Client | null = null;

export const getTursoClient = (): Client => {
  if (!tursoClient) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (!url || !authToken) {
      throw new Error('TURSO_DATABASE_URL e TURSO_AUTH_TOKEN são obrigatórios');
    }

    tursoClient = createClient({
      url,
      authToken,
    });

    console.log('✅ Conexão com Turso estabelecida');
  }

  return tursoClient;
};