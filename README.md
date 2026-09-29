# Precifica3D

Calculadora de custo e preço para impressão 3D — projeto pessoal, inspirado no
[quantocusta3d.com.br](https://quantocusta3d.com.br), construído do zero.

## Status

Etapa 5 concluída: agora dá pra acompanhar as encomendas dos clientes num
quadro, do pedido até a entrega.

- [x] Etapa 1 — Estrutura do projeto (Node + Express + SQLite)
- [x] Etapa 2 — Calculadora de custo/preço (sem login)
- [x] Etapa 3 — Contas e login (grátis vs. premium)
- [x] Etapa 4 — Produtos e Impressoras salvos
- [x] Etapa 5 — Encomendas (Fila / Imprimindo / Pronto / Entregue)

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

## Contas, impressoras e produtos salvos

Clique em "Entrar" (canto superior direito) pra criar uma conta grátis ou
entrar numa existente. Com a conta, duas abas deixam de ficar travadas:

- **Impressoras**: cadastre suas impressoras (nome, preço, vida útil,
  potência) e marque uma como "em uso" — ela passa a alimentar a calculadora
  automaticamente (as Configurações mostram essa impressora e o cálculo já
  usa o custo por hora dela). Limite do plano grátis: 2 impressoras.
- **Produtos**: na Calculadora, depois de preencher peso/tempo/margem
  (e marketplace, se for o caso), clique em "Salvar como produto" e dê um
  nome — ele guarda os valores que você digitou, não um preço congelado, então
  toda vez que você reabre um produto o preço é recalculado com o filamento e
  a impressora atuais. Na aba Produtos, clique em "Abrir na calculadora" pra
  reabrir um produto salvo (os campos e o marketplace vêm preenchidos
  sozinhos) — a calculadora mostra um aviso de "Editando o produto X", e o
  botão vira "Atualizar produto" (ou "Salvar como novo produto" se você quiser
  duplicar em vez de sobrescrever). Limite do plano grátis: 5 produtos.

### Encomendas

Na aba **Encomendas**, clique em "+ Nova encomenda" pra registrar um pedido:
nome do cliente, contato (opcional), o item (pode escolher um produto salvo —
o preço vem preenchido sozinho — ou digitar um item avulso), quantidade,
preço, data de entrega (opcional) e observações. A encomenda entra na coluna
**Fila**, e cada card tem um botão pra avançar pra próxima coluna
(**Imprimindo** → **Pronto** → **Entregue**) ou voltar uma, se precisar
corrigir. Diferente da aba Produtos, o preço da encomenda fica congelado (é
o valor já combinado com o cliente) — não muda sozinho se você ajustar o
preço do filamento depois. Limite do plano grátis: 5 encomendas ativas ao
mesmo tempo (as já marcadas como Entregue não contam).

O plano premium (ainda não existe forma de assinar) vai liberar impressoras,
produtos e encomendas ilimitados.

## Estrutura do projeto

```
calculadora-3d/
├── server.js          # servidor Express (página + API de contas/impressoras/produtos/encomendas)
├── auth.js            # senha com hash, sessão por cookie, limites do plano grátis
├── db.js              # configuração do banco SQLite local (users, sessions, printers, products, orders)
├── public/
│   ├── index.html     # a página da calculadora
│   ├── styles.css     # visual (tema escuro, identidade Precifica3D)
│   ├── calculator.js  # toda a lógica de cálculo, roda no navegador
│   └── app.js         # login/cadastro, abas Impressoras, Produtos e Encomendas, liga a conta à calculadora
└── data/               # banco de dados local (criado automaticamente, não vai pro Git)
```

## Próximos passos

Nenhum próximo passo planejado por enquanto — todas as etapas do plano
original (1 a 5) estão concluídas. Ideias em aberto: plano premium de
verdade (hoje os limites do plano grátis existem mas não há como assinar),
e um domínio próprio (.com.br) pra não depender do endereço do Render.
