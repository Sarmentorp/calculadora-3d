// auth.js
// Contas e login (Etapa 3): senha com hash, sessão guardada no banco e
// identificada por um cookie httpOnly. Nada de framework de autenticação
// pesado — só o necessário, no mesmo espírito simples do resto do projeto.

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('./db');

const SESSION_COOKIE = 'precifica3d_session';
const SESSION_DIAS = 30;

// Limites do plano grátis. Quando existir plano premium de verdade, isso
// deixa de valer pra quem tiver is_premium = 1.
const LIMITES_GRATIS = {
  impressoras: 2,
  produtos: 5,
};

function limparSessoesExpiradas() {
  db.prepare(`DELETE FROM sessions WHERE expires_at < datetime('now')`).run();
}

function criarSessao(userId) {
  limparSessoesExpiradas();
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DIAS * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expiresAt);
  return { token, expiresAt };
}

function destruirSessao(token) {
  if (!token) return;
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

function usuarioDaSessao(token) {
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.id, u.email, u.is_premium
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > datetime('now')`
    )
    .get(token);
  return row || null;
}

function definirCookieSessao(res, token, expiresAt) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(expiresAt),
  });
}

function limparCookieSessao(res) {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

// Middleware: identifica o usuário se houver sessão válida, mas nunca bloqueia.
function identificarUsuario(req, res, next) {
  const token = req.cookies ? req.cookies[SESSION_COOKIE] : null;
  req.user = usuarioDaSessao(token);
  req.sessionToken = token;
  next();
}

// Middleware: bloqueia rotas que exigem login.
function exigirLogin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'nao_autenticado', message: 'Você precisa entrar na sua conta.' });
  }
  next();
}

function hashSenha(senha) {
  return bcrypt.hashSync(senha, 10);
}

function verificarSenha(senha, hash) {
  return bcrypt.compareSync(senha, hash);
}

module.exports = {
  SESSION_COOKIE,
  LIMITES_GRATIS,
  criarSessao,
  destruirSessao,
  definirCookieSessao,
  limparCookieSessao,
  identificarUsuario,
  exigirLogin,
  hashSenha,
  verificarSenha,
};
