'use strict';

// ═══════════════════════════════════════════════════════════════
// HISTÓRICO DE ESTOQUE  (linha do tempo, foto por data, comparativo)
// ───────────────────────────────────────────────────────────────
// Todo movimento já guarda estoque_antes / estoque_depois / data.
// Com isso reconstruímos como estava o estoque em qualquer dia e
// comparamos períodos (dia, semana, mês).
//
// Fuso: São Paulo é UTC-3 fixo. O "fim do dia D" em SP é o instante
// D+1 00:00 -03:00. Comparamos os timestamps (UTC ISO) por esse corte.
// ═══════════════════════════════════════════════════════════════

const storage = require('./storage');
const units = require('./units');
const estoqueCore = require('./estoque');
const { arredondar } = require('./cmv');

const OFFSET_SP = '-03:00';

function fimDoDiaUTC(dataYMD) {
  const inicio = new Date(`${dataYMD}T00:00:00.000${OFFSET_SP}`);
  return new Date(inicio.getTime() + 24 * 60 * 60 * 1000).toISOString();
}
function inicioDoDiaUTC(dataYMD) {
  return new Date(`${dataYMD}T00:00:00.000${OFFSET_SP}`).toISOString();
}
function hojeBR() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function exibFator(base) { return units.UNIDADE_EXIBICAO[base]?.fator || 1; }
function exibUnidade(base) { return units.UNIDADE_EXIBICAO[base]?.unidade || base; }

// Custo por unidade base vigente até o corte (última compra <= corte).
function custoNaData(ing, corteISO) {
  const atual = Number(ing.custo_base) || 0;
  const hist = Array.isArray(ing.historico) ? ing.historico : [];
  if (!hist.length) return { custo: atual, tem_preco_na_data: atual > 0 };
  const ordenado = hist.slice().sort((a, b) => new Date(a.data) - new Date(b.data));
  let custo = null;
  for (const h of ordenado) {
    if (new Date(h.data) <= new Date(corteISO)) custo = Number(h.custo_base) || 0;
  }
  if (custo === null) return { custo: atual, tem_preco_na_data: false }; // ainda não tinha preço
  return { custo, tem_preco_na_data: true };
}

// Quantidade (base) de um ingrediente no fim do dia do corte.
function quantidadeNaData(movs, corteISO, ing, ehHoje) {
  const antes = movs
    .filter(m => new Date(m.data) < new Date(corteISO))
    .sort((a, b) => new Date(a.data) - new Date(b.data));
  if (antes.length) return { qtd: Number(antes[antes.length - 1].estoque_depois) || 0, tem_movimentos: true };
  // Sem movimentos até a data:
  if (ehHoje) return { qtd: estoqueCore.estoqueAtual(ing), tem_movimentos: false }; // legado sem log
  return { qtd: 0, tem_movimentos: false };
}

// Foto do estoque ao fim de um dia (YYYY-MM-DD).
function snapshot(dataYMD) {
  const corte = fimDoDiaUTC(dataYMD);
  const ehHoje = dataYMD >= hojeBR();
  const ings = storage.listarIngredientes();
  const movsTodos = storage.listarMovimentos();

  const itens = ings.map(ing => {
    const movs = movsTodos.filter(m => m.ingrediente_id === ing.id);
    const { qtd, tem_movimentos } = quantidadeNaData(movs, corte, ing, ehHoje);
    const { custo, tem_preco_na_data } = custoNaData(ing, corte);
    const fator = exibFator(ing.unidade_base);
    return {
      id: ing.id,
      nome: ing.nome,
      unidade_base: ing.unidade_base,
      unidade_exibicao: exibUnidade(ing.unidade_base),
      estoque_base: qtd,
      estoque_exibicao: arredondar(qtd / fator, 3),
      custo_base_na_data: custo,
      valor: arredondar(qtd * custo, 2),
      tem_preco_na_data,
      tem_movimentos,
    };
  });

  itens.sort((a, b) => b.valor - a.valor || a.nome.localeCompare(b.nome, 'pt-BR'));
  const valor_total = arredondar(itens.reduce((s, i) => s + i.valor, 0), 2);
  return { data: dataYMD, corte, itens, valor_total, total_itens: itens.length };
}

// Linha do tempo de um ingrediente (mais recente primeiro).
function timeline(ingrediente_id) {
  const ing = storage.buscarIngredientePorId(ingrediente_id);
  if (!ing) return null;
  const fator = exibFator(ing.unidade_base);
  const movs = storage.listarMovimentosPorIngrediente(ingrediente_id).map(m => ({
    ...m,
    quantidade_exibicao: arredondar((m.quantidade_base || 0) / fator, 3),
    saldo_exibicao: arredondar((Number(m.estoque_depois) || 0) / fator, 3),
    unidade_exibicao: exibUnidade(ing.unidade_base),
  }));
  return {
    ingrediente: {
      id: ing.id, nome: ing.nome, unidade_base: ing.unidade_base,
      unidade_exibicao: exibUnidade(ing.unidade_base),
      estoque_exibicao: arredondar(estoqueCore.estoqueAtual(ing) / fator, 3),
      custo_base: Number(ing.custo_base) || 0,
    },
    movimentos: movs,
  };
}

// Resumo do que se movimentou no período (inicio exclusivo, fim inclusivo).
function movimentosNoPeriodo(corteInicio, corteFim) {
  const movs = storage.listarMovimentos().filter(m => {
    const t = new Date(m.data);
    return t > new Date(corteInicio) && t <= new Date(corteFim);
  });
  const porIng = new Map();
  let entradas = 0, saidas = 0;
  for (const m of movs) {
    const q = Number(m.quantidade_base) || 0;
    if (m.tipo === 'entrada') entradas += q;
    else if (m.tipo === 'saida') saidas += q;
    if (!porIng.has(m.ingrediente_id)) porIng.set(m.ingrediente_id, { nome: m.ingrediente_nome, total: 0 });
    porIng.get(m.ingrediente_id).total += 1;
  }
  return { total_movimentos: movs.length, itens_movimentados: porIng.size, entradas, saidas };
}

// Comparativo entre duas datas.
function comparar(dataA, dataB) {
  const a = snapshot(dataA);
  const b = snapshot(dataB);
  const mapA = new Map(a.itens.map(i => [i.id, i]));
  const mapB = new Map(b.itens.map(i => [i.id, i]));
  const ids = new Set([...mapA.keys(), ...mapB.keys()]);

  const itens = [...ids].map(id => {
    const ia = mapA.get(id), ib = mapB.get(id);
    const nome = (ib || ia).nome;
    const unidade_exibicao = (ib || ia).unidade_exibicao;
    const qa = ia ? ia.estoque_exibicao : 0, qb = ib ? ib.estoque_exibicao : 0;
    const va = ia ? ia.valor : 0, vb = ib ? ib.valor : 0;
    return {
      id, nome, unidade_exibicao,
      qtd_a: qa, qtd_b: qb, delta_qtd: arredondar(qb - qa, 3),
      valor_a: va, valor_b: vb, delta_valor: arredondar(vb - va, 2),
    };
  }).sort((x, y) => Math.abs(y.delta_valor) - Math.abs(x.delta_valor) || x.nome.localeCompare(y.nome, 'pt-BR'));

  const periodo = movimentosNoPeriodo(fimDoDiaUTC(dataA), fimDoDiaUTC(dataB));

  return {
    data_a: dataA, data_b: dataB,
    valor_total_a: a.valor_total, valor_total_b: b.valor_total,
    delta_total: arredondar(b.valor_total - a.valor_total, 2),
    itens, periodo,
  };
}

module.exports = { snapshot, timeline, comparar, hojeBR };
