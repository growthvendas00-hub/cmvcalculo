'use strict';

// ═══════════════════════════════════════════════════════════════
// BACKUP / SEGURANÇA DOS DADOS
// ───────────────────────────────────────────────────────────────
// "Não podemos perder o banco de dados de forma nenhuma."
// Este módulo dá a rede de segurança que falta:
//   • exportar()  → pacote JSON com TUDO (menos credenciais) p/ baixar
//   • restaurar() → repõe o banco a partir de um pacote (valida antes,
//                   e guarda o estado atual antes de sobrescrever)
//   • info()      → estado da persistência + backups existentes
//
// Backups automáticos diários e escrita atômica ficam no storage.js.
// Aqui cuidamos do export/import manual (cópia fora do servidor).
// ═══════════════════════════════════════════════════════════════

const storage = require('./storage');

const VERSAO = 1;

function exportar() {
  return {
    app: 'cmv-studio',
    versao: VERSAO,
    exportado_em: new Date().toISOString(),
    modo: storage.KV_ATIVO ? 'kv' : 'local',
    dados: storage.exportarBanco(), // settings NÃO entra (sem senha no arquivo)
  };
}

// Forma esperada de cada coleção — barra a importação de lixo que apagaria tudo.
const FORMA = {
  ingredientes: 'array', fichas: 'array', fornecedores: 'array',
  movimentos_estoque: 'array', whatsapp_log: 'array',
  custos_fixos: 'meses', contagens: 'contagens', caixa: 'lancamentos',
};
function tipoOk(nome, val) {
  switch (FORMA[nome]) {
    case 'array': return Array.isArray(val);
    case 'meses': return val && typeof val === 'object' && Array.isArray(val.meses);
    case 'contagens': return val && typeof val === 'object' && Array.isArray(val.contagens);
    case 'lancamentos': return val && typeof val === 'object' && Array.isArray(val.lancamentos);
    default: return false;
  }
}

function validar(pacote) {
  if (!pacote || typeof pacote !== 'object') return { ok: false, erro: 'Arquivo de backup inválido.' };
  // aceita o pacote completo ({versao, dados}) ou o bloco "dados" cru
  const dados = (pacote.dados && typeof pacote.dados === 'object')
    ? pacote.dados
    : (pacote.ingredientes !== undefined ? pacote : null);
  if (!dados) return { ok: false, erro: 'Backup sem o bloco "dados".' };
  const presentes = Object.keys(FORMA).filter(n => dados[n] !== undefined);
  if (!presentes.length) return { ok: false, erro: 'Backup não contém nenhuma coleção reconhecida.' };
  for (const n of presentes) {
    if (!tipoOk(n, dados[n])) return { ok: false, erro: `Coleção "${n}" com formato inválido no backup.` };
  }
  return { ok: true, dados, presentes };
}

async function restaurar(pacote) {
  const v = validar(pacote);
  if (!v.ok) return { erro: v.erro };
  // Antes de sobrescrever, guarda o estado atual (rede de segurança extra) —
  // sempre, num arquivo dedicado, para permitir desfazer uma restauração ruim.
  let backup_anterior = null;
  try {
    backup_anterior = storage.KV_ATIVO ? await storage.backupKV() : storage.backupPreRestauracaoLocal();
  } catch { /* não bloqueia a restauração */ }
  const n = storage.importarBanco(v.dados);
  return { ok: true, colecoes_restauradas: n, presentes: v.presentes, backup_anterior };
}

function info() {
  const dados = storage.exportarBanco();
  const contagens = {};
  for (const [nome, val] of Object.entries(dados)) {
    if (Array.isArray(val)) contagens[nome] = val.length;
    else if (val && Array.isArray(val.meses)) contagens[nome] = val.meses.length;
    else if (val && Array.isArray(val.contagens)) contagens[nome] = val.contagens.length;
    else if (val && Array.isArray(val.lancamentos)) contagens[nome] = val.lancamentos.length;
    else contagens[nome] = 0;
  }
  return {
    modo: storage.KV_ATIVO ? 'kv' : 'local',
    kv_ativo: storage.KV_ATIVO,
    na_vercel: !!process.env.VERCEL,
    contagens,
    local: storage.infoBackupLocal(),
  };
}

module.exports = { exportar, validar, restaurar, info, VERSAO };
