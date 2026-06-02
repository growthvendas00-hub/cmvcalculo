'use strict';

const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════
// PERSISTÊNCIA — dois modos, escolhidos automaticamente:
//
//  • LOCAL (PC / INICIAR.bat): grava arquivos JSON na pasta /data.
//  • VERCEL (serverless): grava num banco Vercel KV (Redis Upstash),
//    porque o disco da Vercel é volátil. Basta ter as variáveis de
//    ambiente do KV — o código detecta sozinho.
//
// A API interna (lerJSON/salvarJSON) continua a mesma, então nenhuma
// das funções de negócio precisou mudar. No modo KV todos os dados
// ficam em UMA chave (cmv:db), carregada/gravada por requisição.
// ═══════════════════════════════════════════════════════════════

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const KV_ATIVO = !!(KV_URL && KV_TOKEN);
const KV_CHAVE = 'cmv:db';

let redis = null;
if (KV_ATIVO) {
  try {
    const { Redis } = require('@upstash/redis');
    redis = new Redis({ url: KV_URL, token: KV_TOKEN });
  } catch (e) {
    console.error('Falha ao carregar @upstash/redis:', e.message);
  }
}

// Banco em memória (usado no modo KV). Chaveado pelo nome do arquivo.
let DB = {};
let DB_SUJO = false;       // há alterações a gravar?
let DB_CARREGADO = false;  // já hidratou ao menos uma vez nesta instância?

// ─── Modo LOCAL: pasta e arquivos ─────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
if (!KV_ATIVO && !fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const INGREDIENTES_FILE  = path.join(DATA_DIR, 'ingredientes.json');
const FICHAS_FILE        = path.join(DATA_DIR, 'fichas.json');
const CUSTOS_FILE        = path.join(DATA_DIR, 'custos_fixos.json');
const FORNECEDORES_FILE  = path.join(DATA_DIR, 'fornecedores.json');
const MOVIMENTOS_FILE    = path.join(DATA_DIR, 'movimentos_estoque.json');
const CONTAGENS_FILE     = path.join(DATA_DIR, 'contagens.json');
const CAIXA_FILE         = path.join(DATA_DIR, 'caixa.json');

// Nome da coleção a partir do caminho do arquivo (ex.: .../caixa.json → caixa)
function chaveDe(caminho) { return path.basename(caminho, '.json'); }

function clonar(obj) {
  return obj === undefined ? obj : JSON.parse(JSON.stringify(obj));
}

// ─── KV: hidratar (ler tudo) e descarregar (gravar tudo) ──────────────────────
async function kvHydrate() {
  if (!KV_ATIVO || !redis) return;
  const blob = await redis.get(KV_CHAVE); // @upstash/redis já devolve objeto
  DB = (blob && typeof blob === 'object') ? blob : {};
  DB_CARREGADO = true;
  DB_SUJO = false;
}

async function kvFlush() {
  if (!KV_ATIVO || !redis || !DB_SUJO) return;
  await redis.set(KV_CHAVE, DB);
  DB_SUJO = false;
}

// Lê JSON removendo BOM (alguns editores/PowerShell gravam UTF-8 com BOM)
function lerJSON(caminho, padrao) {
  if (KV_ATIVO) {
    const v = DB[chaveDe(caminho)];
    return v === undefined ? padrao : clonar(v);
  }
  try {
    const conteudo = fs.readFileSync(caminho, 'utf-8').replace(/^﻿/, '').trim();
    if (!conteudo) return padrao;
    return JSON.parse(conteudo);
  } catch {
    return padrao;
  }
}

function salvarJSON(caminho, dados) {
  if (KV_ATIVO) {
    DB[chaveDe(caminho)] = dados;
    DB_SUJO = true;
    return;
  }
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
  KV_ATIVO,
  kvHydrate,
  kvFlush,
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
