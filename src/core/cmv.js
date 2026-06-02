'use strict';

const storage = require('./storage');
const units = require('./units');

// Categorias que compõem o total de custos fixos de um mês
const CATEGORIAS_FIXAS = [
  'aluguel', 'energia', 'gas', 'salarios', 'agua',
  'internet', 'marketing', 'manutencao', 'outros',
];

// Tipos de produto vendidos (espelham os tipos das fichas) — usados para
// registrar as vendas do mês em quantidade (origem: cardápio digital).
const VENDAS_TIPOS = ['hamburguer', 'pizza', 'bebida', 'porcao', 'outro'];

// Total de produtos vendidos no mês: soma o detalhamento por tipo se houver,
// senão usa o campo único vendas_mes (compatibilidade com meses antigos).
function totalVendasMes(mes) {
  if (!mes) return 0;
  if (mes.vendas_detalhe && typeof mes.vendas_detalhe === 'object') {
    const soma = VENDAS_TIPOS.reduce((s, t) => s + (parseFloat(mes.vendas_detalhe[t]) || 0), 0);
    if (soma > 0) return soma;
  }
  return parseFloat(mes.vendas_mes) || 0;
}

// Arredonda preservando precisão. Padrão monetário (centavos) = 2 casas.
function arredondar(valor, casas = 2) {
  const f = Math.pow(10, casas);
  return Math.round((Number(valor) + Number.EPSILON) * f) / f;
}

// Custo por unidade base a partir de uma compra.
// Ex.: 10 kg por R$ 469 → 10000 g → 0,0469 / g  (6 casas para não perder precisão)
function calcularCustoBase(valorTotal, quantidadeComprada, unidadeCompra) {
  const qtdBase = units.paraBase(Number(quantidadeComprada), unidadeCompra);
  if (!qtdBase || qtdBase <= 0) return 0;
  return arredondar(Number(valorTotal) / qtdBase, 6);
}

// Ingrediente tem preço válido?
function temPreco(ing) {
  return ing && typeof ing.custo_base === 'number' && ing.custo_base > 0;
}

// Total de custos fixos de um mês + custo rateado por produto
function calcularRateioMes(mes) {
  if (!mes) return { total_mensal: 0, custo_por_produto: 0, vendas_mes: 0 };
  const total = CATEGORIAS_FIXAS.reduce((s, c) => s + (parseFloat(mes[c]) || 0), 0);
  const vendas = totalVendasMes(mes);
  return {
    total_mensal: arredondar(total),
    custo_por_produto: vendas > 0 ? arredondar(total / vendas, 4) : 0,
    vendas_mes: vendas,
  };
}

// Valida se a ficha pode ser calculada (todos os ingredientes com preço)
function validarFicha(ficha) {
  const erros = [];
  if (!ficha.ingredientes || ficha.ingredientes.length === 0) {
    erros.push('A ficha não possui ingredientes. Adicione ao menos um.');
  }
  for (const item of ficha.ingredientes || []) {
    const ing = storage.buscarIngredientePorId(item.ingrediente_id);
    if (!ing) {
      erros.push(`Ingrediente removido ou inexistente (ID ${item.ingrediente_id}). Remova-o da ficha.`);
    } else if (!temPreco(ing)) {
      erros.push(`ERRO: Ingrediente "${ing.nome}" sem preço. Cálculo bloqueado — registre uma compra para definir o custo.`);
    }
    if (!item.quantidade || item.quantidade <= 0) {
      const nome = ing ? ing.nome : item.ingrediente_id;
      erros.push(`Quantidade inválida para "${nome}".`);
    }
  }
  if (!ficha.preco_venda || ficha.preco_venda <= 0) {
    erros.push('Preço de venda não definido (deve ser maior que zero).');
  }
  return erros;
}

// Cálculo completo do CMV de uma ficha.
// Se incluirRateio = true, soma o custo fixo por produto do mês mais recente.
function calcularCMV(ficha) {
  const erros = validarFicha(ficha);
  if (erros.length > 0) return { valido: false, erros };

  let custo_total_insumos = 0;
  const detalhamento = [];

  for (const item of ficha.ingredientes) {
    const ing = storage.buscarIngredientePorId(item.ingrediente_id);
    const fator = item.fator_correcao && item.fator_correcao > 0 ? item.fator_correcao : 1.0;
    const quantidade_real = arredondar(item.quantidade * fator, 2);
    // custo da porção em centavos
    const custo_na_porcao = arredondar(ing.custo_base * item.quantidade * fator, 2);
    custo_total_insumos = arredondar(custo_total_insumos + custo_na_porcao, 2);

    const ex = units.exibicao(ing.custo_base, ing.unidade_base);
    detalhamento.push({
      ingrediente_id: ing.id,
      nome: ing.nome,
      unidade_base: ing.unidade_base,
      quantidade_usada: item.quantidade,
      fator_correcao: fator,
      quantidade_real,
      custo_base: ing.custo_base,
      custo_exibicao: arredondar(ex.valor, 2),
      unidade_exibicao: ex.unidade,
      custo_na_porcao,
    });
  }

  const custo_embalagem = arredondar(ficha.custo_embalagem || 0);

  // Rateio de custos fixos (opcional)
  let custo_rateio = 0;
  let rateio_competencia = null;
  if (ficha.incluir_rateio) {
    const mes = storage.mesMaisRecente();
    if (mes) {
      const r = calcularRateioMes(mes);
      custo_rateio = r.custo_por_produto;
      rateio_competencia = mes.competencia;
    }
  }

  const custo_total = arredondar(custo_total_insumos + custo_embalagem + custo_rateio);
  const cmv_percentual = arredondar((custo_total / ficha.preco_venda) * 100, 2);
  const margem_bruta = arredondar(ficha.preco_venda - custo_total);

  const classificacao = classificarCMV(cmv_percentual);

  return {
    valido: true,
    erros: [],
    detalhamento,
    custo_total_insumos,
    custo_embalagem,
    custo_rateio,
    rateio_competencia,
    custo_total,
    preco_venda: arredondar(ficha.preco_venda),
    margem_bruta,
    cmv_percentual,
    indicador: classificacao.indicador,
    indicador_classe: classificacao.classe,
  };
}

// Faixas de referência (padrão Abrasel para hamburguerias e pizzarias)
function classificarCMV(pct) {
  if (pct < 25) return { indicador: 'Atenção: CMV muito baixo (verifique qualidade)', classe: 'baixo' };
  if (pct <= 33) return { indicador: 'CMV Saudável', classe: 'saudavel' };
  if (pct <= 35) return { indicador: 'Limite — fique atento', classe: 'saudavel' };
  return { indicador: 'Atenção: CMV Alto / Alerta de Prejuízo', classe: 'alerta' };
}

// Propaga novo custo para todas as fichas confirmadas que usam o ingrediente
function propagarPreco(ingrediente_id) {
  const fichas = storage.listarFichas();
  const afetadas = [];
  for (const ficha of fichas) {
    if (!ficha.ingredientes.some(i => i.ingrediente_id === ingrediente_id)) continue;
    if (ficha.status === 'confirmado') {
      const resultado = calcularCMV(ficha);
      if (resultado.valido) {
        ficha.cmv_cache = resultado;
        ficha.ultima_atualizacao = new Date().toISOString();
      }
    }
    afetadas.push(ficha.nome);
  }
  storage.salvarTodasFichas(fichas);
  return afetadas;
}

module.exports = {
  CATEGORIAS_FIXAS,
  VENDAS_TIPOS,
  totalVendasMes,
  arredondar,
  calcularCustoBase,
  calcularRateioMes,
  validarFicha,
  calcularCMV,
  classificarCMV,
  propagarPreco,
  temPreco,
};
