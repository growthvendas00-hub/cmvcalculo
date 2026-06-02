'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const storage = require('../core/storage');
const cmvCore = require('../core/cmv');
const units = require('../core/units');
const estoqueCore = require('../core/estoque');
const caixaCore = require('../core/caixa');

// ═══════════════════════════════════════════════════════════════
// MÓDULO 1 — INGREDIENTES
// ═══════════════════════════════════════════════════════════════

router.get('/ingredientes', (req, res) => {
  res.json(storage.listarIngredientes());
});

// Cria ingrediente SEM preço (pendente) — usado pela lista padrão e cadastro rápido
router.post('/ingredientes/pendente', (req, res) => {
  const { nome, unidade_base } = req.body;
  if (!nome || !unidade_base) {
    return res.status(400).json({ erro: 'Informe nome e unidade base (g, ml ou un).' });
  }
  if (storage.buscarIngredientePorNome(nome)) {
    return res.status(409).json({ erro: `Ingrediente "${nome}" já existe.` });
  }
  const ingrediente = {
    id: uuidv4(),
    nome: nome.trim(),
    unidade_base,
    custo_base: 0,
    unidade_compra: null,
    historico: [],
    ultima_atualizacao: new Date().toISOString(),
  };
  storage.salvarIngrediente(ingrediente);
  res.status(201).json({ ingrediente, mensagem: 'Ingrediente criado (sem preço). Registre uma compra para definir o custo.' });
});

// Registra COMPRA (define/atualiza preço). Aceita ingrediente novo ou existente.
router.post('/ingredientes', (req, res) => {
  const { id, nome, unidade_compra, quantidade_comprada, valor_total, fornecedor } = req.body;

  if (!unidade_compra || !units.existeUnidade(unidade_compra)) {
    return res.status(400).json({ erro: 'Unidade de compra inválida (use kg, g, L, ml ou un).' });
  }
  const qtd = parseFloat(quantidade_comprada);
  const valor = parseFloat(valor_total);
  if (!(qtd > 0) || !(valor > 0)) {
    return res.status(400).json({ erro: 'Quantidade comprada e valor pago devem ser maiores que zero.' });
  }

  const custo_base = cmvCore.calcularCustoBase(valor, qtd, unidade_compra);
  const unidade_base = units.unidadeBase(unidade_compra);
  const fornecedorLimpo = (fornecedor || '').trim();
  if (fornecedorLimpo) storage.registrarFornecedor(fornecedorLimpo);

  const registro = {
    data: new Date().toISOString(),
    fornecedor: fornecedorLimpo || null,
    unidade_compra,
    quantidade_comprada: qtd,
    valor_total: valor,
    custo_base,
  };

  // Localiza por id (preferencial) ou por nome
  let existente = id ? storage.buscarIngredientePorId(id) : null;
  if (!existente && nome) existente = storage.buscarIngredientePorNome(nome);

  let ingrediente;
  let precoAlterado = false;

  if (existente) {
    precoAlterado = existente.custo_base !== custo_base;
    ingrediente = {
      ...existente,
      // não muda a unidade base de um ingrediente já usado em fichas; mantém a dimensão
      unidade_base: existente.unidade_base || unidade_base,
      custo_base,
      unidade_compra,
      historico: [...(existente.historico || []), registro],
      ultima_atualizacao: new Date().toISOString(),
    };
  } else {
    if (!nome) return res.status(400).json({ erro: 'Informe o nome do ingrediente.' });
    ingrediente = {
      id: uuidv4(),
      nome: nome.trim(),
      unidade_base,
      custo_base,
      unidade_compra,
      historico: [registro],
      ultima_atualizacao: new Date().toISOString(),
    };
    precoAlterado = true;
  }

  storage.salvarIngrediente(ingrediente);

  const fichas_atualizadas = precoAlterado ? cmvCore.propagarPreco(ingrediente.id) : [];

  // Entrada automática no estoque (toda compra que chega aumenta o estoque).
  // Pode ser desativada enviando lancar_estoque: false (ex.: só corrigir preço).
  let entrada_estoque = null;
  if (req.body.lancar_estoque !== false) {
    const r = estoqueCore.aplicarMovimento({
      ingrediente_id: ingrediente.id,
      tipo: 'entrada',
      quantidade: qtd,
      unidade: unidade_compra,
      motivo: fornecedorLimpo ? `Compra — ${fornecedorLimpo}` : 'Compra registrada',
    });
    if (!r.erro) { entrada_estoque = r.movimento; ingrediente = r.ingrediente; }
  }

  res.json({
    ingrediente,
    precoAlterado,
    fichas_atualizadas,
    entrada_estoque,
    mensagem: existente
      ? (precoAlterado
          ? `Preço atualizado. ${fichas_atualizadas.length ? 'CMVs recalculados: ' + fichas_atualizadas.join(', ') : ''}`
          : 'Compra registrada (mesmo preço anterior).')
      : 'Ingrediente cadastrado com sucesso.',
  });
});

// Editar nome / unidade base (sem nova compra)
router.put('/ingredientes/:id', (req, res) => {
  const ing = storage.buscarIngredientePorId(req.params.id);
  if (!ing) return res.status(404).json({ erro: 'Ingrediente não encontrado.' });

  const { nome, unidade_base } = req.body;
  if (nome) {
    const outro = storage.buscarIngredientePorNome(nome);
    if (outro && outro.id !== ing.id) {
      return res.status(409).json({ erro: `Já existe um ingrediente chamado "${nome}".` });
    }
    ing.nome = nome.trim();
  }
  if (unidade_base && units.existeUnidade(unidade_base)) ing.unidade_base = unidade_base;
  ing.ultima_atualizacao = new Date().toISOString();
  storage.salvarIngrediente(ing);
  res.json({ ingrediente: ing, mensagem: 'Ingrediente atualizado.' });
});

router.delete('/ingredientes/:id', (req, res) => {
  const emUso = storage.listarFichas()
    .filter(f => f.ingredientes.some(i => i.ingrediente_id === req.params.id))
    .map(f => f.nome);
  if (emUso.length > 0) {
    return res.status(409).json({ erro: `Ingrediente em uso nas fichas: ${emUso.join(', ')}. Remova-o dessas fichas antes de excluir.` });
  }
  storage.deletarIngrediente(req.params.id);
  res.json({ mensagem: 'Ingrediente excluído.' });
});

// ═══════════════════════════════════════════════════════════════
// MÓDULO 2 — FICHAS TÉCNICAS
// ═══════════════════════════════════════════════════════════════

router.get('/fichas', (req, res) => res.json(storage.listarFichas()));

router.get('/fichas/:id', (req, res) => {
  const ficha = storage.buscarFichaPorId(req.params.id);
  if (!ficha) return res.status(404).json({ erro: 'Ficha não encontrada.' });
  res.json(ficha);
});

function montarFicha(body) {
  return {
    nome: (body.nome || '').trim(),
    tipo: body.tipo || 'hamburguer',
    preco_venda: parseFloat(body.preco_venda) || 0,
    custo_embalagem: parseFloat(body.custo_embalagem || 0),
    incluir_rateio: !!body.incluir_rateio,
    ingredientes: (body.ingredientes || []).map(i => ({
      ingrediente_id: i.ingrediente_id,
      quantidade: parseFloat(i.quantidade) || 0,
      fator_correcao: parseFloat(i.fator_correcao || 1.0),
    })),
  };
}

router.post('/fichas', (req, res) => {
  const dados = montarFicha(req.body);
  if (!dados.nome || !dados.preco_venda) {
    return res.status(400).json({ erro: 'Informe o nome do produto e o preço de venda.' });
  }
  const ficha = {
    id: uuidv4(),
    ...dados,
    status: 'rascunho',
    cmv_cache: null,
    criado_em: new Date().toISOString(),
    ultima_atualizacao: new Date().toISOString(),
  };
  storage.salvarFicha(ficha);
  res.status(201).json({ ficha, mensagem: 'Ficha criada em rascunho.' });
});

router.put('/fichas/:id', (req, res) => {
  const ficha = storage.buscarFichaPorId(req.params.id);
  if (!ficha) return res.status(404).json({ erro: 'Ficha não encontrada.' });
  Object.assign(ficha, montarFicha(req.body), {
    status: 'rascunho',
    cmv_cache: null,
    ultima_atualizacao: new Date().toISOString(),
  });
  storage.salvarFicha(ficha);
  res.json({ ficha, mensagem: 'Ficha atualizada e retornada para rascunho.' });
});

router.post('/fichas/:id/confirmar', (req, res) => {
  const ficha = storage.buscarFichaPorId(req.params.id);
  if (!ficha) return res.status(404).json({ erro: 'Ficha não encontrada.' });

  const resultado = cmvCore.calcularCMV(ficha);
  if (!resultado.valido) return res.status(422).json({ erros: resultado.erros });

  ficha.status = 'confirmado';
  ficha.cmv_cache = resultado;
  ficha.ultima_atualizacao = new Date().toISOString();
  storage.salvarFicha(ficha);
  res.json({ ficha, cmv: resultado, mensagem: 'Ficha confirmada e CMV oficializado.' });
});

router.post('/fichas/:id/rascunho', (req, res) => {
  const ficha = storage.buscarFichaPorId(req.params.id);
  if (!ficha) return res.status(404).json({ erro: 'Ficha não encontrada.' });
  ficha.status = 'rascunho';
  ficha.cmv_cache = null;
  ficha.ultima_atualizacao = new Date().toISOString();
  storage.salvarFicha(ficha);
  res.json({ ficha, mensagem: 'Ficha revertida para rascunho.' });
});

router.delete('/fichas/:id', (req, res) => {
  storage.deletarFicha(req.params.id);
  res.json({ mensagem: 'Ficha excluída.' });
});

// ═══════════════════════════════════════════════════════════════
// MÓDULO 3 — RELATÓRIO / PREVIEW
// ═══════════════════════════════════════════════════════════════

router.get('/fichas/:id/cmv', (req, res) => {
  const ficha = storage.buscarFichaPorId(req.params.id);
  if (!ficha) return res.status(404).json({ erro: 'Ficha não encontrada.' });
  res.json(cmvCore.calcularCMV(ficha));
});

router.get('/relatorio', (req, res) => {
  const fichas = storage.listarFichas().filter(f => f.status === 'confirmado');
  const relatorio = fichas.map(f => ({
    id: f.id, nome: f.nome, tipo: f.tipo, preco_venda: f.preco_venda,
    cmv: f.cmv_cache, ultima_atualizacao: f.ultima_atualizacao,
  }));
  const cmvs = relatorio.filter(r => r.cmv?.valido).map(r => r.cmv.cmv_percentual);
  const cmv_medio = cmvs.length ? cmvCore.arredondar(cmvs.reduce((a, b) => a + b, 0) / cmvs.length, 2) : null;
  res.json({ relatorio, cmv_medio, total_produtos: relatorio.length });
});

// ═══════════════════════════════════════════════════════════════
// MÓDULO 4 — CUSTOS FIXOS MENSAIS
// ═══════════════════════════════════════════════════════════════

function enriquecerMes(mes) {
  return { ...mes, ...cmvCore.calcularRateioMes(mes) };
}

router.get('/custos-fixos', (req, res) => {
  const meses = storage.listarMeses().map(enriquecerMes);
  res.json({ meses, mes_ativo: meses[0] || null });
});

router.get('/custos-fixos/:id', (req, res) => {
  const mes = storage.buscarMesPorId(req.params.id);
  if (!mes) return res.status(404).json({ erro: 'Mês não encontrado.' });
  res.json(enriquecerMes(mes));
});

router.post('/custos-fixos', (req, res) => {
  const { competencia } = req.body;
  if (!competencia || !/^\d{4}-\d{2}$/.test(competencia)) {
    return res.status(400).json({ erro: 'Informe a competência no formato AAAA-MM (ex: 2026-06).' });
  }
  if (storage.buscarMesPorCompetencia(competencia)) {
    return res.status(409).json({ erro: `Já existe um registro para ${competencia}. Edite o mês existente.` });
  }
  const mes = { id: uuidv4(), competencia, criado_em: new Date().toISOString() };
  cmvCore.CATEGORIAS_FIXAS.forEach(c => { mes[c] = parseFloat(req.body[c]) || 0; });
  mes.vendas_mes = parseFloat(req.body.vendas_mes) || 0;
  mes.ultima_atualizacao = new Date().toISOString();
  storage.salvarMes(mes);
  res.status(201).json({ mes: enriquecerMes(mes), mensagem: `Mês ${competencia} criado.` });
});

router.put('/custos-fixos/:id', (req, res) => {
  const mes = storage.buscarMesPorId(req.params.id);
  if (!mes) return res.status(404).json({ erro: 'Mês não encontrado.' });
  cmvCore.CATEGORIAS_FIXAS.forEach(c => {
    if (req.body[c] !== undefined) mes[c] = parseFloat(req.body[c]) || 0;
  });
  if (req.body.vendas_mes !== undefined) mes.vendas_mes = parseFloat(req.body.vendas_mes) || 0;
  mes.ultima_atualizacao = new Date().toISOString();
  storage.salvarMes(mes);

  // Recalcula fichas confirmadas que usam rateio (custo fixo mudou)
  const fichas = storage.listarFichas();
  let recalc = 0;
  for (const f of fichas) {
    if (f.status === 'confirmado' && f.incluir_rateio) {
      const r = cmvCore.calcularCMV(f);
      if (r.valido) { f.cmv_cache = r; f.ultima_atualizacao = new Date().toISOString(); recalc++; }
    }
  }
  if (recalc > 0) storage.salvarTodasFichas(fichas);

  res.json({ mes: enriquecerMes(mes), fichas_recalculadas: recalc, mensagem: 'Custos do mês salvos.' });
});

router.delete('/custos-fixos/:id', (req, res) => {
  storage.deletarMes(req.params.id);
  res.json({ mensagem: 'Mês excluído.' });
});

// ═══════════════════════════════════════════════════════════════
// MÓDULO 5 — COMPRAS E FORNECEDORES
// ═══════════════════════════════════════════════════════════════

router.get('/fornecedores', (req, res) => {
  res.json(storage.listarFornecedores());
});

// Análise comparativa por ingrediente (para negociar preço)
router.get('/compras/analise', (req, res) => {
  const ingredientes = storage.listarIngredientes()
    .filter(i => Array.isArray(i.historico) && i.historico.length > 0);

  const analise = ingredientes.map(ing => {
    // ordena por data crescente
    const hist = ing.historico.slice().sort((a, b) => new Date(a.data) - new Date(b.data));
    const ultimo = hist[hist.length - 1];
    const anterior = hist.length > 1 ? hist[hist.length - 2] : null;
    const melhor = hist.reduce((m, r) => (r.custo_base < m.custo_base ? r : m), hist[0]);
    const ultimos3 = hist.slice(-3).reverse(); // mais recente primeiro

    let variacao = null;
    if (anterior && anterior.custo_base > 0) {
      variacao = cmvCore.arredondar(((ultimo.custo_base / anterior.custo_base) - 1) * 100, 1);
    }
    const alerta = anterior ? ultimo.custo_base > anterior.custo_base * 1.05 : false;
    // economia possível se voltar ao melhor preço já pago
    const acima_do_melhor = melhor.custo_base > 0
      ? cmvCore.arredondar(((ultimo.custo_base / melhor.custo_base) - 1) * 100, 1) : 0;

    return {
      id: ing.id,
      nome: ing.nome,
      unidade_base: ing.unidade_base,
      total_compras: hist.length,
      ultimo,
      anterior,
      melhor,
      ultimos3,
      variacao,
      alerta,
      acima_do_melhor,
    };
  });

  // ordena: itens com alerta primeiro, depois por nome
  analise.sort((a, b) => (b.alerta - a.alerta) || a.nome.localeCompare(b.nome, 'pt-BR'));

  const alertas = analise.filter(a => a.alerta).length;
  res.json({ analise, total_itens: analise.length, alertas });
});

// ═══════════════════════════════════════════════════════════════
// MÓDULO 6 — CONTROLE DE ESTOQUE
// ═══════════════════════════════════════════════════════════════

// Panorama geral: itens, valor total parado e lista de compras
router.get('/estoque', (req, res) => {
  res.json(estoqueCore.panorama());
});

// Histórico de movimentações (todas ou de um ingrediente)
router.get('/estoque/movimentos', (req, res) => {
  const { ingrediente_id } = req.query;
  const movs = ingrediente_id
    ? storage.listarMovimentosPorIngrediente(ingrediente_id)
    : storage.listarMovimentos().sort((a, b) => new Date(b.data) - new Date(a.data));
  res.json(movs);
});

// Registra um movimento (entrada / saida / ajuste)
router.post('/estoque/movimento', (req, res) => {
  const { ingrediente_id, tipo, quantidade, unidade, motivo } = req.body;
  if (!ingrediente_id) return res.status(400).json({ erro: 'Informe o ingrediente.' });
  const r = estoqueCore.aplicarMovimento({ ingrediente_id, tipo, quantidade, unidade, motivo });
  if (r.erro) return res.status(400).json({ erro: r.erro });
  const rotulos = { entrada: 'Entrada', saida: 'Baixa', ajuste: 'Ajuste de inventário' };
  res.json({
    ingrediente: r.ingrediente,
    movimento: r.movimento,
    mensagem: `${rotulos[tipo]} registrada para "${r.ingrediente.nome}".`,
  });
});

// Define o estoque mínimo (ponto de reposição) de um ingrediente.
// Aceita a quantidade na unidade informada e converte para a base.
router.put('/estoque/:id/minimo', (req, res) => {
  const ing = storage.buscarIngredientePorId(req.params.id);
  if (!ing) return res.status(404).json({ erro: 'Ingrediente não encontrado.' });
  const qtd = parseFloat(req.body.minimo);
  if (!(qtd >= 0)) return res.status(400).json({ erro: 'Mínimo inválido.' });
  const un = req.body.unidade || ing.unidade_base;
  if (!units.existeUnidade(un) || units.unidadeBase(un) !== ing.unidade_base) {
    return res.status(400).json({ erro: `Unidade incompatível com "${ing.nome}".` });
  }
  ing.estoque_minimo = cmvCore.arredondar(units.paraBase(qtd, un), 3);
  ing.ultima_atualizacao = new Date().toISOString();
  storage.salvarIngrediente(ing);
  res.json({ ingrediente: ing, mensagem: 'Estoque mínimo atualizado.' });
});

// ═══════════════════════════════════════════════════════════════
// MÓDULO 7 — CAIXA DIÁRIO (ENTRADAS E SAÍDAS)
// ═══════════════════════════════════════════════════════════════

router.get('/caixa/categorias', (req, res) => {
  res.json(caixaCore.CATEGORIAS);
});

router.get('/caixa', (req, res) => {
  res.json(caixaCore.resumoMensal(req.query.mes));
});

router.post('/caixa', (req, res) => {
  const { data, tipo, categoria, descricao, valor } = req.body;
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return res.status(400).json({ erro: 'Informe a data (AAAA-MM-DD).' });
  }
  if (!['entrada', 'saida'].includes(tipo)) {
    return res.status(400).json({ erro: 'Tipo deve ser "entrada" ou "saida".' });
  }
  const v = parseFloat(valor);
  if (!(v > 0)) return res.status(400).json({ erro: 'O valor deve ser maior que zero.' });

  const lanc = {
    id: uuidv4(),
    data,
    tipo,
    categoria: (categoria || '').trim() || (tipo === 'entrada' ? 'Outras Entradas' : 'Outras Saídas'),
    descricao: (descricao || '').trim() || null,
    valor: cmvCore.arredondar(v, 2),
    criado_em: new Date().toISOString(),
  };
  storage.salvarLancamento(lanc);
  res.status(201).json({ lancamento: lanc, mensagem: 'Lançamento registrado.' });
});

router.delete('/caixa/:id', (req, res) => {
  if (!storage.buscarLancamentoPorId(req.params.id)) {
    return res.status(404).json({ erro: 'Lançamento não encontrado.' });
  }
  storage.deletarLancamento(req.params.id);
  res.json({ mensagem: 'Lançamento excluído.' });
});

module.exports = router;
