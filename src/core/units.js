'use strict';

// ═══════════════════════════════════════════════════════════════
// CONVERSÃO DE UNIDADES
// ───────────────────────────────────────────────────────────────
// Toda unidade é normalizada para uma UNIDADE BASE por dimensão:
//   massa   → g   (grama)
//   volume  → ml  (mililitro)
//   unidade → un  (peça)
//
// Assim, comprar "10 kg por R$ 469" vira custo por grama = 0,0469/g,
// e uma receita que usa "150 g" custa 150 × 0,0469 = R$ 7,04 — exato.
// ═══════════════════════════════════════════════════════════════

const UNIDADES = {
  kg: { base: 'g',  fator: 1000, dimensao: 'massa',   rotulo: 'kg (quilograma)' },
  g:  { base: 'g',  fator: 1,    dimensao: 'massa',   rotulo: 'g (grama)' },
  L:  { base: 'ml', fator: 1000, dimensao: 'volume',  rotulo: 'L (litro)' },
  ml: { base: 'ml', fator: 1,    dimensao: 'volume',  rotulo: 'ml (mililitro)' },
  un: { base: 'un', fator: 1,    dimensao: 'unidade', rotulo: 'un (unidade)' },
};

// Unidade "amigável" para EXIBIR o custo unitário (sempre a maior da dimensão)
const UNIDADE_EXIBICAO = {
  g:  { unidade: 'kg', fator: 1000 },
  ml: { unidade: 'L',  fator: 1000 },
  un: { unidade: 'un', fator: 1 },
};

function existeUnidade(u) {
  return Object.prototype.hasOwnProperty.call(UNIDADES, u);
}

function unidadeBase(unidade) {
  return UNIDADES[unidade] ? UNIDADES[unidade].base : unidade;
}

function dimensao(unidade) {
  return UNIDADES[unidade] ? UNIDADES[unidade].dimensao : null;
}

// Converte uma quantidade da unidade informada para a unidade base.
// Ex.: paraBase(10, 'kg') = 10000 (g)
function paraBase(quantidade, unidade) {
  const u = UNIDADES[unidade];
  if (!u) return quantidade;
  return quantidade * u.fator;
}

// Dado o custo por unidade base, retorna { valor, unidade } para exibição amigável.
// Ex.: exibicao(0.0469, 'g') = { valor: 46.9, unidade: 'kg' }
function exibicao(custoBase, unidadeBaseStr) {
  const ex = UNIDADE_EXIBICAO[unidadeBaseStr] || { unidade: unidadeBaseStr, fator: 1 };
  return { valor: custoBase * ex.fator, unidade: ex.unidade };
}

module.exports = {
  UNIDADES,
  UNIDADE_EXIBICAO,
  existeUnidade,
  unidadeBase,
  dimensao,
  paraBase,
  exibicao,
};
