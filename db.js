// db.js
// Configura o banco de dados. Antes usávamos um arquivo SQLite local — mas
// no Render (plano grátis) esse arquivo é apagado toda vez que o site
// reinicia, o que fazia as contas, impressoras, produtos e encomendas
// sumirem sozinhos. Agora usamos o mesmo "motor" (SQLite/libSQL), só que
// através da biblioteca @libsql/client, que sabe conversar tanto com um
// arquivo local (pra rodar no seu computador) quanto com um banco de dados
// de verdade guardado na nuvem, no Turso (turso.tech) — grátis e permanente.
//
// Se as variáveis de ambiente TURSO_DATABASE_URL e TURSO_AUTH_TOKEN
// estiverem configuradas (isso é feito no painel do Render, nunca aqui no
// código), usamos o banco do Turso. Caso contrário, usamos um arquivo local
// em ./data — assim continua dando pra rodar e testar no seu computador sem
// precisar de conta nenhuma.

const path = require('path');
const fs = require('fs');
const { createClient } = require('@libsql/client');

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

let url;
if (TURSO_URL) {
  url = TURSO_URL;
} else {
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  url = `file:${path.join(dataDir, 'calculadora3d.db')}`;
}

const db = createClient({
  url,
  authToken: TURSO_TOKEN,
});

// Cria as tabelas se ainda não existirem. É chamado uma vez, quando o
// servidor sobe (veja server.js).
async function initSchema() {
  await db.executeMultiple(`
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

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      cliente_nome TEXT NOT NULL,
      cliente_contato TEXT NOT NULL DEFAULT '',
      produto_id INTEGER,
      item_nome TEXT NOT NULL,
      quantidade REAL NOT NULL DEFAULT 1,
      preco REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'fila',
      data_entrega TEXT,
      observacoes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (produto_id) REFERENCES products(id) ON DELETE SET NULL
    );
  `);
}

// Atalhos pra deixar o resto do código parecido com o que já tínhamos
// (db.prepare(...).get/.all/.run), só que assíncrono. Isso evita reescrever
// toda query do zero.
async function get(sql, args = []) {
  const rs = await db.execute({ sql, args });
  return rs.rows[0] || null;
}

async function all(sql, args = []) {
  const rs = await db.execute({ sql, args });
  return rs.rows;
}

async function run(sql, args = []) {
  const rs = await db.execute({ sql, args });
  return {
    lastInsertRowid: rs.lastInsertRowid !== undefined ? Number(rs.lastInsertRowid) : undefined,
    changes: rs.rowsAffected,
  };
}

module.exports = { initSchema, get, all, run };
