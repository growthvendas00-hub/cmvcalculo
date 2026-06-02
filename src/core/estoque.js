'use strict';

// ═══════════════════════════════════════════════════════════════
// CONTROLE DE ESTOQUE
// ───────────────────────────────────────────────────────────────
// O estoque de cada ingrediente é guardado SEMPRE na unidade base
// (g / ml / un), igual ao custo. Assim "5 kg" viram 5000 g e o
// valor parado em estoque = quantidade_base × custo_base.
//
// Movimentos:
//   entrada → compra ou reposição (soma ao estoque)
//   saida   → perda, quebra, consumo (subtrai do estoque)
//   ajuste  → contagem de inventário (define o valor absoluto)
// ═══════════════════════════════════════════════════════════════

const storage = require('./storage');
const units = require('./units');
const { arredondar } = require('./cmv');
const { v4: uuidv4 } = require('uuid');

// Converte um custo por unidade base para a quantidade "amigável" (kg/L/un)
function exibFator(unidadeBase) {
  return units.UNIDADE_EXIBICAO[unidadeBase]?.fator || 1;
}

// Quantidade base atual do ingrediente (tolerante a campo ausente/legado)
function estoqueAtual(ing) {
  const v = Number(ing.estoque_atual);
  return Number.isFinite(v) ? v : 0;
}

function estoqueMinimo(ing) {
  const v = Number(ing.estoque_minimo);
  return Number.isFinite(v) ? v : 0;
}

// Situação do item para a lista de compras
function situacao(atual, minimo) {
  if (atual <= 0) return { classe: 'zerado', rotulo: 'Sem estoque' };
  if (minimo > 0 && atual <= minimo) return { classe: 'baixo', rotulo: 'Abaixo do mínimo' };
  return { classe: 'ok', rotulo: 'Em estoque' };
}

// Monta a visão de estoque de um ingrediente (quantidade, valor, situação)
function visaoIngrediente(ing) {
  const atual = estoqueAtual(ing);
  const minimo = estoqueMinimo(ing);
  const custo_base = Number(ing.custo_base) || 0;
  const valor_estoque = arredondar(atual * custo_base, 2);
  const ex = units.exibicao(custo_base, ing.unidade_base); // unidade amigável p/ exibir
  const exFator = units.UNIDADE_EXIBICAO[ing.unidade_base]?.fator || 1;
  const s = situacao(atual, minimo);

  return {
    id: ing.id,
    nome: ing.nome,
    unidade_base: ing.unidade_base,
    unidade_exibicao: ex.unidade,
    fator_exibicao: exFator,                 // base × fator? não: base / fator p/ exibir
    custo_base,
    tem_preco: custo_base > 0,
    estoque_base: atual,
    minimo_base: minimo,
    // valores "amigáveis" para exibir (kg/L/un)
    estoque_exibicao: arredondar(atual / exFator, 3),
    minimo_exibicao: arredondar(minimo / exFator, 3),
    valor_estoque,
    situacao: s.classe,
    situacao_rotulo: s.rotulo,
  };
}

// Aplica um movimento e retorna o ingrediente atualizado + registro salvo
function aplicarMovimento({ ingrediente_id, tipo, quantidade, unidade, motivo }) {
  const ing = storage.buscarIngredientePorId(ingrediente_id);
  if (!ing) return { erro: 'Ingrediente não encontrado.' };

  const tiposValidos = ['entrada', 'saida', 'ajuste'];
  if (!tiposValidos.includes(tipo)) return { erro: 'Tipo de movimento inválido.' };

  const qtd = Number(quantidade);
  if (!(qtd >= 0) || (tipo !== 'ajuste' && qtd <= 0)) {
    return { erro: 'Informe uma quantidade válida.' };
  }

  // Converte a quantidade informada para a unidade base
  const un = unidade || ing.unidade_base;
  if (!units.existeUnidade(un)) return { erro: 'Unidade inválida.' };
  if (units.unidadeBase(un) !== ing.unidade_base) {
    return { erro: `Unidade incompatível: "${ing.nome}" é medido em ${ing.unidade_base}.` };
  }
  const qtdBase = arredondar(units.paraBase(qtd, un), 3);

  const anterior = estoqueAtual(ing);
  let novo;
  if (tipo === 'entrada') novo = anterior + qtdBase;
  else if (tipo === 'saida') novo = anterior - qtdBase;
  else novo = qtdBase; // ajuste = valor absoluto contado

  novo = arredondar(Math.max(0, novo), 3);

  ing.estoque_atual = novo;
  ing.ultima_atualizacao = new Date().toISOString();
  storage.salvarIngrediente(ing);

  const registro = {
    id: uuidv4(),
    ingrediente_id,
    ingrediente_nome: ing.nome,
    tipo,
    quantidade_base: tipo === 'ajuste' ? arredondar(novo - anterior, 3) : qtdBase,
    unidade_base: ing.unidade_base,
    estoque_antes: anterior,
    estoque_depois: novo,
    motivo: (motivo || '').trim() || null,
    data: new Date().toISOString(),
  };
  storage.salvarMovimento(registro);

  return { ingrediente: ing, movimento: registro };
}

// ───────────────────────────────────────────────────────────────
// CONTAGEM (inventário inicial + conferência de fechamento)
// ───────────────────────────────────────────────────────────────
// Fluxo de hamburgueria:
//   • 1º dia → INVENTÁRIO INICIAL: conta tudo e preenche a base.
//   • Todo fim de expediente → CONFERÊNCIA: conta o que sobrou.
//
// O consumo do período = (estoque do sistema antes da contagem) − (contado).
// Como as compras já entram no estoque na hora, esse número embute
// vendas + perdas/quebras. É o "saiu do estoque hoje".
// Se o contado for MAIOR que o sistema, registramos como sobra
// (provável entrada não lançada), sem virar consumo negativo.

function registrarContagem({ itens, tipo, observacao }) {
  if (!Array.isArray(itens) || itens.length === 0) {
    return { erro: 'Nenhum item informado para a contagem.' };
  }

  const houvePrimeira = !!storage.ultimaContagem();
  const tipoFinal = tipo || (houvePrimeira ? 'diaria' : 'inicial');
  const agora = new Date().toISOString();

  const detalhe = [];
  let valor_consumo = 0;     // R$ que saiu do estoque (consumo + perdas)
  let valor_contado = 0;     // R$ parado após a contagem
  let valor_sobra = 0;       // R$ de sobra (contado > sistema)

  for (const item of itens) {
    const ing = storage.buscarIngredientePorId(item.ingrediente_id);
    if (!ing) continue;

    const un = item.unidade || ing.unidade_base;
    if (!units.existeUnidade(un) || units.unidadeBase(un) !== ing.unidade_base) {
      return { erro: `Unidade incompatível com "${ing.nome}".` };
    }
    const contadoNum = Number(item.contado);
    if (!(contadoNum >= 0)) {
      return { erro: `Quantidade inválida para "${ing.nome}".` };
    }

    const contadoBase = arredondar(units.paraBase(contadoNum, un), 3);
    const antes = estoqueAtual(ing);
    const diff = arredondar(antes - contadoBase, 3); // positivo = saiu
    const custo_base = Number(ing.custo_base) || 0;

    // Atualiza o estoque para o valor contado (verdade física)
    ing.estoque_atual = contadoBase;
    ing.ultima_atualizacao = agora;
    storage.salvarIngrediente(ing);

    // Loga o movimento de contagem
    storage.salvarMovimento({
      id: uuidv4(),
      ingrediente_id: ing.id,
      ingrediente_nome: ing.nome,
      tipo: 'contagem',
      quantidade_base: arredondar(contadoBase - antes, 3),
      unidade_base: ing.unidade_base,
      estoque_antes: antes,
      estoque_depois: contadoBase,
      motivo: tipoFinal === 'inicial' ? 'Inventário inicial' : 'Conferência de fechamento',
      data: agora,
    });

    const consumo_base = diff > 0 ? diff : 0;
    const sobra_base = diff < 0 ? -diff : 0;
    const fator = exibFator(ing.unidade_base);
    valor_consumo += consumo_base * custo_base;
    valor_sobra += sobra_base * custo_base;
    valor_contado += contadoBase * custo_base;

    detalhe.push({
      ingrediente_id: ing.id,
      nome: ing.nome,
      unidade_base: ing.unidade_base,
      unidade_exibicao: units.exibicao(custo_base, ing.unidade_base).unidade,
      sistema_exibicao: arredondar(antes / fator, 3),
      contado_exibicao: arredondar(contadoBase / fator, 3),
      diferenca_exibicao: arredondar(diff / fator, 3),
      consumo_valor: arredondar(consumo_base * custo_base, 2),
      sobra_valor: arredondar(sobra_base * custo_base, 2),
    });
  }

  const contagem = {
    id: uuidv4(),
    tipo: tipoFinal,
    data: agora,
    observacao: (observacao || '').trim() || null,
    total_itens: detalhe.length,
    valor_consumo: arredondar(valor_consumo, 2),
    valor_sobra: arredondar(valor_sobra, 2),
    valor_contado: arredondar(valor_contado, 2),
    itens_com_consumo: detalhe.filter(d => d.consumo_valor > 0).length,
    detalhe,
  };
  storage.salvarContagem(contagem);
  return { contagem };
}

// Visão geral do estoque (lista + totais + lista de compras + status de contagem)
function panorama() {
  const itens = storage.listarIngredientes().map(visaoIngrediente);

  const valor_total = arredondar(itens.reduce((s, i) => s + i.valor_estoque, 0), 2);
  const lista_compras = itens
    .filter(i => i.situacao !== 'ok')
    .sort((a, b) => {
      const ordem = { zerado: 0, baixo: 1 };
      return (ordem[a.situacao] - ordem[b.situacao]) || a.nome.localeCompare(b.nome, 'pt-BR');
    });

  itens.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  const ultima = storage.ultimaContagem();
  const semPreco = itens.filter(i => !i.tem_preco).map(i => i.nome);

  return {
    itens,
    valor_total_estoque: valor_total,
    total_itens: itens.length,
    itens_zerados: itens.filter(i => i.situacao === 'zerado').length,
    itens_abaixo_minimo: itens.filter(i => i.situacao === 'baixo').length,
    lista_compras,
    sem_preco: semPreco,
    ja_fez_contagem: !!ultima,
    ultima_contagem: ultima ? { data: ultima.data, tipo: ultima.tipo, valor_consumo: ultima.valor_consumo } : null,
  };
}

module.exports = {
  estoqueAtual,
  estoqueMinimo,
  visaoIngrediente,
  aplicarMovimento,
  registrarContagem,
  panorama,
};
