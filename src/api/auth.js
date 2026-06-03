'use strict';

// ═══════════════════════════════════════════════════════════════
// ROTAS DE AUTENTICAÇÃO  (montadas em /api/auth)
//   GET  /status   → estado (configurado? autenticado?)
//   POST /setup    → primeiro acesso: cria a senha
//   POST /login    → entra
//   POST /logout   → sai
//   POST /senha    → troca a senha (precisa estar logado)
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const auth = require('../core/auth');

const MIN_SENHA = 4;

// IMPORTANTE: definir o cookie SEMPRE antes do res.json (no modo KV o envio
// do corpo é assíncrono, mas o header já fica preparado de forma síncrona).
function logar(req, res, body) {
  const token = auth.criarToken();
  res.setHeader('Set-Cookie', auth.cookieSessao(token, auth.isHttps(req)));
  return res.json(body);
}

router.get('/status', (req, res) => {
  res.json({ configurado: auth.configurado(), autenticado: auth.autenticado(req) });
});

router.post('/setup', (req, res) => {
  if (auth.configurado()) return res.status(409).json({ erro: 'Senha já configurada. Use o login.' });
  const senha = (req.body && req.body.senha) || '';
  if (String(senha).length < MIN_SENHA) {
    return res.status(400).json({ erro: `A senha deve ter ao menos ${MIN_SENHA} caracteres.` });
  }
  auth.definirSenha(senha);
  return logar(req, res, { ok: true, mensagem: 'Senha criada. Bem-vindo!' });
});

router.post('/login', (req, res) => {
  if (!auth.configurado()) return res.status(409).json({ erro: 'Ainda não há senha. Crie uma no primeiro acesso.' });
  const senha = (req.body && req.body.senha) || '';
  if (!auth.verificarSenha(senha)) return res.status(401).json({ erro: 'Senha incorreta.' });
  return logar(req, res, { ok: true });
});

router.post('/logout', (req, res) => {
  res.setHeader('Set-Cookie', auth.cookieLogout(auth.isHttps(req)));
  res.json({ ok: true });
});

router.post('/senha', (req, res) => {
  // Esta rota está em /api/auth (fora do gate), então protegemos aqui.
  if (!auth.autenticado(req)) return res.status(401).json({ erro: 'Faça login para trocar a senha.' });
  const atual = (req.body && req.body.senha_atual) || '';
  const nova = (req.body && req.body.senha_nova) || '';
  if (!auth.verificarSenha(atual)) return res.status(401).json({ erro: 'Senha atual incorreta.' });
  if (String(nova).length < MIN_SENHA) {
    return res.status(400).json({ erro: `A nova senha deve ter ao menos ${MIN_SENHA} caracteres.` });
  }
  auth.definirSenha(nova);
  auth.rotacionarSegredo();          // derruba outras sessões
  return logar(req, res, { ok: true, mensagem: 'Senha alterada.' }); // renova a sessão atual
});

module.exports = router;
