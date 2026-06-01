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

// No Vercel, copia os arquivos iniciais para /tmp se ainda não existirem
if (IS_VERCEL) {
  const SEED_DIR = path.join(__dirname, '..', '..', 'data');
  ['ingredientes.json','fichas.json','custos_fixos.json','fornecedores.json'].forEach(f => {
    const dest = path.join(DATA_DIR, f);
    if (!fs.existsSync(dest)) {
      try { fs.copyFileSync(path.join(SEED_DIR, f), dest); } catch { fs.writeFileSync(dest, f === 'custos_fixos.json' ? '{"meses":[]}' : '[]'); }
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

module.exports = {
  listarIngredientes,
  buscarIngredientePorId,
  buscarIngredientePorNome,
  salvarIngrediente,
  deletarIngrediente,
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
