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
  async abrirModalFicha(ficha = null) {
    // Garante a lista de ingredientes fresca (a aba Fichas pode ser a primeira aberta)
    try { _ingredientes = await API.get('/ingredientes'); } catch {}
    const form = document.getElementById('form-ficha');
    form.reset();
    NovoIngrediente.fechar();
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
    Fichas.recalcularLive();
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
      const ehPreparo = !!ing.receita;
      const embTag = ehPreparo
        ? `<span class="emb-tag prep-tag" title="Preparo — o custo é calculado pela receita e atualizado quando o preço de um insumo muda">🍳 preparo</span>`
        : (ing.embalagem
          ? `<span class="emb-tag" title="Comprado por embalagem">📦 ${ing.embalagem.nome} = ${ing.embalagem.conteudo} ${ing.embalagem.unidade}</span>` : '');
      // Item de unidade que talvez seja usado pesando (alface, costela…)
      const btnConverter = (!ehPreparo && ing.unidade_base === 'un')
        ? `<button class="btn-edit" onclick="ConverterUn.abrir('${ing.id}')" title="Compra por unidade mas usa pesando? Converte preço, estoque e fichas para gramas de uma vez">⚖️ Usar por peso</button>` : '';
      const acoes = ehPreparo
        ? `<button class="btn-edit" onclick="Preparos.editar('${ing.id}')">Receita</button>
           <button class="btn-confirm" onclick="Preparos.producao('${ing.id}','${nomeJS}')" title="Dá entrada do rendimento no estoque e baixa os ingredientes usados">Produzi uma leva</button>
           <button class="btn-danger" onclick="Ingredientes.excluir('${ing.id}','${nomeJS}')">Excluir</button>`
        : `<button class="${temPreco ? 'btn-edit' : 'btn-confirm'}" onclick="Ingredientes.registrarPreco('${ing.id}')">${temPreco ? 'Nova Compra' : 'Registrar Preço'}</button>
           ${btnConverter}
           <button class="btn-edit" onclick="Ingredientes.editar('${ing.id}')">Editar</button>
           <button class="btn-danger" onclick="Ingredientes.excluir('${ing.id}','${nomeJS}')">Excluir</button>`;
      return `<tr>
        <td data-label="Ingrediente"><strong>${ing.nome}</strong> <small style="color:var(--text-muted)">(usa em ${ing.unidade_base})</small> ${embTag}</td>
        <td data-label="Custo Atual">${custo}</td>
        <td data-label="Última Compra" style="color:var(--text-muted)">${ultima}</td>
        <td class="cell-acoes" data-label="Ações"><div class="acoes-cell">${acoes}</div></td>
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

  // Atalho do hint: muda para "Por embalagem" (alface, costela — compra por unidade, usa por peso)
  usarModoEmbalagem() {
    Ingredientes._setModo('embalagem');
    const nome = document.getElementById('compra-emb-nome');
    nome.placeholder = 'Ex: pé, maço, peça';
    nome.focus();
  },

  atualizarPreviewCompra() {
    const modo = document.querySelector('input[name="compra-modo"]:checked').value;
    const valor = parseFloat(document.getElementById('compra-valor').value);
    // Dica para item comprado por unidade que talvez seja usado pesando
    const hintUn = document.getElementById('compra-un-hint');
    if (hintUn) hintUn.style.display =
      (modo === 'medida' && document.getElementById('compra-unidade').value === 'un') ? 'block' : 'none';
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
      lancar_estoque: document.getElementById('compra-lancar-estoque').checked,
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
    if (!fichas.length) {
      cont.innerHTML = `<div class="empty-acao" style="width:100%">
        <p>Nenhuma ficha técnica ainda. A ficha é a "receita com custo" de cada produto do cardápio.</p>
        <button class="btn-primary" onclick="UI.abrirModalFicha()">+ Criar minha primeira ficha</button>
      </div>`;
      return;
    }
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
        <button class="btn-edit" onclick="Fichas.duplicar('${f.id}')" title="Cria uma cópia para ajustar — ótimo para variações (ex: outra pizza)">Duplicar</button>
        <button class="btn-danger" onclick="Fichas.excluir('${f.id}','${nomeJS}')">Excluir</button>
      </div></div>`;
  },
  adicionarLinha(item = null) {
    const cont = document.getElementById('ingredientes-lista-ficha');
    cont.querySelector('.ingrediente-vazio')?.remove();
    const div = document.createElement('div');
    div.className = 'ingrediente-linha';
    div.innerHTML = `
      <div><label>Ingrediente *</label>
        <select class="ing-select" required onchange="Fichas.aoTrocarIngrediente(this)"></select>
        <small class="ing-info"></small></div>
      <div><label class="lbl-qtd">Quantidade</label>
        <input type="number" class="ing-qtd" step="0.01" min="0.01" value="${item?.quantidade||''}" required placeholder="Ex: 150" oninput="Fichas.aoEditarLinha(this)" /></div>
      <div><label>Fator Correção</label>
        <input type="number" class="ing-fator" step="0.01" min="1" max="3" value="${item?.fator_correcao||1.00}" oninput="Fichas.aoEditarLinha(this)" /></div>
      <button type="button" class="btn-remover" onclick="this.parentElement.remove();Fichas.recalcularLive()" title="Remover">✕</button>`;
    cont.appendChild(div);
    Fichas.popularSelect(div.querySelector('.ing-select'), item?.ingrediente_id || '');
    Fichas.atualizarLinha(div);
  },
  // Monta as opções do seletor de ingrediente (com atalho de cadastro rápido)
  popularSelect(sel, selecionado = '') {
    const opts = _ingredientes.map(i => {
      const aviso = i.custo_base > 0 ? '' : ' ⚠ sem preço';
      const prefixo = i.receita ? '🍳 ' : '';
      return `<option value="${i.id}">${prefixo}${i.nome} (${i.unidade_base})${aviso}</option>`;
    }).join('');
    sel.innerHTML = `<option value="">— selecione —</option>
      <option value="__novo__">➕ Cadastrar novo ingrediente…</option>${opts}`;
    sel.value = selecionado || '';
  },
  aoTrocarIngrediente(sel) {
    if (sel.value === '__novo__') {
      sel.value = '';
      NovoIngrediente.abrir(sel.closest('.ingrediente-linha'));
      return;
    }
    Fichas.atualizarLinha(sel.closest('.ingrediente-linha'));
    Fichas.recalcularLive();
  },
  aoEditarLinha(el) {
    Fichas.atualizarLinha(el.closest('.ingrediente-linha'));
    Fichas.recalcularLive();
  },
  // Atualiza rótulo da quantidade + dica da linha (embalagem, preparo,
  // custo da porção e atalho de conversão para itens medidos em "un")
  atualizarLinha(div) {
    const ing = _ingredientes.find(i => i.id === div.querySelector('.ing-select').value);
    const lbl = div.querySelector('.lbl-qtd');
    const info = div.querySelector('.ing-info');
    if (!ing) { lbl.textContent = 'Quantidade'; info.textContent = ''; return; }
    lbl.textContent = `Quantidade (${ing.unidade_base})`;
    const partes = [];
    if (ing.receita) partes.push('🍳 preparo da casa — custo vem da receita');
    if (ing.embalagem) {
      partes.push(`📦 1 ${ing.embalagem.nome} = ${ing.embalagem.conteudo} ${ing.embalagem.unidade} — aqui informe só os ${ing.unidade_base} usados`);
    }
    const qtd = parseFloat(div.querySelector('.ing-qtd').value);
    const fator = parseFloat(div.querySelector('.ing-fator').value) || 1;
    if (ing.unidade_base === 'un' && !ing.receita) {
      partes.push('1 = unidade inteira · 0,5 = metade');
      if (qtd > 10) partes.push(`⚠ ${qtd} unidades inteiras? Se você quis dizer GRAMAS, converta aqui →`);
    }
    if (!(ing.custo_base > 0)) partes.push('⚠ sem preço — o CMV não fecha sem ele');
    else if (qtd > 0) partes.push(`custa ≈ ${Fmt.moeda(ing.custo_base * qtd * fator)} nesta porção`);
    // textContent (não innerHTML): nomes de embalagem são texto do usuário
    info.textContent = partes.join(' · ');
    // Item por unidade (alface, costela…): atalho para usar pesando
    if (ing.unidade_base === 'un' && !ing.receita) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'link-converter';
      btn.textContent = '⚖️ uso pesando (converter p/ gramas)';
      btn.onclick = () => ConverterUn.abrir(ing.id, div);
      if (partes.length) info.appendChild(document.createTextNode(' · '));
      info.appendChild(btn);
    }
  },
  // Prévia do CMV ao vivo (sem rateio — esse entra no Confirmar)
  recalcularLive() {
    const bar = document.getElementById('ficha-cmv-live');
    if (!bar) return;
    let custo = 0, linhas = 0, semPreco = false;
    document.querySelectorAll('#ingredientes-lista-ficha .ingrediente-linha').forEach(d => {
      const ing = _ingredientes.find(i => i.id === d.querySelector('.ing-select').value);
      const qtd = parseFloat(d.querySelector('.ing-qtd').value);
      if (!ing || !(qtd > 0)) return;
      const fator = parseFloat(d.querySelector('.ing-fator').value) || 1;
      linhas++;
      if (ing.custo_base > 0) custo += ing.custo_base * qtd * fator;
      else semPreco = true;
    });
    if (!linhas) { bar.style.display = 'none'; return; }
    const total = custo + (parseFloat(document.getElementById('ficha-embalagem').value) || 0);
    document.getElementById('fl-custo').textContent = Fmt.moeda(total);
    const preco = parseFloat(document.getElementById('ficha-preco').value);
    const elCmv = document.getElementById('fl-cmv');
    const elMargem = document.getElementById('fl-margem');
    if (preco > 0) {
      const pct = (total / preco) * 100;
      elCmv.textContent = Fmt.pct(pct);
      elCmv.style.color = pct <= 33 ? 'var(--green)' : pct <= 35 ? 'var(--yellow)' : 'var(--red)';
      elMargem.textContent = Fmt.moeda(preco - total);
    } else {
      elCmv.textContent = '—'; elCmv.style.color = '';
      elMargem.textContent = '—';
    }
    const avisos = [];
    if (semPreco) avisos.push('⚠ Há ingrediente sem preço — o valor acima está incompleto.');
    if (document.getElementById('ficha-rateio').checked) avisos.push('Prévia sem o rateio de custos fixos (ele entra ao Confirmar).');
    document.getElementById('fl-aviso').textContent = avisos.join(' ');
    bar.style.display = 'block';
  },
  coletar() {
    return [...document.querySelectorAll('#ingredientes-lista-ficha .ingrediente-linha')].map(d => ({
      ingrediente_id: d.querySelector('.ing-select').value,
      quantidade: parseFloat(d.querySelector('.ing-qtd').value),
      fator_correcao: parseFloat(d.querySelector('.ing-fator').value || 1.0),
    }));
  },
  _confirmarAoSalvar: false, // setado pelo botão "Salvar e Confirmar"
  async salvar(e) {
    e.preventDefault();
    const confirmarDepois = Fichas._confirmarAoSalvar;
    Fichas._confirmarAoSalvar = false;
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
      let fichaSalva;
      if (id) { const r = await API.put('/fichas/' + id, body); fichaSalva = r.ficha; }
      else { const r = await API.post('/fichas', body); fichaSalva = r.ficha; }
      UI.fecharModal('modal-ficha');
      if (confirmarDepois && fichaSalva) {
        // confirmar() já recarrega a lista, mostra o CMV oficial ou os erros
        await Fichas.confirmar(fichaSalva.id);
      } else {
        await Fichas.carregar();
        UI.toast(id ? 'Ficha atualizada (voltou a rascunho).' : 'Rascunho salvo. Quando terminar, clique em Confirmar.');
      }
    } catch (err) { UI.toast(err.erro || 'Erro ao salvar ficha.', 'erro'); }
  },
  async editar(id) { UI.abrirModalFicha(await API.get('/fichas/' + id)); },
  // Duplica uma ficha (ex: pizza nova = copiar a anterior e trocar 2 ingredientes)
  async duplicar(id) {
    try {
      const f = await API.get('/fichas/' + id);
      const res = await API.post('/fichas', {
        nome: f.nome + ' (cópia)',
        tipo: f.tipo,
        preco_venda: f.preco_venda,
        custo_embalagem: f.custo_embalagem,
        incluir_rateio: f.incluir_rateio,
        ingredientes: f.ingredientes,
      });
      await Fichas.carregar();
      UI.toast('Cópia criada — ajuste o que mudou e confirme.');
      UI.abrirModalFicha(res.ficha);
    } catch (err) { UI.toast(err.erro || 'Erro ao duplicar.', 'erro'); }
  },
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
// CADASTRO RÁPIDO DE INGREDIENTE (dentro do modal da ficha)
// Cria o ingrediente com preço SEM sair da ficha; lançar no estoque
// é opcional (desmarcado por padrão — o CMV não depende do estoque).
// ═══════════════════════════════════════════════════════════════
const NovoIngrediente = {
  _linha: null, // linha da ficha que pediu o cadastro

  abrir(linha) {
    NovoIngrediente._linha = linha || null;
    ['ni-nome','ni-valor','ni-qtd','ni-emb-nome','ni-emb-conteudo'].forEach(id => {
      document.getElementById(id).value = '';
    });
    document.getElementById('ni-unidade').value = 'kg';
    document.getElementById('ni-emb-unidade').value = 'g';
    document.getElementById('ni-estoque').checked = false;
    NovoIngrediente.trocarUnidade();
    const box = document.getElementById('ficha-novo-ing');
    box.style.display = 'block';
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    document.getElementById('ni-nome').focus();
  },
  fechar() {
    document.getElementById('ficha-novo-ing').style.display = 'none';
    NovoIngrediente._linha = null;
  },
  trocarUnidade() {
    const un = document.getElementById('ni-unidade').value;
    document.getElementById('ni-emb-campos').style.display = un === 'emb' ? 'flex' : 'none';
    // Comprou por unidade mas usa pesando? Aponta para o modo embalagem.
    document.getElementById('ni-un-hint').style.display = un === 'un' ? 'block' : 'none';
    NovoIngrediente.preview();
  },
  preview() {
    const valor = parseFloat(document.getElementById('ni-valor').value);
    const qtd = parseFloat(document.getElementById('ni-qtd').value);
    const un = document.getElementById('ni-unidade').value;
    const prev = document.getElementById('ni-preview');
    let custoBase = null, base = null;
    if (valor > 0 && qtd > 0) {
      if (un === 'emb') {
        const conteudo = parseFloat(document.getElementById('ni-emb-conteudo').value);
        const unC = document.getElementById('ni-emb-unidade').value;
        if (conteudo > 0) { custoBase = valor / (qtd * paraBase(conteudo, unC)); base = UNIDADES[unC].base; }
      } else {
        custoBase = valor / paraBase(qtd, un);
        base = UNIDADES[un].base;
      }
    }
    if (custoBase !== null && isFinite(custoBase)) {
      document.getElementById('ni-preview-valor').textContent = Fmt.custoUnit(custoBase, base);
      prev.style.display = 'block';
    } else prev.style.display = 'none';
  },
  async salvar() {
    const nome = document.getElementById('ni-nome').value.trim();
    const valor = parseFloat(document.getElementById('ni-valor').value);
    const qtd = parseFloat(document.getElementById('ni-qtd').value);
    const un = document.getElementById('ni-unidade').value;
    if (!nome) { UI.toast('Dê um nome ao ingrediente.', 'erro'); return; }
    if (!(valor > 0) || !(qtd > 0)) { UI.toast('Informe quanto pagou e por quanto (quantidade).', 'erro'); return; }
    const body = { nome, valor_total: valor, lancar_estoque: document.getElementById('ni-estoque').checked };
    if (un === 'emb') {
      const conteudo = parseFloat(document.getElementById('ni-emb-conteudo').value);
      if (!(conteudo > 0)) { UI.toast('Informe quanto vem dentro de cada embalagem (ex: 340 g).', 'erro'); return; }
      body.modo = 'embalagem';
      body.embalagem_nome = document.getElementById('ni-emb-nome').value.trim() || 'embalagem';
      body.quantidade_embalagens = qtd;
      body.conteudo = conteudo;
      body.unidade_conteudo = document.getElementById('ni-emb-unidade').value;
    } else {
      body.unidade_compra = un;
      body.quantidade_comprada = qtd;
    }
    try {
      const res = await API.post('/ingredientes', body);
      const novo = res.ingrediente;
      const i = _ingredientes.findIndex(x => x.id === novo.id);
      if (i >= 0) _ingredientes[i] = novo; else _ingredientes.push(novo);
      // Re-popula todos os seletores da ficha preservando o que já estava escolhido
      document.querySelectorAll('#ingredientes-lista-ficha .ing-select')
        .forEach(s => Fichas.popularSelect(s, s.value));
      const linha = NovoIngrediente._linha;
      NovoIngrediente.fechar();
      if (linha && document.body.contains(linha)) {
        linha.querySelector('.ing-select').value = novo.id;
        Fichas.atualizarLinha(linha);
        linha.querySelector('.ing-qtd').focus();
      }
      Fichas.recalcularLive();
      UI.toast(`"${novo.nome}" cadastrado${body.lancar_estoque ? ' e lançado no estoque' : ' (estoque não foi alterado)'}.`);
    } catch (err) { UI.toast(err.erro || 'Erro ao cadastrar ingrediente.', 'erro'); }
  },
};

// ═══════════════════════════════════════════════════════════════
// CONVERSÃO "un" → PESO (alface, costela, abacaxi…)
// Item comprado por unidade mas usado pesando: converte preço,
// estoque, mínimo e TODAS as fichas/receitas de uma vez (backend).
// Abre da linha da ficha (com a linha para focar depois) ou da
// aba Ingredientes (linha = null).
// ═══════════════════════════════════════════════════════════════
const ConverterUn = {
  _linha: null,

  abrir(ingId, linha = null) {
    const ing = _ingredientes.find(i => i.id === ingId);
    if (!ing) return;
    ConverterUn._linha = linha;
    document.getElementById('form-converter-un').reset();
    document.getElementById('conv-id').value = ing.id;
    document.getElementById('conv-nome').textContent = ing.nome;
    document.getElementById('conv-titulo').textContent = `⚖️ Usar "${ing.nome}" por peso`;
    document.getElementById('conv-unidade').value = 'g';
    document.getElementById('conv-valor').placeholder = ing.custo_base > 0
      ? `hoje: ${Fmt.moeda(ing.custo_base)}/un (opcional)` : 'opcional';
    document.getElementById('conv-preview').style.display = 'none';
    UI.abrirModal('modal-converter-un');
    document.getElementById('conv-peso').focus();
  },

  depois() {
    UI.fecharModal('modal-converter-un');
    UI.toast('Sem problema! Enquanto isso use frações na ficha: 0,5 = meia unidade, 0,25 = um quarto.', 'aviso');
    ConverterUn._linha = null;
  },

  preview() {
    const peso = parseFloat(document.getElementById('conv-peso').value);
    const un = document.getElementById('conv-unidade').value;
    const ing = _ingredientes.find(i => i.id === document.getElementById('conv-id').value);
    // valor por 1 unidade: o digitado, ou o preço atual do item
    const valor = parseFloat(document.getElementById('conv-valor').value) || (ing?.custo_base > 0 ? ing.custo_base : 0);
    const prev = document.getElementById('conv-preview');
    if (peso > 0 && valor > 0) {
      const custoBase = valor / paraBase(peso, un);
      document.getElementById('conv-preview-valor').textContent = Fmt.custoUnit(custoBase, UNIDADES[un].base);
      prev.style.display = 'block';
    } else prev.style.display = 'none';
  },

  async salvar(e) {
    e.preventDefault();
    const id = document.getElementById('conv-id').value;
    const peso = parseFloat(document.getElementById('conv-peso').value);
    if (!(peso > 0)) { UI.toast('Informe quanto 1 unidade rende (ex.: 300 g).', 'erro'); return; }
    const body = {
      unidade: document.getElementById('conv-unidade').value,
      conteudo: peso,
      nome_unidade: document.getElementById('conv-nome-un').value.trim(),
    };
    const valor = parseFloat(document.getElementById('conv-valor').value);
    if (valor > 0) body.valor_unidade = valor;
    try {
      const res = await API.post(`/ingredientes/${id}/converter-uso`, body);
      UI.fecharModal('modal-converter-un');
      _ingredientes = await API.get('/ingredientes');
      const novo = _ingredientes.find(i => i.id === id);
      const fatorBase = conteudoBaseEmb(novo?.embalagem) || 1;

      const fichaAberta = !document.getElementById('modal-ficha').classList.contains('hidden');
      if (fichaAberta) {
        // Atualiza os seletores e converte as quantidades já digitadas (eram "un").
        // A linha que pediu a conversão é limpa: o usuário vai digitar os gramas agora.
        document.querySelectorAll('#ingredientes-lista-ficha .ing-select')
          .forEach(s => Fichas.popularSelect(s, s.value));
        document.querySelectorAll('#ingredientes-lista-ficha .ingrediente-linha').forEach(d => {
          if (d.querySelector('.ing-select').value !== id) { Fichas.atualizarLinha(d); return; }
          const inp = d.querySelector('.ing-qtd');
          if (d === ConverterUn._linha) inp.value = '';
          else if (parseFloat(inp.value) > 0) inp.value = Math.round(parseFloat(inp.value) * fatorBase * 100) / 100;
          Fichas.atualizarLinha(d);
        });
        Fichas.recalcularLive();
        if (ConverterUn._linha) ConverterUn._linha.querySelector('.ing-qtd').focus();
      } else {
        await Ingredientes.carregar();
      }
      UI.toast(res.mensagem || 'Convertido!');
    } catch (err) { UI.toast(err.erro || 'Erro ao converter.', 'erro'); }
    ConverterUn._linha = null;
  },
};

// ═══════════════════════════════════════════════════════════════
// PREPAROS (sub-receitas da casa: costela desfiada, abacaxi
// caramelizado, molho especial…). Viram ingredientes com custo
// derivado da receita — atualizado quando o preço do insumo muda.
// ═══════════════════════════════════════════════════════════════
const Preparos = {
  abrirNovo() {
    document.getElementById('form-preparo').reset();
    document.getElementById('pr-id').value = '';
    document.getElementById('modal-preparo-titulo').textContent = '🍳 Novo Preparo (receita da casa)';
    document.getElementById('pr-componentes').innerHTML =
      '<div class="ingrediente-vazio">Nenhum ingrediente — clique em "+ Adicionar"</div>';
    Preparos.trocarUnidade();
    Preparos.adicionarComponente();
    Preparos.recalcLive();
    UI.abrirModal('modal-preparo');
  },

  async editar(id) {
    try { _ingredientes = await API.get('/ingredientes'); } catch {}
    const ing = _ingredientes.find(i => i.id === id);
    if (!ing || !ing.receita) return;
    document.getElementById('form-preparo').reset();
    document.getElementById('pr-id').value = ing.id;
    document.getElementById('modal-preparo-titulo').textContent = `🍳 Receita — ${ing.nome}`;
    document.getElementById('pr-nome').value = ing.nome;
    document.getElementById('pr-unidade').value = ing.unidade_base;
    Preparos.trocarUnidade();
    document.getElementById('pr-rend').value = ing.receita.rendimento || '';
    if (ing.receita.unidade_rendimento) document.getElementById('pr-rend-un').value = ing.receita.unidade_rendimento;
    document.getElementById('pr-componentes').innerHTML = '';
    (ing.receita.itens || []).forEach(it => Preparos.adicionarComponente(it));
    Preparos.recalcLive();
    UI.abrirModal('modal-preparo');
  },

  trocarUnidade() {
    const base = document.getElementById('pr-unidade').value;
    const compat = UNIDADES_POR_BASE[base] || [base];
    const sel = document.getElementById('pr-rend-un');
    const atual = sel.value;
    sel.innerHTML = compat.map(u => `<option value="${u}">${u}</option>`).join('');
    if (compat.includes(atual)) sel.value = atual;
    Preparos.recalcLive();
  },

  adicionarComponente(item = null) {
    const cont = document.getElementById('pr-componentes');
    cont.querySelector('.ingrediente-vazio')?.remove();
    const div = document.createElement('div');
    div.className = 'ingrediente-linha';
    div.innerHTML = `
      <div><label>Ingrediente *</label>
        <select class="pr-comp-select" required onchange="Preparos.aoEditar(this)"></select>
        <small class="ing-info"></small></div>
      <div><label class="pr-lbl-qtd">Quantidade</label>
        <input type="number" class="pr-comp-qtd" step="0.01" min="0.01" value="${item?.quantidade || ''}" required placeholder="Ex: 3000" oninput="Preparos.aoEditar(this)" /></div>
      <button type="button" class="btn-remover" onclick="this.parentElement.remove();Preparos.recalcLive()" title="Remover">✕</button>`;
    cont.appendChild(div);
    Preparos.popularSelectComp(div.querySelector('.pr-comp-select'), item?.ingrediente_id || '');
    Preparos.atualizarLinhaComp(div);
  },

  // Só ingredientes "crus" entram na receita (preparo não contém preparo)
  popularSelectComp(sel, selecionado = '') {
    const proprio = document.getElementById('pr-id').value;
    const opts = _ingredientes
      .filter(i => !i.receita && i.id !== proprio)
      .map(i => {
        const aviso = i.custo_base > 0 ? '' : ' ⚠ sem preço';
        return `<option value="${i.id}">${i.nome} (${i.unidade_base})${aviso}</option>`;
      }).join('');
    sel.innerHTML = `<option value="">— selecione —</option>${opts}`;
    sel.value = selecionado || '';
  },

  aoEditar(el) {
    Preparos.atualizarLinhaComp(el.closest('.ingrediente-linha'));
    Preparos.recalcLive();
  },

  atualizarLinhaComp(div) {
    const ing = _ingredientes.find(i => i.id === div.querySelector('.pr-comp-select').value);
    const lbl = div.querySelector('.pr-lbl-qtd');
    const info = div.querySelector('.ing-info');
    if (!ing) { lbl.textContent = 'Quantidade'; info.textContent = ''; return; }
    lbl.textContent = `Quantidade (${ing.unidade_base})`;
    const partes = [];
    if (ing.embalagem) partes.push(`📦 1 ${ing.embalagem.nome} = ${ing.embalagem.conteudo} ${ing.embalagem.unidade}`);
    const qtd = parseFloat(div.querySelector('.pr-comp-qtd').value);
    if (!(ing.custo_base > 0)) partes.push('⚠ sem preço');
    else if (qtd > 0) partes.push(`≈ ${Fmt.moeda(ing.custo_base * qtd)}`);
    info.textContent = partes.join(' · ');
  },

  coletar() {
    return [...document.querySelectorAll('#pr-componentes .ingrediente-linha')].map(d => ({
      ingrediente_id: d.querySelector('.pr-comp-select').value,
      quantidade: parseFloat(d.querySelector('.pr-comp-qtd').value),
    }));
  },

  recalcLive() {
    const box = document.getElementById('pr-custo-live');
    if (!box) return;
    let custo = 0, linhas = 0, semPreco = false;
    document.querySelectorAll('#pr-componentes .ingrediente-linha').forEach(d => {
      const ing = _ingredientes.find(i => i.id === d.querySelector('.pr-comp-select').value);
      const qtd = parseFloat(d.querySelector('.pr-comp-qtd').value);
      if (!ing || !(qtd > 0)) return;
      linhas++;
      if (ing.custo_base > 0) custo += ing.custo_base * qtd;
      else semPreco = true;
    });
    if (!linhas) { box.style.display = 'none'; return; }
    const base = document.getElementById('pr-unidade').value;
    const rend = parseFloat(document.getElementById('pr-rend').value);
    const rendBase = rend > 0 ? paraBase(rend, document.getElementById('pr-rend-un').value) : 0;
    let txt = `Custo da leva: ${Fmt.moeda(custo)}`;
    if (rendBase > 0) txt += ` → ${Fmt.custoUnit(custo / rendBase, base)}`;
    else txt += ' — informe o rendimento para calcular o custo por ' + base;
    if (semPreco) txt += ' · ⚠ há componente sem preço (custo incompleto)';
    document.getElementById('pr-custo-texto').textContent = txt;
    box.style.display = 'block';
  },

  async salvar(e) {
    e.preventDefault();
    const id = document.getElementById('pr-id').value;
    const itens = Preparos.coletar();
    if (!itens.length) { UI.toast('Adicione ao menos um ingrediente na receita.', 'erro'); return; }
    if (itens.some(i => !i.ingrediente_id)) { UI.toast('Selecione o ingrediente em cada linha.', 'erro'); return; }
    const body = {
      nome: document.getElementById('pr-nome').value,
      unidade_base: document.getElementById('pr-unidade').value,
      rendimento: parseFloat(document.getElementById('pr-rend').value),
      unidade_rendimento: document.getElementById('pr-rend-un').value,
      itens,
    };
    try {
      const res = id ? await API.put('/preparos/' + id, body) : await API.post('/preparos', body);
      UI.fecharModal('modal-preparo');
      await Ingredientes.carregar();
      UI.toast(res.mensagem || 'Preparo salvo.');
    } catch (err) { UI.toast(err.erro || 'Erro ao salvar o preparo.', 'erro'); }
  },

  // "Produzi uma leva": entrada do rendimento + baixa dos ingredientes
  async producao(id, nome) {
    const resp = prompt(`Quantas levas de "${nome}" você produziu?\n(1 leva = a receita inteira; pode usar 0,5 para meia receita)`, '1');
    if (resp === null) return;
    const levas = parseFloat(String(resp).replace(',', '.'));
    if (!(levas > 0)) { UI.toast('Quantidade de levas inválida.', 'erro'); return; }
    try {
      const res = await API.post(`/preparos/${id}/producao`, { levas });
      await Ingredientes.carregar();
      UI.toast(res.mensagem || 'Produção registrada.');
    } catch (err) { UI.toast(err.erro || 'Erro ao registrar a produção.', 'erro'); }
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
      <div class="resumo-card"><div class="valor" id="resumo-saiu-hoje">—</div><div class="label">Saiu Hoje (R$)</div></div>
      <div class="resumo-card"><div class="valor" style="font-size:1.05rem">${ultimaTxt}</div><div class="label">Última Contagem</div></div>`;

    // Saída rápida (baixa do quartinho em 2 toques)
    const srBox = document.getElementById('saida-rapida-box');
    if (_estoqueItens.length) {
      srBox.style.display = 'block';
      const sel = document.getElementById('sr-item');
      const anterior = sel.value;
      sel.innerHTML = '<option value="">— escolha o item —</option>' +
        _estoqueItens.map(i => `<option value="${i.id}">${i.nome}</option>`).join('');
      if (anterior && _estoqueItens.some(i => i.id === anterior)) sel.value = anterior;
      Estoque.srTrocarItem();
    } else {
      srBox.style.display = 'none';
    }

    // Lista de compras (com sugestão de quanto comprar)
    const bloco = document.getElementById('estoque-compras-bloco');
    if (data.lista_compras.length) {
      bloco.style.display = 'block';
      document.getElementById('lista-compras-contagem').textContent = `(${data.lista_compras.length})`;
      document.getElementById('lista-compras-itens').innerHTML = data.lista_compras.map(i => {
        const tag = i.situacao === 'zerado'
          ? '<span class="badge-estoque zerado">Sem estoque</span>'
          : '<span class="badge-estoque baixo">Abaixo do mínimo</span>';
        const sugestao = Estoque.sugestaoCompra(i);
        const restante = (i.minimo_base > 0
          ? `tem ${fmtQtd(i.estoque_exibicao, i.unidade_exibicao)}, mínimo ${fmtQtd(i.minimo_exibicao, i.unidade_exibicao)}`
          : `tem ${fmtQtd(i.estoque_exibicao, i.unidade_exibicao)}`)
          + (sugestao ? ` · <strong style="color:var(--accent)">comprar ≈ ${sugestao}</strong>` : '');
        return `<div class="lista-compras-item">
          <div><strong>${i.nome}</strong> ${tag}</div>
          <div style="color:var(--text-muted);font-size:0.8rem">${restante}</div>
          <button class="btn-confirm" onclick="Estoque.abrirMovimento('${i.id}','entrada')">Registrar Entrada</button>
        </div>`;
      }).join('');
    } else {
      bloco.style.display = 'none';
    }

    Estoque.carregarConsumo();

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

  // ── Saída rápida (baixa do quartinho em 2 toques) ──
  srTrocarItem() {
    const id = document.getElementById('sr-item').value;
    const i = _estoqueItens.find(x => x.id === id);
    const unSel = document.getElementById('sr-unidade');
    const info = document.getElementById('sr-info');
    if (!i) { unSel.innerHTML = ''; info.textContent = ''; return; }
    unSel.innerHTML = opcoesUnidadeIng(i, i.embalagem ? 'emb' : null);
    const eqEmb = i.estoque_embalagem != null ? ` (≈ ${i.estoque_embalagem} ${i.embalagem.nome})` : '';
    info.textContent = `Em estoque: ${fmtQtd(i.estoque_exibicao, i.unidade_exibicao)}${eqEmb}`;
  },

  async baixaRapida() {
    const id = document.getElementById('sr-item').value;
    const qtd = parseFloat(document.getElementById('sr-qtd').value);
    const i = _estoqueItens.find(x => x.id === id);
    if (!i) { UI.toast('Escolha o item que saiu.', 'erro'); return; }
    if (!(qtd > 0)) { UI.toast('Informe a quantidade que saiu.', 'erro'); return; }
    try {
      const res = await API.post('/estoque/movimento', {
        ingrediente_id: id,
        tipo: 'saida',
        quantidade: qtd,
        unidade: document.getElementById('sr-unidade').value,
        motivo: 'Saída rápida (uso na produção)',
      });
      document.getElementById('sr-qtd').value = '';
      await Estoque.carregar(); // mantém o item selecionado e atualiza saldo/consumo
      const ing = res.ingrediente;
      const ex = EXIBICAO[ing.unidade_base] || { un: ing.unidade_base, fator: 1 };
      const resta = (Number(ing.estoque_atual) || 0) / ex.fator;
      UI.toast(`Baixa registrada — resta ${fmtQtd(resta, ex.un)} de ${ing.nome}.`);
    } catch (err) { UI.toast(err.erro || 'Erro ao dar baixa.', 'erro'); }
  },

  // ── Lista de compras: sugestão de quantidade + copiar + WhatsApp ──
  // Quanto falta para voltar ao mínimo, na medida em que a pessoa compra
  // (embalagens quando houver, senão kg/L/un).
  sugestaoCompra(i) {
    const falta = Math.max((i.minimo_base || 0) - (i.estoque_base || 0), 0);
    if (i.conteudo_embalagem_base > 0) {
      const emb = Math.ceil((falta > 0 ? falta : (i.estoque_base > 0 ? 0 : i.conteudo_embalagem_base)) / i.conteudo_embalagem_base);
      return emb > 0 ? `${emb} ${i.embalagem.nome}${emb > 1 ? 's' : ''}` : null;
    }
    if (falta > 0) {
      const fator = i.fator_exibicao || 1;
      return fmtQtd(Math.ceil((falta / fator) * 1000) / 1000, i.unidade_exibicao);
    }
    return null; // zerado sem mínimo: sem como sugerir quantidade
  },

  montarTextoListaCompras() {
    const lista = _estoquePanorama?.lista_compras || [];
    if (!lista.length) return null;
    const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const linhas = lista.map(i => {
      const tem = `tem ${fmtQtd(i.estoque_exibicao, i.unidade_exibicao)}`;
      const sugestao = Estoque.sugestaoCompra(i);
      return `• ${i.nome} — ${tem}${sugestao ? ` · comprar ≈ ${sugestao}` : ' · repor'}`;
    });
    return `🛒 LISTA DE COMPRAS — ${hoje}\n${linhas.join('\n')}`;
  },

  async copiarListaCompras() {
    const texto = Estoque.montarTextoListaCompras();
    if (!texto) { UI.toast('A lista de compras está vazia.', 'aviso'); return; }
    try { await navigator.clipboard.writeText(texto); UI.toast('Lista copiada! Cole onde quiser (WhatsApp, bloco de notas…).'); }
    catch { UI.toast('Não consegui copiar automaticamente — use o botão do WhatsApp.', 'erro'); }
  },

  zapListaCompras() {
    const texto = Estoque.montarTextoListaCompras();
    if (!texto) { UI.toast('A lista de compras está vazia.', 'aviso'); return; }
    window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank');
  },

  // ── Quanto saiu (R$) do estoque num dia ──
  async carregarConsumo() {
    const box = document.getElementById('consumo-dia-box');
    if (!_estoqueItens.length) { box.style.display = 'none'; return; }
    box.style.display = 'block';
    const input = document.getElementById('consumo-data');
    const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    if (!input.value) input.value = hoje;
    let c;
    try { c = await API.get('/estoque/consumo?data=' + input.value); } catch { return; }
    // Card "Saiu Hoje" do resumo (só reflete o dia atual)
    if (input.value === hoje) {
      const card = document.getElementById('resumo-saiu-hoje');
      if (card) { card.textContent = Fmt.moeda(c.valor_total); card.style.color = c.valor_total > 0 ? 'var(--red)' : 'var(--green)'; }
    }
    const cont = document.getElementById('consumo-dia-conteudo');
    if (!c.total_movimentos) {
      cont.innerHTML = '<p class="empty" style="padding:14px !important">Nenhuma saída registrada nesse dia.</p>';
      return;
    }
    const linhas = c.itens.map(i => `
      <div class="consumo-item">
        <span>${i.nome}</span>
        <span style="color:var(--text-muted)">${fmtQtd(i.quantidade_exibicao, i.unidade_exibicao)}</span>
        <strong style="color:var(--red)">${Fmt.moeda(i.valor)}</strong>
      </div>`).join('');
    const origem = c.valor_contagens > 0
      ? `<small style="color:var(--text-muted)">Baixas: ${Fmt.moeda(c.valor_saidas)} · apurado na conferência: ${Fmt.moeda(c.valor_contagens)}</small>` : '';
    cont.innerHTML = `
      <div class="consumo-total">Saiu <strong>${Fmt.moeda(c.valor_total)}</strong> do estoque</div>
      ${origem}
      <div class="consumo-lista">${linhas}</div>`;
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
    checarHashAdmin(); // libera o painel interno se a URL tiver #auditoria
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
// MÓDULO 8 — AUDITORIA TÉCNICA
// ═══════════════════════════════════════════════════════════════
const Auditoria = {
  _ultimo: null,
  async carregar() {
    const lista = document.getElementById('auditoria-lista');
    const resumo = document.getElementById('auditoria-resumo');
    resumo.innerHTML = '<div class="resumo-card"><div class="valor">…</div><div class="label">Verificando</div></div>';
    lista.innerHTML = '';
    let data;
    try { data = await API.get('/auditoria'); } catch (e) { lista.innerHTML = `<p class="empty">${(e&&e.erro)||'Erro ao verificar.'}</p>`; resumo.innerHTML=''; return; }
    Auditoria._ultimo = data;
    const r = data.resumo;

    const tudoOk = r.total === 0;
    resumo.innerHTML = `
      <div class="resumo-card"><div class="valor" style="color:${r.criticos?'var(--red)':'var(--text-muted)'}">${r.criticos}</div><div class="label">Críticos</div></div>
      <div class="resumo-card"><div class="valor" style="color:${r.avisos?'var(--accent)':'var(--text-muted)'}">${r.avisos}</div><div class="label">Avisos</div></div>
      <div class="resumo-card"><div class="valor" style="color:var(--text-muted)">${r.infos}</div><div class="label">Informações</div></div>
      <div class="resumo-card"><div class="valor" style="font-size:1rem;color:${tudoOk?'var(--green)':'var(--text)'}">${tudoOk?'✅ Tudo certo':'⚠ Revisar'}</div><div class="label">${r.contagens.ingredientes} ing · ${r.contagens.fichas} fichas</div></div>`;

    if (tudoOk) {
      lista.innerHTML = `<div class="auditoria-ok">
        <div class="auditoria-ok-icone">✅</div>
        <h3>Nenhum problema técnico encontrado</h3>
        <p>Ingredientes, fichas, estoque e custos estão consistentes. Rode esta verificação sempre que cadastrar muita coisa nova.</p>
      </div>`;
      return;
    }

    const sevMeta = {
      critico: { rotulo: 'Crítico', icone: '⛔', classe: 'crit' },
      aviso:   { rotulo: 'Aviso',   icone: '⚠️', classe: 'avi' },
      info:    { rotulo: 'Info',    icone: 'ℹ️', classe: 'inf' },
    };
    lista.innerHTML = data.problemas.map((p, idx) => {
      const m = sevMeta[p.severidade] || sevMeta.info;
      const alvoTxt = p.alvo ? `<span class="aud-alvo">${({ingrediente:'Ingrediente',ficha:'Ficha',mes:'Mês',estoque:'Estoque'})[p.alvo.tipo]||p.alvo.tipo}: <strong>${(p.alvo.nome||'').replace(/</g,'&lt;')}</strong></span>` : '';
      const sug = p.sugestao ? `<div class="aud-sugestao">💡 ${p.sugestao.replace(/</g,'&lt;')}</div>` : '';
      const btn = p.acao ? `<button class="btn-confirm aud-corrigir" onclick="Auditoria.corrigir('${p.acao}', this)">Corrigir automaticamente</button>` : '';
      return `<div class="aud-item ${m.classe}">
        <div class="aud-item-topo">
          <span class="aud-badge ${m.classe}">${m.icone} ${m.rotulo}</span>
          <span class="aud-categoria">${p.categoria}</span>
        </div>
        <div class="aud-titulo">${p.titulo.replace(/</g,'&lt;')}</div>
        <div class="aud-detalhe">${p.detalhe.replace(/</g,'&lt;')}</div>
        ${alvoTxt}
        ${sug}
        ${btn}
      </div>`;
    }).join('');
  },

  async corrigir(acao, btn) {
    if (btn) { btn.disabled = true; btn.textContent = 'Corrigindo…'; }
    try {
      const res = await API.post('/auditoria/corrigir', { acao });
      UI.toast(res.mensagem || 'Correção aplicada.');
      // Recarrega telas que podem ter mudado + a própria auditoria
      await Auditoria.carregar();
      Backup.carregarInfo().catch(()=>{});
      Fichas.carregar?.().catch(()=>{});
    } catch (err) {
      UI.toast(err.erro || 'Erro ao corrigir.', 'erro');
      if (btn) { btn.disabled = false; btn.textContent = 'Corrigir automaticamente'; }
    }
  },
};

// ── Backup / segurança dos dados (dentro do painel interno) ──
const Backup = {
  async carregarInfo() {
    const el = document.getElementById('backup-status');
    if (!el) return;
    let info;
    try { info = await API.get('/backup/info'); } catch { el.textContent = 'Não foi possível ler o estado do banco.'; return; }
    const c = info.contagens || {};
    const total = `${c.ingredientes||0} ingredientes · ${c.fichas||0} fichas · ${c.movimentos_estoque||0} movimentos · ${c.caixa||0} lançamentos`;
    let onde;
    if (info.kv_ativo) {
      const baks = (info.kv && info.kv.backups) || [];
      const ult = baks.length ? ` · backup diário automático no Redis (${baks.length} guardados, último: ${baks[0].split(':').pop()})` : ' · backup diário automático ativo (1ª gravação do dia)';
      onde = `<strong style="color:var(--green)">Banco persistente (Vercel KV)</strong>${ult}`;
    }
    else if (info.na_vercel) onde = '<strong style="color:var(--red)">⚠ Disco temporário SEM KV — risco de perda!</strong>';
    else {
      const b = (info.local && info.local.backups) || [];
      const ult = b.length ? `último backup automático: ${Fmt.data(b[0].data)} (${b.length} guardados)` : 'sem backup automático ainda';
      onde = `Arquivos locais · ${ult}`;
    }
    el.innerHTML = `${onde}<br><span style="color:var(--text-muted)">${total}</span>`;
  },

  async exportar() {
    try {
      const r = await fetch('/api/backup/exportar', { credentials: 'same-origin' });
      if (r.status === 401) { Auth.exigirLogin(); return; }
      if (!r.ok) throw 0;
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cmv-backup-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      UI.toast('Backup baixado. Guarde o arquivo num lugar seguro (Drive, e-mail).');
      Backup.carregarInfo().catch(()=>{});
    } catch { UI.toast('Erro ao gerar o backup.', 'erro'); }
  },

  async importar(input) {
    const file = input.files && input.files[0];
    input.value = ''; // permite re-selecionar o mesmo arquivo depois
    if (!file) return;
    if (!confirm('Restaurar vai SUBSTITUIR os dados atuais pelos do arquivo.\nO estado atual é salvo num backup antes. Continuar?')) return;
    let pacote;
    try { pacote = JSON.parse(await file.text()); }
    catch { UI.toast('Arquivo inválido (não é um JSON de backup).', 'erro'); return; }
    try {
      const res = await API.post('/backup/restaurar', pacote);
      UI.toast(res.mensagem || 'Backup restaurado.');
      setTimeout(() => location.reload(), 900);
    } catch (err) { UI.toast(err.erro || 'Erro ao restaurar.', 'erro'); }
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
    if (target === 'caixa') { Caixa.carregar(); } // Whats.carregarLog() desativado — WhatsApp é projeto futuro (bloco oculto no HTML)
    if (target === 'auditoria') { Auditoria.carregar(); Backup.carregarInfo(); }
  });
});
document.querySelectorAll('.modal').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m) m.classList.add('hidden'); });
});

// ═══════════════════════════════════════════════════════════════
// PAINEL INTERNO (AUDITORIA) — oculto dos usuários
// A aba não aparece na barra. O dono/desenvolvedor abre por:
//   • atalho de teclado  Ctrl+Shift+A
//   • URL  .../#auditoria   (também #admin / #diagnostico)
// Só funciona depois de logado.
// ═══════════════════════════════════════════════════════════════
const AdminTab = {
  revelar(focar = true) {
    if (!_appIniciado) return; // só após login
    const btn = document.getElementById('tab-btn-auditoria');
    if (!btn) return;
    const estavaOculta = btn.hasAttribute('hidden');
    btn.removeAttribute('hidden');
    if (focar) {
      btn.click();
      if (estavaOculta) UI.toast('Painel interno de auditoria liberado (não visível aos usuários).', 'aviso');
    }
  },
};
function checarHashAdmin() {
  if (/^#(auditoria|admin|diagnostico)$/i.test(location.hash || '')) AdminTab.revelar();
}
window.addEventListener('hashchange', checarHashAdmin);
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
    e.preventDefault();
    AdminTab.revelar();
  }
});

// Início: primeiro resolve a autenticação; o app só carrega após login.
Auth.iniciar();
