'use strict';

// ═══════════════════════════════════════════════════════════════
// PREPAROS (sub-receitas feitas na casa)
// ───────────────────────────────────────────────────────────────
// Costela desfiada, abacaxi caramelizado, molho da casa, cebola
// caramelizada… são "ingredientes" que o cliente PRODUZ a partir de
// outros insumos. Um preparo é um ingrediente normal (entra em ficha,
// estoque, contagem) com um campo extra:
//
//   ing.receita = {
//     itens: [{ ingrediente_id, quantidade }],  // qtd na base do componente
//     rendimento, unidade_rendimento,           // como o usuário digitou
//     rendimento_base,                          // na unidade base do preparo
//   }
//
// O custo_base do preparo é DERIVADO: soma dos componentes ÷ rendimento.
// Sempre que o preço de um componente muda, o preparo é recalculado e o
// novo custo propaga para as fichas (cmv.propagarPreco).
//
// Regra anti-ciclo: preparo NÃO pode conter outro preparo (1 nível).
// ═══════════════════════════════════════════════════════════════

const storage = require('./storage');
const units = require('./units');
const cmv = require('./cmv');
const estoqueCore = require('./estoque');

function ehPreparo(ing) {
  return !!(ing && ing.receita && Array.isArray(ing.receita.itens));
}

// Custo do preparo a partir da receita atual (preços de hoje).
function custoReceita(receita) {
  let total = 0;
  const sem_preco = [];
  const removidos = [];
  const componentes = [];
  for (const item of (receita && receita.itens) || []) {
    const comp = storage.buscarIngredientePorId(item.ingrediente_id);
    if (!comp) { removidos.push(item.ingrediente_id); continue; }
    const qtd = Number(item.quantidade) || 0;
    const custo = (Number(comp.custo_base) || 0) * qtd;
    if (!(comp.custo_base > 0)) sem_preco.push(comp.nome);
    total += custo;
    componentes.push({
      ingrediente_id: comp.id,
      nome: comp.nome,
      unidade_base: comp.unidade_base,
      quantidade: qtd,
      custo: cmv.arredondar(custo, 2),
    });
  }
  const rendimento = Number(receita && receita.rendimento_base) || 0;
  const custo_base = rendimento > 0 ? cmv.arredondar(total / rendimento, 6) : 0;
  return { custo_total: cmv.arredondar(total, 2), custo_base, sem_preco, removidos, componentes };
}

// Valida e normaliza a receita vinda da API. Retorna { erro } ou { receita }.
function montarReceita(body, unidade_base, idDoProprio = null) {
  const itens = Array.isArray(body.itens) ? body.itens : [];
  if (!itens.length) return { erro: 'A receita precisa de ao menos um ingrediente.' };

  const normalizados = [];
  const vistos = new Set();
  for (const item of itens) {
    const comp = storage.buscarIngredientePorId(item.ingrediente_id);
    if (!comp) return { erro: 'Há um ingrediente inválido na receita. Recarregue a página e tente de novo.' };
    if (comp.id === idDoProprio) return { erro: 'O preparo não pode conter ele mesmo.' };
    if (ehPreparo(comp)) return { erro: `"${comp.nome}" também é um preparo — use os ingredientes crus dele na receita (um preparo não entra dentro de outro).` };
    if (vistos.has(comp.id)) return { erro: `"${comp.nome}" aparece mais de uma vez — some as quantidades numa linha só.` };
    vistos.add(comp.id);
    const qtd = parseFloat(item.quantidade);
    if (!(qtd > 0)) return { erro: `Quantidade inválida para "${comp.nome}".` };
    normalizados.push({ ingrediente_id: comp.id, quantidade: qtd });
  }

  const rendimento = parseFloat(body.rendimento);
  if (!(rendimento > 0)) return { erro: 'Informe quanto a receita RENDE depois de pronta (ex.: 800 g).' };
  const unR = body.unidade_rendimento || unidade_base;
  if (!units.existeUnidade(unR) || units.unidadeBase(unR) !== unidade_base) {
    return { erro: `O rendimento deve ser em ${unidade_base} (a unidade de uso do preparo).` };
  }

  return {
    receita: {
      itens: normalizados,
      rendimento,
      unidade_rendimento: unR,
      rendimento_base: cmv.arredondar(units.paraBase(rendimento, unR), 3),
    },
  };
}

// Recalcula o custo derivado de UM preparo. Retorna true se o custo mudou.
function recalcular(ing) {
  if (!ehPreparo(ing)) return false;
  const { custo_base } = custoReceita(ing.receita);
  if (Number(ing.custo_base) === custo_base) return false;
  ing.custo_base = custo_base;
  ing.ultima_atualizacao = new Date().toISOString();
  storage.salvarIngrediente(ing);
  return true;
}

// Quando o preço de um ingrediente muda, atualiza os preparos que o usam
// na receita e propaga o novo custo para as fichas desses preparos.
function recalcularPreparosComIngrediente(ingrediente_id) {
  const afetados = [];
  for (const ing of storage.listarIngredientes()) {
    if (!ehPreparo(ing)) continue;
    if (!ing.receita.itens.some(i => i.ingrediente_id === ingrediente_id)) continue;
    if (recalcular(ing)) {
      cmv.propagarPreco(ing.id);
      afetados.push(ing.nome);
    }
  }
  return afetados;
}

// "Produzi uma leva": dá ENTRADA do rendimento no preparo e BAIXA os
// componentes do estoque (consumo real da produção).
function registrarProducao(ing, levas = 1) {
  if (!ehPreparo(ing)) return { erro: 'Este item não é um preparo.' };
  const n = Number(levas);
  if (!(n > 0) || n > 1000) return { erro: 'Informe quantas levas você produziu (ex.: 1).' };
  const rend = Number(ing.receita.rendimento_base) || 0;
  if (!(rend > 0)) return { erro: 'A receita está sem rendimento válido. Edite o preparo.' };

  const entrada = estoqueCore.aplicarMovimento({
    ingrediente_id: ing.id,
    tipo: 'entrada',
    quantidade: cmv.arredondar(rend * n, 3),
    unidade: ing.unidade_base,
    motivo: `Produção${n !== 1 ? ` (${n} levas)` : ''} — ${ing.nome}`,
  });
  if (entrada.erro) return { erro: entrada.erro };

  const baixas = [];
  for (const item of ing.receita.itens) {
    const comp = storage.buscarIngredientePorId(item.ingrediente_id);
    if (!comp) continue;
    const r = estoqueCore.aplicarMovimento({
      ingrediente_id: comp.id,
      tipo: 'saida',
      quantidade: cmv.arredondar((Number(item.quantidade) || 0) * n, 3),
      unidade: comp.unidade_base,
      motivo: `Produção — ${ing.nome}`,
    });
    if (!r.erro) baixas.push({ nome: comp.nome, movimento: r.movimento });
  }

  return { ingrediente: entrada.ingrediente, entrada: entrada.movimento, baixas };
}

module.exports = {
  ehPreparo,
  custoReceita,
  montarReceita,
  recalcular,
  recalcularPreparosComIngrediente,
  registrarProducao,
};
