'use strict';

// ═══════════════════════════════════════════════════════════════
// CAIXA DIÁRIO
// ───────────────────────────────────────────────────────────────
// Registra quanto ENTROU e quanto SAIU de dinheiro em cada dia.
// Resultado do dia = entradas − saídas → dia de lucro ou prejuízo.
// ═══════════════════════════════════════════════════════════════

const storage = require('./storage');
const { arredondar } = require('./cmv');

const CATEGORIAS = {
  entrada: ['Vendas no Balcão', 'Delivery / App', 'Outras Entradas'],
  saida: ['Compra de Insumos', 'Salários / Diárias', 'Contas (água, luz, gás)', 'Retirada do Dono', 'Outras Saídas'],
};

// Agrupa os lançamentos por dia dentro de uma competência (AAAA-MM).
// Se mês não for informado, usa o mês com lançamentos mais recente.
function resumoMensal(mes) {
  const todos = storage.listarLancamentos();

  // Descobre meses disponíveis (para o seletor do front)
  const mesesDisponiveis = [...new Set(todos.map(l => (l.data || '').slice(0, 7)))]
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a));

  const competencia = mes || mesesDisponiveis[0] || new Date().toISOString().slice(0, 7);
  const doMes = todos.filter(l => (l.data || '').startsWith(competencia));

  // Agrupa por dia
  const mapa = new Map();
  for (const l of doMes) {
    const dia = l.data;
    if (!mapa.has(dia)) mapa.set(dia, { data: dia, entradas: 0, saidas: 0, lancamentos: [] });
    const g = mapa.get(dia);
    const valor = Number(l.valor) || 0;
    if (l.tipo === 'entrada') g.entradas += valor;
    else g.saidas += valor;
    g.lancamentos.push(l);
  }

  const dias = [...mapa.values()].map(d => {
    d.entradas = arredondar(d.entradas, 2);
    d.saidas = arredondar(d.saidas, 2);
    d.resultado = arredondar(d.entradas - d.saidas, 2);
    d.lancamentos.sort((a, b) => (a.criado_em || '').localeCompare(b.criado_em || ''));
    return d;
  }).sort((a, b) => b.data.localeCompare(a.data)); // dia mais recente primeiro

  const total_entradas = arredondar(dias.reduce((s, d) => s + d.entradas, 0), 2);
  const total_saidas = arredondar(dias.reduce((s, d) => s + d.saidas, 0), 2);
  const resultado = arredondar(total_entradas - total_saidas, 2);

  return {
    competencia,
    meses_disponiveis: mesesDisponiveis,
    dias,
    resumo: {
      total_entradas,
      total_saidas,
      resultado,
      dias_lucro: dias.filter(d => d.resultado > 0).length,
      dias_prejuizo: dias.filter(d => d.resultado < 0).length,
      dias_registrados: dias.length,
    },
  };
}

module.exports = { CATEGORIAS, resumoMensal };
