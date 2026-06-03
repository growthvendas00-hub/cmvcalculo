'use strict';

// ═══════════════════════════════════════════════════════════════
// AUTENTICAÇÃO (login único da hamburgueria)
// ───────────────────────────────────────────────────────────────
// • Senha guardada com hash scrypt + salt (nunca em texto puro).
// • Sessão sem servidor de estado: um token assinado por HMAC vai
//   num cookie HttpOnly. Funciona na Vercel serverless.
// • O segredo de assinatura fica nas configurações (persistido no KV).
// ═══════════════════════════════════════════════════════════════

const crypto = require('crypto');
const storage = require('./storage');

const COOKIE_NAME = 'cmv_sessao';
const SESSAO_DURACAO_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

// ─── Senha ──────────────────────────────────────────────────────
function hashSenha(senha, saltHex) {
  const salt = saltHex || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(senha), Buffer.from(salt, 'hex'), 64).toString('hex');
  return { hash, salt };
}

function configurado() {
  const s = storage.lerSettings();
  return !!(s && s.senha_hash);
}

function verificarSenha(senha) {
  const s = storage.lerSettings();
  if (!s || !s.senha_hash || !s.senha_salt) return false;
  const { hash } = hashSenha(senha, s.senha_salt);
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(s.senha_hash, 'hex'));
  } catch { return false; }
}

// Define/atualiza a senha. Gera o segredo de sessão na primeira vez.
function definirSenha(senha) {
  const s = storage.lerSettings();
  const { hash, salt } = hashSenha(senha);
  s.senha_hash = hash;
  s.senha_salt = salt;
  if (!s.auth_secret) s.auth_secret = crypto.randomBytes(32).toString('hex');
  if (!s.criado_em) s.criado_em = new Date().toISOString();
  s.atualizado_em = new Date().toISOString();
  storage.salvarSettings(s);
}

// Invalida todas as sessões (troca o segredo de assinatura)
function rotacionarSegredo() {
  const s = storage.lerSettings();
  s.auth_secret = crypto.randomBytes(32).toString('hex');
  storage.salvarSettings(s);
}

function segredo() {
  const s = storage.lerSettings();
  return s.auth_secret || null;
}

// ─── Token de sessão (HMAC) ─────────────────────────────────────
function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function assinar(payloadStr, seg) {
  return b64url(crypto.createHmac('sha256', seg).update(payloadStr).digest());
}

function criarToken() {
  const seg = segredo();
  if (!seg) return null;
  const payload = JSON.stringify({ v: 1, iat: Date.now(), exp: Date.now() + SESSAO_DURACAO_MS });
  const corpo = b64url(payload);
  return corpo + '.' + assinar(payload, seg);
}

function tokenValido(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return false;
  const seg = segredo();
  if (!seg) return false;
  const [corpo, assinatura] = token.split('.');
  let payloadStr;
  try {
    payloadStr = Buffer.from(corpo.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
  } catch { return false; }
  const esperada = assinar(payloadStr, seg);
  try {
    if (!crypto.timingSafeEqual(Buffer.from(assinatura), Buffer.from(esperada))) return false;
  } catch { return false; }
  try {
    const p = JSON.parse(payloadStr);
    return typeof p.exp === 'number' && p.exp > Date.now();
  } catch { return false; }
}

// ─── Cookies (sem dependência externa) ──────────────────────────
function serializarCookie(nome, valor, { maxAgeMs, secure } = {}) {
  let c = `${nome}=${valor}; HttpOnly; SameSite=Lax; Path=/`;
  if (typeof maxAgeMs === 'number') c += `; Max-Age=${Math.floor(maxAgeMs / 1000)}`;
  if (secure) c += '; Secure';
  return c;
}

function cookieSessao(token, secure) {
  return serializarCookie(COOKIE_NAME, token, { maxAgeMs: SESSAO_DURACAO_MS, secure });
}

function cookieLogout(secure) {
  return serializarCookie(COOKIE_NAME, '', { maxAgeMs: 0, secure });
}

function lerCookies(req) {
  const raw = req.headers && req.headers.cookie;
  const out = {};
  if (!raw) return out;
  raw.split(';').forEach(par => {
    const i = par.indexOf('=');
    if (i < 0) return;
    const k = par.slice(0, i).trim();
    const v = par.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

function isHttps(req) {
  return !!(req.secure || (req.headers && req.headers['x-forwarded-proto'] === 'https'));
}

function autenticado(req) {
  return tokenValido(lerCookies(req)[COOKIE_NAME]);
}

module.exports = {
  COOKIE_NAME,
  configurado,
  verificarSenha,
  definirSenha,
  rotacionarSegredo,
  criarToken,
  tokenValido,
  cookieSessao,
  cookieLogout,
  lerCookies,
  isHttps,
  autenticado,
};
