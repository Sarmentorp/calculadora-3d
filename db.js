// db.js
// Configura o banco de dados local (SQLite, um arquivo só, sem servidor externo).
// Na Etapa 2 o banco ainda não é usado pela calculadora (ela roda 100% no navegador).
// Já deixamos a tabela de usuários criada para a Etapa 3 (contas e login).

const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, 'data', 'calculadora3d.db');

// Garante que a pasta "data" existe
const fs = require('fs');
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Estrutura inicial (users é usada só a partir da Etapa 3)
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_premium INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

module.exports = db;
