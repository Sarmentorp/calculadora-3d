// server.js
// Servidor simples (Express) que serve a página da calculadora e uma rota de saúde.
// Nada de contas/login ainda — isso entra na Etapa 3.

const express = require('express');
require('./db'); // garante que o banco de dados é criado/aberto ao subir o servidor

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, etapa: 2 });
});

app.listen(PORT, () => {
  console.log(`Calculadora 3D rodando em http://localhost:${PORT}`);
});
