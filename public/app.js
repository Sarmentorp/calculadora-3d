// app.js
// Contas (login/cadastro), navegação entre abas e a aba Impressoras.
// A lógica de cálculo em si continua toda em calculator.js — aqui só
// cuidamos de conta, dados salvos no servidor e amarrar isso à calculadora
// através da interface window.Precifica3D exposta no final de calculator.js.

let currentUser = null;
let printers = [];
let isPremium = false;
let limiteGratis = 1;
let authMode = 'login';

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

async function apiFetch(url, opts = {}) {
  const res = await fetch(url, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const err = new Error((data && data.message) || 'Algo deu errado. Tente de novo.');
    err.code = data && data.error;
    err.status = res.status;
    throw err;
  }

  return data;
}

// ============================================================
// Abas
// ============================================================
function setupTabs() {
  document.querySelectorAll('.tab[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

function switchTab(tab) {
  document.querySelectorAll('.tab[data-tab]').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  document.querySelectorAll('.view').forEach((v) => {
    v.hidden = v.id !== `view-${tab}`;
  });
  if (tab === 'impressoras') renderImpressorasView();
}

// ============================================================
// Área do usuário / modal de entrar e cadastrar
// ============================================================
function renderUserArea() {
  const el = document.getElementById('userArea');
  if (currentUser) {
    el.innerHTML = `
      <span class="user-email">${escapeHtml(currentUser.email)}</span>
      <button class="btn-ghost" id="logoutBtn">Sair</button>
    `;
    document.getElementById('logoutBtn').addEventListener('click', logout);
  } else {
    el.innerHTML = `<button class="btn-ghost" id="loginBtn">Entrar</button>`;
    document.getElementById('loginBtn').addEventListener('click', () => openAuthModal('login'));
  }
}

function updateAuthModalTexts() {
  const isLogin = authMode === 'login';
  document.getElementById('authModalTitle').textContent = isLogin ? 'Entrar' : 'Criar conta';
  document.getElementById('authModalSub').textContent = isLogin
    ? 'Entre pra salvar suas impressoras, produtos e encomendas.'
    : 'Grátis. Leva menos de um minuto.';
  document.getElementById('authSubmitBtn').textContent = isLogin ? 'Entrar' : 'Criar conta';
  document.getElementById('authSwitchMode').textContent = isLogin
    ? 'Ainda não tem conta? Cadastre-se'
    : 'Já tem conta? Entrar';
  document.getElementById('authSenha').setAttribute('autocomplete', isLogin ? 'current-password' : 'new-password');
}

function openAuthModal(mode) {
  authMode = mode;
  updateAuthModalTexts();
  document.getElementById('authError').hidden = true;
  document.getElementById('authForm').reset();
  document.getElementById('authModal').hidden = false;
  document.getElementById('authEmail').focus();
}

function closeAuthModal() {
  document.getElementById('authModal').hidden = true;
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('authEmail').value.trim();
  const senha = document.getElementById('authSenha').value;
  const errorEl = document.getElementById('authError');
  errorEl.hidden = true;

  const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/cadastro';

  try {
    const data = await apiFetch(endpoint, { method: 'POST', body: { email, senha } });
    currentUser = data.user;
    closeAuthModal();
    renderUserArea();
    await loadPrinters();
    if (!document.getElementById('view-impressoras').hidden) renderImpressorasView();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  }
}

async function logout() {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  } catch {
    // mesmo se a chamada falhar, limpamos o estado local
  }
  currentUser = null;
  printers = [];
  renderUserArea();
  updatePrinterPresetSelect();
  if (!document.getElementById('view-impressoras').hidden) renderImpressorasView();
}

function setupAuthModal() {
  document.getElementById('authForm').addEventListener('submit', handleAuthSubmit);
  document.getElementById('authSwitchMode').addEventListener('click', () => {
    authMode = authMode === 'login' ? 'cadastro' : 'login';
    updateAuthModalTexts();
    document.getElementById('authError').hidden = true;
  });
  document.getElementById('authModal').addEventListener('click', (e) => {
    if (e.target.id === 'authModal') closeAuthModal();
  });
}

// ============================================================
// Aba Impressoras
// ============================================================
function renderImpressorasView() {
  const loggedOut = document.getElementById('impressorasLoggedOut');
  const loggedIn = document.getElementById('impressorasLoggedIn');

  if (!currentUser) {
    loggedOut.hidden = false;
    loggedIn.hidden = true;
    return;
  }

  loggedOut.hidden = true;
  loggedIn.hidden = false;
  renderPrintersList();
}

function printerCardHtml(p) {
  const custoHora = p.preco / p.vida_util_horas;
  const { formatarReais } = window.Precifica3D;
  return `
    <div class="printer-card${p.is_default ? ' is-default' : ''}">
      ${p.is_default ? '<span class="badge-default">Em uso na calculadora</span>' : ''}
      <h3>${escapeHtml(p.nome)}</h3>
      <dl class="printer-specs">
        <div><dt>Preço</dt><dd>${formatarReais(p.preco)}</dd></div>
        <div><dt>Vida útil</dt><dd>${p.vida_util_horas} h</dd></div>
        <div><dt>Potência</dt><dd>${p.potencia_w} W</dd></div>
        <div><dt>Custo por hora</dt><dd>${formatarReais(custoHora)}</dd></div>
      </dl>
      <div class="printer-actions">
        ${p.is_default ? '' : `<button class="btn-secondary" data-usar="${p.id}">Usar na calculadora</button>`}
        <button class="btn-ghost" data-editar="${p.id}">Editar</button>
        <button class="btn-ghost btn-danger" data-excluir="${p.id}">Excluir</button>
      </div>
    </div>
  `;
}

function renderPrintersList() {
  const list = document.getElementById('printersList');
  const hint = document.getElementById('printersLimitHint');
  const novaBtn = document.getElementById('novaImpressoraBtn');
  const errorEl = document.getElementById('printersError');
  errorEl.hidden = true;

  if (printers.length === 0) {
    list.innerHTML = '<p class="field-hint">Você ainda não tem nenhuma impressora salva.</p>';
  } else {
    list.innerHTML = printers.map(printerCardHtml).join('');
    list.querySelectorAll('[data-editar]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = printers.find((pp) => pp.id === Number(btn.dataset.editar));
        if (p) openPrinterModal(p);
      });
    });
    list.querySelectorAll('[data-excluir]').forEach((btn) => {
      btn.addEventListener('click', () => deletePrinter(Number(btn.dataset.excluir)));
    });
    list.querySelectorAll('[data-usar]').forEach((btn) => {
      btn.addEventListener('click', () => setDefaultPrinter(Number(btn.dataset.usar)));
    });
  }

  if (!isPremium && printers.length >= limiteGratis) {
    hint.hidden = false;
    hint.textContent = `Plano grátis: ${printers.length}/${limiteGratis} impressora salva. Em breve: plano premium com impressoras ilimitadas.`;
    novaBtn.disabled = true;
  } else {
    hint.hidden = true;
    novaBtn.disabled = false;
  }
}

function updatePrinterCustoHoraPreview() {
  const preco = parseFloat(document.getElementById('printerPreco').value) || 0;
  const vidaUtil = parseFloat(document.getElementById('printerVidaUtil').value) || 1;
  const custoHora = preco / vidaUtil;
  document.getElementById('printerCustoHoraPreview').textContent =
    `Custo por hora (calculado): ${window.Precifica3D.formatarReais(custoHora)}`;
}

function openPrinterModal(printer) {
  document.getElementById('printerModalTitle').textContent = printer ? 'Editar impressora' : 'Nova impressora';
  document.getElementById('printerId').value = printer ? printer.id : '';
  document.getElementById('printerNome').value = printer ? printer.nome : '';
  document.getElementById('printerPreco').value = printer ? printer.preco : '';
  document.getElementById('printerVidaUtil').value = printer ? printer.vida_util_horas : '';
  document.getElementById('printerPotencia').value = printer ? printer.potencia_w : '';
  document.getElementById('printerFormError').hidden = true;
  updatePrinterCustoHoraPreview();
  document.getElementById('printerModal').hidden = false;
  document.getElementById('printerNome').focus();
}

function closePrinterModal() {
  document.getElementById('printerModal').hidden = true;
}

async function handlePrinterSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('printerId').value;
  const payload = {
    nome: document.getElementById('printerNome').value.trim(),
    preco: parseFloat(document.getElementById('printerPreco').value),
    vidaUtilHoras: parseFloat(document.getElementById('printerVidaUtil').value),
    potenciaW: parseFloat(document.getElementById('printerPotencia').value),
  };
  const errorEl = document.getElementById('printerFormError');
  errorEl.hidden = true;

  try {
    if (id) {
      await apiFetch(`/api/impressoras/${id}`, { method: 'PUT', body: payload });
    } else {
      await apiFetch('/api/impressoras', { method: 'POST', body: payload });
    }
    closePrinterModal();
    await loadPrinters();
    renderPrintersList();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  }
}

async function deletePrinter(id) {
  if (!window.confirm('Excluir essa impressora?')) return;
  try {
    await apiFetch(`/api/impressoras/${id}`, { method: 'DELETE' });
    await loadPrinters();
    renderPrintersList();
  } catch (err) {
    const errorEl = document.getElementById('printersError');
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  }
}

async function setDefaultPrinter(id) {
  try {
    await apiFetch(`/api/impressoras/${id}/padrao`, { method: 'POST' });
    await loadPrinters();
    renderPrintersList();
  } catch (err) {
    const errorEl = document.getElementById('printersError');
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  }
}

function setupPrinterModal() {
  document.getElementById('novaImpressoraBtn').addEventListener('click', () => openPrinterModal(null));
  document.getElementById('printerCancelBtn').addEventListener('click', closePrinterModal);
  document.getElementById('printerForm').addEventListener('submit', handlePrinterSubmit);
  document.getElementById('printerModal').addEventListener('click', (e) => {
    if (e.target.id === 'printerModal') closePrinterModal();
  });
  ['printerPreco', 'printerVidaUtil'].forEach((id) => {
    document.getElementById(id).addEventListener('input', updatePrinterCustoHoraPreview);
  });
}

// ============================================================
// Ligação com a calculadora: impressora padrão da conta vira a
// impressora usada nas Configurações e no cálculo.
// ============================================================
async function loadPrinters() {
  if (!currentUser) {
    printers = [];
    updatePrinterPresetSelect();
    return;
  }

  try {
    const data = await apiFetch('/api/impressoras');
    printers = data.impressoras;
    isPremium = data.isPremium;
    limiteGratis = data.limiteGratis;
  } catch {
    printers = [];
  }

  updatePrinterPresetSelect();
  syncImpressoraPadraoNaCalculadora();
}

function syncImpressoraPadraoNaCalculadora() {
  if (!currentUser) return;
  const padrao = printers.find((p) => p.is_default);
  if (!padrao) return;

  window.Precifica3D.aplicarSettings({
    printerPreset: `srv:${padrao.id}`,
    precoImpressora: padrao.preco,
    vidaUtilHoras: padrao.vida_util_horas,
    potenciaImpressora: padrao.potencia_w,
  });
}

function updateSettingsModalSub() {
  const sub = document.getElementById('settingsModalSub');
  if (!sub) return;
  sub.textContent = currentUser
    ? 'Esses valores ficam salvos neste navegador. A impressora marcada como padrão na aba Impressoras é usada automaticamente aqui.'
    : 'Esses valores ficam salvos neste navegador. Entre na sua conta e cadastre suas impressoras na aba Impressoras pra usá-las aqui.';
}

function updatePrinterPresetSelect() {
  const select = document.getElementById('printerPreset');
  const settings = window.Precifica3D.getSettings();

  const options = [{ value: 'a1mini', label: 'Bambu Lab A1 mini' }];
  if (currentUser) {
    printers.forEach((p) => {
      options.push({ value: `srv:${p.id}`, label: p.is_default ? `${p.nome} (em uso)` : p.nome });
    });
  }
  options.push({ value: 'personalizada', label: 'Personalizada' });

  select.innerHTML = options.map((o) => `<option value="${o.value}">${escapeHtml(o.label)}</option>`).join('');
  select.value = options.some((o) => o.value === settings.printerPreset) ? settings.printerPreset : 'personalizada';
  updateSettingsModalSub();
}

function handlePrinterPresetChange(e) {
  const val = e.target.value;
  if (!val.startsWith('srv:')) return;
  const id = Number(val.slice(4));
  const p = printers.find((pp) => pp.id === id);
  if (!p) return;
  document.getElementById('precoImpressora').value = p.preco;
  document.getElementById('vidaUtilHoras').value = p.vida_util_horas;
  document.getElementById('potenciaImpressora').value = p.potencia_w;
  window.Precifica3D.atualizarCustoHoraCalculado();
}

// ============================================================
// Início
// ============================================================
async function init() {
  setupTabs();
  setupAuthModal();
  setupPrinterModal();

  document.getElementById('settingsBtn').addEventListener('click', updatePrinterPresetSelect);
  document.getElementById('printerPreset').addEventListener('change', handlePrinterPresetChange);
  document.getElementById('impressorasEntrarBtn').addEventListener('click', () => openAuthModal('login'));
  document.getElementById('impressorasCadastrarBtn').addEventListener('click', () => openAuthModal('cadastro'));

  try {
    const data = await apiFetch('/api/auth/me');
    currentUser = data.user;
  } catch {
    currentUser = null;
  }

  renderUserArea();
  await loadPrinters();
}

document.addEventListener('DOMContentLoaded', init);
