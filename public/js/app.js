'use strict';

// ═══════════════════════════════════════════════════════════════
// CONVERSÃO DE UNIDADES (espelho do backend, p/ preview e rótulos)
// ═══════════════════════════════════════════════════════════════
const UNIDADES = {
  kg: { base: 'g',  fator: 1000 },
  g:  { base: 'g',  fator: 1 },
  L:  { base: 'ml', fator: 1000 },
  ml: { base: 'ml', fator: 1 },
  un: { base: 'un', fator: 1 },
};
const EXIBICAO = { g: { un: 'kg', fator: 1000 }, ml: { un: 'L', fator: 1000 }, un: { un: 'un', fator: 1 } };
const UNIDADES_POR_BASE = { g: ['kg', 'g'], ml: ['L', 'ml'], un: ['un'] };
function paraBase(qtd, unidade) { return qtd * (UNIDADES[unidade]?.fator || 1); }
function conteudoBaseEmb(emb) { return emb ? (Number(emb.conteudo) || 0) * (UNIDADES[emb.unidade]?.fator || 0) : 0; }

// ═══════════════════════════════════════════════════════════════
// LISTA PADRÃO — apenas nomes + unidade base + lembrete (SEM preço)
// ═══════════════════════════════════════════════════════════════
const INGREDIENTES_PADRAO = [
  { categoria: '🥩 Carnes e Proteínas', itens: [
    { nome: 'Carne Moída 80/20', base: 'g', dica: 'Padrão do smash burger (80% carne / 20% gordura). Compre em açougue para melhor preço.' },
    { nome: 'Hambúrguer Artesanal (blend)', base: 'g', dica: 'Se compra o blend pronto pesado. Anote o peso por unidade.' },
    { nome: 'Bacon em Fatias', base: 'g', dica: 'Perde ~25-35% de gordura na chapa. Use Fator de Correção ~1,30 na ficha.' },
    { nome: 'Frango (peito)', base: 'g', dica: 'Fator ~1,10 (perde peso ao cozinhar).' },
    { nome: 'Calabresa', base: 'g', dica: 'Muito usada em pizza e porção. Fator ~1,15.' },
    { nome: 'Pepperoni', base: 'g', dica: 'Premium para pizzas. Compre fatiado para ganhar tempo.' },
  ]},
  { categoria: '🧀 Laticínios', itens: [
    { nome: 'Queijo Mussarela', base: 'g', dica: 'Base da pizza. Em bloco ralado sai mais barato que fatiado.' },
    { nome: 'Queijo Cheddar (fatia)', base: 'g', dica: 'Clássico do burger. ~1 fatia (20g) por lanche.' },
    { nome: 'Queijo Prato', base: 'g', dica: 'Alternativa mais suave e econômica.' },
    { nome: 'Requeijão Cremoso', base: 'g', dica: 'Borda recheada e base de pizza.' },
    { nome: 'Cream Cheese', base: 'g', dica: 'Premium. Controle bem a quantidade.' },
  ]},
  { categoria: '🥬 Vegetais e Frescos', itens: [
    { nome: 'Alface', base: 'g', dica: 'Fator ~1,20 (folhas externas e talo).' },
    { nome: 'Tomate', base: 'g', dica: 'Fator ~1,15. Preço varia muito com a safra.' },
    { nome: 'Cebola', base: 'g', dica: 'Fator ~1,20. Caramelizada perde metade do peso (fator ~2,0).' },
    { nome: 'Cebola Roxa', base: 'g', dica: 'Visual nobre para burgers premium.' },
    { nome: 'Azeitona Fatiada', base: 'g', dica: 'Comprada em conserva, já fatiada.' },
    { nome: 'Champignon', base: 'g', dica: 'Drene bem antes de pesar.' },
  ]},
  { categoria: '🍞 Pães e Massas', itens: [
    { nome: 'Pão Brioche', base: 'un', dica: 'Macio e nobre. Validade curta — controle o estoque.' },
    { nome: 'Pão Hamburguer', base: 'un', dica: 'Opção econômica.' },
    { nome: 'Disco de Massa de Pizza', base: 'un', dica: 'Se compra pronto. Se faz, crie uma ficha da massa.' },
    { nome: 'Farinha de Trigo', base: 'g', dica: 'Para massa própria. 1 pizza 30cm ≈ 200-250g.' },
  ]},
  { categoria: '🥫 Molhos e Condimentos', itens: [
    { nome: 'Maionese', base: 'g', dica: 'Compre em balde (3-4kg) para baratear.' },
    { nome: 'Maionese Especial/Temperada', base: 'g', dica: 'Agrega valor. ~20g por lanche bastam.' },
    { nome: 'Ketchup', base: 'g', dica: '~20g por lanche.' },
    { nome: 'Mostarda', base: 'g', dica: 'Clássico do smash americano.' },
    { nome: 'Molho de Tomate (pizza)', base: 'g', dica: '80-120g por pizza 30cm.' },
    { nome: 'Molho Barbecue', base: 'g', dica: 'Burgers e porções.' },
    { nome: 'Azeite de Oliva', base: 'ml', dica: 'Finalização. 5-10ml por pizza.' },
  ]},
  { categoria: '📦 Embalagens e Descartáveis', itens: [
    { nome: 'Caixa de Pizza', base: 'un', dica: 'Essencial no delivery. Personalize com sua marca.' },
    { nome: 'Caixa de Hamburguer', base: 'un', dica: 'Embalagem de marca justifica preço premium.' },
    { nome: 'Sacola Kraft', base: 'un', dica: 'Para agrupar o pedido.' },
    { nome: 'Guardanapo', base: 'un', dica: 'Parece nada, mas em volume conta.' },
    { nome: 'Copo + Tampa', base: 'un', dica: 'Para bebidas e milk-shakes.' },
  ]},
];

// ═══════════════════════════════════════════════════════════════
// ESTADO
// ═══════════════════════════════════════════════════════════════
let _ingredientes = [];
let _mesAtivo = null;
let _meses = [];

// ═══════════════════════════════════════════════════════════════
// API
// ═══════════════════════════════════════════════════════════════
const API = {
  async req(method, path, body) {
    const opt = { method, headers: {} };
    if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    let r;
    try {
      r = await fetch('/api' + path, opt);
    } catch (e) {
      Status.set(false);
      throw { erro: 'Sem conexão com o servidor. Verifique se a janela do INICIAR.bat está aberta.' };
    }
    Status.set(true);
    const txt = await r.text();
    const data = txt ? JSON.parse(txt) : {};
    // Sessão expirada / não autenticado: mostra o login (exceto nas rotas de auth)
    if (r.status === 401 && !path.startsWith('/auth')) {
      if (typeof Auth !== 'undefined') Auth.exigirLogin();
      throw { erro: 'Sessão expirada. Faça login novamente.', _auth: true };
    }
    if (!r.ok) throw data;
    return data;
  },
  get(p) { return API.req('GET', p); },
  post(p, b) { return API.req('POST', p, b ?? {}); },
  put(p, b) { return API.req('PUT', p, b ?? {}); },
  delete(p) { return API.req('DELETE', p); },
};

const Status = {
  set(online) {
    const el = document.getElementById('status-servidor');
    if (!el) return;
    el.textContent = online ? '● Servidor conectado' : '● Servidor offline';
    el.className = 'status-servidor ' + (online ? 'online' : 'offline');
  },
};

// ═══════════════════════════════════════════════════════════════
// FORMATAÇÃO — moeda brasileira sempre 2 casas
// ═══════════════════════════════════════════════════════════════
const Fmt = {
  moeda(v) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },
  // custo por unidade "amigável" (kg/L/un) com 2 casas
  custoUnit(custoBase, unidadeBase) {
    if (custoBase === null || custoBase === undefined) return '—';
    const ex = EXIBICAO[unidadeBase] || { un: unidadeBase, fator: 1 };
    return Fmt.moeda(custoBase * ex.fator) + '/' + ex.un;
  },
  pct(v) { return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'; },
  data(iso) { return iso ? new Date(iso).toLocaleDateString('pt-BR') : '—'; },
  competencia(c) {
    if (!c) return '—';
    const [a, m] = c.split('-');
    const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    return `${meses[parseInt(m,10)-1]}/${a}`;
  },
};

// ═══════════════════════════════════════════════════════════════
// UI
// ═══════════════════════════════════════════════════════════════
const UI = {
  abrirModal(id) { document.getElementById(id).classList.remove('hidden'); },
  fecharModal(id) { document.getElementById(id).classList.add('hidden'); },
  toast(msg, tipo = 'sucesso') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = `toast ${tipo}`;
    clearTimeout(UI._t);
    UI._t = setTimeout(() => el.classList.add('hidden'), 5500);
  },
  toggleTutorial(id) {
    const box = document.getElementById(id);
    const corpo = box.querySelector('.tutorial-corpo');
    const btn = box.querySelector('.tutorial-toggle');
    const c = corpo.classList.toggle('collapsed');
    btn.textContent = c ? 'Mostrar ▼' : 'Ocultar ▲';
  },
  abrirModalFicha(ficha = null) {
    const form = document.getElementById('form-ficha');
    form.reset();
    document.getElementById('ficha-rateio').checked = false;
    document.getElementById('ingredientes-lista-ficha').innerHTML =
      '<div class="ingrediente-vazio">Nenhum ingrediente — clique em "+ Adicionar"</div>';
    if (ficha) {
      document.getElementById('modal-ficha-titulo').textContent = 'Editar Ficha Técnica';
      document.getElementById('ficha-id').value = ficha.id;
      document.getElementById('ficha-nome').value = ficha.nome;
      document.getElementById('ficha-tipo').value = ficha.tipo || 'hamburguer';
      document.getElementById('ficha-preco').value = ficha.preco_venda;
      document.getElementById('ficha-embalagem').value = ficha.custo_embalagem || 0;
      document.getElementById('ficha-rateio').checked = !!ficha.incluir_rateio;
      if (ficha.ingredientes?.length) {
        document.getElementById('ingredientes-lista-ficha').innerHTML = '';
        ficha.ingredientes.forEach(it => Fichas.adicionarLinha(it));
      }
    } else {
      document.getElementById('modal-ficha-titulo').textContent = 'Nova Ficha Técnica';
      document.getElementById('ficha-id').value = '';
    }
    UI.abrirModal('modal-ficha');
  },
};

// Tooltips flutuantes
(function () {
  const tip = document.getElementById('tooltip');
  document.addEventListener('mouseover', e => {
    const el = e.target.closest('.dica-icone');
    if (!el || !el.dataset.dica) return;
    tip.textContent = el.dataset.dica;
    tip.classList.remove('hidden');
    const r = el.getBoundingClientRect();
    let top = r.bottom + 8, left = r.left;
    if (left + 290 > window.innerWidth) left = window.innerWidth - 300;
    if (top + 140 > window.innerHeight) top = r.top - 140;
    tip.style.top = Math.max(8, top) + 'px';
    tip.style.left = Math.max(8, left) + 'px';
  });
  document.addEventListener('mouseout', e => {
    if (e.target.closest('.dica-icone')) tip.classList.add('hidden');
  });
})();

// ═══════════════════════════════════════════════════════════════
// MÓDULO 1 — INGREDIENTES
// ═══════════════════════════════════════════════════════════════
const Ingredientes = {
  async carregar() {
    _ingredientes = await API.get('/ingredientes');
    const tbody = document.getElementById('lista-ingredientes');
    if (!_ingredientes.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty">Nenhum ingrediente. Use "📋 Lista Padrão" ou "+ Novo Ingrediente".</td></tr>';
      return;
    }
    tbody.innerHTML = _ingredientes.map(ing => {
      const temPreco = ing.custo_base > 0;
      const custo = temPreco
        ? `<code style="color:var(--accent)">${Fmt.custoUnit(ing.custo_base, ing.unidade_base)}</code>`
        : `<span class="badge-sem-preco">⚠ Sem preço</span>`;
      const ultima = ing.historico?.length ? Fmt.data(ing.historico[ing.historico.length-1].data) : '—';
      const nomeJS = ing.nome.replace(/'/g, "\\'");
      const embTag = ing.embalagem
        ? `<span class="emb-tag" title="Comprado por embalagem">📦 ${ing.embalagem.nome} = ${ing.embalagem.conteudo} ${ing.embalagem.unidade}</span>` : '';
      return `<tr>
        <td data-label="Ingrediente"><strong>${ing.nome}</strong> <small style="color:var(--text-muted)">(usa em ${ing.unidade_base})</small> ${embTag}</td>
        <td data-label="Custo Atual">${custo}</td>
        <td data-label="Última Compra" style="color:var(--text-muted)">${ultima}</td>
        <td class="cell-acoes" data-label="Ações"><div class="acoes-cell">
          <button class="${temPreco ? 'btn-edit' : 'btn-confirm'}" onclick="Ingredientes.registrarPreco('${ing.id}')">${temPreco ? 'Nova Compra' : 'Registrar Preço'}</button>
          <button class="btn-edit" onclick="Ingredientes.editar('${ing.id}')">Editar</button>
          <button class="btn-danger" onclick="Ingredientes.excluir('${ing.id}','${nomeJS}')">Excluir</button>
        </div></td>
      </tr>`;
    }).join('');
  },

  async _carregarFornecedores() {
    try {
      const lista = await API.get('/fornecedores');
      document.getElementById('lista-fornecedores').innerHTML =
        lista.map(f => `<option value="${f}"></option>`).join('');
    } catch {}
  },

  _setModo(modo) {
    document.querySelector(`input[name="compra-modo"][value="${modo}"]`).checked = true;
    Ingredientes.trocarModoCompra();
  },
  trocarModoCompra() {
    const modo = document.querySelector('input[name="compra-modo"]:checked').value;
    document.getElementById('compra-sec-medida').style.display = modo === 'medida' ? 'block' : 'none';
    document.getElementById('compra-sec-embalagem').style.display = modo === 'embalagem' ? 'block' : 'none';
    Ingredientes.atualizarPreviewCompra();
  },

  abrirNovo() {
    document.getElementById('form-compra').reset();
    document.getElementById('compra-id').value = '';
    document.getElementById('modal-compra-titulo').textContent = 'Novo Ingrediente (com preço)';
    const nome = document.getElementById('compra-nome');
    nome.readOnly = false; nome.value = '';
    document.getElementById('compra-unidade').value = 'kg';
    document.getElementById('compra-emb-unidade').value = 'g';
    Ingredientes._setModo('medida');
    Ingredientes._carregarFornecedores();
    document.getElementById('compra-preview').style.display = 'none';
    UI.abrirModal('modal-compra');
  },

  registrarPreco(id) {
    const ing = _ingredientes.find(i => i.id === id);
    if (!ing) return;
    document.getElementById('form-compra').reset();
    document.getElementById('compra-id').value = ing.id;
    document.getElementById('modal-compra-titulo').textContent = `Registrar Compra — ${ing.nome}`;
    const nome = document.getElementById('compra-nome');
    nome.value = ing.nome; nome.readOnly = true;
    Ingredientes._carregarFornecedores();
    document.getElementById('compra-preview').style.display = 'none';
    if (ing.embalagem) {
      // já compra por embalagem: pré-preenche e usa o modo embalagem
      document.getElementById('compra-emb-nome').value = ing.embalagem.nome || '';
      document.getElementById('compra-emb-conteudo').value = ing.embalagem.conteudo || '';
      document.getElementById('compra-emb-unidade').value = ing.embalagem.unidade || 'g';
      Ingredientes._setModo('embalagem');
    } else {
      const compat = UNIDADES_POR_BASE[ing.unidade_base] || ['kg','g','L','ml','un'];
      document.getElementById('compra-unidade').value = compat[0];
      document.getElementById('compra-emb-unidade').value = (UNIDADES_POR_BASE[ing.unidade_base]||['g'])[ (ing.unidade_base==='un'?0:1) ] || ing.unidade_base;
      Ingredientes._setModo('medida');
    }
    UI.abrirModal('modal-compra');
  },

  atualizarPreviewCompra() {
    const modo = document.querySelector('input[name="compra-modo"]:checked').value;
    const valor = parseFloat(document.getElementById('compra-valor').value);
    const prev = document.getElementById('compra-preview');
    const alerta = document.getElementById('compra-preview-alerta');
    alerta.style.display = 'none';
    let custoBase = null, base = null, extra = '';

    if (modo === 'medida') {
      const qtd = parseFloat(document.getElementById('compra-quantidade').value);
      const unidade = document.getElementById('compra-unidade').value;
      if (qtd > 0 && valor > 0) { custoBase = valor / paraBase(qtd, unidade); base = UNIDADES[unidade].base; }
    } else {
      const qtdEmb = parseFloat(document.getElementById('compra-emb-qtd').value);
      const conteudo = parseFloat(document.getElementById('compra-emb-conteudo').value);
      const un = document.getElementById('compra-emb-unidade').value;
      const nomeEmb = document.getElementById('compra-emb-nome').value.trim() || 'embalagem';
      if (qtdEmb > 0 && conteudo > 0 && valor > 0) {
        const totalBase = qtdEmb * paraBase(conteudo, un);
        custoBase = valor / totalBase;
        base = UNIDADES[un].base;
        extra = ` · ${Fmt.moeda(valor / qtdEmb)}/${nomeEmb}`;
      }
    }
    if (custoBase !== null && isFinite(custoBase)) {
      document.getElementById('compra-preview-valor').textContent = Fmt.custoUnit(custoBase, base) + extra;
      prev.style.display = 'block';
      const exibido = custoBase * (EXIBICAO[base]?.fator || 1);
      if (base === 'g' && exibido > 300) {
        alerta.textContent = '⚠ Custo muito alto para 1 kg. Confira os valores.';
        alerta.style.display = 'block';
      }
    } else { prev.style.display = 'none'; }
  },

  async salvarCompra(e) {
    e.preventDefault();
    const id = document.getElementById('compra-id').value;
    const modo = document.querySelector('input[name="compra-modo"]:checked').value;
    const body = {
      nome: document.getElementById('compra-nome').value,
      fornecedor: document.getElementById('compra-fornecedor').value,
      valor_total: parseFloat(document.getElementById('compra-valor').value),
    };
    if (id) body.id = id;
    if (modo === 'embalagem') {
      body.modo = 'embalagem';
      body.embalagem_nome = document.getElementById('compra-emb-nome').value.trim() || 'embalagem';
      body.quantidade_embalagens = parseFloat(document.getElementById('compra-emb-qtd').value);
      body.conteudo = parseFloat(document.getElementById('compra-emb-conteudo').value);
      body.unidade_conteudo = document.getElementById('compra-emb-unidade').value;
      if (!(body.quantidade_embalagens > 0) || !(body.conteudo > 0)) { UI.toast('Preencha quantas embalagens e o conteúdo de cada uma.', 'erro'); return; }
    } else {
      body.unidade_compra = document.getElementById('compra-unidade').value;
      body.quantidade_comprada = parseFloat(document.getElementById('compra-quantidade').value);
      if (!(body.quantidade_comprada > 0)) { UI.toast('Informe a quantidade comprada.', 'erro'); return; }
    }
    if (!(body.valor_total > 0)) { UI.toast('Informe o valor pago.', 'erro'); return; }
    try {
      const res = await API.post('/ingredientes', body);
      UI.fecharModal('modal-compra');
      await Ingredientes.carregar();
      if (res.precoAlterado && res.fichas_atualizadas?.length) {
        UI.toast(`Preço salvo. CMVs recalculados: ${res.fichas_atualizadas.join(', ')}`, 'aviso');
      } else {
        UI.toast(res.mensagem || 'Salvo.');
      }
    } catch (err) {
      UI.toast(err.erro || 'Erro ao salvar.', 'erro');
    }
  },

  editar(id) {
    const ing = _ingredientes.find(i => i.id === id);
    if (!ing) return;
    document.getElementById('form-editar-ing').reset();
    document.getElementById('editar-ing-id').value = ing.id;
    document.getElementById('editar-ing-nome').value = ing.nome;
    document.getElementById('editar-ing-unidade').value = ing.unidade_base;
    const tem = !!ing.embalagem;
    document.getElementById('editar-ing-tem-emb').checked = tem;
    if (tem) {
      document.getElementById('editar-emb-nome').value = ing.embalagem.nome || '';
      document.getElementById('editar-emb-conteudo').value = ing.embalagem.conteudo || '';
    }
    Ingredientes.editAtualizarEmb();
    if (tem) document.getElementById('editar-emb-unidade').value = ing.embalagem.unidade;
    Ingredientes.editToggleEmb();
    UI.abrirModal('modal-editar-ing');
  },

  editToggleEmb() {
    const on = document.getElementById('editar-ing-tem-emb').checked;
    document.getElementById('editar-ing-emb-campos').style.display = on ? 'block' : 'none';
  },
  // Atualiza as unidades válidas do conteúdo conforme a unidade de uso
  editAtualizarEmb() {
    const base = document.getElementById('editar-ing-unidade').value;
    const compat = UNIDADES_POR_BASE[base] || [base];
    const rot = { kg:'kg', g:'g', L:'L', ml:'ml', un:'un' };
    document.getElementById('editar-emb-unidade').innerHTML = compat.map(u => `<option value="${u}">${rot[u]||u}</option>`).join('');
    document.getElementById('editar-emb-hint').textContent =
      `Ex.: 1 embalagem contém X ${base}. Você compra a embalagem e usa por ${base} na ficha.`;
  },

  async salvarEdicao(e) {
    e.preventDefault();
    const id = document.getElementById('editar-ing-id').value;
    const body = {
      nome: document.getElementById('editar-ing-nome').value,
      unidade_base: document.getElementById('editar-ing-unidade').value,
    };
    if (document.getElementById('editar-ing-tem-emb').checked) {
      const conteudo = parseFloat(document.getElementById('editar-emb-conteudo').value);
      if (!(conteudo > 0)) { UI.toast('Informe o conteúdo da embalagem.', 'erro'); return; }
      body.embalagem = {
        nome: document.getElementById('editar-emb-nome').value.trim() || 'embalagem',
        conteudo,
        unidade: document.getElementById('editar-emb-unidade').value,
      };
    } else {
      body.embalagem = null;
    }
    try {
      await API.put('/ingredientes/' + id, body);
      UI.fecharModal('modal-editar-ing');
      await Ingredientes.carregar();
      UI.toast('Ingrediente atualizado.');
    } catch (err) {
      UI.toast(err.erro || 'Erro ao editar.', 'erro');
    }
  },

  async excluir(id, nome) {
    if (!confirm(`Excluir "${nome}"?\nSe estiver em alguma ficha, a exclusão será bloqueada.`)) return;
    try {
      const res = await API.delete('/ingredientes/' + id);
      await Ingredientes.carregar();
      UI.toast(res.mensagem);
    } catch (err) {
      UI.toast(err.erro || 'Erro ao excluir.', 'erro');
    }
  },
};

// ═══════════════════════════════════════════════════════════════
// LISTA PADRÃO
// ═══════════════════════════════════════════════════════════════
const IngPadrao = {
  abrirModal() {
    const existentes = new Set(_ingredientes.map(i => i.nome.toLowerCase()));
    const cont = document.getElementById('padrao-lista');
    cont.innerHTML = INGREDIENTES_PADRAO.map(cat => `
      <div class="padrao-categoria">
        <div class="padrao-categoria-titulo">${cat.categoria}</div>
        ${cat.itens.map(it => {
          const existe = existentes.has(it.nome.toLowerCase());
          return `<div class="padrao-item${existe?' ja-existe':''}" onclick="IngPadrao.toggle(this)"
                       data-nome="${it.nome}" data-base="${it.base}">
            <input type="checkbox" ${existe?'disabled':''} onclick="event.stopPropagation()" />
            <span class="padrao-item-nome">${it.nome}</span>
            <span class="padrao-item-un">por ${it.base}</span>
            <span class="padrao-item-dica">${it.dica}</span>
          </div>`;
        }).join('')}
      </div>`).join('');
    IngPadrao.contar();
    UI.abrirModal('modal-padrao');
  },
  toggle(div) {
    if (div.classList.contains('ja-existe')) return;
    const cb = div.querySelector('input');
    cb.checked = !cb.checked;
    div.classList.toggle('selecionado', cb.checked);
    IngPadrao.contar();
  },
  contar() {
    const n = document.querySelectorAll('#padrao-lista input:checked').length;
    document.getElementById('padrao-contagem').textContent =
      n === 0 ? 'Nenhum selecionado' : `${n} selecionado${n>1?'s':''}`;
  },
  async importar() {
    const sel = [...document.querySelectorAll('#padrao-lista .padrao-item')]
      .filter(d => d.querySelector('input:checked'))
      .map(d => d.dataset);
    if (!sel.length) { UI.toast('Selecione ao menos um ingrediente.', 'aviso'); return; }
    let ok = 0;
    for (const d of sel) {
      try { await API.post('/ingredientes/pendente', { nome: d.nome, unidade_base: d.base }); ok++; } catch {}
    }
    UI.fecharModal('modal-padrao');
    await Ingredientes.carregar();
    UI.toast(`${ok} ingrediente(s) importado(s) sem preço. Clique em "Registrar Preço" em cada um.`, 'aviso');
  },
};

// ═══════════════════════════════════════════════════════════════
// MÓDULO 2 — FICHAS
// ═══════════════════════════════════════════════════════════════
const Fichas = {
  async carregar() {
    const fichas = await API.get('/fichas');
    const cont = document.getElementById('lista-fichas');
    if (!fichas.length) { cont.innerHTML = '<p class="empty" style="width:100%">Nenhuma ficha técnica criada</p>'; return; }
    cont.innerHTML = fichas.map(f => Fichas.card(f)).join('');
  },
  card(f) {
    const cmv = f.cmv_cache;
    const cmvHtml = (f.status === 'confirmado' && cmv?.valido)
      ? `<div class="cmv-indicator cmv-${cmv.indicador_classe}">CMV: ${Fmt.pct(cmv.cmv_percentual)} — ${cmv.indicador}</div>` : '';
    const rateioTag = f.incluir_rateio ? '<span style="font-size:0.7rem;color:var(--green);margin-left:6px">+ Custos Fixos</span>' : '';
    const nomeJS = f.nome.replace(/'/g, "\\'");
    const tipos = { hamburguer:'🍔 Hamburguer', pizza:'🍕 Pizza', bebida:'🥤 Bebida', porcao:'🍟 Porção', outro:'🍽 Outro' };
    return `<div class="ficha-card ${f.status}">
      <div class="ficha-card-header">
        <div><div class="ficha-card-nome">${f.nome}${rateioTag}</div>
        <div class="ficha-card-tipo">${tipos[f.tipo]||f.tipo}</div></div>
        <span class="badge badge-${f.status}">${f.status}</span>
      </div>
      <div class="ficha-card-info">
        <div class="ficha-stat">${Fmt.moeda(f.preco_venda)}<span>Preço de Venda</span></div>
        <div class="ficha-stat">${f.ingredientes.length}<span>Ingredientes</span></div>
      </div>
      ${cmvHtml}
      <div class="ficha-card-actions">
        <button class="btn-edit" onclick="Fichas.verCMV('${f.id}')">Ver CMV</button>
        ${f.status === 'rascunho'
          ? `<button class="btn-confirm" onclick="Fichas.confirmar('${f.id}')">Confirmar</button>`
          : `<button class="btn-secondary" style="font-size:0.78rem;padding:5px 10px" onclick="Fichas.rascunho('${f.id}')">Voltar a Rascunho</button>`}
        <button class="btn-edit" onclick="Fichas.editar('${f.id}')">Editar</button>
        <button class="btn-danger" onclick="Fichas.excluir('${f.id}','${nomeJS}')">Excluir</button>
      </div></div>`;
  },
  adicionarLinha(item = null) {
    const cont = document.getElementById('ingredientes-lista-ficha');
    cont.querySelector('.ingrediente-vazio')?.remove();
    const opts = _ingredientes.map(i => {
      const aviso = i.custo_base > 0 ? '' : ' ⚠ sem preço';
      return `<option value="${i.id}" data-base="${i.unidade_base}" ${item?.ingrediente_id===i.id?'selected':''}>${i.nome} (${i.unidade_base})${aviso}</option>`;
    }).join('');
    const baseSel = item ? (_ingredientes.find(i=>i.id===item.ingrediente_id)?.unidade_base || 'g') : 'g';
    const div = document.createElement('div');
    div.className = 'ingrediente-linha';
    div.innerHTML = `
      <div><label>Ingrediente *</label>
        <select class="ing-select" required onchange="Fichas.atualizarRotuloQtd(this)">
          <option value="">— selecione —</option>${opts}
        </select></div>
      <div><label class="lbl-qtd">Quantidade (${baseSel})</label>
        <input type="number" class="ing-qtd" step="0.01" min="0.01" value="${item?.quantidade||''}" required placeholder="Ex: 150" /></div>
      <div><label>Fator Correção</label>
        <input type="number" class="ing-fator" step="0.01" min="1" max="3" value="${item?.fator_correcao||1.00}" /></div>
      <button type="button" class="btn-remover" onclick="this.parentElement.remove()" title="Remover">✕</button>`;
    cont.appendChild(div);
  },
  atualizarRotuloQtd(sel) {
    const base = sel.selectedOptions[0]?.dataset.base || 'g';
    const lbl = sel.closest('.ingrediente-linha').querySelector('.lbl-qtd');
    if (lbl) lbl.textContent = `Quantidade (${base})`;
  },
  coletar() {
    return [...document.querySelectorAll('#ingredientes-lista-ficha .ingrediente-linha')].map(d => ({
      ingrediente_id: d.querySelector('.ing-select').value,
      quantidade: parseFloat(d.querySelector('.ing-qtd').value),
      fator_correcao: parseFloat(d.querySelector('.ing-fator').value || 1.0),
    }));
  },
  async salvar(e) {
    e.preventDefault();
    const id = document.getElementById('ficha-id').value;
    const ingredientes = Fichas.coletar();
    if (!ingredientes.length) { UI.toast('Adicione ao menos um ingrediente.', 'erro'); return; }
    if (ingredientes.some(i => !i.ingrediente_id)) { UI.toast('Selecione o ingrediente em cada linha.', 'erro'); return; }
    const body = {
      nome: document.getElementById('ficha-nome').value,
      tipo: document.getElementById('ficha-tipo').value,
      preco_venda: parseFloat(document.getElementById('ficha-preco').value),
      custo_embalagem: parseFloat(document.getElementById('ficha-embalagem').value || 0),
      incluir_rateio: document.getElementById('ficha-rateio').checked,
      ingredientes,
    };
    try {
      if (id) { await API.put('/fichas/' + id, body); UI.toast('Ficha atualizada (voltou a rascunho).'); }
      else { await API.post('/fichas', body); UI.toast('Ficha criada. Revise e clique em Confirmar.'); }
      UI.fecharModal('modal-ficha');
      await Fichas.carregar();
    } catch (err) { UI.toast(err.erro || 'Erro ao salvar ficha.', 'erro'); }
  },
  async editar(id) { UI.abrirModalFicha(await API.get('/fichas/' + id)); },
  async confirmar(id) {
    try {
      const res = await API.post('/fichas/' + id + '/confirmar');
      await Fichas.carregar();
      UI.toast('Ficha confirmada! CMV oficializado.');
      Fichas.mostrar(res.ficha, res.cmv);
    } catch (err) {
      if (err.erros) {
        const ficha = await API.get('/fichas/' + id).catch(() => ({ nome: '' }));
        Fichas.mostrar(ficha, { valido: false, erros: err.erros });
        UI.toast('Cálculo bloqueado — veja os erros.', 'erro');
      } else UI.toast(err.erro || 'Erro ao confirmar.', 'erro');
    }
  },
  async rascunho(id) {
    if (!confirm('Voltar para rascunho? O CMV oficial será removido.')) return;
    await API.post('/fichas/' + id + '/rascunho');
    await Fichas.carregar();
    UI.toast('Ficha voltou para rascunho.', 'aviso');
  },
  async verCMV(id) {
    const [ficha, cmv] = await Promise.all([API.get('/fichas/'+id), API.get('/fichas/'+id+'/cmv')]);
    Fichas.mostrar(ficha, cmv);
  },
  mostrar(ficha, cmv) {
    document.getElementById('modal-cmv-titulo').textContent = ficha.nome || 'Detalhamento CMV';
    const cont = document.getElementById('modal-cmv-conteudo');
    if (!cmv.valido) {
      cont.innerHTML = `<div style="padding:20px">
        <div class="erros-bloco">
          <div class="erros-bloco-titulo">⛔ Cálculo bloqueado — corrija antes de confirmar</div>
          <ul>${cmv.erros.map(e=>`<li>${e}</li>`).join('')}</ul>
        </div>
        <p style="font-size:0.82rem;color:var(--text-muted);margin-top:10px;line-height:1.6">
          Vá em <strong>Ingredientes</strong>, clique em <strong>Registrar Preço</strong> no item indicado e volte para confirmar.
        </p></div>`;
      UI.abrirModal('modal-cmv');
      return;
    }
    const rows = cmv.detalhamento.map(d => `<tr>
      <td>${d.nome}</td>
      <td style="text-align:right">${d.quantidade_usada} ${d.unidade_base}</td>
      <td style="text-align:center">${d.fator_correcao.toFixed(2)}</td>
      <td style="text-align:right">${d.quantidade_real} ${d.unidade_base}</td>
      <td style="text-align:right">${Fmt.custoUnit(d.custo_base, d.unidade_base)}</td>
      <td style="text-align:right;font-weight:700;color:var(--accent)">${Fmt.moeda(d.custo_na_porcao)}</td>
    </tr>`).join('');
    const rateioRow = cmv.custo_rateio > 0
      ? `<div class="totais-item"><span>Custos Fixos (rateio${cmv.rateio_competencia?' '+Fmt.competencia(cmv.rateio_competencia):''})</span><strong style="color:var(--yellow)">${Fmt.moeda(cmv.custo_rateio)}</strong></div>` : '';
    cont.innerHTML = `<div style="padding:20px">
      <div class="cmv-indicator cmv-${cmv.indicador_classe}" style="margin-bottom:16px;font-size:0.95rem">${cmv.indicador} — CMV: <strong>${Fmt.pct(cmv.cmv_percentual)}</strong></div>
      <div class="tabela-scroll"><table class="detalhe-tabela">
        <thead><tr>
          <th>Ingrediente</th><th style="text-align:right">Qtd</th><th style="text-align:center">Fator</th>
          <th style="text-align:right">Qtd Real</th><th style="text-align:right">Custo/Un</th><th style="text-align:right">Custo Porção</th>
        </tr></thead><tbody>${rows}</tbody>
      </table></div>
      <div class="totais-bloco">
        <div class="totais-item"><span>Insumos</span><strong>${Fmt.moeda(cmv.custo_total_insumos)}</strong></div>
        <div class="totais-item"><span>Embalagem</span><strong>${Fmt.moeda(cmv.custo_embalagem)}</strong></div>
        ${rateioRow}
        <div class="totais-item"><span>Custo Total</span><strong style="color:var(--accent)">${Fmt.moeda(cmv.custo_total)}</strong></div>
        <div class="totais-item"><span>Preço de Venda</span><strong>${Fmt.moeda(cmv.preco_venda)}</strong></div>
        <div class="totais-item"><span>Margem Bruta</span><strong style="color:var(--green)">${Fmt.moeda(cmv.margem_bruta)}</strong></div>
        <div class="totais-item"><span>CMV %</span><strong class="cmv-${cmv.indicador_classe}" style="font-size:1.3rem;padding:2px 8px;border-radius:6px">${Fmt.pct(cmv.cmv_percentual)}</strong></div>
      </div></div>`;
    UI.abrirModal('modal-cmv');
  },
  async excluir(id, nome) {
    if (!confirm(`Excluir a ficha "${nome}"?`)) return;
    await API.delete('/fichas/' + id);
    await Fichas.carregar();
    UI.toast('Ficha excluída.');
  },
};

// ═══════════════════════════════════════════════════════════════
// MÓDULO 3 — RELATÓRIO
// ═══════════════════════════════════════════════════════════════
const Relatorio = {
  async carregar() {
    const data = await API.get('/relatorio');
    const cor = v => v===null?'var(--text-muted)':v<25?'var(--yellow)':v<=33?'var(--green)':v<=35?'var(--yellow)':'var(--red)';
    const txt = v => v===null?'—':v<25?'⚠ CMV baixo':v<=33?'✔ Saudável':v<=35?'⚠ No limite':'🚨 CMV Alto';
    document.getElementById('relatorio-resumo').innerHTML = `
      <div class="resumo-card"><div class="valor">${data.total_produtos}</div><div class="label">Produtos Confirmados</div></div>
      <div class="resumo-card"><div class="valor" style="color:${cor(data.cmv_medio)}">${data.cmv_medio!==null?Fmt.pct(data.cmv_medio):'—'}</div><div class="label">CMV Médio</div></div>
      <div class="resumo-card"><div class="valor" style="font-size:1rem">${txt(data.cmv_medio)}</div><div class="label">Saúde Geral</div></div>`;
    const lista = document.getElementById('relatorio-lista');
    if (!data.relatorio.length) { lista.innerHTML = '<p class="empty">Nenhum produto confirmado. Confirme fichas para gerar o relatório.</p>'; return; }
    lista.innerHTML = data.relatorio.filter(i=>i.cmv?.valido).map(item => {
      const cmv = item.cmv;
      const rows = cmv.detalhamento.map(d => `<tr>
        <td>${d.nome}</td><td style="text-align:right">${d.quantidade_usada} ${d.unidade_base}</td>
        <td style="text-align:center">${d.fator_correcao.toFixed(2)}</td>
        <td style="text-align:right">${Fmt.custoUnit(d.custo_base,d.unidade_base)}</td>
        <td style="text-align:right;font-weight:600">${Fmt.moeda(d.custo_na_porcao)}</td></tr>`).join('');
      const rateio = cmv.custo_rateio>0?`<div class="totais-item"><span>Custos Fixos</span><strong style="color:var(--yellow)">${Fmt.moeda(cmv.custo_rateio)}</strong></div>`:'';
      return `<div class="relatorio-produto">
        <div class="relatorio-produto-header" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'">
          <div><span class="relatorio-produto-nome">${item.nome}</span>
          <span style="color:var(--text-muted);font-size:0.78rem;margin-left:10px">${Fmt.data(item.ultima_atualizacao)}</span></div>
          <div style="display:flex;align-items:center;gap:14px">
            <span class="cmv-indicator cmv-${cmv.indicador_classe}" style="margin:0">CMV ${Fmt.pct(cmv.cmv_percentual)} — ${cmv.indicador}</span>
            <span style="color:var(--text-muted)">▾</span></div>
        </div>
        <div class="relatorio-produto-body" style="display:none">
          <div class="tabela-scroll"><table class="detalhe-tabela"><thead><tr>
            <th>Ingrediente</th><th style="text-align:right">Qtd</th><th style="text-align:center">Fator</th>
            <th style="text-align:right">Custo/Un</th><th style="text-align:right">Custo Porção</th></tr></thead>
            <tbody>${rows}</tbody></table></div>
          <div class="totais-bloco">
            <div class="totais-item"><span>Insumos</span><strong>${Fmt.moeda(cmv.custo_total_insumos)}</strong></div>
            <div class="totais-item"><span>Embalagem</span><strong>${Fmt.moeda(cmv.custo_embalagem)}</strong></div>
            ${rateio}
            <div class="totais-item"><span>Custo Total</span><strong>${Fmt.moeda(cmv.custo_total)}</strong></div>
            <div class="totais-item"><span>Preço</span><strong>${Fmt.moeda(cmv.preco_venda)}</strong></div>
            <div class="totais-item"><span>Margem Bruta</span><strong style="color:var(--green)">${Fmt.moeda(cmv.margem_bruta)}</strong></div>
          </div></div></div>`;
    }).join('');
  },
};

// ═══════════════════════════════════════════════════════════════
// MÓDULO 4 — CUSTOS FIXOS MENSAIS
// ═══════════════════════════════════════════════════════════════
const CAMPOS_CF = ['aluguel','energia','gas','salarios','agua','internet','marketing','manutencao','outros'];
const VENDAS_TIPOS = ['hamburguer','pizza','bebida','porcao','outro'];

const CustosFixos = {
  async carregar() {
    const data = await API.get('/custos-fixos');
    _meses = data.meses;
    const sel = document.getElementById('seletor-mes');
    if (!_meses.length) {
      document.getElementById('custos-vazio').style.display = 'flex';
      document.getElementById('custos-formulario').style.display = 'none';
      sel.innerHTML = '<option>— sem meses —</option>';
      _mesAtivo = null;
      return;
    }
    sel.innerHTML = _meses.map(m => `<option value="${m.id}">${Fmt.competencia(m.competencia)}</option>`).join('');
    // mantém seleção atual se existir, senão o mais recente
    const idAtivo = _mesAtivo && _meses.find(m=>m.id===_mesAtivo.id) ? _mesAtivo.id : _meses[0].id;
    sel.value = idAtivo;
    CustosFixos.selecionar(idAtivo);
  },
  selecionar(id) {
    _mesAtivo = _meses.find(m => m.id === id);
    if (!_mesAtivo) return;
    document.getElementById('custos-vazio').style.display = 'none';
    document.getElementById('custos-formulario').style.display = 'block';
    CAMPOS_CF.forEach(c => { document.getElementById('cf-'+c).value = _mesAtivo[c] || ''; });
    // Vendas por tipo (com retrocompatibilidade: meses antigos tinham só o total)
    const det = _mesAtivo.vendas_detalhe || {};
    const temDetalhe = VENDAS_TIPOS.some(t => det[t]);
    VENDAS_TIPOS.forEach(t => { document.getElementById('cv-'+t).value = det[t] || ''; });
    if (!temDetalhe && _mesAtivo.vendas_mes) {
      // mês antigo: joga o total em "outros" para não perder o dado
      document.getElementById('cv-outro').value = _mesAtivo.vendas_mes;
    }
    CustosFixos.recalcular();
  },
  vendasDetalhe() {
    const d = {};
    VENDAS_TIPOS.forEach(t => { d[t] = parseInt(document.getElementById('cv-'+t).value, 10) || 0; });
    return d;
  },
  totalVendas() {
    const d = CustosFixos.vendasDetalhe();
    return VENDAS_TIPOS.reduce((s,t)=>s+d[t], 0);
  },
  coletar() {
    const o = { vendas_detalhe: CustosFixos.vendasDetalhe() };
    CAMPOS_CF.forEach(c => { o[c] = parseFloat(document.getElementById('cf-'+c).value) || 0; });
    return o;
  },
  recalcular() {
    const total = CAMPOS_CF.reduce((s,c)=>s+(parseFloat(document.getElementById('cf-'+c).value)||0),0);
    const vendas = CustosFixos.totalVendas();
    const porProd = vendas>0 ? total/vendas : 0;
    document.getElementById('vendas-total').textContent = vendas.toLocaleString('pt-BR');
    document.getElementById('rateio-total').textContent = Fmt.moeda(total);
    document.getElementById('rateio-vendas').textContent = vendas.toLocaleString('pt-BR');
    document.getElementById('rateio-por-produto').textContent = Fmt.moeda(porProd);
    const expl = document.getElementById('rateio-explicacao');
    if (total>0 && vendas>0) expl.textContent = `Cada produto precisa cobrir ${Fmt.moeda(porProd)} de custo fixo, além dos ingredientes.`;
    else if (total>0) expl.textContent = 'Informe as vendas do mês (quantidade) para calcular o rateio.';
    else expl.textContent = 'Preencha os custos e as vendas do mês.';
  },
  abrirNovoMes() {
    document.getElementById('form-mes').reset();
    // sugere o mês atual
    const hoje = new Date();
    document.getElementById('mes-competencia').value = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}`;
    UI.abrirModal('modal-mes');
  },
  async criarMes(e) {
    e.preventDefault();
    const competencia = document.getElementById('mes-competencia').value;
    if (!competencia) { UI.toast('Escolha o mês.', 'erro'); return; }
    const body = { competencia };
    if (document.getElementById('mes-copiar').checked && _meses.length) {
      const base = _meses[0];
      CAMPOS_CF.forEach(c => body[c] = base[c] || 0);
      body.vendas_detalhe = base.vendas_detalhe || {};
    }
    try {
      const res = await API.post('/custos-fixos', body);
      UI.fecharModal('modal-mes');
      _mesAtivo = res.mes;
      await CustosFixos.carregar();
      document.getElementById('seletor-mes').value = res.mes.id;
      CustosFixos.selecionar(res.mes.id);
      UI.toast(res.mensagem);
    } catch (err) { UI.toast(err.erro || 'Erro ao criar mês.', 'erro'); }
  },
  async salvar() {
    if (!_mesAtivo) return;
    try {
      const res = await API.put('/custos-fixos/' + _mesAtivo.id, CustosFixos.coletar());
      _mesAtivo = res.mes;
      const extra = res.fichas_recalculadas ? ` (${res.fichas_recalculadas} ficha[s] com rateio recalculada[s])` : '';
      UI.toast('Custos do mês salvos.' + extra);
      CustosFixos.recalcular();
    } catch (err) { UI.toast(err.erro || 'Erro ao salvar.', 'erro'); }
  },
  async excluirMes() {
    if (!_mesAtivo) return;
    if (!confirm(`Excluir o mês ${Fmt.competencia(_mesAtivo.competencia)}?`)) return;
    await API.delete('/custos-fixos/' + _mesAtivo.id);
    _mesAtivo = null;
    await CustosFixos.carregar();
    UI.toast('Mês excluído.', 'aviso');
  },
};
CAMPOS_CF.forEach(c => {
  document.getElementById('cf-'+c)?.addEventListener('input', () => CustosFixos.recalcular());
});
VENDAS_TIPOS.forEach(t => {
  document.getElementById('cv-'+t)?.addEventListener('input', () => CustosFixos.recalcular());
});

// ═══════════════════════════════════════════════════════════════
// MÓDULO 5 — COMPRAS E FORNECEDORES
// ═══════════════════════════════════════════════════════════════
const Compras = {
  async carregar() {
    const data = await API.get('/compras/analise');
    document.getElementById('compras-resumo').innerHTML = `
      <div class="resumo-card"><div class="valor">${data.total_itens}</div><div class="label">Itens com Compras</div></div>
      <div class="resumo-card"><div class="valor" style="color:${data.alertas ? 'var(--red)' : 'var(--green)'}">${data.alertas}</div><div class="label">Alertas de Alta</div></div>`;

    const lista = document.getElementById('compras-lista');
    if (!data.analise.length) {
      lista.innerHTML = '<p class="empty">Nenhuma compra registrada ainda. Cadastre ingredientes com preço (e fornecedor) na aba Ingredientes.</p>';
      return;
    }
    lista.innerHTML = data.analise.map(a => Compras.card(a)).join('');
  },

  card(a) {
    const seta = a.alerta
      ? `<span class="seta-alta" title="Mais de 5% acima da compra anterior">🔺 +${a.variacao}%</span>`
      : (a.variacao !== null && a.variacao < 0
          ? `<span class="seta-baixa" title="Mais barato que a compra anterior">🔻 ${a.variacao}%</span>`
          : '');

    const ultimoFornec = a.ultimo.fornecedor || '—';
    const melhorFornec = a.melhor.fornecedor || '—';
    const igualMelhor = a.ultimo.custo_base <= a.melhor.custo_base;

    const linhas = a.ultimos3.map(r => `
      <tr>
        <td>${Fmt.data(r.data)}</td>
        <td>${r.fornecedor || '<span style="color:var(--text-muted)">—</span>'}</td>
        <td style="text-align:right">${r.quantidade_comprada} ${r.unidade_compra}</td>
        <td style="text-align:right">${Fmt.moeda(r.valor_total)}</td>
        <td style="text-align:right;font-weight:600">${Fmt.custoUnit(r.custo_base, a.unidade_base)}</td>
      </tr>`).join('');

    return `<div class="compra-card ${a.alerta ? 'tem-alerta' : ''}">
      <div class="compra-card-top">
        <div class="compra-nome">${a.nome} ${seta}</div>
        <div class="compra-precos">
          <div class="preco-bloco">
            <span class="preco-label">Último preço</span>
            <strong>${Fmt.custoUnit(a.ultimo.custo_base, a.unidade_base)}</strong>
            <small>${ultimoFornec}</small>
          </div>
          <div class="preco-bloco ${igualMelhor ? 'no-melhor' : ''}">
            <span class="preco-label">Melhor preço</span>
            <strong style="color:var(--green)">${Fmt.custoUnit(a.melhor.custo_base, a.unidade_base)}</strong>
            <small>${melhorFornec} · ${Fmt.data(a.melhor.data)}</small>
          </div>
        </div>
      </div>
      ${!igualMelhor && a.acima_do_melhor > 0
        ? `<div class="compra-dica">💰 Você está pagando <strong>${a.acima_do_melhor}%</strong> acima do melhor preço já conseguido. Vale negociar.</div>`
        : (igualMelhor ? `<div class="compra-dica ok">✓ Você está no melhor preço já registrado.</div>` : '')}
      <div class="tabela-scroll"><table class="detalhe-tabela compra-tabela">
        <thead><tr>
          <th>Data</th><th>Fornecedor</th><th style="text-align:right">Qtd</th>
          <th style="text-align:right">Total</th><th style="text-align:right">Custo/Un</th>
        </tr></thead>
        <tbody>${linhas}</tbody>
      </table></div>
    </div>`;
  },
};

// ═══════════════════════════════════════════════════════════════
// MÓDULO 6 — ESTOQUE
// ═══════════════════════════════════════════════════════════════
const ROTULOS_UN = { kg:'kg — quilograma', g:'g — grama', L:'L — litro', ml:'ml — mililitro', un:'un — unidade' };
function opcoesUnidade(base, selecionada) {
  const lista = UNIDADES_POR_BASE[base] || [base];
  const sel = selecionada || lista[0];
  return lista.map(u => `<option value="${u}" ${u===sel?'selected':''}>${ROTULOS_UN[u]||u}</option>`).join('');
}
// Opções de unidade para um ingrediente, incluindo a embalagem ('emb') quando houver.
function opcoesUnidadeIng(ing, selecionada) {
  let html = '';
  if (ing.embalagem) {
    const e = ing.embalagem;
    const sel = (selecionada === 'emb') ? 'selected' : '';
    html += `<option value="emb" ${sel}>${e.nome} (${e.conteudo} ${e.unidade})</option>`;
  }
  const base = ing.unidade_base;
  const lista = UNIDADES_POR_BASE[base] || [base];
  const selBase = selecionada && selecionada !== 'emb' ? selecionada : (ing.embalagem ? null : lista[0]);
  html += lista.map(u => `<option value="${u}" ${u===selBase?'selected':''}>${ROTULOS_UN[u]||u}</option>`).join('');
  return html;
}
function fmtQtd(valor, unidade) {
  const n = Number(valor);
  const txt = n.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
  return `${txt} ${unidade}`;
}

let _estoqueItens = [];
let _estoquePanorama = null;

const Estoque = {
  async carregar() {
    const data = await API.get('/estoque');
    _estoquePanorama = data;
    _estoqueItens = data.itens;

    // Botão de contagem muda de rótulo conforme o estágio
    const btn = document.getElementById('btn-contagem');
    if (btn) {
      btn.disabled = !data.total_itens;
      btn.style.opacity = data.total_itens ? '1' : '0.5';
      btn.textContent = data.total_itens
        ? (data.ja_fez_contagem ? '✅ Conferência de Fechamento' : '📋 Fazer Inventário Inicial')
        : '📋 Contagem do Dia';
    }

    const precisaComprar = data.itens_abaixo_minimo + data.itens_zerados;
    const ultima = data.ultima_contagem;
    const ultimaTxt = ultima ? Fmt.data(ultima.data) : '—';
    document.getElementById('estoque-resumo').innerHTML = `
      <div class="resumo-card"><div class="valor">${Fmt.moeda(data.valor_total_estoque)}</div><div class="label">Valor Parado em Estoque</div></div>
      <div class="resumo-card"><div class="valor">${data.total_itens}</div><div class="label">Itens no Estoque</div></div>
      <div class="resumo-card"><div class="valor" style="color:${precisaComprar?'var(--red)':'var(--green)'}">${precisaComprar}</div><div class="label">Precisa Comprar</div></div>
      <div class="resumo-card"><div class="valor" style="font-size:1.05rem">${ultimaTxt}</div><div class="label">Última Contagem</div></div>`;

    // Lista de compras
    const bloco = document.getElementById('estoque-compras-bloco');
    if (data.lista_compras.length) {
      bloco.style.display = 'block';
      document.getElementById('lista-compras-contagem').textContent = `(${data.lista_compras.length})`;
      document.getElementById('lista-compras-itens').innerHTML = data.lista_compras.map(i => {
        const tag = i.situacao === 'zerado'
          ? '<span class="badge-estoque zerado">Sem estoque</span>'
          : '<span class="badge-estoque baixo">Abaixo do mínimo</span>';
        const restante = i.minimo_base > 0
          ? `tem ${fmtQtd(i.estoque_exibicao, i.unidade_exibicao)}, mínimo ${fmtQtd(i.minimo_exibicao, i.unidade_exibicao)}`
          : `tem ${fmtQtd(i.estoque_exibicao, i.unidade_exibicao)}`;
        return `<div class="lista-compras-item">
          <div><strong>${i.nome}</strong> ${tag}</div>
          <div style="color:var(--text-muted);font-size:0.8rem">${restante}</div>
          <button class="btn-confirm" onclick="Estoque.abrirMovimento('${i.id}','entrada')">Registrar Entrada</button>
        </div>`;
      }).join('');
    } else {
      bloco.style.display = 'none';
    }

    // Tabela completa
    const tbody = document.getElementById('lista-estoque');
    if (!_estoqueItens.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty">Nenhum ingrediente cadastrado. Cadastre os itens na aba <strong>Ingredientes</strong> (com preço) e eles aparecerão aqui.</td></tr>';
      document.getElementById('estoque-historico').innerHTML = '';
      return;
    }
    tbody.innerHTML = _estoqueItens.map(i => {
      const badge = { ok:'<span class="badge-estoque ok">Em estoque</span>', baixo:'<span class="badge-estoque baixo">Baixo</span>', zerado:'<span class="badge-estoque zerado">Zerado</span>' }[i.situacao];
      const minimo = i.minimo_base > 0 ? fmtQtd(i.minimo_exibicao, i.unidade_exibicao) : '<span style="color:var(--text-muted)">—</span>';
      return `<tr>
        <td data-label="Ingrediente"><strong class="link-historico" onclick="Historico.timeline('${i.id}')" title="Ver linha do tempo">${i.nome}</strong></td>
        <td data-label="Em Estoque" style="text-align:right"><strong>${fmtQtd(i.estoque_exibicao, i.unidade_exibicao)}</strong>${i.estoque_embalagem!=null?`<br><small style="color:var(--text-muted)">≈ ${i.estoque_embalagem} ${i.embalagem.nome}</small>`:''}</td>
        <td data-label="Mínimo" style="text-align:right;color:var(--text-muted)">${minimo}</td>
        <td data-label="Valor Parado" style="text-align:right">${i.tem_preco ? Fmt.moeda(i.valor_estoque) : '<span class="badge-sem-preco">sem preço</span>'}</td>
        <td data-label="Situação" style="text-align:center">${badge}</td>
        <td class="cell-acoes" data-label="Ações"><div class="acoes-cell">
          <button class="btn-confirm" onclick="Estoque.abrirMovimento('${i.id}','entrada')" title="Chegou mercadoria">＋ Entrada</button>
          <button class="btn-danger" onclick="Estoque.abrirMovimento('${i.id}','saida')" title="Perda / quebra">－ Baixa</button>
          <button class="btn-edit" onclick="Estoque.abrirMinimo('${i.id}')">Mínimo</button>
        </div></td>
      </tr>`;
    }).join('');

    Estoque.carregarHistorico();
  },

  // ── Histórico de contagens (consumo por dia) ──
  async carregarHistorico() {
    let contagens = [];
    try { contagens = await API.get('/estoque/contagens'); } catch { return; }
    const cont = document.getElementById('estoque-historico');
    if (!contagens.length) { cont.innerHTML = ''; return; }
    const linhas = contagens.slice(0, 12).map(c => {
      const tipoTag = c.tipo === 'inicial'
        ? '<span class="badge-estoque ok">Inventário inicial</span>'
        : '<span class="badge-estoque" style="background:rgba(245,166,35,0.12);color:var(--accent);border:1px solid rgba(245,166,35,0.3)">Conferência</span>';
      return `<tr>
        <td data-label="Data">${Fmt.data(c.data)} ${tipoTag}</td>
        <td data-label="Itens" style="text-align:right">${c.total_itens}</td>
        <td data-label="Saiu do estoque" style="text-align:right;color:var(--red)">${c.valor_consumo>0?Fmt.moeda(c.valor_consumo):'—'}</td>
        <td data-label="Valor contado" style="text-align:right">${Fmt.moeda(c.valor_contado)}</td>
      </tr>`;
    }).join('');
    cont.innerHTML = `
      <h3 style="font-size:0.95rem;font-weight:600;margin-bottom:12px">📅 Histórico de Contagens</h3>
      <div class="card"><table>
        <thead><tr>
          <th>Data</th><th style="text-align:right">Itens</th>
          <th style="text-align:right">Saiu do Estoque</th><th style="text-align:right">Valor Contado</th>
        </tr></thead>
        <tbody>${linhas}</tbody>
      </table></div>`;
  },

  // ── Contagem do dia (inventário inicial + conferência) ──
  abrirContagem() {
    if (!_estoqueItens.length) { UI.toast('Cadastre ingredientes primeiro na aba Ingredientes.', 'aviso'); return; }
    const inicial = !_estoquePanorama?.ja_fez_contagem;
    document.getElementById('modal-contagem-titulo').textContent =
      inicial ? '📋 Inventário Inicial' : '✅ Conferência de Fechamento';
    document.getElementById('contagem-saiu-label').textContent =
      inicial ? 'Valor inicial' : 'Saiu do estoque';
    document.getElementById('contagem-ajuda').innerHTML = inicial
      ? 'Primeira contagem: digite <strong>quanto você tem hoje</strong> de cada item. Isso vira a base do seu estoque.'
      : 'Fim do dia: digite <strong>quanto sobrou</strong> de cada item. O sistema calcula o que saiu (vendas + perdas).';

    const semPreco = (_estoquePanorama?.sem_preco || []);
    const aviso = semPreco.length
      ? `<div class="contagem-aviso">⚠ ${semPreco.length} item(ns) sem preço não entram no valor. Registre o preço na aba Ingredientes para o estoque ficar exato.</div>`
      : '';

    document.getElementById('contagem-lista').innerHTML = aviso + _estoqueItens.map(i => {
      // Itens com embalagem são contados NA embalagem (ex.: latas); os demais em kg/L/un.
      const usaEmb = !!i.embalagem;
      const unidade = usaEmb ? 'emb' : i.unidade_exibicao;
      const rotulo = usaEmb ? i.embalagem.nome : i.unidade_exibicao;
      const fator = usaEmb ? i.conteudo_embalagem_base : i.fator_exibicao;
      const sistema = usaEmb ? i.estoque_embalagem : i.estoque_exibicao;
      return `
      <div class="contagem-item" data-id="${i.id}" data-unidade="${unidade}" data-rotulo="${rotulo}" data-custo="${i.custo_base}" data-fator="${fator}" data-sistema="${sistema}">
        <div class="contagem-item-nome">${i.nome}${i.tem_preco?'':' <span class="badge-sem-preco">sem preço</span>'}</div>
        <div class="contagem-item-sistema">Sistema: ${fmtQtd(sistema, rotulo)}</div>
        <div class="contagem-item-input">
          <input type="number" step="0.001" min="0" value="${sistema}" oninput="Estoque.recalcContagem()" />
          <span class="contagem-item-un">${rotulo}</span>
        </div>
        <div class="contagem-item-diff" data-diff></div>
      </div>`;
    }).join('');

    Estoque.recalcContagem();
    UI.abrirModal('modal-contagem');
  },

  recalcContagem() {
    let valorContado = 0, valorSaiu = 0;
    document.querySelectorAll('#contagem-lista .contagem-item').forEach(el => {
      const custo = parseFloat(el.dataset.custo) || 0;          // por unidade base
      const fator = parseFloat(el.dataset.fator) || 1;          // base por unidade exibida
      const sistema = parseFloat(el.dataset.sistema) || 0;      // em unidade exibida
      const contado = parseFloat(el.querySelector('input').value);
      const diffEl = el.querySelector('[data-diff]');
      if (!(contado >= 0)) { diffEl.textContent = ''; return; }
      const rot = el.dataset.rotulo || el.dataset.unidade;
      valorContado += contado * fator * custo;
      const dif = sistema - contado; // positivo = saiu
      if (Math.abs(dif) < 0.0005) { diffEl.innerHTML = '<span class="dif-ok">✓ confere</span>'; }
      else if (dif > 0) { valorSaiu += dif * fator * custo; diffEl.innerHTML = `<span class="dif-saiu">saiu ${dif.toLocaleString('pt-BR',{maximumFractionDigits:3})} ${rot}</span>`; }
      else { diffEl.innerHTML = `<span class="dif-entrou">+${(-dif).toLocaleString('pt-BR',{maximumFractionDigits:3})} ${rot}</span>`; }
    });
    document.getElementById('contagem-valor').textContent = Fmt.moeda(valorContado);
    document.getElementById('contagem-saiu').textContent = Fmt.moeda(valorSaiu);
  },

  async salvarContagem() {
    const itens = [...document.querySelectorAll('#contagem-lista .contagem-item')].map(el => ({
      ingrediente_id: el.dataset.id,
      contado: parseFloat(el.querySelector('input').value),
      unidade: el.dataset.unidade,
    })).filter(x => x.contado >= 0);
    if (!itens.length) { UI.toast('Preencha as quantidades.', 'erro'); return; }
    const btn = document.getElementById('contagem-salvar');
    btn.disabled = true;
    try {
      const res = await API.post('/estoque/contagem', { itens });
      UI.fecharModal('modal-contagem');
      await Estoque.carregar();
      const c = res.contagem;
      if (c.valor_consumo > 0) UI.toast(`${res.mensagem} Saiu ${Fmt.moeda(c.valor_consumo)} do estoque.`, 'aviso');
      else UI.toast(res.mensagem);
    } catch (err) { UI.toast(err.erro || 'Erro ao salvar contagem.', 'erro'); }
    finally { btn.disabled = false; }
  },

  abrirMovimento(id, tipo = 'entrada') {
    const i = _estoqueItens.find(x => x.id === id);
    if (!i) return;
    document.getElementById('form-estoque').reset();
    document.getElementById('estoque-ing-id').value = i.id;
    document.getElementById('estoque-tipo').value = tipo;
    // Se compra por embalagem, oferece a embalagem como unidade (e usa por padrão)
    document.getElementById('estoque-unidade').innerHTML = opcoesUnidadeIng(i, i.embalagem ? 'emb' : null);
    document.getElementById('modal-estoque-titulo').textContent = `Movimentar — ${i.nome}`;
    const eqEmb = i.estoque_embalagem != null ? ` (≈ ${i.estoque_embalagem} ${i.embalagem.nome})` : '';
    document.getElementById('estoque-modal-info').innerHTML =
      `Estoque atual: <strong>${fmtQtd(i.estoque_exibicao, i.unidade_exibicao)}</strong>${eqEmb}`;
    Estoque.atualizarRotuloTipo();
    UI.abrirModal('modal-estoque');
  },

  atualizarRotuloTipo() {
    const tipo = document.getElementById('estoque-tipo').value;
    const lbl = document.getElementById('estoque-qtd-label');
    const txt = { entrada: 'Quantidade que entrou *', saida: 'Quantidade que saiu *', ajuste: 'Quantidade real contada *' }[tipo];
    lbl.childNodes[0].nodeValue = txt;
  },

  async salvarMovimento(e) {
    e.preventDefault();
    const body = {
      ingrediente_id: document.getElementById('estoque-ing-id').value,
      tipo: document.getElementById('estoque-tipo').value,
      quantidade: parseFloat(document.getElementById('estoque-quantidade').value),
      unidade: document.getElementById('estoque-unidade').value,
      motivo: document.getElementById('estoque-motivo').value,
    };
    try {
      const res = await API.post('/estoque/movimento', body);
      UI.fecharModal('modal-estoque');
      await Estoque.carregar();
      UI.toast(res.mensagem);
    } catch (err) { UI.toast(err.erro || 'Erro ao movimentar estoque.', 'erro'); }
  },

  abrirMinimo(id) {
    const i = _estoqueItens.find(x => x.id === id);
    if (!i) return;
    document.getElementById('form-minimo').reset();
    document.getElementById('minimo-ing-id').value = i.id;
    const usaEmb = !!i.embalagem;
    document.getElementById('minimo-unidade').innerHTML = opcoesUnidadeIng(i, usaEmb ? 'emb' : i.unidade_exibicao);
    let val = '';
    if (i.minimo_base > 0) val = usaEmb ? Math.round((i.minimo_base / i.conteudo_embalagem_base) * 100) / 100 : i.minimo_exibicao;
    document.getElementById('minimo-quantidade').value = val;
    document.getElementById('modal-minimo-titulo').textContent = `Estoque Mínimo — ${i.nome}`;
    UI.abrirModal('modal-minimo');
  },

  async salvarMinimo(e) {
    e.preventDefault();
    const id = document.getElementById('minimo-ing-id').value;
    const body = {
      minimo: parseFloat(document.getElementById('minimo-quantidade').value),
      unidade: document.getElementById('minimo-unidade').value,
    };
    try {
      await API.put('/estoque/' + id + '/minimo', body);
      UI.fecharModal('modal-minimo');
      await Estoque.carregar();
      UI.toast('Estoque mínimo atualizado.');
    } catch (err) { UI.toast(err.erro || 'Erro ao salvar mínimo.', 'erro'); }
  },
};

// ═══════════════════════════════════════════════════════════════
// MÓDULO 7 — CAIXA DIÁRIO
// ═══════════════════════════════════════════════════════════════
let _caixaCategorias = null;
let _caixaMesAtivo = null;

const Caixa = {
  async carregar(mes) {
    if (!_caixaCategorias) {
      try { _caixaCategorias = await API.get('/caixa/categorias'); } catch { _caixaCategorias = { entrada: [], saida: [] }; }
    }
    const data = await API.get('/caixa' + (mes ? '?mes=' + mes : ''));
    _caixaMesAtivo = data.competencia;

    // Seletor de meses (inclui o mês atual mesmo sem lançamentos)
    const sel = document.getElementById('caixa-seletor-mes');
    const meses = [...new Set([data.competencia, ...data.meses_disponiveis])];
    sel.innerHTML = meses.map(m => `<option value="${m}">${Fmt.competencia(m)}</option>`).join('');
    sel.value = data.competencia;

    const r = data.resumo;
    const corRes = r.resultado > 0 ? 'var(--green)' : (r.resultado < 0 ? 'var(--red)' : 'var(--text-muted)');
    document.getElementById('caixa-resumo').innerHTML = `
      <div class="resumo-card"><div class="valor" style="color:var(--green)">${Fmt.moeda(r.total_entradas)}</div><div class="label">Entradas no Mês</div></div>
      <div class="resumo-card"><div class="valor" style="color:var(--red)">${Fmt.moeda(r.total_saidas)}</div><div class="label">Saídas no Mês</div></div>
      <div class="resumo-card"><div class="valor" style="color:${corRes}">${Fmt.moeda(r.resultado)}</div><div class="label">Resultado do Mês</div></div>
      <div class="resumo-card"><div class="valor" style="font-size:1rem">🟢 ${r.dias_lucro} &nbsp; 🔴 ${r.dias_prejuizo}</div><div class="label">Dias Lucro / Prejuízo</div></div>`;

    const cont = document.getElementById('caixa-dias');
    if (!data.dias.length) {
      cont.innerHTML = '<p class="empty">Nenhum lançamento neste mês. Clique em "+ Lançamento" para começar.</p>';
      return;
    }
    cont.innerHTML = data.dias.map(d => Caixa.cardDia(d)).join('');
  },

  cardDia(d) {
    const lucro = d.resultado >= 0;
    const lancs = d.lancamentos.map(l => `
      <div class="caixa-lanc ${l.tipo}">
        <span class="caixa-lanc-cat">${l.tipo === 'entrada' ? '⬆' : '⬇'} ${l.categoria}${l.descricao ? ' · <em>'+l.descricao+'</em>' : ''}</span>
        <span class="caixa-lanc-valor ${l.tipo}">${l.tipo === 'entrada' ? '+' : '−'} ${Fmt.moeda(l.valor)}</span>
        <button class="btn-remover" title="Excluir" onclick="Caixa.excluir('${l.id}')">✕</button>
      </div>`).join('');
    return `<div class="caixa-dia ${lucro ? 'lucro' : 'prejuizo'}">
      <div class="caixa-dia-header">
        <div class="caixa-dia-data">${Fmt.data(d.data)}</div>
        <div class="caixa-dia-totais">
          <span class="t-entrada">+ ${Fmt.moeda(d.entradas)}</span>
          <span class="t-saida">− ${Fmt.moeda(d.saidas)}</span>
          <span class="t-resultado ${lucro ? 'lucro' : 'prejuizo'}">${lucro ? 'Lucro' : 'Prejuízo'}: ${Fmt.moeda(d.resultado)}</span>
        </div>
      </div>
      <div class="caixa-dia-lancs">${lancs}</div>
    </div>`;
  },

  selecionarMes(mes) { Caixa.carregar(mes); },

  abrirLancamento() {
    document.getElementById('form-caixa').reset();
    document.querySelector('input[name="caixa-tipo"][value="entrada"]').checked = true;
    // data padrão = hoje (ou primeiro dia do mês ativo, se for outro mês)
    const hoje = new Date();
    const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`;
    const inp = document.getElementById('caixa-data');
    inp.value = (_caixaMesAtivo && hojeStr.startsWith(_caixaMesAtivo)) ? hojeStr : `${_caixaMesAtivo}-01`;
    Caixa.trocarTipo();
    UI.abrirModal('modal-caixa');
  },

  trocarTipo() {
    const tipo = document.querySelector('input[name="caixa-tipo"]:checked').value;
    const cats = (_caixaCategorias && _caixaCategorias[tipo]) || [];
    document.getElementById('caixa-categoria').innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');
    document.getElementById('modal-caixa').querySelector('.modal-box').className =
      'modal-box caixa-tema-' + tipo;
  },

  async salvarLancamento(e) {
    e.preventDefault();
    const body = {
      data: document.getElementById('caixa-data').value,
      tipo: document.querySelector('input[name="caixa-tipo"]:checked').value,
      categoria: document.getElementById('caixa-categoria').value,
      descricao: document.getElementById('caixa-descricao').value,
      valor: parseFloat(document.getElementById('caixa-valor').value),
    };
    try {
      await API.post('/caixa', body);
      UI.fecharModal('modal-caixa');
      await Caixa.carregar(body.data.slice(0, 7));
      UI.toast('Lançamento registrado.');
    } catch (err) { UI.toast(err.erro || 'Erro ao salvar lançamento.', 'erro'); }
  },

  async excluir(id) {
    if (!confirm('Excluir este lançamento?')) return;
    try {
      await API.delete('/caixa/' + id);
      await Caixa.carregar(_caixaMesAtivo);
      UI.toast('Lançamento excluído.', 'aviso');
    } catch (err) { UI.toast(err.erro || 'Erro ao excluir.', 'erro'); }
  },
};

// ═══════════════════════════════════════════════════════════════
// MÓDULO — WHATSAPP (simulador + log)
// ═══════════════════════════════════════════════════════════════
const Whats = {
  async simular() {
    const inp = document.getElementById('wa-input');
    const texto = inp.value.trim();
    if (!texto) return;
    const box = document.getElementById('wa-resposta');
    box.style.display = 'block';
    box.className = 'wa-resposta carregando';
    box.textContent = 'Processando…';
    try {
      const r = await API.post('/webhook/whatsapp/test', { texto });
      box.className = 'wa-resposta ' + (r.sucesso ? 'ok' : 'falha');
      box.textContent = r.reply;
      inp.value = '';
      // recarrega dados que podem ter mudado + o log
      await Promise.all([Caixa.carregar(_caixaMesAtivo), Whats.carregarLog()]);
    } catch (err) {
      box.className = 'wa-resposta falha';
      box.textContent = err.erro || 'Erro ao processar.';
    }
  },
  async carregarLog() {
    let log = [];
    try { log = await API.get('/webhook/whatsapp/log'); } catch { return; }
    const cont = document.getElementById('wa-log');
    if (!cont) return;
    if (!log.length) { cont.innerHTML = '<p class="wa-vazio">Nenhuma mensagem ainda. Teste acima ou mande no WhatsApp.</p>'; return; }
    cont.innerHTML = '<div class="wa-log-titulo">Últimas mensagens</div>' + log.map(l => `
      <div class="wa-log-item ${l.sucesso ? 'ok' : 'falha'}">
        <div class="wa-log-topo">
          <span class="wa-log-de">${l.de === 'simulador' ? '🧪 simulador' : '📱 ' + (l.de || '—')}</span>
          <span class="wa-log-data">${Fmt.data(l.data)}</span>
        </div>
        <div class="wa-log-texto">"${(l.texto||'').replace(/</g,'&lt;')}"</div>
        <div class="wa-log-resp">${(l.resposta||'').replace(/</g,'&lt;').split('\n')[0]}</div>
      </div>`).join('');
  },
};

// ═══════════════════════════════════════════════════════════════
// AUTENTICAÇÃO (gate de login)
// ═══════════════════════════════════════════════════════════════
let _appIniciado = false;

const Auth = {
  _mostrar(qual) { // 'carregando' | 'setup' | 'login'
    document.getElementById('gate').classList.remove('hidden');
    document.getElementById('gate-carregando').classList.toggle('hidden', qual !== 'carregando');
    document.getElementById('gate-setup').classList.toggle('hidden', qual !== 'setup');
    document.getElementById('gate-login').classList.toggle('hidden', qual !== 'login');
  },
  _erro(msg) {
    const el = document.getElementById('gate-erro');
    el.textContent = msg; el.classList.toggle('hidden', !msg);
  },
  exigirLogin() {
    _appIniciado = false;
    document.getElementById('btn-logout').classList.add('hidden');
    document.getElementById('btn-senha').classList.add('hidden');
    Auth._mostrar('login');
  },
  async iniciar() {
    try {
      const s = await API.get('/auth/status');
      if (s.autenticado) return Auth._entrar();
      Auth._erro('');
      Auth._mostrar(s.configurado ? 'login' : 'setup');
    } catch (e) {
      Auth._erro(e.erro || 'Erro ao conectar.');
      Auth._mostrar('login');
    }
  },
  _entrar() {
    document.getElementById('gate').classList.add('hidden');
    document.getElementById('btn-logout').classList.remove('hidden');
    document.getElementById('btn-senha').classList.remove('hidden');
    if (!_appIniciado) { _appIniciado = true; Ingredientes.carregar().catch(()=>{}); }
  },
  async setup(e) {
    e.preventDefault();
    const s1 = document.getElementById('setup-senha').value;
    const s2 = document.getElementById('setup-senha2').value;
    if (s1.length < 4) return Auth._erro('A senha precisa de ao menos 4 caracteres.');
    if (s1 !== s2) return Auth._erro('As senhas não conferem.');
    try { await API.post('/auth/setup', { senha: s1 }); Auth._erro(''); Auth._entrar(); }
    catch (err) { Auth._erro(err.erro || 'Erro ao criar senha.'); }
  },
  async login(e) {
    e.preventDefault();
    const senha = document.getElementById('login-senha').value;
    try { await API.post('/auth/login', { senha }); document.getElementById('login-senha').value=''; Auth._erro(''); Auth._entrar(); }
    catch (err) { Auth._erro(err.erro || 'Senha incorreta.'); }
  },
  async logout() {
    try { await API.post('/auth/logout'); } catch {}
    location.reload();
  },
  abrirTrocaSenha() {
    document.getElementById('form-senha').reset();
    UI.abrirModal('modal-senha');
  },
  async trocarSenha(e) {
    e.preventDefault();
    const body = {
      senha_atual: document.getElementById('senha-atual').value,
      senha_nova: document.getElementById('senha-nova').value,
    };
    try {
      await API.post('/auth/senha', body);
      UI.fecharModal('modal-senha');
      UI.toast('Senha alterada com sucesso.');
    } catch (err) { UI.toast(err.erro || 'Erro ao trocar senha.', 'erro'); }
  },
};

// ═══════════════════════════════════════════════════════════════
// MÓDULO — HISTÓRICO DE ESTOQUE
// ═══════════════════════════════════════════════════════════════
function ymdHoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function ymdSoma(ymd, dias) {
  const [a,m,d] = ymd.split('-').map(Number);
  const dt = new Date(a, m-1, d + dias);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
}
function fmtYMD(ymd) { // 'YYYY-MM-DD' -> 'DD/MM/AAAA' sem deslize de fuso
  if (!ymd || ymd.indexOf('-') < 0) return ymd || '—';
  const [a,m,d] = ymd.split('-');
  return `${d}/${m}/${a}`;
}

const Historico = {
  modo: 'dia',
  init() {
    if (!document.getElementById('hist-data-a').value) {
      document.getElementById('hist-data-a').value = ymdHoje();
      document.getElementById('hist-data-b').value = ymdHoje();
    }
    Historico.atualizar();
  },
  trocarModo() {
    Historico.modo = document.querySelector('input[name="hist-modo"]:checked').value;
    const comparar = Historico.modo === 'comparar';
    document.getElementById('hist-campo-b').classList.toggle('hidden', !comparar);
    document.getElementById('hist-label-a').textContent = comparar ? 'De' : 'Data';
    if (comparar && !document.getElementById('hist-data-b').value) document.getElementById('hist-data-b').value = ymdHoje();
    Historico.atualizar();
  },
  preset(p) {
    const hoje = ymdHoje();
    const setMode = m => {
      Historico.modo = m;
      document.querySelector(`input[name="hist-modo"][value="${m}"]`).checked = true;
      document.getElementById('hist-campo-b').classList.toggle('hidden', m !== 'comparar');
      document.getElementById('hist-label-a').textContent = m === 'comparar' ? 'De' : 'Data';
    };
    if (p === 'hoje') { setMode('dia'); document.getElementById('hist-data-a').value = hoje; }
    else if (p === 'ontem') { setMode('dia'); document.getElementById('hist-data-a').value = ymdSoma(hoje,-1); }
    else if (p === '7d') { setMode('comparar'); document.getElementById('hist-data-a').value = ymdSoma(hoje,-7); document.getElementById('hist-data-b').value = hoje; }
    else if (p === '30d') { setMode('comparar'); document.getElementById('hist-data-a').value = ymdSoma(hoje,-30); document.getElementById('hist-data-b').value = hoje; }
    else if (p === 'mespassado') {
      setMode('comparar');
      const d = new Date(); const primeiroEste = new Date(d.getFullYear(), d.getMonth(), 1);
      const ultimoPassado = new Date(primeiroEste - 1);
      const primeiroPassado = new Date(ultimoPassado.getFullYear(), ultimoPassado.getMonth(), 1);
      const fmt = x => `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;
      document.getElementById('hist-data-a').value = fmt(primeiroPassado);
      document.getElementById('hist-data-b').value = fmt(ultimoPassado);
    }
    Historico.atualizar();
  },
  async atualizar() {
    if (Historico.modo === 'comparar') return Historico.comparar();
    return Historico.umDia();
  },
  async umDia() {
    const data = document.getElementById('hist-data-a').value || ymdHoje();
    let d;
    try { d = await API.get('/estoque/historico/snapshot?data=' + data); } catch (e) { return; }
    document.getElementById('hist-resumo').innerHTML = `
      <div class="resumo-card"><div class="valor">${Fmt.moeda(d.valor_total)}</div><div class="label">Valor do Estoque em ${fmtYMD(data)}</div></div>
      <div class="resumo-card"><div class="valor">${d.itens.filter(i=>i.estoque_base>0).length}</div><div class="label">Itens com Estoque</div></div>`;
    const linhas = d.itens.map(i => `<tr onclick="Historico.timeline('${i.id}')" class="clicavel">
      <td data-label="Ingrediente"><strong>${i.nome}</strong></td>
      <td data-label="Estoque" style="text-align:right">${fmtQtd(i.estoque_exibicao, i.unidade_exibicao)}</td>
      <td data-label="Valor" style="text-align:right">${i.tem_preco_na_data ? Fmt.moeda(i.valor) : '<span style="color:var(--text-muted)">'+Fmt.moeda(i.valor)+' *</span>'}</td>
    </tr>`).join('');
    document.getElementById('hist-conteudo').innerHTML = `
      <div class="card"><table>
        <thead><tr><th>Ingrediente</th><th style="text-align:right">Em Estoque</th><th style="text-align:right">Valor</th></tr></thead>
        <tbody>${linhas || '<tr><td colspan="3" class="empty">Sem itens.</td></tr>'}</tbody>
      </table></div>
      <p class="hist-nota">Clique num item para ver a linha do tempo. * valor estimado com o preço atual (sem compra registrada até a data).</p>`;
  },
  async comparar() {
    const a = document.getElementById('hist-data-a').value, b = document.getElementById('hist-data-b').value;
    if (!a || !b) return;
    let d;
    try { d = await API.get(`/estoque/historico/comparar?a=${a}&b=${b}`); } catch (e) { return; }
    const delta = d.delta_total;
    const cor = delta > 0 ? 'var(--green)' : (delta < 0 ? 'var(--red)' : 'var(--text-muted)');
    document.getElementById('hist-resumo').innerHTML = `
      <div class="resumo-card"><div class="valor" style="font-size:1.3rem">${Fmt.moeda(d.valor_total_a)}</div><div class="label">Em ${fmtYMD(a)}</div></div>
      <div class="resumo-card"><div class="valor" style="font-size:1.3rem">${Fmt.moeda(d.valor_total_b)}</div><div class="label">Em ${fmtYMD(b)}</div></div>
      <div class="resumo-card"><div class="valor" style="color:${cor}">${delta>0?'+':''}${Fmt.moeda(delta)}</div><div class="label">Variação do Estoque</div></div>`;
    const linhas = d.itens.map(i => {
      const dv = i.delta_valor;
      const c = dv>0?'var(--green)':(dv<0?'var(--red)':'var(--text-muted)');
      return `<tr onclick="Historico.timeline('${i.id}')" class="clicavel">
        <td data-label="Ingrediente"><strong>${i.nome}</strong></td>
        <td data-label="Antes" style="text-align:right;color:var(--text-muted)">${i.qtd_a} ${i.unidade_exibicao}</td>
        <td data-label="Depois" style="text-align:right">${i.qtd_b} ${i.unidade_exibicao}</td>
        <td data-label="Variação R$" style="text-align:right;color:${c};font-weight:600">${dv>0?'+':''}${Fmt.moeda(dv)}</td>
      </tr>`;
    }).join('');
    document.getElementById('hist-conteudo').innerHTML = `
      <div class="card"><table>
        <thead><tr><th>Ingrediente</th><th style="text-align:right">Antes</th><th style="text-align:right">Depois</th><th style="text-align:right">Variação R$</th></tr></thead>
        <tbody>${linhas || '<tr><td colspan="4" class="empty">Sem itens.</td></tr>'}</tbody>
      </table></div>
      <div class="hist-periodo">📈 No período: <strong>${d.periodo.total_movimentos}</strong> movimentações em <strong>${d.periodo.itens_movimentados}</strong> itens.</div>`;
  },
  async timeline(id) {
    let d;
    try { d = await API.get('/estoque/historico/timeline?ingrediente_id=' + id); } catch (e) { return; }
    document.getElementById('modal-timeline-titulo').textContent = 'Linha do Tempo — ' + d.ingrediente.nome;
    const rotulos = { entrada:'➕ Entrada', saida:'➖ Baixa', ajuste:'🔄 Ajuste', contagem:'📋 Contagem' };
    const cor = { entrada:'var(--green)', saida:'var(--red)', ajuste:'var(--accent)', contagem:'var(--accent)' };
    const itens = d.movimentos.length ? d.movimentos.map(m => {
      const sinal = m.quantidade_base > 0 ? '+' : '';
      return `<div class="tl-item">
        <div class="tl-data">${Fmt.data(m.data)}</div>
        <div class="tl-corpo">
          <span class="tl-tipo" style="color:${cor[m.tipo]||'var(--text)'}">${rotulos[m.tipo]||m.tipo}</span>
          <span class="tl-qtd">${sinal}${m.quantidade_exibicao} ${m.unidade_exibicao}</span>
          ${m.motivo?`<span class="tl-motivo">${m.motivo}</span>`:''}
        </div>
        <div class="tl-saldo">saldo: <strong>${m.saldo_exibicao} ${m.unidade_exibicao}</strong></div>
      </div>`;
    }).join('') : '<p class="empty">Nenhuma movimentação registrada para este item ainda.</p>';
    document.getElementById('modal-timeline-conteudo').innerHTML = itens;
    UI.abrirModal('modal-timeline');
  },
};

// ═══════════════════════════════════════════════════════════════
// NAVEGAÇÃO + INIT
// ═══════════════════════════════════════════════════════════════
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    const target = btn.dataset.tab;
    document.getElementById('tab-' + target).classList.add('active');
    if (target === 'relatorio') Relatorio.carregar();
    if (target === 'fichas') Fichas.carregar();
    if (target === 'custos') CustosFixos.carregar();
    if (target === 'compras') Compras.carregar();
    if (target === 'estoque') Estoque.carregar();
    if (target === 'historico') Historico.init();
    if (target === 'caixa') { Caixa.carregar(); Whats.carregarLog(); }
  });
});
document.querySelectorAll('.modal').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m) m.classList.add('hidden'); });
});

// Início: primeiro resolve a autenticação; o app só carrega após login.
Auth.iniciar();
