# CLAUDE.md — CMV Studio

Guia de arquitetura para agentes. Leia isto ANTES de explorar; evita re-mapear o código.
Sistema de CMV/estoque/caixa para hamburgueria/pizzaria. Node + Express + HTML/CSS/JS puro (sem framework, sem build).

## Como rodar / testar
- **Porta 3001** (a 3000 é de outro projeto na máquina). Subir: `node src/server.js` (ou `INICIAR.bat`). Deploy: Vercel.
- Antes de reiniciar, **mate a porta**: PowerShell `Get-NetTCPConnection -LocalPort 3001 -State Listen | %{ Stop-Process -Id $_.OwningProcess -Force }`.
- **Não há navegador MCP conectado** nesta máquina. Valide backend por `curl` + `node --check public/js/app.js` + contagem de chaves `{`/`}` no CSS. Não dá para tirar screenshot — peça print ao usuário se precisar conferir visual.
- Depois de testar via API, **limpe os dados de teste** (reset dos `data/*.json`) — o usuário usa os mesmos arquivos.
- Avisos de `LF will be replaced by CRLF` no git são normais (Windows). Idioma de todo texto/UI: **português (pt-BR)**.

## Persistência (dois modos automáticos) — `src/core/storage.js`
- **Local**: grava arquivos em `data/*.json`. **Vercel**: grava num **Vercel KV (Redis Upstash)**, tudo numa única chave `cmv:db`.
- Decide por env: se existir `KV_REST_API_URL`+`KV_REST_API_TOKEN` (ou `UPSTASH_REDIS_REST_*`) → KV; senão → arquivos. Exposto como `storage.KV_ATIVO`.
- No modo KV, `server.js` tem middleware em `/api` que **hidrata** (`kvHydrate`) no início da request e **grava** (`kvFlush`) ao responder — ele faz isso embrulhando `res.json` (flush só ocorre se `DB_SUJO`). Por isso: **handlers que gravam devem responder com `res.json`** (não `res.send/sendStatus`), senão o flush não roda. O webhook usa `res.sendStatus` e por isso chama `storage.kvFlush()` manualmente.
- `lerJSON(caminho, padrao)` / `salvarJSON(caminho, dados)` são a API interna; tiram BOM; no modo KV operam sobre `DB[chave]` (chave = nome do arquivo sem `.json`).

### Coleções (mesma estrutura nos dois modos)
- `ingredientes` (array) · `fichas` (array) · `custos_fixos` `{meses:[]}` · `fornecedores` (array)
- `movimentos_estoque` (array) · `contagens` `{contagens:[]}` · `caixa` `{lancamentos:[]}`
- `whatsapp_log` (array, capado em 200) · `settings` `{}` (**gitignored**: senha_hash, senha_salt, auth_secret, criado_em)

## Módulos core (`src/core/`)
- **units.js** — `UNIDADES` (kg/g/L/ml/un → base g/ml/un), `UNIDADE_EXIBICAO`, `paraBase`, `exibicao`, `existeUnidade`, `unidadeBase`, `dimensao`. **Embalagem**: `conteudoBaseEmbalagem(emb)`, `converterParaBase(qtd, unidade, base, embalagem)` (aceita unidade `'emb'`). Use SEMPRE `converterParaBase` para converter entrada do usuário → base.
- **cmv.js** — `arredondar`, `calcularCustoBase(valor, qtd, unidadeCompra)`, `calcularCMV(ficha)`, `calcularRateioMes(mes)`, `propagarPreco(ing_id)`, `validarFicha`, `classificarCMV`, `temPreco`, `CATEGORIAS_FIXAS`, `VENDAS_TIPOS`, `totalVendasMes`.
- **estoque.js** — `aplicarMovimento({ingrediente_id,tipo,quantidade,unidade,motivo})` (tipo: entrada/saida/ajuste), `registrarContagem({itens,tipo,observacao})`, `panorama()`, `visaoIngrediente(ing)`, `estoqueAtual/estoqueMinimo`.
- **caixa.js** — `CATEGORIAS` {entrada:[],saida:[]}, `resumoMensal(mes)` (agrupa por dia, fuso SP).
- **historico.js** — `snapshot(YMD)` (reconstrói estoque ao fim do dia), `timeline(ing_id)`, `comparar(a,b)`, `hojeBR()`. Fuso fixo SP (-03:00).
- **auth.js** — senha scrypt+salt; sessão = token HMAC (segredo em settings.auth_secret) em cookie HttpOnly `cmv_sessao`. `configurado/verificarSenha/definirSenha/rotacionarSegredo/criarToken/tokenValido/autenticado(req)/cookieSessao/cookieLogout/lerCookies/isHttps`.
- **whatsapp.js** — `processarMensagem(texto, de)` → `{reply, log}`. Interpreta PT: caixa (entrou/saiu+valor), estoque (entrada/baixa/contagem com qtd+unidade), compra (comprei item qtd valor), consultas (caixa/estoque), ajuda. Acha ingrediente por nome. (Ainda NÃO entende "lata"/embalagem nos comandos — só kg/g/L/ml/un.)

## API (`src/api/`) — tudo sob `/api`
- **routes.js**: ingredientes (`GET`, `POST /ingredientes/pendente`, `POST /ingredientes` [compra: modo medida OU `modo:'embalagem'`], `PUT/:id` [nome, unidade_base, embalagem], `DELETE/:id`); fichas (CRUD + `/:id/confirmar`, `/rascunho`, `/cmv`); `GET /relatorio`; custos-fixos (CRUD, aceita `vendas_detalhe` por tipo); compras (`/fornecedores`, `/compras/analise`); estoque (`/estoque`, `/estoque/movimento`, `/estoque/contagem`, `/estoque/contagens`, `PUT /estoque/:id/minimo`, `/estoque/movimentos`, **histórico**: `/estoque/historico/snapshot?data=`, `/timeline?ingrediente_id=`, `/comparar?a=&b=`); caixa (`/caixa/categorias`, `GET/POST /caixa`, `DELETE /caixa/:id`).
- **auth.js** (`/api/auth`): `GET /status`, `POST /setup|login|logout|senha`. Define cookie ANTES de `res.json`.
- **webhook.js** (`/api/webhook`): `GET/POST /whatsapp` (Meta Cloud API), `POST /whatsapp/test` (simulador), `GET /whatsapp/log`. Segurança: verify token, HMAC `x-hub-signature-256` (se `WHATSAPP_APP_SECRET`), lista `WHATSAPP_ALLOWED`.

### Ordem de middleware em `server.js` (NÃO trocar)
`trust proxy` → `express.json` (captura `req.rawBody` p/ HMAC) → static → **KV hydrate/flush** (`/api`) → **gate de auth** (`/api`, libera `/auth/` e `/webhook/`) → `/api/auth` → `/api` (routes) → `/api/webhook` → catch-all (`index.html`). `app.listen` só se `!process.env.VERCEL`; sempre `module.exports = app`.

## Frontend (`public/`)
- **index.html** — `#gate` (login/setup) cobre tudo até autenticar; header com `#btn-senha`/`#btn-logout`; 8 abas: ingredientes, estoque, historico, fichas, relatorio, compras, caixa, custos. Modais: compra, editar-ing, ficha, padrao, mes, cmv, estoque(movimento), minimo, contagem, timeline, senha, caixa.
- **app.js** — módulos: `API` (wrapper fetch; trata 401 → `Auth.exigirLogin`), `Status`, `Fmt` (moeda/custoUnit/pct/data/competencia), `UI`, `Ingredientes`, `IngPadrao`, `Fichas`, `Relatorio`, `CustosFixos`, `Compras`, `Estoque`, `Historico`, `Caixa`, `Whats`, `Auth`. Boot = `Auth.iniciar()`. Espelha conversão de unidades (`UNIDADES`, `paraBase`, `conteudoBaseEmb`, `opcoesUnidadeIng`).
- **style.css** — um arquivo só, tema escuro via CSS vars (`--bg/--surface/--accent/--green/--red`…). Mobile: abas rolam, tabelas dentro de `.card` viram cartões empilhados (via `data-label` nos `<td>`), modais viram folha inferior.

## Convenções / regras de negócio (IMPORTANTES)
- **Unidade de USO** do ingrediente (`unidade_base`): g/ml/un — é o que a ficha usa. **Custo** (`custo_base`) é sempre **por unidade base**, 6 casas internas, exibido 2 casas.
- **Embalagem** (`ing.embalagem = {nome, conteudo, unidade}`): ponte "1 lata = 340 g" para quem **compra por pacote e usa por grama**. Compra modo embalagem e movimentos aceitam unidade `'emb'`. Estoque é sempre guardado em unidade base; UI mostra equivalente em embalagens.
- **Moeda** R$ pt-BR (`Fmt.moeda`). **Datas diárias** (caixa/contagem/histórico) no fuso **America/Sao_Paulo**.
- **CMV%** = custo_total / preço_venda × 100. Faixa saudável Abrasel 25–33%. Rateio de custos fixos = total_mensal / produtos_vendidos_mes (opcional por ficha via `incluir_rateio`).
- Toda compra registra **entrada automática** no estoque. Todo movimento grava em `movimentos_estoque` com `estoque_antes/estoque_depois/data` → base do histórico/time-travel.

## Deploy (resumo; detalhes no README.md)
- Vercel + **Storage → KV (Upstash for Redis)** → Connect ao projeto (injeta `KV_REST_API_*`) → Redeploy. Sem isso os dados são voláteis.
- WhatsApp: Meta Cloud API; vars `WHATSAPP_VERIFY_TOKEN/TOKEN/APP_SECRET/ALLOWED`; webhook `…/api/webhook/whatsapp`.
- `vercel.json` roteia tudo para `src/server.js` (`@vercel/node`). `.gitignore` exclui `node_modules/`, `.env`, `data/settings.json`.

## Pendências / próximos passos naturais
- WhatsApp entender embalagem ("comprei milho 6 latas 30").
- CMV real × teórico (vendas do cardápio × fichas × consumo do estoque → desperdício).
- Relatório/exportação mensal; metas e alertas.
