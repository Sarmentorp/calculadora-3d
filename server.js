// server.js
// Servidor Express: serve a página da calculadora + API de contas (Etapa 3),
// impressoras, produtos e encomendas salvos (Etapa 4 e 5).

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

// As rotas abaixo usam o banco de dados, que agora responde de forma
// assíncrona (veja db.js). Esse "envelope" evita repetir o mesmo try/catch
// em cada rota: se algo falhar (por exemplo, uma instabilidade momentânea
// na conexão com o banco), a pessoa recebe um erro claro em vez da página
// travar sem resposta.
function asyncRoute(handler) {
  return (req, res) => {
    handler(req, res).catch((err) => {
      console.error('Erro numa rota da API:', err);
      res.status(500).json({ error: 'erro_interno', message: 'Algo deu errado no servidor. Tente de novo em instantes.' });
    });
  };
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, etapa: 5 });
});

// ============================================================
// Contas (cadastro, login, logout, sessão atual)
// ============================================================
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function paraUsuarioPublico(user) {
  return { id: user.id, email: user.email, is_premium: !!user.is_premium };
}

app.post('/api/auth/cadastro', asyncRoute(async (req, res) => {
  const email = String((req.body && req.body.email) || '').trim().toLowerCase();
  const senha = String((req.body && req.body.senha) || '');

  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: 'email_invalido', message: 'Digite um e-mail válido.' });
  }
  if (senha.length < 6) {
    return res.status(400).json({ error: 'senha_curta', message: 'A senha precisa ter pelo menos 6 caracteres.' });
  }

  const existente = await db.get('SELECT id FROM users WHERE email = ?', [email]);
  if (existente) {
    return res.status(409).json({ error: 'email_em_uso', message: 'Já existe uma conta com esse e-mail.' });
  }

  const hash = auth.hashSenha(senha);
  const info = await db.run('INSERT INTO users (email, password_hash) VALUES (?, ?)', [email, hash]);
  const user = await db.get('SELECT * FROM users WHERE id = ?', [info.lastInsertRowid]);

  const { token, expiresAt } = await auth.criarSessao(user.id);
  auth.definirCookieSessao(res, token, expiresAt);
  res.status(201).json({ user: paraUsuarioPublico(user) });
}));

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const email = String((req.body && req.body.email) || '').trim().toLowerCase();
  const senha = String((req.body && req.body.senha) || '');

  const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
  if (!user || !auth.verificarSenha(senha, user.password_hash)) {
    return res.status(401).json({ error: 'credenciais_invalidas', message: 'E-mail ou senha incorretos.' });
  }

  const { token, expiresAt } = await auth.criarSessao(user.id);
  auth.definirCookieSessao(res, token, expiresAt);
  res.json({ user: paraUsuarioPublico(user) });
}));

app.post('/api/auth/logout', asyncRoute(async (req, res) => {
  await auth.destruirSessao(req.sessionToken);
  auth.limparCookieSessao(res);
  res.json({ ok: true });
}));

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

app.get('/api/impressoras', auth.exigirLogin, asyncRoute(async (req, res) => {
  const impressoras = await db.all('SELECT * FROM printers WHERE user_id = ? ORDER BY created_at ASC', [req.user.id]);
  res.json({
    impressoras,
    limiteGratis: auth.LIMITES_GRATIS.impressoras,
    isPremium: !!req.user.is_premium,
  });
}));

app.post('/api/impressoras', auth.exigirLogin, asyncRoute(async (req, res) => {
  if (!req.user.is_premium) {
    const { n: total } = await db.get('SELECT COUNT(*) AS n FROM printers WHERE user_id = ?', [req.user.id]);
    if (total >= auth.LIMITES_GRATIS.impressoras) {
      const limite = auth.LIMITES_GRATIS.impressoras;
      const substantivo = limite === 1 ? 'impressora' : 'impressoras';
      return res.status(403).json({
        error: 'limite_gratis',
        message: `No plano grátis você pode salvar até ${limite} ${substantivo}. Em breve: plano premium com impressoras ilimitadas.`,
      });
    }
  }

  const { erro, valores } = validarImpressora(req.body);
  if (erro) return res.status(400).json({ error: 'dados_invalidos', message: erro });

  const { n: totalAtual } = await db.get('SELECT COUNT(*) AS n FROM printers WHERE user_id = ?', [req.user.id]);
  const jaTemAlguma = totalAtual > 0;
  const info = await db.run(
    `INSERT INTO printers (user_id, nome, preco, vida_util_horas, potencia_w, is_default)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [req.user.id, valores.nome, valores.preco, valores.vidaUtilHoras, valores.potenciaW, jaTemAlguma ? 0 : 1]
  );

  const impressora = await db.get('SELECT * FROM printers WHERE id = ?', [info.lastInsertRowid]);
  res.status(201).json({ impressora });
}));

app.put('/api/impressoras/:id', auth.exigirLogin, asyncRoute(async (req, res) => {
  const impressora = await db.get('SELECT * FROM printers WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!impressora) return res.status(404).json({ error: 'nao_encontrada', message: 'Impressora não encontrada.' });

  const { erro, valores } = validarImpressora(req.body);
  if (erro) return res.status(400).json({ error: 'dados_invalidos', message: erro });

  await db.run('UPDATE printers SET nome = ?, preco = ?, vida_util_horas = ?, potencia_w = ? WHERE id = ?', [
    valores.nome,
    valores.preco,
    valores.vidaUtilHoras,
    valores.potenciaW,
    impressora.id,
  ]);

  const atualizada = await db.get('SELECT * FROM printers WHERE id = ?', [impressora.id]);
  res.json({ impressora: atualizada });
}));

app.delete('/api/impressoras/:id', auth.exigirLogin, asyncRoute(async (req, res) => {
  const impressora = await db.get('SELECT * FROM printers WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!impressora) return res.status(404).json({ error: 'nao_encontrada', message: 'Impressora não encontrada.' });

  await db.run('DELETE FROM printers WHERE id = ?', [impressora.id]);

  if (impressora.is_default) {
    const proxima = await db.get(
      'SELECT id FROM printers WHERE user_id = ? ORDER BY created_at ASC LIMIT 1',
      [req.user.id]
    );
    if (proxima) {
      await db.run('UPDATE printers SET is_default = 1 WHERE id = ?', [proxima.id]);
    }
  }

  res.json({ ok: true });
}));

app.post('/api/impressoras/:id/padrao', auth.exigirLogin, asyncRoute(async (req, res) => {
  const impressora = await db.get('SELECT * FROM printers WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!impressora) return res.status(404).json({ error: 'nao_encontrada', message: 'Impressora não encontrada.' });

  await db.run('UPDATE printers SET is_default = 0 WHERE user_id = ?', [req.user.id]);
  await db.run('UPDATE printers SET is_default = 1 WHERE id = ?', [impressora.id]);

  res.json({ ok: true });
}));

// ============================================================
// Produtos salvos (Etapa 4)
// ============================================================
// Um "produto" guarda os valores que você digitou na calculadora (peso,
// tempo, margem, marketplace...) — não um preço congelado. Toda vez que
// você abre ou lista um produto, o preço é recalculado com o filamento e a
// impressora atuais, então ele nunca fica desatualizado sozinho.
function validarProduto(body) {
  const nome = String((body && body.nome) || '').trim();
  const peso = parseFloat(body && body.peso);
  const horas = parseFloat(body && body.horas) || 0;
  const minutos = parseFloat(body && body.minutos) || 0;
  const margem = parseFloat(body && body.margem);
  const embalagem = parseFloat(body && body.embalagem) || 0;
  const taxaFalha = parseFloat(body && body.taxaFalha) || 0;
  const custosExtras = parseFloat(body && body.custosExtras) || 0;
  const precoMarketeiro = !!(body && body.precoMarketeiro);
  const marketplace = String((body && body.marketplace) || 'nenhum');
  const comissaoPct = parseFloat(body && body.comissaoPct) || 0;
  const taxaFixaMarketplace = parseFloat(body && body.taxaFixaMarketplace) || 0;

  if (!nome) return { erro: 'Dê um nome pra esse produto.' };
  if (nome.length > 80) return { erro: 'O nome está longo demais.' };
  if (!(peso > 0)) return { erro: 'O peso precisa ser maior que zero.' };
  if (horas <= 0 && minutos <= 0) return { erro: 'Informe o tempo de impressão.' };
  if (!(margem >= 0)) return { erro: 'Informe a margem de lucro.' };

  return {
    valores: {
      nome, peso, horas, minutos, margem, embalagem, taxaFalha, custosExtras,
      precoMarketeiro, marketplace, comissaoPct, taxaFixaMarketplace,
    },
  };
}

app.get('/api/produtos', auth.exigirLogin, asyncRoute(async (req, res) => {
  const produtos = await db.all('SELECT * FROM products WHERE user_id = ? ORDER BY created_at ASC', [req.user.id]);
  res.json({
    produtos,
    limiteGratis: auth.LIMITES_GRATIS.produtos,
    isPremium: !!req.user.is_premium,
  });
}));

app.post('/api/produtos', auth.exigirLogin, asyncRoute(async (req, res) => {
  if (!req.user.is_premium) {
    const { n: total } = await db.get('SELECT COUNT(*) AS n FROM products WHERE user_id = ?', [req.user.id]);
    if (total >= auth.LIMITES_GRATIS.produtos) {
      const limite = auth.LIMITES_GRATIS.produtos;
      const substantivo = limite === 1 ? 'produto' : 'produtos';
      return res.status(403).json({
        error: 'limite_gratis',
        message: `No plano grátis você pode salvar até ${limite} ${substantivo}. Em breve: plano premium com produtos ilimitados.`,
      });
    }
  }

  const { erro, valores: v } = validarProduto(req.body);
  if (erro) return res.status(400).json({ error: 'dados_invalidos', message: erro });

  const info = await db.run(
    `INSERT INTO products
     (user_id, nome, peso, horas, minutos, margem, embalagem, taxa_falha, custos_extras, preco_marketeiro, marketplace, comissao_pct, taxa_fixa_marketplace)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      req.user.id, v.nome, v.peso, v.horas, v.minutos, v.margem, v.embalagem, v.taxaFalha, v.custosExtras,
      v.precoMarketeiro ? 1 : 0, v.marketplace, v.comissaoPct, v.taxaFixaMarketplace,
    ]
  );

  const produto = await db.get('SELECT * FROM products WHERE id = ?', [info.lastInsertRowid]);
  res.status(201).json({ produto });
}));

app.put('/api/produtos/:id', auth.exigirLogin, asyncRoute(async (req, res) => {
  const produto = await db.get('SELECT * FROM products WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!produto) return res.status(404).json({ error: 'nao_encontrada', message: 'Produto não encontrado.' });

  const { erro, valores: v } = validarProduto(req.body);
  if (erro) return res.status(400).json({ error: 'dados_invalidos', message: erro });

  await db.run(
    `UPDATE products SET
       nome = ?, peso = ?, horas = ?, minutos = ?, margem = ?, embalagem = ?, taxa_falha = ?, custos_extras = ?,
       preco_marketeiro = ?, marketplace = ?, comissao_pct = ?, taxa_fixa_marketplace = ?
     WHERE id = ?`,
    [
      v.nome, v.peso, v.horas, v.minutos, v.margem, v.embalagem, v.taxaFalha, v.custosExtras,
      v.precoMarketeiro ? 1 : 0, v.marketplace, v.comissaoPct, v.taxaFixaMarketplace, produto.id,
    ]
  );

  const atualizado = await db.get('SELECT * FROM products WHERE id = ?', [produto.id]);
  res.json({ produto: atualizado });
}));

app.delete('/api/produtos/:id', auth.exigirLogin, asyncRoute(async (req, res) => {
  const produto = await db.get('SELECT * FROM products WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!produto) return res.status(404).json({ error: 'nao_encontrada', message: 'Produto não encontrado.' });

  await db.run('DELETE FROM products WHERE id = ?', [produto.id]);
  res.json({ ok: true });
}));

// ============================================================
// Encomendas (Etapa 5)
// ============================================================
// Quadro em estilo kanban: cada encomenda tem um status (fila, imprimindo,
// pronto, entregue). Ela pode citar um produto salvo, mas o nome do item e
// o preço ficam congelados na encomenda — diferente da aba Produtos, aqui
// o valor já foi combinado com o cliente e não deve mudar sozinho se você
// ajustar o preço do filamento depois.
const STATUS_ENCOMENDA = ['fila', 'imprimindo', 'pronto', 'entregue'];

function validarEncomenda(body) {
  const clienteNome = String((body && body.clienteNome) || '').trim();
  const clienteContato = String((body && body.clienteContato) || '').trim();
  const itemNome = String((body && body.itemNome) || '').trim();
  const produtoIdRaw = body && body.produtoId;
  const produtoId = produtoIdRaw ? parseInt(produtoIdRaw, 10) : null;
  const quantidade = parseFloat(body && body.quantidade) || 1;
  const preco = parseFloat(body && body.preco);
  const dataEntrega = (body && body.dataEntrega) ? String(body.dataEntrega).trim() : '';
  const observacoes = (body && body.observacoes) ? String(body.observacoes).trim() : '';

  if (!clienteNome) return { erro: 'Informe o nome do cliente.' };
  if (clienteNome.length > 80) return { erro: 'O nome do cliente está longo demais.' };
  if (clienteContato.length > 80) return { erro: 'O contato está longo demais.' };
  if (!itemNome) return { erro: 'Descreva o item da encomenda.' };
  if (itemNome.length > 120) return { erro: 'A descrição do item está longa demais.' };
  if (!(quantidade > 0)) return { erro: 'A quantidade precisa ser maior que zero.' };
  if (!(preco >= 0)) return { erro: 'Informe o preço da encomenda.' };
  if (observacoes.length > 500) return { erro: 'As observações estão longas demais.' };

  return {
    valores: {
      clienteNome, clienteContato, produtoId: produtoId && produtoId > 0 ? produtoId : null,
      itemNome, quantidade, preco, dataEntrega, observacoes,
    },
  };
}

app.get('/api/encomendas', auth.exigirLogin, asyncRoute(async (req, res) => {
  const encomendas = await db.all('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at ASC', [req.user.id]);
  res.json({
    encomendas,
    limiteGratis: auth.LIMITES_GRATIS.encomendas,
    isPremium: !!req.user.is_premium,
  });
}));

app.post('/api/encomendas', auth.exigirLogin, asyncRoute(async (req, res) => {
  if (!req.user.is_premium) {
    const { n: ativas } = await db.get(
      `SELECT COUNT(*) AS n FROM orders WHERE user_id = ? AND status != 'entregue'`,
      [req.user.id]
    );
    if (ativas >= auth.LIMITES_GRATIS.encomendas) {
      const limite = auth.LIMITES_GRATIS.encomendas;
      const substantivo = limite === 1 ? 'encomenda ativa' : 'encomendas ativas';
      return res.status(403).json({
        error: 'limite_gratis',
        message: `No plano grátis você pode ter até ${limite} ${substantivo} ao mesmo tempo (as já entregues não contam). Marque uma como entregue ou exclua uma, ou espere o plano premium.`,
      });
    }
  }

  const { erro, valores: v } = validarEncomenda(req.body);
  if (erro) return res.status(400).json({ error: 'dados_invalidos', message: erro });

  if (v.produtoId) {
    const produto = await db.get('SELECT id FROM products WHERE id = ? AND user_id = ?', [v.produtoId, req.user.id]);
    if (!produto) v.produtoId = null;
  }

  const info = await db.run(
    `INSERT INTO orders
     (user_id, cliente_nome, cliente_contato, produto_id, item_nome, quantidade, preco, status, data_entrega, observacoes)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'fila', ?, ?)`,
    [
      req.user.id, v.clienteNome, v.clienteContato, v.produtoId, v.itemNome, v.quantidade, v.preco,
      v.dataEntrega, v.observacoes,
    ]
  );

  const encomenda = await db.get('SELECT * FROM orders WHERE id = ?', [info.lastInsertRowid]);
  res.status(201).json({ encomenda });
}));

app.put('/api/encomendas/:id', auth.exigirLogin, asyncRoute(async (req, res) => {
  const encomenda = await db.get('SELECT * FROM orders WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!encomenda) return res.status(404).json({ error: 'nao_encontrada', message: 'Encomenda não encontrada.' });

  const { erro, valores: v } = validarEncomenda(req.body);
  if (erro) return res.status(400).json({ error: 'dados_invalidos', message: erro });

  if (v.produtoId) {
    const produto = await db.get('SELECT id FROM products WHERE id = ? AND user_id = ?', [v.produtoId, req.user.id]);
    if (!produto) v.produtoId = null;
  }

  await db.run(
    `UPDATE orders SET
       cliente_nome = ?, cliente_contato = ?, produto_id = ?, item_nome = ?, quantidade = ?, preco = ?,
       data_entrega = ?, observacoes = ?
     WHERE id = ?`,
    [
      v.clienteNome, v.clienteContato, v.produtoId, v.itemNome, v.quantidade, v.preco,
      v.dataEntrega, v.observacoes, encomenda.id,
    ]
  );

  const atualizada = await db.get('SELECT * FROM orders WHERE id = ?', [encomenda.id]);
  res.json({ encomenda: atualizada });
}));

app.post('/api/encomendas/:id/status', auth.exigirLogin, asyncRoute(async (req, res) => {
  const encomenda = await db.get('SELECT * FROM orders WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!encomenda) return res.status(404).json({ error: 'nao_encontrada', message: 'Encomenda não encontrada.' });

  const status = String((req.body && req.body.status) || '');
  if (!STATUS_ENCOMENDA.includes(status)) {
    return res.status(400).json({ error: 'status_invalido', message: 'Status inválido.' });
  }

  await db.run('UPDATE orders SET status = ? WHERE id = ?', [status, encomenda.id]);
  const atualizada = await db.get('SELECT * FROM orders WHERE id = ?', [encomenda.id]);
  res.json({ encomenda: atualizada });
}));

app.delete('/api/encomendas/:id', auth.exigirLogin, asyncRoute(async (req, res) => {
  const encomenda = await db.get('SELECT * FROM orders WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!encomenda) return res.status(404).json({ error: 'nao_encontrada', message: 'Encomenda não encontrada.' });

  await db.run('DELETE FROM orders WHERE id = ?', [encomenda.id]);
  res.json({ ok: true });
}));

// Prepara as tabelas do banco antes de aceitar pedidos. Se isso falhar
// (por exemplo, dados de conexão do Turso errados), o servidor nem sobe —
// melhor um erro claro no log do Render do que o site no ar sem banco.
db.initSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Calculadora 3D rodando em http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Não foi possível preparar o banco de dados:', err);
    process.exit(1);
  });
