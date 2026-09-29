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

// Estrutura inicial (users é usada a partir da Etapa 3)
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_premium INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS printers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    nome TEXT NOT NULL,
    preco REAL NOT NULL,
    vida_util_horas REAL NOT NULL,
    potencia_w REAL NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    nome TEXT NOT NULL,
    peso REAL NOT NULL,
    horas REAL NOT NULL DEFAULT 0,
    minutos REAL NOT NULL DEFAULT 0,
    margem REAL NOT NULL DEFAULT 0,
    embalagem REAL NOT NULL DEFAULT 0,
    taxa_falha REAL NOT NULL DEFAULT 0,
    custos_extras REAL NOT NULL DEFAULT 0,
    preco_marketeiro INTEGER NOT NULL DEFAULT 0,
    marketplace TEXT NOT NULL DEFAULT 'nenhum',
    comissao_pct REAL NOT NULL DEFAULT 0,
    taxa_fixa_marketplace REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

module.exports = db;
