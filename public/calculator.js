// calculator.js
// Toda a lógica da calculadora roda aqui, no navegador — não precisa de login
// nem de servidor pra calcular. As "Configurações" ficam salvas no localStorage
// deste navegador por enquanto (na Etapa 3, quando tiver conta, passam a ficar
// salvas no servidor e vinculadas ao usuário).

const SETTINGS_KEY = 'precifica3d_settings';

const defaultSettings = {
  precoFilamento: 89.90,       // R$ por kg
  custoImpressoraHora: 0.73,   // R$ por hora (depreciação da máquina)
  potenciaImpressora: 150,     // Watts
  tarifaEnergia: 0.95,         // R$ por kWh
};

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    return { ...defaultSettings, ...(saved || {}) };
  } catch {
    return { ...defaultSettings };
  }
}

function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

let settings = loadSettings();

// --- Preenche o modal de configurações com os valores atuais ---
function fillSettingsForm() {
  document.getElementById('precoFilamento').value = settings.precoFilamento;
  document.getElementById('custoImpressoraHora').value = settings.custoImpressoraHora;
  document.getElementById('potenciaImpressora').value = settings.potenciaImpressora;
  document.getElementById('tarifaEnergia').value = settings.tarifaEnergia;
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

  return {
    peso,
    tempoHoras: horas + minutos / 60,
    margem,
    embalagem,
    taxaFalha,
    custosExtras,
    precoMarketeiro,
  };
}

// --- O cálculo em si ---
function calcular(input, settings) {
  const custoMaterial = input.peso * (settings.precoFilamento / 1000);
  const custoMaquina = input.tempoHoras * settings.custoImpressoraHora;
  const custoEnergia = input.tempoHoras * (settings.potenciaImpressora / 1000) * settings.tarifaEnergia;

  const custoBase = custoMaterial + custoMaquina + custoEnergia + input.embalagem + input.custosExtras;

  // Taxa de falha: encarece o custo pra cobrir peças que podem falhar na impressão.
  const fator_falha = 1 - Math.min(input.taxaFalha, 90) / 100;
  const custoComFalha = fator_falha > 0 ? custoBase / fator_falha : custoBase;

  let precoFinal = custoComFalha * (1 + input.margem / 100);

  if (input.precoMarketeiro) {
    precoFinal = arredondarMarketeiro(precoFinal);
  }

  return {
    custoMaterial,
    custoMaquina,
    custoEnergia,
    custoBase,
    custoComFalha,
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
  const resultadoEl = document.getElementById('resultado');
  const hintEl = document.getElementById('resultHint');
  const breakdownEl = document.getElementById('breakdown');
  const breakdownBody = document.getElementById('breakdownBody');

  if (input.peso <= 0 || input.tempoHoras <= 0) {
    resultadoEl.textContent = 'R$ --,--';
    hintEl.textContent = 'Preencha o peso e o tempo de impressão para ver o resultado.';
    breakdownEl.hidden = true;
    return;
  }

  const r = calcular(input, settings);

  resultadoEl.textContent = formatarReais(r.precoFinal);
  hintEl.textContent = `Para ${input.peso} g e ${input.tempoHoras.toFixed(2)} h de impressão.`;

  breakdownEl.hidden = false;
  breakdownBody.innerHTML = `
    <div class="line"><span>Material (filamento)</span><span>${formatarReais(r.custoMaterial)}</span></div>
    <div class="line"><span>Máquina (depreciação)</span><span>${formatarReais(r.custoMaquina)}</span></div>
    <div class="line"><span>Energia elétrica</span><span>${formatarReais(r.custoEnergia)}</span></div>
    <div class="line"><span>Embalagem</span><span>${formatarReais(input.embalagem)}</span></div>
    <div class="line"><span>Custos extras</span><span>${formatarReais(input.custosExtras)}</span></div>
    <div class="line total"><span>Custo total (com taxa de falha)</span><span>${formatarReais(r.custoComFalha)}</span></div>
    <div class="line total"><span>Preço sugerido (+${input.margem}%)</span><span>${formatarReais(r.precoFinal)}</span></div>
  `;
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
      custoImpressoraHora: parseFloat(document.getElementById('custoImpressoraHora').value) || defaultSettings.custoImpressoraHora,
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
  atualizar();
});
