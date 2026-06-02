'use strict';

const fs = require('fs');
const path = require('path');

// No Vercel o filesystem é somente-leitura; usamos /tmp para escrita.
// Localmente usamos a pasta /data do projeto.
const IS_VERCEL = !!process.env.VERCEL;
const DATA_DIR = IS_VERCEL
  ? path.join('/tmp', 'cmv-data')
  : path.join(__dirname, '..', '..', 'data');

// Garante que o diretório existe (necessário na primeira execução no Vercel)
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const INGREDIENTES_FILE  = path.join(DATA_DIR, 'ingredientes.json');
const FICHAS_FILE        = path.join(DATA_DIR, 'fichas.json');
const CUSTOS_FILE        = path.join(DATA_DIR, 'custos_fixos.json');
const FORNECEDORES_FILE  = path.join(DATA_DIR, 'fornecedores.json');
const MOVIMENTOS_FILE    = path.join(DATA_DIR, 'movimentos_estoque.json');
const CONTAGENS_FILE     = path.join(DATA_DIR, 'contagens.json');
const CAIXA_FILE         = path.join(DATA_DIR, 'caixa.json');

// No Vercel, copia os arquivos iniciais para /tmp se ainda não existirem
if (IS_VERCEL) {
  const SEED_DIR = path.join(__dirname, '..', '..', 'data');
  const PADROES = {
    'custos_fixos.json': '{"meses":[]}',
    'caixa.json': '{"lancamentos":[]}',
    'contagens.json': '{"contagens":[]}',
  };
  ['ingredientes.json','fichas.json','custos_fixos.json','fornecedores.json','movimentos_estoque.json','contagens.json','caixa.json'].forEach(f => {
    const dest = path.join(DATA_DIR, f);
    if (!fs.existsSync(dest)) {
      try { fs.copyFileSync(path.join(SEED_DIR, f), dest); } catch { fs.writeFileSync(dest, PADROES[f] || '[]'); }
    }
  });
}

// Lê JSON removendo BOM (alguns editores/PowerShell gravam UTF-8 com BOM)
function lerJSON(caminho, padrao) {
  try {
    const conteudo = fs.readFileSync(caminho, 'utf-8').replace(/^﻿/, '').trim();
    if (!conteudo) return padrao;
    return JSON.parse(conteudo);
  } catch {
    return padrao;
  }
}

function salvarJSON(caminho, dados) {
  fs.writeFileSync(caminho, JSON.stringify(dados, null, 2), 'utf-8');
}

// ─── Ingredientes ─────────────────────────────────────────────────────────────

function listarIngredientes() {
  return lerJSON(INGREDIENTES_FILE, []);
}

function buscarIngredientePorId(id) {
  return listarIngredientes().find(i => i.id === id) || null;
}

function buscarIngredientePorNome(nome) {
  const alvo = nome.trim().toLowerCase();
  return listarIngredientes().find(i => i.nome.toLowerCase() === alvo) || null;
}

function salvarIngrediente(ingrediente) {
  const lista = listarIngredientes();
  const idx = lista.findIndex(i => i.id === ingrediente.id);
  if (idx >= 0) lista[idx] = ingrediente;
  else lista.push(ingrediente);
  salvarJSON(INGREDIENTES_FILE, lista);
}

function deletarIngrediente(id) {
  salvarJSON(INGREDIENTES_FILE, listarIngredientes().filter(i => i.id !== id));
}

// ─── Fichas Técnicas ──────────────────────────────────────────────────────────

function listarFichas() {
  return lerJSON(FICHAS_FILE, []);
}

function buscarFichaPorId(id) {
  return listarFichas().find(f => f.id === id) || null;
}

function salvarFicha(ficha) {
  const lista = listarFichas();
  const idx = lista.findIndex(f => f.id === ficha.id);
  if (idx >= 0) lista[idx] = ficha;
  else lista.push(ficha);
  salvarJSON(FICHAS_FILE, lista);
}

function salvarTodasFichas(fichas) {
  salvarJSON(FICHAS_FILE, fichas);
}

function deletarFicha(id) {
  salvarJSON(FICHAS_FILE, listarFichas().filter(f => f.id !== id));
}

// ─── Custos Fixos Mensais ─────────────────────────────────────────────────────
// Estrutura: { meses: [ { id, competencia:"2026-06", aluguel, energia, ... } ] }

function listarMeses() {
  const dados = lerJSON(CUSTOS_FILE, { meses: [] });
  const meses = Array.isArray(dados.meses) ? dados.meses : [];
  // ordena do mais recente para o mais antigo
  return meses.slice().sort((a, b) => (b.competencia || '').localeCompare(a.competencia || ''));
}

function buscarMesPorId(id) {
  return listarMeses().find(m => m.id === id) || null;
}

function buscarMesPorCompetencia(competencia) {
  return listarMeses().find(m => m.competencia === competencia) || null;
}

function salvarMes(mes) {
  const meses = listarMeses();
  const idx = meses.findIndex(m => m.id === mes.id);
  if (idx >= 0) meses[idx] = mes;
  else meses.push(mes);
  salvarJSON(CUSTOS_FILE, { meses });
}

function deletarMes(id) {
  salvarJSON(CUSTOS_FILE, { meses: listarMeses().filter(m => m.id !== id) });
}

// Mês mais recente cadastrado (usado como base para o rateio das fichas)
function mesMaisRecente() {
  const meses = listarMeses();
  return meses.length ? meses[0] : null;
}

// ─── Fornecedores (lista de contatos) ─────────────────────────────────────────

function listarFornecedores() {
  return lerJSON(FORNECEDORES_FILE, []);
}

// Salva fornecedor se for novo (case-insensitive). Retorna a lista atualizada.
function registrarFornecedor(nome) {
  if (!nome || !nome.trim()) return listarFornecedores();
  const limpo = nome.trim();
  const lista = listarFornecedores();
  if (!lista.some(f => f.toLowerCase() === limpo.toLowerCase())) {
    lista.push(limpo);
    lista.sort((a, b) => a.localeCompare(b, 'pt-BR'));
    salvarJSON(FORNECEDORES_FILE, lista);
  }
  return listarFornecedores();
}

// ─── Movimentações de Estoque (histórico de entradas/saídas/ajustes) ──────────

function listarMovimentos() {
  return lerJSON(MOVIMENTOS_FILE, []);
}

function listarMovimentosPorIngrediente(ingrediente_id) {
  return listarMovimentos()
    .filter(m => m.ingrediente_id === ingrediente_id)
    .sort((a, b) => new Date(b.data) - new Date(a.data));
}

function salvarMovimento(mov) {
  const lista = listarMovimentos();
  lista.push(mov);
  salvarJSON(MOVIMENTOS_FILE, lista);
}

// ─── Contagens de Estoque (inventário inicial + conferências diárias) ─────────

function listarContagens() {
  const dados = lerJSON(CONTAGENS_FILE, { contagens: [] });
  const lista = Array.isArray(dados.contagens) ? dados.contagens : [];
  return lista.slice().sort((a, b) => new Date(b.data) - new Date(a.data));
}

function salvarContagem(contagem) {
  const lista = listarContagens();
  lista.push(contagem);
  salvarJSON(CONTAGENS_FILE, { contagens: lista });
}

function ultimaContagem() {
  const lista = listarContagens();
  return lista.length ? lista[0] : null;
}

// ─── Caixa Diário (entradas e saídas por dia) ─────────────────────────────────
// Estrutura: { lancamentos: [ { id, data:"2026-06-01", tipo, categoria, descricao, valor } ] }

function listarLancamentos() {
  const dados = lerJSON(CAIXA_FILE, { lancamentos: [] });
  return Array.isArray(dados.lancamentos) ? dados.lancamentos : [];
}

function buscarLancamentoPorId(id) {
  return listarLancamentos().find(l => l.id === id) || null;
}

function salvarLancamento(lanc) {
  const lista = listarLancamentos();
  const idx = lista.findIndex(l => l.id === lanc.id);
  if (idx >= 0) lista[idx] = lanc;
  else lista.push(lanc);
  salvarJSON(CAIXA_FILE, { lancamentos: lista });
}

function deletarLancamento(id) {
  salvarJSON(CAIXA_FILE, { lancamentos: listarLancamentos().filter(l => l.id !== id) });
}

module.exports = {
  listarIngredientes,
  buscarIngredientePorId,
  buscarIngredientePorNome,
  salvarIngrediente,
  deletarIngrediente,
  listarMovimentos,
  listarMovimentosPorIngrediente,
  salvarMovimento,
  listarContagens,
  salvarContagem,
  ultimaContagem,
  listarLancamentos,
  buscarLancamentoPorId,
  salvarLancamento,
  deletarLancamento,
  listarFichas,
  buscarFichaPorId,
  salvarFicha,
  salvarTodasFichas,
  deletarFicha,
  listarMeses,
  buscarMesPorId,
  buscarMesPorCompetencia,
  salvarMes,
  deletarMes,
  mesMaisRecente,
  listarFornecedores,
  registrarFornecedor,
};
