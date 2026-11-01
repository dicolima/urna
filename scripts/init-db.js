import { readFile } from 'node:fs/promises';
import { pool } from '../db/connection.js';

let client;
try {
  const sql = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
  client = await pool.connect();
  await client.query('BEGIN');
  // Serializa inicializações simultâneas em múltiplas instâncias.
  await client.query('SELECT pg_advisory_xact_lock(714209315)');
  await client.query(sql);
  await client.query('COMMIT');
  console.log('Tabelas e procedure inicializadas. Os votos existentes foram preservados.');
} catch (error) {
  if (client) await client.query('ROLLBACK').catch(() => {});
  console.error('Não foi possível inicializar o banco. Verifique DATABASE_URL, acesso e permissões. Código:', error.code || 'indisponível');
  process.exitCode = 1;
} finally {
  client?.release();
  await pool.end();
}
