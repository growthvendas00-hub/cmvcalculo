'use strict';

// ═══════════════════════════════════════════════════════════════
// AUDITORIA TÉCNICA DO SISTEMA
// ───────────────────────────────────────────────────────────────
// Varre ingredientes, fichas, estoque e custos atrás de erros de
// LÓGICA e de MODELAGEM — não erros de digitação, mas combinações
// que produzem números errados sem o usuário perceber.
//
// O caso clássico (que originou este módulo): comprar por LATA mas
// usar por GRAMA. Se o item ficou cadastrado em "un" (lata) e a ficha
// pede "30", o sistema entende 30 latas. A auditoria detecta esse e
// outros padrões e sugere a correção exata.
//
// Severidades:
//   critico → conta errada AGORA / cálculo bloqueado. Resolver já.
//   aviso   → provável erro de modelagem. Conferir.
//   info    → higiene de dados / oportunidade. Opcional.
// ═══════════════════════════════════════════════════════════════

const storage = require('./storage');
const units = require('./units');
const cmv = require('./cmv');

// Custo máximo plausível por unidade "amigável" (kg / L / un). Acima disso,
// quase sempre é erro de unidade (ex.: lata inteira lançada como 1 unidade).
const LIMITE_CUSTO_EXIB = { g: 500, ml: 300, un: 250 };
// Usar mais de N "un" de um item numa ficha sugere que ele deveria ser g/ml.
const QTD_UN_SUSPEITA = 10;
// Fator de correção fora desta faixa é quase sempre engano.
const FATOR_MIN = 1.0;
const FATOR_MAX = 3.0;

function ex(custoBase, base) {
  const e = units.UNIDADE_EXIBICAO[base] || { unidade: base, fator: 1 };
  return { valor: custoBase * e.fator, unidade: e.unidade };
}

function problema(severidade, categoria, titulo, detalhe, opts = {}) {
  return Object.assign({
    severidade, categoria, titulo, detalhe,
    alvo: opts.alvo || null,        // { tipo:'ingrediente'|'ficha'|'mes'|'estoque', id, nome }
    sugestao: opts.sugestao || null,
    acao: opts.acao || null,        // chave de correção automática segura, se houver
  });
}

// ─── A auditoria propriamente dita ──────────────────────────────
function executar() {
  const ingredientes = storage.listarIngredientes();
  const fichas = storage.listarFichas();
  const movimentos = storage.listarMovimentos();
  const meses = storage.listarMeses();

  const mapIng = new Map(ingredientes.map(i => [i.id, i]));
  const problemas = [];

  // Índice: ingrediente_id → fichas que o usam (com a quantidade pedida)
  const usoEmFichas = new Map();
  for (const f of fichas) {
    for (const item of (f.ingredientes || [])) {
      if (!usoEmFichas.has(item.ingrediente_id)) usoEmFichas.set(item.ingrediente_id, []);
      usoEmFichas.get(item.ingrediente_id).push({ ficha: f, item });
    }
  }

  // ───────────────────────────── INGREDIENTES ─────────────────────────────
  const vistos = new Map(); // nome normalizado → primeiro id (detecta duplicados)
  for (const ing of ingredientes) {
    const alvo = { tipo: 'ingrediente', id: ing.id, nome: ing.nome };
    const usos = usoEmFichas.get(ing.id) || [];
    const emFichaConfirmada = usos.some(u => u.ficha.status === 'confirmado');

    // 1) Unidade base inválida (corrompe todos os cálculos do item)
    if (!['g', 'ml', 'un'].includes(ing.unidade_base)) {
      problemas.push(problema('critico', 'Unidade',
        `"${ing.nome}" com unidade de uso inválida`,
        `A unidade de uso é "${ing.unidade_base}", mas só valem g, ml ou un. Edite o ingrediente.`,
        { alvo }));
    }

    // 2) Sem preço
    if (!(Number(ing.custo_base) > 0)) {
      if (emFichaConfirmada) {
        problemas.push(problema('critico', 'Preço',
          `"${ing.nome}" sem preço, mas usado em ficha confirmada`,
          `Aparece em: ${usos.filter(u => u.ficha.status === 'confirmado').map(u => u.ficha.nome).join(', ')}. O CMV dessas fichas está incorreto. Registre uma compra para definir o custo.`,
          { alvo, sugestao: 'Aba Ingredientes → Registrar Preço.' }));
      } else {
        problemas.push(problema('aviso', 'Preço',
          `"${ing.nome}" ainda sem preço`,
          'Sem custo definido, ele não entra no valor do estoque nem pode ser usado numa ficha confirmada.',
          { alvo, sugestao: 'Registre uma compra quando for usar.' }));
      }
    }

    // 3) Embalagem inconsistente (o erro técnico central: lata/caixa mal modelada)
    if (ing.embalagem) {
      const emb = ing.embalagem;
      const conteudoBase = units.conteudoBaseEmbalagem(emb);
      if (!(conteudoBase > 0)) {
        problemas.push(problema('critico', 'Embalagem',
          `Embalagem de "${ing.nome}" sem conteúdo válido`,
          `A embalagem "${emb.nome || '—'}" não tem um conteúdo > 0 (ex.: 1 lata = 340 g). Sem isso, contar por embalagem dá zero.`,
          { alvo, sugestao: 'Editar ingrediente → informe o conteúdo da embalagem.' }));
      } else if (!units.existeUnidade(emb.unidade) || units.unidadeBase(emb.unidade) !== ing.unidade_base) {
        problemas.push(problema('critico', 'Embalagem',
          `Embalagem de "${ing.nome}" em unidade incompatível`,
          `O item é usado em ${ing.unidade_base}, mas a embalagem está em "${emb.unidade}". As conversões (estoque, contagem, baixa por embalagem) ficam erradas.`,
          { alvo, sugestao: `Editar ingrediente → o conteúdo da embalagem deve ser em ${ing.unidade_base}.` }));
      }
    }

    // 4) Custo por unidade implausível → quase sempre erro de unidade (lata inteira)
    if (Number(ing.custo_base) > 0) {
      const limite = LIMITE_CUSTO_EXIB[ing.unidade_base];
      const e = ex(ing.custo_base, ing.unidade_base);
      const flagar = limite && e.valor > limite && (ing.unidade_base !== 'un' || usos.length > 0);
      if (flagar) {
        problemas.push(problema('aviso', 'Custo suspeito',
          `Custo muito alto em "${ing.nome}": ${moeda(e.valor)}/${e.unidade}`,
          ing.unidade_base === 'un'
            ? `Cada unidade está custando ${moeda(e.valor)}. Se você compra um pacote/lata e usa por grama, cadastre por embalagem (1 lata = X g) — assim a ficha não cobra a embalagem inteira.`
            : `${moeda(e.valor)} por ${e.unidade} está acima do esperado. Confira se o valor pago e a quantidade da última compra estão certos.`,
          { alvo, sugestao: 'Aba Ingredientes → Nova Compra (revise valor e quantidade) ou use "Por embalagem".' }));
      }
    }

    // 5) "un" usado em quantidade alta numa ficha → deveria ser g/ml (padrão milho/lata)
    if (ing.unidade_base === 'un') {
      const exagerado = usos.filter(u => Number(u.item.quantidade) > QTD_UN_SUSPEITA);
      if (exagerado.length) {
        problemas.push(problema('aviso', 'Modelagem',
          `"${ing.nome}" é medido em "un", mas uma ficha pede ${maiorQtd(exagerado)} un`,
          `Usar dezenas de "unidades" numa receita normalmente significa que o certo seria medir por grama/ml. Fichas: ${exagerado.map(u => u.ficha.nome).join(', ')}. Esse é o erro clássico de "lata contada inteira".`,
          { alvo, sugestao: 'Mude a unidade de uso para g/ml e cadastre a compra "Por embalagem" (1 lata = X g).' }));
      }
    }

    // 6) Duplicidade de nome (confunde busca do WhatsApp e pode duplicar estoque)
    const chave = (ing.nome || '').trim().toLowerCase();
    if (chave) {
      if (vistos.has(chave)) {
        problemas.push(problema('aviso', 'Duplicado',
          `Ingrediente duplicado: "${ing.nome}"`,
          'Há dois ingredientes com o mesmo nome. Isso divide o estoque e confunde os comandos do WhatsApp.',
          { alvo, sugestao: 'Renomeie um deles ou una as compras num só item.' }));
      } else {
        vistos.set(chave, ing.id);
      }
    }

    // 7) Estoque negativo (não deveria acontecer — indica corrupção)
    if (Number(ing.estoque_atual) < 0) {
      problemas.push(problema('critico', 'Estoque',
        `Estoque negativo em "${ing.nome}"`,
        `O estoque está em ${ing.estoque_atual} ${ing.unidade_base}. Faça uma contagem para corrigir.`,
        { alvo }));
    }
  }

  // ───────────────────────────── FICHAS ─────────────────────────────
  for (const f of fichas) {
    const alvo = { tipo: 'ficha', id: f.id, nome: f.nome };

    // 8) Ingrediente removido ainda referenciado
    const fantasmas = (f.ingredientes || []).filter(i => !mapIng.has(i.ingrediente_id));
    if (fantasmas.length) {
      problemas.push(problema('critico', 'Ficha',
        `"${f.nome}" usa ingrediente(s) que não existem mais`,
        `${fantasmas.length} item(ns) da ficha apontam para ingredientes excluídos. O CMV não fecha.`,
        { alvo, sugestao: 'Edite a ficha e remova/substitua os itens órfãos.' }));
    }

    // 9) Fator de correção fora da faixa sã
    for (const item of (f.ingredientes || [])) {
      const fator = Number(item.fator_correcao);
      if (item.fator_correcao !== undefined && (fator < FATOR_MIN || fator > FATOR_MAX)) {
        const ing = mapIng.get(item.ingrediente_id);
        problemas.push(problema('aviso', 'Ficha',
          `Fator de correção estranho em "${f.nome}"`,
          `${ing ? ing.nome : 'Um item'} está com fator ${fator}. O normal fica entre ${FATOR_MIN.toFixed(2)} e ${FATOR_MAX.toFixed(2)} (1,00 = sem perda).`,
          { alvo }));
        break;
      }
    }

    // Cálculo ao vivo (serve para 3 checagens)
    const vivo = cmv.calcularCMV(f);

    // 10) Ficha confirmada vendendo no prejuízo
    if (f.status === 'confirmado' && vivo.valido) {
      if (vivo.custo_total >= vivo.preco_venda) {
        problemas.push(problema('critico', 'Prejuízo',
          `"${f.nome}" custa mais do que vende`,
          `Custo total ${moeda(vivo.custo_total)} ≥ preço de venda ${moeda(vivo.preco_venda)}. Cada venda dá prejuízo.`,
          { alvo, sugestao: 'Reveja o preço de venda ou os ingredientes.' }));
      } else if (vivo.cmv_percentual < 8) {
        problemas.push(problema('aviso', 'CMV suspeito',
          `CMV de "${f.nome}" baixíssimo (${vivo.cmv_percentual}%)`,
          'Um CMV abaixo de 8% costuma indicar quantidade/preço de ingrediente errado (faltando custo). Confira a ficha.',
          { alvo }));
      } else if (vivo.cmv_percentual > 60) {
        problemas.push(problema('aviso', 'CMV suspeito',
          `CMV de "${f.nome}" altíssimo (${vivo.cmv_percentual}%)`,
          'Acima de 60% quase sempre é erro de unidade (item contado inteiro) ou preço de venda baixo demais.',
          { alvo }));
      }
    }

    // 11) CMV oficial (cache) desatualizado em relação ao cálculo atual
    if (f.status === 'confirmado' && vivo.valido && f.cmv_cache && f.cmv_cache.valido) {
      const dif = Math.abs((f.cmv_cache.cmv_percentual || 0) - vivo.cmv_percentual);
      if (dif >= 0.5) {
        problemas.push(problema('aviso', 'Desatualizado',
          `CMV oficial de "${f.nome}" está defasado`,
          `O CMV salvo é ${f.cmv_cache.cmv_percentual}% mas o cálculo atual dá ${vivo.cmv_percentual}% (preço de ingrediente mudou). Reconfirme para atualizar.`,
          { alvo, acao: 'reconfirmar_fichas',
            sugestao: 'Use "Corrigir" para recalcular automaticamente todas as fichas defasadas.' }));
      }
    }

    // 12) Ficha confirmada mas inválida (não deveria existir, mas verificamos)
    if (f.status === 'confirmado' && !vivo.valido) {
      problemas.push(problema('critico', 'Ficha',
        `"${f.nome}" está confirmada mas não calcula`,
        `Motivos: ${(vivo.erros || []).join(' / ')}`,
        { alvo, sugestao: 'Volte para rascunho, corrija e confirme de novo.' }));
    }
  }

  // ───────────────────────────── ESTOQUE × LOG ─────────────────────────────
  // 13) Divergência entre estoque atual e o último movimento registrado.
  const ultimoMov = new Map();
  for (const m of movimentos) {
    const at = ultimoMov.get(m.ingrediente_id);
    if (!at || new Date(m.data) >= new Date(at.data)) ultimoMov.set(m.ingrediente_id, m);
  }
  let divergencias = 0;
  for (const ing of ingredientes) {
    const m = ultimoMov.get(ing.id);
    if (!m) continue;
    const atual = Number(ing.estoque_atual) || 0;
    const log = Number(m.estoque_depois) || 0;
    if (Math.abs(atual - log) > 0.001) divergencias++;
  }
  if (divergencias > 0) {
    problemas.push(problema('aviso', 'Estoque',
      `${divergencias} item(ns) com estoque fora de sincronia com o histórico`,
      'O estoque atual não bate com o último movimento registrado (pode vir de uma mudança de unidade antiga). O histórico/foto por data fica impreciso.',
      { acao: 'sincronizar_estoque',
        sugestao: 'Use "Corrigir" para registrar um ajuste e realinhar o histórico ao estoque atual.' }));
  }

  // 14) Movimentos órfãos (ingrediente já excluído)
  const orfaos = movimentos.filter(m => !mapIng.has(m.ingrediente_id));
  if (orfaos.length) {
    problemas.push(problema('info', 'Higiene',
      `${orfaos.length} movimento(s) de itens já excluídos`,
      'São registros de estoque de ingredientes que não existem mais. Não afetam os cálculos atuais, mas poluem o histórico.',
      { acao: 'limpar_movimentos_orfaos',
        sugestao: 'Use "Corrigir" para remover esses registros antigos.' }));
  }

  // ───────────────────────────── CUSTOS FIXOS ─────────────────────────────
  for (const mes of meses) {
    const r = cmv.calcularRateioMes(mes);
    if (r.total_mensal > 0 && r.vendas_mes === 0) {
      problemas.push(problema('info', 'Custos Fixos',
        `Mês ${mes.competencia}: custos lançados sem vendas`,
        `Há ${moeda(r.total_mensal)} de custos fixos, mas 0 produtos vendidos no mês. O rateio por produto não pode ser calculado.`,
        { alvo: { tipo: 'mes', id: mes.id, nome: mes.competencia },
          sugestao: 'Aba Custos Fixos → informe as vendas do mês (quantidade).' }));
    }
  }

  // ─── Resumo ───
  const resumo = {
    total: problemas.length,
    criticos: problemas.filter(p => p.severidade === 'critico').length,
    avisos: problemas.filter(p => p.severidade === 'aviso').length,
    infos: problemas.filter(p => p.severidade === 'info').length,
    verificado_em: new Date().toISOString(),
    contagens: {
      ingredientes: ingredientes.length,
      fichas: fichas.length,
      movimentos: movimentos.length,
    },
  };

  // Ordena: crítico → aviso → info
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
        if (antes !== r.cmv_percentual) {
          f.cmv_cache = r;
          f.ultima_atualizacao = new Date().toISOString();
          n++;
        }
      }
    }
    if (n > 0) storage.salvarTodasFichas(fichas);
    return { ok: true, corrigidos: n, mensagem: `${n} ficha(s) recalculada(s) e atualizada(s).` };
  }

  if (acao === 'limpar_movimentos_orfaos') {
    const ingredientes = storage.listarIngredientes();
    const ids = new Set(ingredientes.map(i => i.id));
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
          id: uuidv4(),
          ingrediente_id: ing.id,
          ingrediente_nome: ing.nome,
          tipo: 'ajuste',
          quantidade_base: cmv.arredondar(atual - log, 3),
          unidade_base: ing.unidade_base,
          estoque_antes: log,
          estoque_depois: atual,
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

// ─── utilidades ───
function moeda(v) {
  return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function maiorQtd(usos) {
  return Math.max(...usos.map(u => Number(u.item.quantidade) || 0));
}

module.exports = { executar, corrigir };
