import pg from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('Defina DATABASE_URL no .env ou nas variáveis de ambiente do serviço.');
}

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
});

pool.on('error', error => {
  // Nunca registrar a string de conexão ou as credenciais.
  console.error('Falha em conexão ociosa do PostgreSQL:', error.code || 'erro de conexão');
});
