'use strict';

// ═══════════════════════════════════════════════════════════════
// WEBHOOK DO WHATSAPP (Meta WhatsApp Cloud API)
// ───────────────────────────────────────────────────────────────
// GET  /api/webhook/whatsapp        → verificação do webhook (Meta)
// POST /api/webhook/whatsapp        → recebe mensagens da Meta
// POST /api/webhook/whatsapp/test   → simulador (testar comandos sem a Meta)
// GET  /api/webhook/whatsapp/log    → últimas mensagens processadas
//
// Variáveis de ambiente:
//   WHATSAPP_VERIFY_TOKEN  → segredo que você escolhe, usado na verificação
//   WHATSAPP_TOKEN         → token de acesso da Meta (para responder)
//   WHATSAPP_APP_SECRET    → (opcional) valida a assinatura das requisições
//   WHATSAPP_ALLOWED       → (opcional) números autorizados, separados por vírgula
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const storage = require('../core/storage');
const whatsapp = require('../core/whatsapp');

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'cmv-studio';
const TOKEN = process.env.WHATSAPP_TOKEN || '';
const APP_SECRET = process.env.WHATSAPP_APP_SECRET || '';
const ALLOWED = (process.env.WHATSAPP_ALLOWED || '')
  .split(',').map(s => s.replace(/\D/g, '')).filter(Boolean);

function soDigitos(s) { return (s || '').replace(/\D/g, ''); }

// Verifica a assinatura HMAC da Meta (proteção contra requisições forjadas)
function assinaturaValida(req) {
  if (!APP_SECRET) return true; // sem segredo configurado → não valida (uso de teste)
  const assinatura = req.get('x-hub-signature-256') || '';
  if (!req.rawBody) return false;
  const esperado = 'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(req.rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(assinatura), Buffer.from(esperado));
  } catch { return false; }
}

// ─── Verificação do webhook (Meta chama via GET ao configurar) ──
router.get('/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// ─── Recebe mensagens ───────────────────────────────────────────
router.post('/whatsapp', async (req, res) => {
  if (!assinaturaValida(req)) return res.sendStatus(401);

  // Sempre responde 200 rápido para a Meta não reenviar
  res.sendStatus(200);

  try {
    const value = req.body?.entry?.[0]?.changes?.[0]?.value;
    const msg = value?.messages?.[0];
    if (!msg || msg.type !== 'text') return;

    const de = msg.from;                          // ex.: 5511999999999
    const texto = msg.text?.body || '';
    const phoneNumberId = value?.metadata?.phone_number_id;

    // Filtro de números autorizados (se a lista estiver configurada)
    if (ALLOWED.length && !ALLOWED.includes(soDigitos(de))) {
      storage.salvarWhatsappLog({ id: Date.now().toString(), data: new Date().toISOString(), de, texto, sucesso: false, resposta: 'Número não autorizado', intent: 'bloqueado' });
      await storage.kvFlush().catch(() => {});
      await enviarTexto(phoneNumberId, de, '🚫 Este número não tem permissão para registrar no sistema.');
      return;
    }

    const { reply, log } = whatsapp.processarMensagem(texto, de);
    storage.salvarWhatsappLog(log);
    await storage.kvFlush().catch(() => {});
    await enviarTexto(phoneNumberId, de, reply);
  } catch (e) {
    console.error('Erro no webhook do WhatsApp:', e.message);
  }
});

// ─── Simulador (usado pelo dashboard e para testes) ─────────────
router.post('/whatsapp/test', async (req, res) => {
  const texto = (req.body && req.body.texto) || '';
  const de = (req.body && req.body.de) || 'simulador';
  if (!texto.trim()) return res.status(400).json({ erro: 'Envie um texto.' });
  const { reply, log } = whatsapp.processarMensagem(texto, de);
  storage.salvarWhatsappLog(log);
  res.json({ reply, intent: log.intent, sucesso: log.sucesso });
});

// ─── Log das últimas mensagens ──────────────────────────────────
router.get('/whatsapp/log', (req, res) => {
  res.json(storage.listarWhatsappLog().slice(0, 30));
});

// ─── Envio de resposta via Meta Cloud API ───────────────────────
async function enviarTexto(phoneNumberId, para, texto) {
  if (!TOKEN || !phoneNumberId) return; // sem credenciais (modo teste) → não envia
  try {
    await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: para, type: 'text', text: { body: texto } }),
    });
  } catch (e) {
    console.error('Falha ao enviar WhatsApp:', e.message);
  }
}

module.exports = router;
