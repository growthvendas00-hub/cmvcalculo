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
- `storage.salvarTodosMovimentos(lista)` substitui a coleção inteira (usado pela limpeza de órfãos da auditoria).

## Módulos core (`src/core/`)
- **units.js** — `UNIDADES` (kg/g/L/ml/un → base g/ml/un), `UNIDADE_EXIBICAO`, `paraBase`, `exibicao`, `existeUnidade`, `unidadeBase`, `dimensao`. **Embalagem**: `conteudoBaseEmbalagem(emb)`, `converterParaBase(qtd, unidade, base, embalagem)` (aceita unidade `'emb'`). Use SEMPRE `converterParaBase` para converter entrada do usuário → base.
- **cmv.js** — `arredondar`, `calcularCustoBase(valor, qtd, unidadeCompra)`, `calcularCMV(ficha)`, `calcularRateioMes(mes)`, `propagarPreco(ing_id)`, `validarFicha`, `classificarCMV`, `temPreco`, `CATEGORIAS_FIXAS`, `VENDAS_TIPOS`, `totalVendasMes`.
- **estoque.js** — `aplicarMovimento({ingrediente_id,tipo,quantidade,unidade,motivo})` (tipo: entrada/saida/ajuste), `registrarContagem({itens,tipo,observacao})`, `panorama()`, `visaoIngrediente(ing)`, `estoqueAtual/estoqueMinimo`.
- **caixa.js** — `CATEGORIAS` {entrada:[],saida:[]}, `resumoMensal(mes)` (agrupa por dia, fuso SP).
- **historico.js** — `snapshot(YMD)` (reconstrói estoque ao fim do dia), `timeline(ing_id)`, `comparar(a,b)`, `hojeBR()`. Fuso fixo SP (-03:00).
- **auth.js** — senha scrypt+salt; sessão = token HMAC (segredo em settings.auth_secret) em cookie HttpOnly `cmv_sessao`. `configurado/verificarSenha/definirSenha/rotacionarSegredo/criarToken/tokenValido/autenticado(req)/cookieSessao/cookieLogout/lerCookies/isHttps`.
- **whatsapp.js** — `processarMensagem(texto, de)` → `{reply, log}`. Interpreta PT: caixa (entrou/saiu+valor), estoque (entrada/baixa/contagem com qtd+unidade), compra (comprei item qtd valor), consultas (caixa/estoque), ajuda. Acha ingrediente por nome (`escaparRegex` antes de montar RegExp — nomes com `()`/`-` não quebram). (Ainda NÃO entende "lata"/embalagem nos comandos — só kg/g/L/ml/un.)
- **auditoria.js** — `executar()` → `{resumo, problemas[]}`; `corrigir(acao)`. Varre TODO o sistema atrás de erros de LÓGICA/modelagem (não digitação). Cada problema: `{severidade:'critico'|'aviso'|'info', categoria, titulo, detalhe, alvo?, sugestao?, acao?}`. Detecta: unidade base inválida; ingrediente sem preço (crítico se usado em ficha confirmada); **embalagem incompatível/sem conteúdo** (dimensão ≠ unidade_base); **custo por unidade implausível** (>R$500/kg, >R$300/L, >R$250/un); **"un" usado em qtd alta numa ficha** (>10 → padrão "lata contada inteira"); nomes duplicados; estoque negativo; ficha com ingrediente removido; ficha no prejuízo (custo≥preço); CMV suspeito (<8% ou >60%); **CMV cache defasado** vs cálculo ao vivo; fator_correcao fora de 1–3; divergência estoque×último movimento; movimentos órfãos; mês com custos sem vendas. `corrigir(acao)` só faz operações SEGURAS: `reconfirmar_fichas` (recalcula cache defasado), `sincronizar_estoque` (loga ajuste realinhando histórico ao estoque atual), `limpar_movimentos_orfaos`.

## API (`src/api/`) — tudo sob `/api`
- **routes.js**: ingredientes (`GET`, `POST /ingredientes/pendente`, `POST /ingredientes` [compra: modo medida OU `modo:'embalagem'`], `PUT/:id` [nome, unidade_base, embalagem], `DELETE/:id`); fichas (CRUD + `/:id/confirmar`, `/rascunho`, `/cmv`); `GET /relatorio`; custos-fixos (CRUD, aceita `vendas_detalhe` por tipo); compras (`/fornecedores`, `/compras/analise`); estoque (`/estoque`, `/estoque/movimento`, `/estoque/contagem`, `/estoque/contagens`, `PUT /estoque/:id/minimo`, `/estoque/movimentos`, **histórico**: `/estoque/historico/snapshot?data=`, `/timeline?ingrediente_id=`, `/comparar?a=&b=`); caixa (`/caixa/categorias`, `GET/POST /caixa`, `DELETE /caixa/:id`); **auditoria** (`GET /auditoria`, `POST /auditoria/corrigir` body `{acao}`). Helper interno `logarZeragemEstoque(ing, antes, motivo)`: quando a unidade de uso muda, zera o estoque E grava um movimento de ajuste→0 (mantém log e estoque sincronizados).
- **auth.js** (`/api/auth`): `GET /status`, `POST /setup|login|logout|senha`. Define cookie ANTES de `res.json`.
- **webhook.js** (`/api/webhook`): `GET/POST /whatsapp` (Meta Cloud API), `POST /whatsapp/test` (simulador), `GET /whatsapp/log`. Segurança: verify token, HMAC `x-hub-signature-256` (se `WHATSAPP_APP_SECRET`), lista `WHATSAPP_ALLOWED`.

### Ordem de middleware em `server.js` (NÃO trocar)
`trust proxy` → `express.json` (captura `req.rawBody` p/ HMAC) → static → **KV hydrate/flush** (`/api`) → **gate de auth** (`/api`, libera `/auth/` e **só** `/webhook/whatsapp` exato — o simulador `/webhook/whatsapp/test` e o `/log` exigem login) → `/api/auth` → `/api` (routes) → `/api/webhook` → **404 JSON p/ `/api` desconhecido** → catch-all (`index.html`). `app.listen` só se `!process.env.VERCEL`; sempre `module.exports = app`.

## Frontend (`public/`)
- **index.html** — `#gate` (login/setup) cobre tudo até autenticar; header com `#btn-senha`/`#btn-logout`; **9 abas**: ingredientes, estoque, historico, fichas, relatorio, compras, caixa, custos, **auditoria** (`#tab-auditoria` com `#auditoria-resumo`/`#auditoria-lista`). Modais: compra, editar-ing, ficha, padrao, mes, cmv, estoque(movimento), minimo, contagem, timeline, senha, caixa.
- **app.js** — módulos: `API` (wrapper fetch; trata 401 → `Auth.exigirLogin`), `Status`, `Fmt` (moeda/custoUnit/pct/data/competencia), `UI`, `Ingredientes`, `IngPadrao`, `Fichas`, `Relatorio`, `CustosFixos`, `Compras`, `Estoque`, `Historico`, `Caixa`, `Whats`, `Auth`, **`Auditoria`** (`carregar()`, `corrigir(acao, btn)`). Boot = `Auth.iniciar()`. Espelha conversão de unidades (`UNIDADES`, `paraBase`, `conteudoBaseEmb`, `opcoesUnidadeIng`). Nav dispara `Auditoria.carregar()` ao abrir a aba.
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

## Bugs já resolvidos (NÃO reintroduzir)
- **CMV — arredondar só no fim** (`cmv.js calcularCMV`): somar `ing.custo_base*qtd*fator` com precisão e `arredondar` o total UMA vez. Arredondar cada item antes de somar zerava temperos baratos (1g de sal virava R$0,00).
- **Mudança de unidade de uso loga ajuste** (`routes.js logarZeragemEstoque`, usado no `POST /ingredientes` quando `baseMudou` e no `PUT /ingredientes/:id`): ao zerar o estoque por troca de unidade, gravar movimento `ajuste`→0. Sem isso, o estoque atual divergia do histórico e a foto por data mentia.
- **Embalagem incompatível é limpa** no `PUT` quando a unidade de uso muda e a embalagem antiga fica com dimensão ≠ base (e não veio embalagem nova). Idem no `POST` modo medida.
- **Webhook**: gate libera SÓ `/webhook/whatsapp` exato. `/test` e `/log` exigem login (antes qualquer um injetava lançamentos). `/api` desconhecido → 404 JSON (não HTML).
- **RegExp segura** em `whatsapp.acharIngrediente` (`escaparRegex`) — nomes com `()`/`-`.
- **`ficha.tipo`** validado contra `VENDAS_TIPOS` em `montarFicha` (default `hamburguer`).
- Use a **aba Auditoria** após mudanças grandes: ela detecta justamente esses padrões (e o clássico "lata contada inteira") e oferece correção automática segura.

## Pendências / próximos passos naturais
- WhatsApp entender embalagem ("comprei milho 6 latas 30").
- CMV real × teórico (vendas do cardápio × fichas × consumo do estoque → desperdício).
- Relatório/exportação mensal; metas e alertas.
- Auditoria: agendar verificação automática / badge com nº de críticos no topo.
