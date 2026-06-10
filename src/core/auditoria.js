'use strict';

// ═══════════════════════════════════════════════════════════════
// AUDITORIA TÉCNICA DO SISTEMA (uso interno — não visível aos usuários)
// ───────────────────────────────────────────────────────────────
// Varre TUDO atrás de erros de LÓGICA, MODELAGEM e INTEGRIDADE — não
// erros de digitação, mas combinações que produzem números errados ou
// corrompem o banco sem ninguém perceber.
//
// O caso que originou o módulo: comprar por LATA e usar por GRAMA. Se o
// item ficou em "un" (lata) e a ficha pede "30", o sistema entende 30
// latas. A auditoria pega esse e dezenas de outros padrões.
//
// Severidades:
//   critico → conta errada / risco de perder dados AGORA. Resolver já.
//   aviso   → provável erro de modelagem. Conferir.
//   info    → higiene / oportunidade. Opcional.
// ═══════════════════════════════════════════════════════════════

const storage = require('./storage');
const units = require('./units');
const cmv = require('./cmv');
const backup = require('./backup');

const LIMITE_CUSTO_EXIB = { g: 500, ml: 300, un: 250 }; // R$ por kg / L / un
const QTD_UN_SUSPEITA = 10;
const FATOR_MIN = 1.0;
const FATOR_MAX = 3.0;
const RE_YMD = /^\d{4}-\d{2}-\d{2}$/;
const RE_COMP = /^\d{4}-\d{2}$/;

function ex(custoBase, base) {
  const e = units.UNIDADE_EXIBICAO[base] || { unidade: base, fator: 1 };
  return { valor: custoBase * e.fator, unidade: e.unidade };
}
function moeda(v) {
  return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function hojeYMD() { return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); }
function ehNumero(v) { return typeof v === 'number' && Number.isFinite(v); }
function ymdValido(s) { return typeof s === 'string' && RE_YMD.test(s) && !Number.isNaN(new Date(s + 'T12:00:00Z').getTime()); }
function isoValido(s) { return !!s && !Number.isNaN(new Date(s).getTime()); }

function executar() {
  const ingredientes = storage.listarIngredientes();
  const fichas = storage.listarFichas();
  const movimentos = storage.listarMovimentos();
  const meses = storage.listarMeses();
  const contagens = storage.listarContagens();
  const lancamentos = storage.listarLancamentos();
  const fornecedores = storage.listarFornecedores();

  const mapIng = new Map(ingredientes.map(i => [i.id, i]));
  const problemas = [];
  const P = (severidade, categoria, titulo, detalhe, opts = {}) =>
    problemas.push({ severidade, categoria, titulo, detalhe, alvo: opts.alvo || null, sugestao: opts.sugestao || null, acao: opts.acao || null });

  // Índice ingrediente → fichas que o usam
  const usoEmFichas = new Map();
  for (const f of fichas) {
    if (!Array.isArray(f.ingredientes)) continue;
    for (const item of f.ingredientes) {
      if (!usoEmFichas.has(item.ingrediente_id)) usoEmFichas.set(item.ingrediente_id, []);
      usoEmFichas.get(item.ingrediente_id).push({ ficha: f, item });
    }
  }

  // ───────────────────────── INGREDIENTES ─────────────────────────
  const vistosNome = new Map();
  const vistosId = new Map();
  for (const ing of ingredientes) {
    const alvo = { tipo: 'ingrediente', id: ing.id, nome: ing.nome || '(sem nome)' };
    const usos = usoEmFichas.get(ing.id) || [];
    const emFichaConfirmada = usos.some(u => u.ficha.status === 'confirmado');

    if (!ing.id) {
      P('critico', 'Integridade', 'Ingrediente sem identificador', `"${ing.nome || '?'}" não tem id — pode sumir ou duplicar.`, { alvo });
    } else if (vistosId.has(ing.id)) {
      P('critico', 'Integridade', 'Dois ingredientes com o mesmo id', `id "${ing.id}" repetido. Edições podem afetar o item errado.`, { alvo });
    } else { vistosId.set(ing.id, true); }

    if (!['g', 'ml', 'un'].includes(ing.unidade_base)) {
      P('critico', 'Unidade', `"${ing.nome}" com unidade de uso inválida`, `É "${ing.unidade_base}", mas só valem g, ml ou un. Edite o ingrediente.`, { alvo });
    }

    if (!ehNumero(ing.custo_base)) {
      P('critico', 'Integridade', `Custo inválido em "${ing.nome}"`, `O custo não é um número (${JSON.stringify(ing.custo_base)}). Registre uma compra para corrigir.`, { alvo });
    } else if (!(ing.custo_base > 0)) {
      if (emFichaConfirmada) {
        P('critico', 'Preço', `"${ing.nome}" sem preço, mas usado em ficha confirmada`,
          `Em: ${usos.filter(u => u.ficha.status === 'confirmado').map(u => u.ficha.nome).join(', ')}. O CMV dessas fichas está errado.`,
          { alvo, sugestao: 'Aba Ingredientes → Registrar Preço.' });
      } else {
        P('aviso', 'Preço', `"${ing.nome}" ainda sem preço`, 'Não entra no valor do estoque nem em ficha confirmada.', { alvo, sugestao: 'Registre uma compra quando for usar.' });
      }
    }

    if (ing.estoque_atual !== undefined && !ehNumero(Number(ing.estoque_atual))) {
      P('aviso', 'Integridade', `Estoque inválido em "${ing.nome}"`, 'O estoque atual não é um número; está sendo tratado como 0.', { alvo });
    } else if (Number(ing.estoque_atual) < 0) {
      P('critico', 'Estoque', `Estoque negativo em "${ing.nome}"`, `Está em ${ing.estoque_atual} ${ing.unidade_base}. Faça uma contagem.`, { alvo });
    }

    if (ing.embalagem) {
      const emb = ing.embalagem;
      const conteudoBase = units.conteudoBaseEmbalagem(emb);
      if (!(conteudoBase > 0)) {
        P('critico', 'Embalagem', `Embalagem de "${ing.nome}" sem conteúdo válido`, `"${emb.nome || '—'}" não tem conteúdo > 0 (ex.: 1 lata = 340 g). Contar por embalagem dá zero.`, { alvo, sugestao: 'Editar ingrediente → informe o conteúdo.' });
      } else if (!units.existeUnidade(emb.unidade) || units.unidadeBase(emb.unidade) !== ing.unidade_base) {
        P('critico', 'Embalagem', `Embalagem de "${ing.nome}" em unidade incompatível`, `O item é usado em ${ing.unidade_base}, mas a embalagem está em "${emb.unidade}". As conversões ficam erradas.`, { alvo, sugestao: `O conteúdo da embalagem deve ser em ${ing.unidade_base}.` });
      }
    }

    if (ehNumero(ing.custo_base) && ing.custo_base > 0) {
      const limite = LIMITE_CUSTO_EXIB[ing.unidade_base];
      const e = ex(ing.custo_base, ing.unidade_base);
      if (limite && e.valor > limite && (ing.unidade_base !== 'un' || usos.length > 0)) {
        P('aviso', 'Custo suspeito', `Custo muito alto em "${ing.nome}": ${moeda(e.valor)}/${e.unidade}`,
          ing.unidade_base === 'un'
            ? `Cada unidade custa ${moeda(e.valor)}. Se compra um pacote/lata e usa por grama, cadastre por embalagem (1 lata = X g).`
            : `${moeda(e.valor)} por ${e.unidade} está acima do esperado. Confira valor e quantidade da última compra.`,
          { alvo, sugestao: 'Nova Compra (revise valor/qtd) ou use "Por embalagem".' });
      }
    }

    if (ing.unidade_base === 'un') {
      const exagerado = usos.filter(u => Number(u.item.quantidade) > QTD_UN_SUSPEITA);
      if (exagerado.length) {
        P('aviso', 'Modelagem', `"${ing.nome}" é medido em "un", mas uma ficha pede ${Math.max(...exagerado.map(u => Number(u.item.quantidade) || 0))} un`,
          `Usar dezenas de "unidades" numa receita quase sempre quer dizer gramas/ml. Fichas: ${exagerado.map(u => u.ficha.nome).join(', ')}. É o erro clássico de "lata contada inteira".`,
          { alvo, sugestao: 'Mude para g/ml e cadastre a compra "Por embalagem".' });
      }
    }

    const chave = (ing.nome || '').trim().toLowerCase();
    if (chave) {
      if (vistosNome.has(chave)) P('aviso', 'Duplicado', `Ingrediente duplicado: "${ing.nome}"`, 'Dois itens com o mesmo nome dividem o estoque e confundem o WhatsApp.', { alvo, sugestao: 'Renomeie um ou una as compras.' });
      else vistosNome.set(chave, ing.id);
    }

    if (Array.isArray(ing.historico)) {
      const ruins = ing.historico.filter(h => !ehNumero(Number(h.custo_base)) || !isoValido(h.data)).length;
      if (ruins > 0) P('info', 'Integridade', `Histórico de compras com ${ruins} registro(s) estranho(s) em "${ing.nome}"`, 'Algumas compras antigas têm custo/data inválidos. Não afeta o preço atual.', { alvo });
    }
  }

  // ───────────────────────── FICHAS ─────────────────────────
  const vistosFichaId = new Map();
  for (const f of fichas) {
    const alvo = { tipo: 'ficha', id: f.id, nome: f.nome || '(sem nome)' };

    if (!f.id) P('critico', 'Integridade', 'Ficha sem identificador', `"${f.nome || '?'}" não tem id.`, { alvo });
    else if (vistosFichaId.has(f.id)) P('critico', 'Integridade', 'Duas fichas com o mesmo id', `id "${f.id}" repetido.`, { alvo });
    else vistosFichaId.set(f.id, true);

    if (!Array.isArray(f.ingredientes)) {
      P('critico', 'Integridade', `"${f.nome}" com lista de ingredientes corrompida`, 'O campo de ingredientes não é uma lista. Edite a ficha.', { alvo });
      continue; // sem lista, os demais checks não fazem sentido
    }

    const fantasmas = f.ingredientes.filter(i => !mapIng.has(i.ingrediente_id));
    if (fantasmas.length) P('critico', 'Ficha', `"${f.nome}" usa ingrediente(s) que não existem mais`, `${fantasmas.length} item(ns) apontam para ingredientes excluídos. O CMV não fecha.`, { alvo, sugestao: 'Edite a ficha e remova/substitua os órfãos.' });

    const idsNaFicha = new Set();
    for (const item of f.ingredientes) {
      if (idsNaFicha.has(item.ingrediente_id)) {
        const ing = mapIng.get(item.ingrediente_id);
        P('aviso', 'Ficha', `Ingrediente repetido em "${f.nome}"`, `${ing ? ing.nome : 'Um item'} aparece mais de uma vez. Some as quantidades numa linha só.`, { alvo });
        break;
      }
      idsNaFicha.add(item.ingrediente_id);
    }

    if (f.ingredientes.some(i => !(Number(i.quantidade) > 0))) P('aviso', 'Ficha', `"${f.nome}" tem item com quantidade zero/negativa`, 'Algum ingrediente está com quantidade ≤ 0 — não soma ao custo.', { alvo });

    const fatorRuim = f.ingredientes.find(i => i.fator_correcao !== undefined && (Number(i.fator_correcao) < FATOR_MIN || Number(i.fator_correcao) > FATOR_MAX));
    if (fatorRuim) {
      const ing = mapIng.get(fatorRuim.ingrediente_id);
      P('aviso', 'Ficha', `Fator de correção estranho em "${f.nome}"`, `${ing ? ing.nome : 'Um item'} está com fator ${fatorRuim.fator_correcao}. O normal fica entre ${FATOR_MIN.toFixed(2)} e ${FATOR_MAX.toFixed(2)}.`, { alvo });
    }

    if (!(Number(f.preco_venda) > 0)) P('aviso', 'Ficha', `"${f.nome}" sem preço de venda`, 'Preço de venda ≤ 0 impede calcular CMV e margem.', { alvo });

    const vivo = cmv.calcularCMV(f);
    if (f.status === 'confirmado' && vivo.valido) {
      if (vivo.custo_total >= vivo.preco_venda) P('critico', 'Prejuízo', `"${f.nome}" custa mais do que vende`, `Custo ${moeda(vivo.custo_total)} ≥ preço ${moeda(vivo.preco_venda)}. Cada venda dá prejuízo.`, { alvo, sugestao: 'Reveja preço ou ingredientes.' });
      else if (vivo.cmv_percentual < 8) P('aviso', 'CMV suspeito', `CMV de "${f.nome}" baixíssimo (${vivo.cmv_percentual}%)`, 'Abaixo de 8% costuma ser quantidade/preço errado. Confira.', { alvo });
      else if (vivo.cmv_percentual > 60) P('aviso', 'CMV suspeito', `CMV de "${f.nome}" altíssimo (${vivo.cmv_percentual}%)`, 'Acima de 60% quase sempre é erro de unidade ou preço de venda baixo.', { alvo });
    }
    if (f.status === 'confirmado' && vivo.valido && f.cmv_cache && f.cmv_cache.valido) {
      if (Math.abs((f.cmv_cache.cmv_percentual || 0) - vivo.cmv_percentual) >= 0.5) {
        P('aviso', 'Desatualizado', `CMV oficial de "${f.nome}" está defasado`, `Salvo ${f.cmv_cache.cmv_percentual}%, atual ${vivo.cmv_percentual}% (preço de ingrediente mudou).`, { alvo, acao: 'reconfirmar_fichas', sugestao: 'Use "Corrigir" para recalcular as defasadas.' });
      }
    }
    if (f.status === 'confirmado' && !vivo.valido) P('critico', 'Ficha', `"${f.nome}" está confirmada mas não calcula`, `Motivos: ${(vivo.erros || []).join(' / ')}`, { alvo, sugestao: 'Volte a rascunho, corrija e confirme.' });
  }

  // ───────────────────────── ESTOQUE × HISTÓRICO ─────────────────────────
  const movsPorIng = new Map();
  let depoisNegativos = 0, datasRuins = 0, datasFuturas = 0;
  const agoraMs = Date.now() + 60 * 1000; // 1 min de tolerância
  for (const m of movimentos) {
    if (!movsPorIng.has(m.ingrediente_id)) movsPorIng.set(m.ingrediente_id, []);
    movsPorIng.get(m.ingrediente_id).push(m);
    if (Number(m.estoque_depois) < 0) depoisNegativos++;
    if (!isoValido(m.data)) datasRuins++;
    else if (new Date(m.data).getTime() > agoraMs) datasFuturas++;
  }

  // Divergência estoque atual × último movimento
  let divergencias = 0;
  for (const ing of ingredientes) {
    const lista = (movsPorIng.get(ing.id) || []).slice().sort((a, b) => new Date(a.data) - new Date(b.data));
    if (!lista.length) continue;
    const ultimo = lista[lista.length - 1];
    if (Math.abs((Number(ing.estoque_atual) || 0) - (Number(ultimo.estoque_depois) || 0)) > 0.001) divergencias++;
  }
  if (divergencias > 0) P('aviso', 'Estoque', `${divergencias} item(ns) com estoque fora de sincronia com o histórico`, 'O estoque atual não bate com o último movimento. A foto por data fica imprecisa.', { acao: 'sincronizar_estoque', sugestao: 'Use "Corrigir" para realinhar.' });

  // Cadeia de movimentos descontínua (depois do anterior ≠ antes do seguinte)
  const quebraCadeia = [];
  for (const ing of ingredientes) {
    const lista = (movsPorIng.get(ing.id) || []).slice().sort((a, b) => new Date(a.data) - new Date(b.data));
    for (let i = 1; i < lista.length; i++) {
      if (Math.abs((Number(lista[i - 1].estoque_depois) || 0) - (Number(lista[i].estoque_antes) || 0)) > 0.01) { quebraCadeia.push(ing.nome); break; }
    }
  }
  if (quebraCadeia.length) P('aviso', 'Histórico', `${quebraCadeia.length} item(ns) com histórico de movimentos inconsistente`, `A sequência de saldos não encadeia em: ${quebraCadeia.slice(0, 6).join(', ')}${quebraCadeia.length > 6 ? '…' : ''}. Pode vir de edições antigas; afeta só a precisão da linha do tempo.`, {});

  if (depoisNegativos > 0) P('aviso', 'Histórico', `${depoisNegativos} movimento(s) terminam com saldo negativo`, 'Há registros de estoque com saldo abaixo de zero — provável baixa maior que o disponível.', {});
  if (datasRuins > 0) P('info', 'Histórico', `${datasRuins} movimento(s) com data inválida`, 'Registros sem data válida não aparecem direito na linha do tempo.', {});
  if (datasFuturas > 0) P('info', 'Histórico', `${datasFuturas} movimento(s) com data no futuro`, 'Datas futuras costumam ser erro de relógio/digitação.', {});

  const orfaos = movimentos.filter(m => !mapIng.has(m.ingrediente_id));
  if (orfaos.length) P('info', 'Higiene', `${orfaos.length} movimento(s) de itens já excluídos`, 'Registros de ingredientes que não existem mais. Não afetam os cálculos.', { acao: 'limpar_movimentos_orfaos', sugestao: 'Use "Corrigir" para remover.' });

  // ───────────────────────── CONTAGENS ─────────────────────────
  let contagensComItemFantasma = 0;
  for (const c of contagens) {
    if (Array.isArray(c.detalhe) && c.detalhe.some(d => !mapIng.has(d.ingrediente_id))) contagensComItemFantasma++;
  }
  if (contagensComItemFantasma > 0) P('info', 'Higiene', `${contagensComItemFantasma} contagem(ns) citam itens já excluídos`, 'Contagens antigas referenciam ingredientes removidos. Histórico apenas.', {});

  // ───────────────────────── CAIXA ─────────────────────────
  let caixaDataRuim = 0, caixaFutura = 0, caixaValorRuim = 0, caixaTipoRuim = 0;
  for (const l of lancamentos) {
    if (!ymdValido(l.data)) caixaDataRuim++;
    else if (l.data > hojeYMD()) caixaFutura++;
    if (!(Number(l.valor) > 0)) caixaValorRuim++;
    if (!['entrada', 'saida'].includes(l.tipo)) caixaTipoRuim++;
  }
  if (caixaTipoRuim > 0) P('critico', 'Caixa', `${caixaTipoRuim} lançamento(s) de caixa com tipo inválido`, 'Lançamentos sem "entrada"/"saida" bagunçam o resultado do dia.', {});
  if (caixaDataRuim > 0) P('aviso', 'Caixa', `${caixaDataRuim} lançamento(s) de caixa com data inválida`, 'Não entram no mês certo.', {});
  if (caixaFutura > 0) P('aviso', 'Caixa', `${caixaFutura} lançamento(s) de caixa com data no futuro`, 'Quase sempre é erro de ano na digitação.', {});
  if (caixaValorRuim > 0) P('aviso', 'Caixa', `${caixaValorRuim} lançamento(s) de caixa com valor zero/negativo`, 'Valores ≤ 0 distorcem entradas/saídas.', {});

  // ───────────────────────── CUSTOS FIXOS ─────────────────────────
  const compVistas = new Map();
  for (const mes of meses) {
    const alvo = { tipo: 'mes', id: mes.id, nome: mes.competencia || '(sem competência)' };
    if (!RE_COMP.test(mes.competencia || '')) P('aviso', 'Custos Fixos', 'Mês com competência inválida', `"${mes.competencia}" não está no formato AAAA-MM.`, { alvo });
    else if (compVistas.has(mes.competencia)) P('aviso', 'Custos Fixos', `Competência duplicada: ${mes.competencia}`, 'Dois registros para o mesmo mês — o rateio pode usar o errado.', { alvo });
    else compVistas.set(mes.competencia, true);

    const negativos = cmv.CATEGORIAS_FIXAS.filter(c => Number(mes[c]) < 0);
    if (negativos.length) P('aviso', 'Custos Fixos', `Valores negativos em ${mes.competencia}`, `Categorias com valor negativo: ${negativos.join(', ')}.`, { alvo });

    const r = cmv.calcularRateioMes(mes);
    if (r.total_mensal > 0 && r.vendas_mes === 0) P('info', 'Custos Fixos', `Mês ${mes.competencia}: custos sem vendas`, `${moeda(r.total_mensal)} de custos, mas 0 produtos vendidos. Rateio não calcula.`, { alvo, sugestao: 'Informe as vendas do mês.' });
  }

  // ───────────────────────── FORNECEDORES ─────────────────────────
  const fornVistos = new Map();
  let fornDup = 0;
  for (const f of (Array.isArray(fornecedores) ? fornecedores : [])) {
    const k = String(f || '').trim().toLowerCase();
    if (!k) continue;
    if (fornVistos.has(k)) fornDup++; else fornVistos.set(k, true);
  }
  if (fornDup > 0) P('info', 'Higiene', `${fornDup} fornecedor(es) duplicado(s)`, 'Mesmo fornecedor escrito de formas diferentes.', {});

  // ───────────────────────── CONFIGURAÇÃO / SESSÃO ─────────────────────────
  try {
    const s = storage.lerSettings();
    if (s && s.senha_hash && !s.auth_secret) P('critico', 'Sessão', 'Login configurado sem segredo de sessão', 'Há senha mas falta o auth_secret — os logins não se mantêm. Troque a senha para regenerar.', { sugestao: 'Topo → 🔑 trocar senha.' });
  } catch { /* ignora */ }

  // ───────────────────────── SEGURANÇA DOS DADOS ─────────────────────────
  // (o ponto que mais preocupa: NÃO perder o banco)
  const binfo = backup.info();
  if (binfo.na_vercel && !binfo.kv_ativo) {
    P('critico', 'Segurança dos dados', 'Rodando na nuvem SEM banco persistente (KV)', 'O disco da Vercel é temporário: sem o Vercel KV conectado, os dados podem sumir a qualquer momento. Conecte o KV (Upstash) e faça Redeploy.', { sugestao: 'Vercel → Storage → KV → Connect → Redeploy.' });
  } else if (binfo.kv_ativo) {
    P('info', 'Segurança dos dados', 'Dados no Vercel KV (durável) + backup diário automático', 'O banco está num KV persistente e a 1ª gravação de cada dia guarda uma foto datada no próprio Redis (rotação de 14 dias). Ainda assim, baixe um backup de tempos em tempos (botão Exportar) e guarde fora do servidor.', {});
  } else {
    // modo local: checa os backups automáticos
    const ultimos = (binfo.local && binfo.local.backups) || [];
    if (!ultimos.length) {
      P('aviso', 'Segurança dos dados', 'Nenhum backup automático ainda', 'Assim que você salvar algo, o sistema passa a guardar um backup por dia em data/backups. Você também pode baixar um agora (Exportar).', { sugestao: 'Clique em Exportar para baixar uma cópia.' });
    } else {
      const maisRecente = ultimos[0];
      const dias = Math.floor((Date.now() - new Date(maisRecente.data).getTime()) / 86400000);
      if (dias >= 2) P('aviso', 'Segurança dos dados', `Último backup automático há ${dias} dias`, 'Faz tempo que não há backup novo. Exporte uma cópia agora para não correr risco.', { sugestao: 'Clique em Exportar.' });
      else P('info', 'Segurança dos dados', `Backups automáticos em dia (${ultimos.length} guardado[s])`, `Último: ${maisRecente.arquivo}. Mesmo assim, guarde uma cópia exportada fora do computador.`, {});
    }
  }

  const resumo = {
    total: problemas.length,
    criticos: problemas.filter(p => p.severidade === 'critico').length,
    avisos: problemas.filter(p => p.severidade === 'aviso').length,
    infos: problemas.filter(p => p.severidade === 'info').length,
    verificado_em: new Date().toISOString(),
    contagens: { ingredientes: ingredientes.length, fichas: fichas.length, movimentos: movimentos.length, lancamentos: lancamentos.length, meses: meses.length },
  };
  const ordem = { critico: 0, aviso: 1, info: 2 };
  problemas.sort((a, b) => ordem[a.severidade] - ordem[b.severidade]);
  return { resumo, problemas };
}

// ─── Correções automáticas (apenas operações SEGURAS e reversíveis) ─────────
function corrigir(acao) {
  const { v4: uuidv4 } = require('uuid');

  if (acao === 'reconfirmar_fichas') {
    const fichas = storage.listarFichas();
    let n = 0;
    for (const f of fichas) {
      if (f.status !== 'confirmado') continue;
      const r = cmv.calcularCMV(f);
      if (r.valido) {
        const antes = f.cmv_cache && f.cmv_cache.cmv_percentual;
        if (antes !== r.cmv_percentual) { f.cmv_cache = r; f.ultima_atualizacao = new Date().toISOString(); n++; }
      }
    }
    if (n > 0) storage.salvarTodasFichas(fichas);
    return { ok: true, corrigidos: n, mensagem: `${n} ficha(s) recalculada(s) e atualizada(s).` };
  }

  if (acao === 'limpar_movimentos_orfaos') {
    const ids = new Set(storage.listarIngredientes().map(i => i.id));
    const movimentos = storage.listarMovimentos();
    const limpos = movimentos.filter(m => ids.has(m.ingrediente_id));
    const removidos = movimentos.length - limpos.length;
    if (removidos > 0) storage.salvarTodosMovimentos(limpos);
    return { ok: true, corrigidos: removidos, mensagem: `${removidos} movimento(s) órfão(s) removido(s).` };
  }

  if (acao === 'sincronizar_estoque') {
    const ingredientes = storage.listarIngredientes();
    const movimentos = storage.listarMovimentos();
    const ultimoMov = new Map();
    for (const m of movimentos) {
      const at = ultimoMov.get(m.ingrediente_id);
      if (!at || new Date(m.data) >= new Date(at.data)) ultimoMov.set(m.ingrediente_id, m);
    }
    let n = 0;
    for (const ing of ingredientes) {
      const m = ultimoMov.get(ing.id);
      if (!m) continue;
      const atual = Number(ing.estoque_atual) || 0;
      const log = Number(m.estoque_depois) || 0;
      if (Math.abs(atual - log) > 0.001) {
        storage.salvarMovimento({
          id: uuidv4(), ingrediente_id: ing.id, ingrediente_nome: ing.nome, tipo: 'ajuste',
          quantidade_base: cmv.arredondar(atual - log, 3), unidade_base: ing.unidade_base,
          estoque_antes: log, estoque_depois: atual,
          motivo: 'Sincronização (auditoria): histórico realinhado ao estoque atual',
          data: new Date().toISOString(),
        });
        n++;
      }
    }
    return { ok: true, corrigidos: n, mensagem: `${n} item(ns) sincronizado(s) com o histórico.` };
  }

  return { erro: 'Ação de correção desconhecida.' };
}

module.exports = { executar, corrigir };
