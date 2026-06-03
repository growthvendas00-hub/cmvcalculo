# CMV Studio

Sistema de controle de **CMV (Custo de Mercadoria Vendida)**, estoque e caixa para hamburgueria e pizzaria.

Módulos: Ingredientes · Estoque (contagem diária) · Histórico · Fichas Técnicas · Relatório CMV · Compras · Caixa Diário · Custos Fixos. Com **login**, **integração WhatsApp** e **histórico de estoque com comparação entre períodos**.

## 🔐 Login

No primeiro acesso o sistema pede para **criar uma senha** (a senha da hamburgueria). Depois é só logar. A sessão dura 30 dias por dispositivo. Para trocar a senha, use o botão 🔑 no topo.

## 📦 Compra por embalagem (lata, caixa, pacote)

Itens que você **compra por embalagem mas usa por grama/ml** (lata de milho, caixa com várias unidades, ovo/melão usado em pedaços) agora têm a ponte certa: ao registrar a compra, escolha **"Por embalagem"** e informe o **conteúdo de cada uma** (ex.: 1 lata = 340 g). O custo passa a ser por grama, então a ficha técnica calcula certinho (30 g de milho ≠ 1 lata inteira). No estoque você ainda conta por lata.

## 🕓 Histórico de estoque

A aba **Histórico** mostra **como estava o estoque em qualquer data**, a **linha do tempo de cada item** (clique no item) e o **comparativo entre dois períodos** (dia, semana, mês) — quanto o estoque cresceu/caiu e o que mais se movimentou.

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

---

## 📲 Lançar pelo WhatsApp

Você manda uma mensagem e o sistema registra sozinho no caixa/estoque e responde
confirmando. Funciona pela **WhatsApp Cloud API (Meta)** — oficial e grátis.

### Comandos
| Você manda | O que acontece |
|---|---|
| `entrou 1850 vendas` | Entrada no caixa de R$ 1.850 (Vendas) |
| `saiu 600 fornecedor` | Saída no caixa de R$ 600 (Insumos) |
| `comprei carne 5kg 120` | Registra preço + entrada de 5 kg no estoque |
| `entrou carne 5kg` | Entrada de 5 kg no estoque (chegou mercadoria) |
| `baixa carne 2kg quebra` | Baixa de 2 kg (perda) |
| `contei carne 5kg` | Contagem: ajusta o estoque para 5 kg |
| `caixa` | Responde o resultado do dia |
| `estoque` | Responde valor parado + o que comprar |
| `ajuda` | Lista os comandos |

> O item precisa estar cadastrado em **Ingredientes** (com preço) para os comandos de estoque.
> Você pode testar tudo sem a Meta no **simulador** dentro da aba **Caixa Diário**.

### Configurar na Meta (uma vez)
1. Crie um app em **developers.facebook.com** → produto **WhatsApp**.
2. Pegue o **Token de acesso** e o **Phone Number ID** (a Meta dá um número de teste grátis).
3. Em **Configuration → Webhook**, aponte para:
   `https://SEU-PROJETO.vercel.app/api/webhook/whatsapp`
   e use o **Verify Token** igual ao `WHATSAPP_VERIFY_TOKEN`.
4. Assine o campo **messages**.
5. Na Vercel, defina as variáveis (Settings → Environment Variables):
   - `WHATSAPP_VERIFY_TOKEN` (o mesmo do passo 3)
   - `WHATSAPP_TOKEN` (token de acesso da Meta)
   - `WHATSAPP_APP_SECRET` (em Configurações básicas do app — recomendado)
   - `WHATSAPP_ALLOWED` (seu número com DDI, ex.: `5511999999999`)
6. **Redeploy**. Mande "ajuda" para o número e pronto.

Sem `WHATSAPP_TOKEN` o sistema ainda entende as mensagens e registra, mas não
consegue responder no WhatsApp (útil só para teste).
