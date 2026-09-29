# Precifica3D

Calculadora de custo e preço para impressão 3D — projeto pessoal, inspirado no
[quantocusta3d.com.br](https://quantocusta3d.com.br), construído do zero.

## Status

Etapa 2 de 5 concluída: a calculadora já funciona sozinha, sem precisar de conta.

- [x] Etapa 1 — Estrutura do projeto (Node + Express + SQLite)
- [x] Etapa 2 — Calculadora de custo/preço (sem login)
- [ ] Etapa 3 — Contas e login (grátis vs. premium)
- [ ] Etapa 4 — Produtos e Impressoras salvos
- [ ] Etapa 5 — Encomendas (fila / imprimindo / pronto)

## Como rodar no seu computador

Pré-requisito: ter o **Node.js** instalado (o mesmo que você já usa pro Command Center).

1. Abra um terminal (PowerShell) dentro desta pasta.
2. Instale as dependências (só precisa fazer isso uma vez, ou quando eu avisar que mudou algo):
   ```
   npm install
   ```
3. Suba o servidor:
   ```
   npm start
   ```
4. Abra o navegador em: **http://localhost:3000**

Pra parar o servidor, volte no terminal e aperte `Ctrl + C`.

## Como a calculadora pensa o preço

Clique no ⚙️ (configurações) pra ajustar os valores de base. Por padrão:

- **Material**: peso (g) × preço do filamento por kg
- **Máquina**: tempo de impressão (h) × custo por hora da impressora
  (= preço da impressora ÷ vida útil em horas — ex: Bambu A1 mini
  R$ 2.200 ÷ 3.000 h = R$ 0,73/h)
- **Energia**: tempo (h) × potência (kW) × tarifa de energia
- Soma tudo isso + embalagem + custos extras = **custo base**
- Divide pela taxa de falha (ex: 10% → divide por 0,90) pra cobrir peças que falham
- Aplica sua margem de lucro (+50%, +75%, +100%, +200% ou um valor customizado)
- Se "preço marketeiro" estiver ligado, arredonda pra cima terminando em ",90"

Clique em "Ver como esse preço foi calculado" pra ver essa conta line a line.

## Estrutura do projeto

```
calculadora-3d/
├── server.js          # servidor Express (serve a página e a API)
├── db.js              # configuração do banco SQLite local (usado a partir da Etapa 3)
├── public/
│   ├── index.html     # a página da calculadora
│   ├── styles.css      # visual (tema escuro)
│   └── calculator.js  # toda a lógica de cálculo, roda no navegador
└── data/               # banco de dados local (criado automaticamente, não vai pro Git)
```

## Próximos passos

Quando você validar que a calculadora está calculando do jeito certo pra você,
seguimos pra Etapa 3 (contas de usuário com login, grátis vs. premium).
