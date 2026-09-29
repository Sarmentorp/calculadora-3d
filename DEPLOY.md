# Como colocar o Precifica3D no ar

Guia passo a passo pra publicar o site de verdade, com endereço próprio na internet.
Vamos usar **GitHub** (guarda o código) + **Render** (hospeda e publica o site).
As contas e a compra do domínio você faz — eu só te guio em cada passo.

---

## Passo 1 — Subir o projeto pro GitHub

No terminal (PowerShell), dentro da pasta do projeto (`Documents\calculadora-3d`):

```powershell
git init
git add .
git commit -m "Etapa 1 e 2: calculadora funcionando"
git branch -M main
```

Agora, no navegador:

1. Entre em [github.com/new](https://github.com/new)
2. Nome do repositório: `calculadora-3d` (pode deixar **Private**)
3. **Não** marque "Add a README" (já temos um) — deixe tudo desmarcado
4. Clique em **Create repository**

O GitHub vai te mostrar um endereço parecido com:
`https://github.com/SEU-USUARIO/calculadora-3d.git`

Volta no terminal e roda (trocando `SEU-USUARIO` pelo seu usuário real):

```powershell
git remote add origin https://github.com/SEU-USUARIO/calculadora-3d.git
git push -u origin main
```

Se pedir login, use seu usuário e senha/token do GitHub (o próprio GitHub te guia se for a primeira vez — ele pode pedir pra autenticar pelo navegador).

✅ Depois disso, atualizar o site fica fácil: sempre que eu mandar arquivos novos,
é só `git add .`, `git commit -m "..."` e `git push` de novo.

---

## Passo 2 — Criar o Web Service no Render

1. Entre em [render.com](https://render.com) e crie sua conta (dá pra entrar direto com o GitHub, fica mais rápido)
2. Clique em **New +** → **Blueprint**
3. Escolha o repositório `calculadora-3d` que você acabou de criar
4. O Render vai ler o arquivo `render.yaml` que já deixei no projeto e preencher tudo sozinho:
   - Nome: `precifica3d`
   - Plano: **Free**
   - Build command: `npm install`
   - Start command: `npm start`
5. Clique em **Apply** / **Create Web Service**

Espera uns 2-3 minutos pro primeiro deploy terminar. Quando acabar, o Render te dá um
endereço tipo `https://precifica3d.onrender.com` — abre e testa a calculadora.

**Importante sobre o plano grátis:** se o site ficar 15 minutos sem visitas, ele
"dorme" e demora uns segundos pra acordar na próxima visita. Isso é normal e não
tem custo. Quando a gente chegar na Etapa 3 (contas de usuário), vamos precisar
garantir que os dados não se percam nesse processo — aí decidimos juntos se vale
a pena um plano pago (bem barato) ou usar um banco de dados hospedado à parte.

---

## Passo 3 — Domínio próprio (ex: precifica3d.com.br)

1. Compre o domínio em um registrador — pro `.com.br`, o oficial é o
   [registro.br](https://registro.br) (em torno de R$ 40/ano)
2. No painel do Render, vá em **Settings** → **Custom Domains** → **Add Custom Domain**
   e digite seu domínio (ex: `precifica3d.com.br` e/ou `www.precifica3d.com.br`)
3. O Render vai te mostrar exatamente quais registros de DNS adicionar
   (geralmente um `CNAME` para o `www` e um registro `A` para o domínio raiz)
4. Entra no painel do seu registrador (registro.br ou onde comprou) e adiciona
   esses registros na aba de DNS
5. Pode levar de alguns minutos até 48h pra propagar. O Render emite o certificado
   de segurança (HTTPS) automaticamente assim que reconhece o domínio

Qualquer uma dessas telas que aparecer diferente do esperado, me manda um print que
eu te ajudo a continuar.
