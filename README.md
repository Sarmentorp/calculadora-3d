# Precifica3D

Calculadora de custo e preço para impressão 3D — projeto pessoal, inspirado no
[quantocusta3d.com.br](https://quantocusta3d.com.br), construído do zero.

## Status

Etapa 3 concluída e a parte de Impressoras da Etapa 4 também: agora dá pra
criar conta, entrar, e salvar sua impressora pra calculadora usar sozinha.

- [x] Etapa 1 — Estrutura do projeto (Node + Express + SQLite)
- [x] Etapa 2 — Calculadora de custo/preço (sem login)
- [x] Etapa 3 — Contas e login (grátis vs. premium)
- [ ] Etapa 4 — Produtos salvos (Impressoras já está pronta ✅)
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

## Contas e impressoras salvas

Clique em "Entrar" (canto superior direito) pra criar uma conta grátis ou
entrar numa existente. Com a conta, a aba **Impressoras** deixa de ficar
travada: você cadastra suas impressoras (nome, preço, vida útil, potência) e
marca uma como "em uso" — ela passa a alimentar a calculadora automaticamente
(as Configurações mostram essa impressora e o cálculo já usa o custo por hora
dela). No plano grátis dá pra salvar 2 impressoras; o plano premium (ainda não
existe forma de assinar) vai liberar impressoras ilimitadas.

## Estrutura do projeto

```
calculadora-3d/
├── server.js          # servidor Express (página + API de contas/impressoras)
├── auth.js            # senha com hash, sessão por cookie, limites do plano grátis
├── db.js              # configuração do banco SQLite local (users, sessions, printers)
├── public/
│   ├── index.html     # a página da calculadora
│   ├── styles.css     # visual (tema escuro, identidade Precifica3D)
│   ├── calculator.js  # toda a lógica de cálculo, roda no navegador
│   └── app.js         # login/cadastro, aba Impressoras, liga a conta à calculadora
└── data/               # banco de dados local (criado automaticamente, não vai pro Git)
```

## Próximos passos

Falta a aba **Produtos** (peças salvas com preço pronto) pra fechar a Etapa 4,
e depois a Etapa 5 (Encomendas, em estilo kanban).
