const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3001;

app.set('trust proxy', 1); // honra x-forwarded-proto (Vercel) p/ cookie Secure

// Captura o corpo cru (necessário para validar a assinatura HMAC do WhatsApp)
app.use(express.json({
  verify: (req, res, buf) => { req.rawBody = buf; },
}));
app.use(express.static(path.join(__dirname, '..', 'public')));

const storage = require('./core/storage');

// No modo Vercel KV, os dados vivem num banco. Antes de cada requisição da API
// carregamos o estado; depois de o handler montar a resposta, gravamos o que
// mudou e só então enviamos. No modo local (arquivos) este middleware não roda.
if (storage.KV_ATIVO) {
  app.use('/api', async (req, res, next) => {
    try {
      await storage.kvHydrate();
    } catch (e) {
      return res.status(503).json({ erro: 'Não foi possível acessar o banco de dados. Tente novamente.' });
    }
    const enviarJSON = res.json.bind(res);
    res.json = (body) => {
      storage.kvFlush()
        .catch(err => console.error('Falha ao gravar no KV:', err.message))
        .finally(() => enviarJSON(body));
      return res;
    };
    next();
  });
}

// ─── Gate de autenticação ───────────────────────────────────────
// Roda DEPOIS do hydrate (precisa das settings carregadas). Libera as
// rotas de auth e o webhook do WhatsApp (a Meta precisa alcançá-lo).
const auth = require('./core/auth');
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/auth/') || req.path.startsWith('/webhook/')) return next();
  if (auth.autenticado(req)) return next();
  return res.status(401).json({ erro: 'Não autenticado.' });
});

app.use('/api/auth', require('./api/auth'));

const routes = require('./api/routes');
app.use('/api', routes);

// Webhook do WhatsApp (fica sob /api para herdar o carregamento do banco KV)
app.use('/api/webhook', require('./api/webhook'));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// No Vercel o módulo é exportado; localmente ouvimos a porta
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n  ╔══════════════════════════════════════╗`);
    console.log(`  ║     CMV STUDIO — Iniciado            ║`);
    console.log(`  ║  Acesse: http://localhost:${PORT}       ║`);
    console.log(`  ╚══════════════════════════════════════╝\n`);
  });
}

module.exports = app;
