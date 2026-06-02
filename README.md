# CMV Studio

Sistema de controle de **CMV (Custo de Mercadoria Vendida)**, estoque e caixa para hamburgueria e pizzaria.

Módulos: Ingredientes · Estoque (contagem diária) · Fichas Técnicas · Relatório CMV · Compras · Caixa Diário · Custos Fixos.

---

## 💻 Rodar no computador (uso local)

1. Tenha o [Node.js 18+](https://nodejs.org) instalado.
2. Na primeira vez, instale as dependências (abra o terminal na pasta do projeto):
   ```
   npm install
   ```
3. Dê **dois cliques no `INICIAR.bat`** (ou rode `npm start`).
4. Acesse **http://localhost:3001**.

Nesse modo os dados ficam gravados na pasta `data/` do próprio projeto.

---

## ☁️ Publicar na Vercel (com dados que NÃO somem)

A Vercel é *serverless*: o disco é temporário, então o sistema usa um banco
**Vercel KV (Redis)** para guardar os dados. É grátis para esse volume e leva 2 minutos.

### Passo a passo

1. **Suba o projeto para o GitHub** (já está em `growthvendas00-hub/cmvcalculo`).
2. Em **vercel.com** → **Add New… → Project** → importe o repositório `cmvcalculo`.
   - Framework Preset: **Other** · Build Command: *(vazio)* · Output: *(vazio)*.
3. **Crie o banco antes (ou depois) do deploy:**
   - No projeto, aba **Storage** → **Create Database** → escolha **KV** (Upstash) → **Create**.
   - Clique em **Connect** para ligar o banco a este projeto.
   - A Vercel adiciona sozinha as variáveis `KV_REST_API_URL` e `KV_REST_API_TOKEN`.
4. **Redeploy** (aba Deployments → ⋯ → Redeploy) para o app subir já com o banco.
5. Pronto — acesse a URL da Vercel. Os dados de estoque, fichas e caixa ficam salvos.

> Se as variáveis do KV **não** estiverem presentes, o app continua funcionando,
> mas em modo temporário (os dados se perdem ao “dormir”). Por isso o passo 3 é essencial.

### Como o sistema decide onde gravar
- Achou `KV_REST_API_URL` + `KV_REST_API_TOKEN` (ou as `UPSTASH_REDIS_REST_*`) → grava no **banco**.
- Não achou → grava em **arquivos** na pasta `data/` (uso local).

Veja `.env.example` para referência das variáveis.
