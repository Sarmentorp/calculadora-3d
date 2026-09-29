// calculator.js
// Toda a lógica da calculadora roda aqui, no navegador — não precisa de login
// nem de servidor pra calcular. As "Configurações" ficam salvas no localStorage
// deste navegador por enquanto (na Etapa 3, quando tiver conta, passam a ficar
// salvas no servidor e vinculadas ao usuário).

const SETTINGS_KEY = 'precifica3d_settings';

// Impressoras pré-cadastradas (Etapa 4 vai deixar isso mais completo, com
// várias impressoras salvas de uma vez — por enquanto é só um atalho pra
// preencher as Configurações).
const PRINTER_PRESETS = {
  a1mini: {
    nome: 'Bambu Lab A1 mini',
    potencia: 90,        // W médios durante a impressão (fabricante indica 50-130 W)
    preco: 2319.00,       // R$, preço de tabela em set/2026 — ajuste pro que você pagou
    vidaUtilHoras: 3000,  // estimativa de vida útil pra fins de depreciação
  },
};

const defaultSettings = {
  precoFilamento: 89.90,                          // R$ por kg
  printerPreset: 'a1mini',
  precoImpressora: PRINTER_PRESETS.a1mini.preco,   // R$
  vidaUtilHoras: PRINTER_PRESETS.a1mini.vidaUtilHoras,
  potenciaImpressora: PRINTER_PRESETS.a1mini.potencia, // Watts
  tarifaEnergia: 0.95,                             // R$ por kWh
};

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
    // Compatibilidade com versões antigas, que só guardavam custoImpressoraHora.
    if (saved.custoImpressoraHora && !saved.precoImpressora) {
      saved.vidaUtilHoras = saved.vidaUtilHoras || defaultSettings.vidaUtilHoras;
      saved.precoImpressora = saved.custoImpressoraHora * saved.vidaUtilHoras;
    }
    return { ...defaultSettings, ...saved };
  } catch {
    return { ...defaultSettings };
  }
}

function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

let settings = loadSettings();

// --- Taxas de marketplace (Mercado Livre, Shopee, TikTok Shop) ---
// Pesquisado em setembro/2026. São valores de referência: a comissão real
// varia por categoria (Mercado Livre) ou muda com o tempo, então os campos
// ficam editáveis — confirme o número exato no painel de vendedor de cada
// plataforma antes de confiar 100% no preço sugerido.
function getMarketplaceDefaults(mkt, precoEstimado) {
  switch (mkt) {
    case 'ml_classico':
      return {
        comissaoPct: 12,
        taxaFixa: precoEstimado < 79 ? 6.5 : 0,
        hint: 'Mercado Livre Clássico cobra entre 10% e 19% conforme a categoria do anúncio. Abaixo de R$ 79, cobra também uma taxa fixa de ~R$ 6 a R$ 7; a partir de R$ 79 não tem taxa fixa, mas o frete grátis passa a ser obrigação do vendedor. Confira a % exata da sua categoria no painel do Mercado Livre.',
      };
    case 'ml_premium':
      return {
        comissaoPct: 17,
        taxaFixa: precoEstimado < 79 ? 6.5 : 0,
        hint: 'Mercado Livre Premium cobra entre 15% e 19% (permite parcelar em até 12x pro comprador). Mesma regra de taxa fixa/frete grátis do Clássico a partir de R$ 79.',
      };
    case 'shopee':
      if (precoEstimado < 80) return { comissaoPct: 20, taxaFixa: 4, hint: 'Shopee: peças até R$ 79,99 pagam 20% + R$ 4,00 fixo por item.' };
      if (precoEstimado < 100) return { comissaoPct: 14, taxaFixa: 16, hint: 'Shopee: peças de R$ 80 a R$ 99,99 pagam 14% + R$ 16,00 fixo por item.' };
      if (precoEstimado < 200) return { comissaoPct: 14, taxaFixa: 20, hint: 'Shopee: peças de R$ 100 a R$ 199,99 pagam 14% + R$ 20,00 fixo por item.' };
      if (precoEstimado < 500) return { comissaoPct: 14, taxaFixa: 26, hint: 'Shopee: peças de R$ 200 a R$ 499,99 pagam 14% + R$ 26,00 fixo por item.' };
      return { comissaoPct: 14, taxaFixa: 28, hint: 'Shopee: peças a partir de R$ 500 pagam 14% + R$ 28,00 fixo por item.' };
    case 'tiktok':
      if (precoEstimado < 50) return { comissaoPct: 10, taxaFixa: 4, hint: 'TikTok Shop: peças abaixo de R$ 50 pagam 10% + R$ 4,00 fixo por item.' };
      return { comissaoPct: 6, taxaFixa: 6, hint: 'TikTok Shop: peças a partir de R$ 50 pagam 6% + R$ 6,00 fixo por item.' };
    default:
      return { comissaoPct: 0, taxaFixa: 0, hint: '' };
  }
}

// --- Preenche o modal de configurações com os valores atuais ---
function fillSettingsForm() {
  document.getElementById('precoFilamento').value = settings.precoFilamento;
  document.getElementById('printerPreset').value = settings.printerPreset || 'personalizada';
  document.getElementById('precoImpressora').value = settings.precoImpressora;
  document.getElementById('vidaUtilHoras').value = settings.vidaUtilHoras;
  document.getElementById('potenciaImpressora').value = settings.potenciaImpressora;
  document.getElementById('tarifaEnergia').value = settings.tarifaEnergia;
  atualizarCustoHoraCalculado();
}

// Mostra, em tempo real no modal, quanto dá o custo por hora (preço ÷ vida útil).
function atualizarCustoHoraCalculado() {
  const preco = parseFloat(document.getElementById('precoImpressora').value) || 0;
  const vidaUtil = parseFloat(document.getElementById('vidaUtilHoras').value) || 1;
  const custoHora = preco / vidaUtil;
  document.getElementById('custoHoraCalculado').textContent = `Custo por hora (calculado): ${formatarReais(custoHora)}`;
}

// --- Lê os valores do formulário principal ---
function readForm() {
  const peso = parseFloat(document.getElementById('peso').value) || 0;
  const horas = parseFloat(document.getElementById('horas').value) || 0;
  const minutos = parseFloat(document.getElementById('minutos').value) || 0;
  const margem = parseFloat(document.getElementById('margemCustom').value) || 0;
  const embalagem = parseFloat(document.getElementById('embalagem').value) || 0;
  const taxaFalha = parseFloat(document.getElementById('taxaFalha').value) || 0;
  const custosExtras = parseFloat(document.getElementById('custosExtras').value) || 0;
  const precoMarketeiro = document.getElementById('precoMarketeiro').checked;
  const marketplace = document.getElementById('marketplace').value;
  const comissaoPct = parseFloat(document.getElementById('comissaoPct').value) || 0;
  const taxaFixaMarketplace = parseFloat(document.getElementById('taxaFixaMarketplace').value) || 0;

  return {
    peso,
    tempoHoras: horas + minutos / 60,
    margem,
    embalagem,
    taxaFalha,
    custosExtras,
    precoMarketeiro,
    marketplace,
    comissaoPct,
    taxaFixaMarketplace,
  };
}

// --- O cálculo em si ---
function calcular(input, settings) {
  const custoMaterial = input.peso * (settings.precoFilamento / 1000);
  const custoImpressoraHora = settings.precoImpressora / settings.vidaUtilHoras;
  const custoMaquina = input.tempoHoras * custoImpressoraHora;
  const custoEnergia = input.tempoHoras * (settings.potenciaImpressora / 1000) * settings.tarifaEnergia;

  const custoBase = custoMaterial + custoMaquina + custoEnergia + input.embalagem + input.custosExtras;

  // Taxa de falha: encarece o custo pra cobrir peças que podem falhar na impressão.
  const fator_falha = 1 - Math.min(input.taxaFalha, 90) / 100;
  const custoComFalha = fator_falha > 0 ? custoBase / fator_falha : custoBase;

  // Preço de venda direta (sem marketplace): o que você cobraria vendendo
  // direto pro cliente, sem nenhuma plataforma tirando comissão.
  const precoDireto = custoComFalha * (1 + input.margem / 100);

  const temMarketplace = input.marketplace && input.marketplace !== 'nenhum';

  let precoAnuncio = null;
  let recebeLiquido = precoDireto;
  let precoFinal;

  if (temMarketplace) {
    // Conta reversa: pra você receber líquido o mesmo precoDireto depois da
    // comissão + taxa fixa da plataforma, o preço anunciado precisa ser maior.
    const comissaoFrac = Math.min(input.comissaoPct, 90) / 100;
    precoAnuncio = (precoDireto + input.taxaFixaMarketplace) / (1 - comissaoFrac);

    if (input.precoMarketeiro) {
      precoAnuncio = arredondarMarketeiro(precoAnuncio);
    }

    recebeLiquido = precoAnuncio * (1 - comissaoFrac) - input.taxaFixaMarketplace;
    precoFinal = precoAnuncio;
  } else {
    precoFinal = input.precoMarketeiro ? arredondarMarketeiro(precoDireto) : precoDireto;
    recebeLiquido = precoFinal;
  }

  return {
    custoMaterial,
    custoMaquina,
    custoEnergia,
    custoBase,
    custoComFalha,
    precoDireto,
    temMarketplace,
    precoAnuncio,
    recebeLiquido,
    precoFinal,
  };
}

// Arredonda pra cima terminando em ",90" (ex: 23,10 -> 23,90 | 24,95 -> 25,90)
function arredondarMarketeiro(valor) {
  const inteiro = Math.floor(valor);
  const candidato = inteiro + 0.9;
  return candidato >= valor ? candidato : inteiro + 1 + 0.9;
}

function formatarReais(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// --- Atualiza a tela ---
function atualizar() {
  const input = readForm();
  const resultLabelEl = document.getElementById('resultLabel');
  const resultadoEl = document.getElementById('resultado');
  const hintEl = document.getElementById('resultHint');
  const resultSubEl = document.getElementById('resultSub');
  const breakdownEl = document.getElementById('breakdown');
  const breakdownBody = document.getElementById('breakdownBody');

  if (input.peso <= 0 || input.tempoHoras <= 0) {
    resultadoEl.textContent = 'R$ --,--';
    hintEl.textContent = 'Preencha o peso e o tempo de impressão para ver o resultado.';
    breakdownEl.hidden = true;
    resultSubEl.hidden = true;
    return;
  }

  const r = calcular(input, settings);

  resultLabelEl.textContent = r.temMarketplace ? 'PREÇO DO ANÚNCIO' : 'PREÇO SUGERIDO';
  resultadoEl.textContent = formatarReais(r.precoFinal);
  hintEl.textContent = `Para ${input.peso} g e ${input.tempoHoras.toFixed(2)} h de impressão.`;

  if (r.temMarketplace) {
    resultSubEl.hidden = false;
    resultSubEl.textContent = `Depois da comissão e da taxa fixa da plataforma, você recebe ${formatarReais(r.recebeLiquido)} líquido.`;
  } else {
    resultSubEl.hidden = true;
  }

  breakdownEl.hidden = false;
  let linhas = `
    <div class="line"><span>Material (filamento)</span><span>${formatarReais(r.custoMaterial)}</span></div>
    <div class="line"><span>Máquina (depreciação)</span><span>${formatarReais(r.custoMaquina)}</span></div>
    <div class="line"><span>Energia elétrica</span><span>${formatarReais(r.custoEnergia)}</span></div>
    <div class="line"><span>Embalagem</span><span>${formatarReais(input.embalagem)}</span></div>
    <div class="line"><span>Custos extras</span><span>${formatarReais(input.custosExtras)}</span></div>
    <div class="line total"><span>Custo total (com taxa de falha)</span><span>${formatarReais(r.custoComFalha)}</span></div>
    <div class="line total"><span>Preço de venda direta (+${input.margem}%)</span><span>${formatarReais(r.precoDireto)}</span></div>
  `;

  if (r.temMarketplace) {
    linhas += `
    <div class="line"><span>Comissão da plataforma (${input.comissaoPct}%)</span><span>- ${formatarReais(r.precoAnuncio * (input.comissaoPct / 100))}</span></div>
    <div class="line"><span>Taxa fixa por item</span><span>- ${formatarReais(input.taxaFixaMarketplace)}</span></div>
    <div class="line total"><span>Preço do anúncio</span><span>${formatarReais(r.precoAnuncio)}</span></div>
    <div class="line total"><span>Você recebe líquido</span><span>${formatarReais(r.recebeLiquido)}</span></div>
    `;
  }

  breakdownBody.innerHTML = linhas;
}

// --- Botões de margem pré-definida ---
function setupChips() {
  const chips = document.querySelectorAll('.chip[data-margin]');
  const custom = document.getElementById('margemCustom');

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      chips.forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      custom.value = chip.dataset.margin;
      atualizar();
    });
  });

  custom.addEventListener('input', () => {
    chips.forEach((c) => c.classList.toggle('active', c.dataset.margin === custom.value));
    atualizar();
  });
}

// --- Configurações (modal) ---
function setupSettingsModal() {
  const modal = document.getElementById('settingsModal');
  document.getElementById('settingsBtn').addEventListener('click', () => {
    fillSettingsForm();
    modal.hidden = false;
  });

  document.getElementById('closeSettings').addEventListener('click', () => {
    settings = {
      precoFilamento: parseFloat(document.getElementById('precoFilamento').value) || defaultSettings.precoFilamento,
      printerPreset: document.getElementById('printerPreset').value,
      precoImpressora: parseFloat(document.getElementById('precoImpressora').value) || defaultSettings.precoImpressora,
      vidaUtilHoras: parseFloat(document.getElementById('vidaUtilHoras').value) || defaultSettings.vidaUtilHoras,
      potenciaImpressora: parseFloat(document.getElementById('potenciaImpressora').value) || defaultSettings.potenciaImpressora,
      tarifaEnergia: parseFloat(document.getElementById('tarifaEnergia').value) || defaultSettings.tarifaEnergia,
    };
    saveSettings(settings);
    modal.hidden = true;
    atualizar();
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.hidden = true;
  });

  // Escolher uma impressora da lista preenche os campos sozinho (dá pra editar depois).
  document.getElementById('printerPreset').addEventListener('change', (e) => {
    const preset = PRINTER_PRESETS[e.target.value];
    if (preset) {
      document.getElementById('precoImpressora').value = preset.preco;
      document.getElementById('vidaUtilHoras').value = preset.vidaUtilHoras;
      document.getElementById('potenciaImpressora').value = preset.potencia;
      atualizarCustoHoraCalculado();
    }
  });

  ['precoImpressora', 'vidaUtilHoras'].forEach((id) => {
    document.getElementById(id).addEventListener('input', atualizarCustoHoraCalculado);
  });
}

// --- Marketplace (Mercado Livre / Shopee / TikTok Shop) ---
function setupMarketplace() {
  const select = document.getElementById('marketplace');
  const fields = document.getElementById('marketplaceFields');
  const comissaoInput = document.getElementById('comissaoPct');
  const taxaFixaInput = document.getElementById('taxaFixaMarketplace');
  const hintEl = document.getElementById('marketplaceHint');

  select.addEventListener('change', () => {
    if (select.value === 'nenhum') {
      fields.hidden = true;
      atualizar();
      return;
    }

    fields.hidden = false;

    // Usa o preço de venda direta atual (se já der pra calcular) só pra
    // escolher a faixa de taxa certa (Shopee e TikTok Shop têm faixas por preço).
    const input = readForm();
    let precoEstimado = 0;
    if (input.peso > 0 && input.tempoHoras > 0) {
      const r = calcular({ ...input, marketplace: 'nenhum' }, settings);
      precoEstimado = r.precoDireto;
    }

    const defaults = getMarketplaceDefaults(select.value, precoEstimado);
    comissaoInput.value = defaults.comissaoPct;
    taxaFixaInput.value = defaults.taxaFixa;
    hintEl.textContent = defaults.hint;

    atualizar();
  });

  comissaoInput.addEventListener('input', atualizar);
  taxaFixaInput.addEventListener('input', atualizar);
}

// --- Liga tudo ---
function setupInputs() {
  ['peso', 'horas', 'minutos', 'embalagem', 'taxaFalha', 'custosExtras'].forEach((id) => {
    document.getElementById(id).addEventListener('input', atualizar);
  });
  document.getElementById('precoMarketeiro').addEventListener('change', atualizar);
}

document.addEventListener('DOMContentLoaded', () => {
  setupChips();
  setupInputs();
  setupSettingsModal();
  setupMarketplace();
  atualizar();
});

// --- Ponte pro app.js (contas + impressoras salvas, Etapa 3/4) ---
// Scripts "clássicos" (sem type="module") compartilham o mesmo escopo léxico
// de topo, então o app.js já enxergaria essas variáveis diretamente — mas
// deixamos isso explícito em window.Precifica3D pra ficar claro qual é a
// interface entre os dois arquivos, sem duplicar lógica de cálculo.
window.Precifica3D = {
  getSettings() {
    return settings;
  },
  aplicarSettings(parciais) {
    settings = { ...settings, ...parciais };
    saveSettings(settings);
    atualizar();
  },
  saveSettings,
  atualizar,
  atualizarCustoHoraCalculado,
  formatarReais,
  PRINTER_PRESETS,
  defaultSettings,
};
