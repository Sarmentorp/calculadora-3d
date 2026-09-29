// server.js
// Servidor Express: serve a página da calculadora + API de contas (Etapa 3)
// e impressoras salvas (parte da Etapa 4).

const express = require('express');
const cookieParser = require('cookie-parser');
const db = require('./db');
const auth = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

// O Render fica na frente do nosso servidor como proxy; isso é necessário
// pra o Express entender corretamente quando a conexão é HTTPS (cookie "secure").
app.set('trust proxy', 1);

app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));
app.use(auth.identificarUsuario);

app.get('/api/health', (req, res) => {
  res.json({ ok: true, etapa: 3 });
});

// ============================================================
// Contas (cadastro, login, logout, sessão atual)
// ============================================================
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function paraUsuarioPublico(user) {
  return { id: user.id, email: user.email, is_premium: !!user.is_premium };
}

app.post('/api/auth/cadastro', (req, res) => {
  const email = String((req.body && req.body.email) || '').trim().toLowerCase();
  const senha = String((req.body && req.body.senha) || '');

  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: 'email_invalido', message: 'Digite um e-mail válido.' });
  }
  if (senha.length < 6) {
    return res.status(400).json({ error: 'senha_curta', message: 'A senha precisa ter pelo menos 6 caracteres.' });
  }

  const existente = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existente) {
    return res.status(409).json({ error: 'email_em_uso', message: 'Já existe uma conta com esse e-mail.' });
  }

  const hash = auth.hashSenha(senha);
  const info = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(email, hash);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);

  const { token, expiresAt } = auth.criarSessao(user.id);
  auth.definirCookieSessao(res, token, expiresAt);
  res.status(201).json({ user: paraUsuarioPublico(user) });
});

app.post('/api/auth/login', (req, res) => {
  const email = String((req.body && req.body.email) || '').trim().toLowerCase();
  const senha = String((req.body && req.body.senha) || '');

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !auth.verificarSenha(senha, user.password_hash)) {
    return res.status(401).json({ error: 'credenciais_invalidas', message: 'E-mail ou senha incorretos.' });
  }

  const { token, expiresAt } = auth.criarSessao(user.id);
  auth.definirCookieSessao(res, token, expiresAt);
  res.json({ user: paraUsuarioPublico(user) });
});

app.post('/api/auth/logout', (req, res) => {
  auth.destruirSessao(req.sessionToken);
  auth.limparCookieSessao(res);
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  res.json({ user: req.user ? paraUsuarioPublico(req.user) : null });
});

// ============================================================
// Impressoras salvas (Etapa 4)
// ============================================================
function validarImpressora(body) {
  const nome = String((body && body.nome) || '').trim();
  const preco = parseFloat(body && body.preco);
  const vidaUtilHoras = parseFloat(body && body.vidaUtilHoras);
  const potenciaW = parseFloat(body && body.potenciaW);

  if (!nome) return { erro: 'Dê um nome pra essa impressora.' };
  if (nome.length > 80) return { erro: 'O nome está longo demais.' };
  if (!(preco > 0)) return { erro: 'Informe o preço da impressora.' };
  if (!(vidaUtilHoras > 0)) return { erro: 'Informe a vida útil estimada (em horas).' };
  if (!(potenciaW >= 0)) return { erro: 'Informe a potência média (em watts).' };

  return { valores: { nome, preco, vidaUtilHoras, potenciaW } };
}

app.get('/api/impressoras', auth.exigirLogin, (req, res) => {
  const impressoras = db.prepare('SELECT * FROM printers WHERE user_id = ? ORDER BY created_at ASC').all(req.user.id);
  res.json({
    impressoras,
    limiteGratis: auth.LIMITES_GRATIS.impressoras,
    isPremium: !!req.user.is_premium,
  });
});

app.post('/api/impressoras', auth.exigirLogin, (req, res) => {
  if (!req.user.is_premium) {
    const total = db.prepare('SELECT COUNT(*) AS n FROM printers WHERE user_id = ?').get(req.user.id).n;
    if (total >= auth.LIMITES_GRATIS.impressoras) {
      return res.status(403).json({
        error: 'limite_gratis',
        message: `No plano grátis você pode salvar ${auth.LIMITES_GRATIS.impressoras} impressora. Em breve: plano premium com impressoras ilimitadas.`,
      });
    }
  }

  const { erro, valores } = validarImpressora(req.body);
  if (erro) return res.status(400).json({ error: 'dados_invalidos', message: erro });

  const jaTemAlguma = db.prepare('SELECT COUNT(*) AS n FROM printers WHERE user_id = ?').get(req.user.id).n > 0;
  const info = db
    .prepare(
      `INSERT INTO printers (user_id, nome, preco, vida_util_horas, potencia_w, is_default)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(req.user.id, valores.nome, valores.preco, valores.vidaUtilHoras, valores.potenciaW, jaTemAlguma ? 0 : 1);

  const impressora = db.prepare('SELECT * FROM printers WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ impressora });
});

app.put('/api/impressoras/:id', auth.exigirLogin, (req, res) => {
  const impressora = db.prepare('SELECT * FROM printers WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!impressora) return res.status(404).json({ error: 'nao_encontrada', message: 'Impressora não encontrada.' });

  const { erro, valores } = validarImpressora(req.body);
  if (erro) return res.status(400).json({ error: 'dados_invalidos', message: erro });

  db.prepare('UPDATE printers SET nome = ?, preco = ?, vida_util_horas = ?, potencia_w = ? WHERE id = ?').run(
    valores.nome,
    valores.preco,
    valores.vidaUtilHoras,
    valores.potenciaW,
    impressora.id
  );

  const atualizada = db.prepare('SELECT * FROM printers WHERE id = ?').get(impressora.id);
  res.json({ impressora: atualizada });
});

app.delete('/api/impressoras/:id', auth.exigirLogin, (req, res) => {
  const impressora = db.prepare('SELECT * FROM printers WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!impressora) return res.status(404).json({ error: 'nao_encontrada', message: 'Impressora não encontrada.' });

  db.prepare('DELETE FROM printers WHERE id = ?').run(impressora.id);

  if (impressora.is_default) {
    const proxima = db
      .prepare('SELECT id FROM printers WHERE user_id = ? ORDER BY created_at ASC LIMIT 1')
      .get(req.user.id);
    if (proxima) {
      db.prepare('UPDATE printers SET is_default = 1 WHERE id = ?').run(proxima.id);
    }
  }

  res.json({ ok: true });
});

app.post('/api/impressoras/:id/padrao', auth.exigirLogin, (req, res) => {
  const impressora = db.prepare('SELECT * FROM printers WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!impressora) return res.status(404).json({ error: 'nao_encontrada', message: 'Impressora não encontrada.' });

  db.prepare('UPDATE printers SET is_default = 0 WHERE user_id = ?').run(req.user.id);
  db.prepare('UPDATE printers SET is_default = 1 WHERE id = ?').run(impressora.id);

  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Calculadora 3D rodando em http://localhost:${PORT}`);
});
