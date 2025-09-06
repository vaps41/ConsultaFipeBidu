tailwind.config = {
    theme: {
        extend: {
            colors: {
                'brand-primary': '#005AAD',
                'brand-secondary': '#FFC107',
                'brand-primary-light': '#E6F0FA',
                'brand-secondary-light': '#FFF9E6',
            }
        }
    }
}

const API_BASE_URL = 'https://parallelum.com.br/fipe/api/v1';

// Elementos do DOM
const vehicleTypeSelect = document.getElementById('vehicleType');
const yearSelect = document.getElementById('year');
const brandSearchInput = document.getElementById('brandSearch');
const modelSearchInput = document.getElementById('modelSearch');
const brandSuggestions = document.getElementById('brandSuggestions');
const modelSuggestions = document.getElementById('modelSuggestions');
const brandCodeInput = document.getElementById('brandCode');
const modelCodeInput = document.getElementById('modelCode');
const brandContainer = document.getElementById('brand-container');
const modelContainer = document.getElementById('model-container');
const yearContainer = document.getElementById('year-container');
const resultsContainer = document.getElementById('results-container');
const loader = document.getElementById('loader');
const errorDiv = document.getElementById('error');
const resetButton = document.getElementById('resetButton');

// Abas
const tabs = {
    ia: { btn: document.getElementById('tab-ia'), content: document.getElementById('tab-content-ia') },
    leilao: { btn: document.getElementById('tab-leilao'), content: document.getElementById('tab-content-leilao') },
    seguro: { btn: document.getElementById('tab-seguro'), content: document.getElementById('tab-content-seguro') },
    ipva: { btn: document.getElementById('tab-ipva'), content: document.getElementById('tab-content-ipva') },
    custos: { btn: document.getElementById('tab-custos'), content: document.getElementById('tab-content-custos') }
};

// Seguro
const vehicleOriginSelect = document.getElementById('vehicleOrigin');
const driverAgeInput = document.getElementById('driverAge');
const locationSelect = document.getElementById('location');
const coverageTypeSelect = document.getElementById('coverageType');
const calculateInsuranceBtn = document.getElementById('calculateInsuranceBtn');
const insuranceWarning = document.getElementById('insurance-warning');
const insuranceResultContainer = document.getElementById('insurance-result-container');
const insuranceAnnual = document.getElementById('insurance-annual');
const insuranceMonthly = document.getElementById('insurance-monthly');
const insuranceAdjustments = document.getElementById('insurance-adjustments');

// IPVA
const stateSelect = document.getElementById('stateSelect');
const ipvaResultContainer = document.getElementById('ipva-result-container');
const ipvaResult = document.getElementById('ipva-result');
const ipvaRateInfo = document.getElementById('ipva-rate-info');

// Projeção
const calculateProjectionBtn = document.getElementById('calculateProjectionBtn');
const projectionHelperText = document.getElementById('projection-helper-text');
const projectionResultContainer = document.getElementById('projection-result-container');
const projectionTableBody = document.getElementById('projection-table-body');
const projectionTotalCost = document.getElementById('projection-total-cost');
const projectionMonthlyCost = document.getElementById('projection-monthly-cost');

// Gemini
const geminiAssistantLoader = document.getElementById('gemini-assistant-loader');
const getTechSheetBtn = document.getElementById('getTechSheetBtn');
const techSheetResult = document.getElementById('tech-sheet-result');

let currentFipeValue = 0;
let currentFipeData = null;
let annualInsuranceCost = 0;
let annualIpvaCost = 0;
let selectedIpvaRate = 0;
let allBrands = [];
let allModels = [];

const ipvaRates = { 'AC': 2, 'AL': 3, 'AP': 3, 'AM': 3, 'BA': 2.5, 'CE': 3.5, 'DF': 3.5, 'ES': 2, 'GO': 3.75, 'MA': 2.5, 'MT': 3, 'MS': 3.5, 'MG': 4, 'PA': 2.5, 'PB': 2.5, 'PR': 3.5, 'PE': 2.4, 'PI': 2.5, 'RJ': 4, 'RN': 3, 'RS': 3, 'RO': 3, 'RR': 3, 'SC': 2, 'SP': 4, 'SE': 2.5, 'TO': 2 };

// Funções de UI
function toggleLoader(show) { loader.classList.toggle('hidden', !show); }
function showError(message) { errorDiv.textContent = message; errorDiv.classList.remove('hidden'); }
function clearError() { errorDiv.classList.add('hidden'); }
function hideResults() { resultsContainer.classList.add('hidden'); }
function formatCurrency(value) { return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function parseCurrency(valueString) { return parseFloat(valueString.replace('R$ ', '').replace(/\./g, '').replace(',', '.')); }

// Lógica das Abas
function switchTab(activeTab) {
    for (const key in tabs) {
        const is_active = key === activeTab;
        tabs[key].btn.classList.toggle('border-brand-primary', is_active);
        tabs[key].btn.classList.toggle('text-brand-primary', is_active);
        tabs[key].btn.classList.toggle('border-transparent', !is_active);
        tabs[key].btn.classList.toggle('text-gray-500', !is_active);
        tabs[key].content.classList.toggle('hidden', !is_active);
    }
}
Object.keys(tabs).forEach(key => tabs[key].btn.addEventListener('click', () => switchTab(key)));

// --- Lógica Gemini API ---
async function callGeminiApi(prompt, schema = null) {
    // A URL agora aponta para a nossa função no servidor
    const serverUrl = '/.netlify/functions/gemini';

    try {
        const response = await fetch(serverUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, schema }) // Enviamos o prompt e o schema para o nosso servidor
        });

        if (!response.ok) throw new Error(`Erro no servidor: ${response.status}`);

        const result = await response.json();
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

        if (text) return text;
        throw new Error("Resposta da API inválida.");
    } catch (error) {
        console.error("Erro ao chamar o servidor proxy:", error);
        return schema ? "{}" : "Desculpe, não foi possível obter a informação no momento.";
    }
}

const techSheetSchema = {
    type: "OBJECT",
    properties: {
        motor: {
            type: "OBJECT", properties: {
                tipo: { type: "STRING" },
                cilindrada_cm3: { type: "STRING" },
                combustivel: { type: "STRING" },
                potencia_cv_etanol: { type: "STRING" },
                potencia_cv_gasolina: { type: "STRING" },
                torque_kgfm_etanol: { type: "STRING" },
                torque_kgfm_gasolina: { type: "STRING" },
                velocidade_maxima_km_h: { type: "STRING" },
                aceleracao_0_100_s: { type: "STRING" },
            }
        },
        transmissao: {
            type: "OBJECT", properties: {
                tipo: { type: "STRING" },
                marchas: { type: "STRING" },
                tracao: { type: "STRING" },
            }
        },
        suspensao: {
            type: "OBJECT", properties: {
                dianteira: { type: "STRING" },
                traseira: { type: "STRING" },
            }
        },
        freios: {
            type: "OBJECT", properties: {
                dianteiros: { type: "STRING" },
                traseiros: { type: "STRING" },
            }
        },
        dimensoes: {
            type: "OBJECT", properties: {
                comprimento_mm: { type: "STRING" },
                largura_mm: { type: "STRING" },
                altura_mm: { type: "STRING" },
                entre_eixos_mm: { type: "STRING" }
            }
        },
        pneus: {
            type: "OBJECT", properties: {
                medida: { type: "STRING" },
                roda_aro: { type: "STRING" },
            }
        },
        capacidades: {
            type: "OBJECT", properties: {
                tanque_combustivel_l: { type: "STRING" },
                porta_malas_l: { type: "STRING" },
            }
        },
        bateria: {
            type: "OBJECT", properties: {
                tensao_v: { type: "STRING" },
                capacidade_ah: { type: "STRING" },
                cca_a: { type: "STRING" },
                polaridade: { type: "STRING" },
            }
        }
    }
};

function renderTechSheet(data) {
    techSheetResult.innerHTML = '';

    const keyToLabel = {
        'tipo': 'Tipo',
        'cilindrada_cm3': 'Cilindrada (cm³)',
        'combustivel': 'Combustível',
        'potencia_cv_etanol': 'Potência (Etanol)',
        'potencia_cv_gasolina': 'Potência (Gasolina)',
        'torque_kgfm_etanol': 'Torque (Etanol)',
        'torque_kgfm_gasolina': 'Torque (Gasolina)',
        'velocidade_maxima_km_h': 'Velocidade Máxima (km/h)',
        'aceleracao_0_100_s': 'Aceleração (0-100 km/h)',
        'marchas': 'Marchas',
        'tracao': 'Tração',
        'dianteira': 'Dianteira',
        'traseira': 'Traseira',
        'dianteiros': 'Dianteiros',
        'traseiros': 'Traseiros',
        'comprimento_mm': 'Comprimento (mm)',
        'largura_mm': 'Largura (mm)',
        'altura_mm': 'Altura (mm)',
        'entre_eixos_mm': 'Entre-eixos (mm)',
        'tanque_combustivel_l': 'Tanque de Combustível (L)',
        'porta_malas_l': 'Porta-malas (L)',
        'medida': 'Medida Pneus',
        'roda_aro': 'Roda (Aro)',
        'tensao_v': 'Tensão (V)',
        'capacidade_ah': 'Capacidade (Ah)',
        'cca_a': 'CCA (A)',
        'polaridade': 'Polaridade'
    };

    const sections = {
        'Motor e Performance': data.motor,
        'Transmissão': data.transmissao,
        'Suspensão e Freios': { ...(data.suspensao || {}), ...(data.freios || {}) },
        'Dimensões': data.dimensoes,
        'Capacidades e Outros': { ...(data.capacidades || {}), ...(data.pneus || {}), ...(data.bateria || {}) }
    };

    const gridContainer = document.createElement('div');
    gridContainer.className = 'grid grid-cols-1 md:grid-cols-2 gap-6';

    for (const title in sections) {
        const sectionData = sections[title];
        if (!sectionData || Object.values(sectionData).every(v => !v || v === 'N/A')) continue;

        const sectionCard = document.createElement('div');
        sectionCard.className = 'bg-white p-4 rounded-lg border';

        const sectionTitle = document.createElement('h4');
        sectionTitle.className = 'text-lg font-semibold text-gray-800 mb-3';
        sectionTitle.textContent = title;
        sectionCard.appendChild(sectionTitle);

        const list = document.createElement('dl');
        for (const key in sectionData) {
            const value = sectionData[key];
            if (value && value !== 'N/A') {
                const dt = document.createElement('dt');
                dt.className = 'text-sm font-medium text-gray-500';
                dt.textContent = keyToLabel[key] || key.replace(/_/g, ' ');

                const dd = document.createElement('dd');
                dd.className = 'text-base text-gray-900 mb-2';
                dd.textContent = value;

                list.appendChild(dt);
                list.appendChild(dd);

                if (key === 'medida') {
                    const pneuMedidaSemEspaco = value.replace(/\s/g, '');
                    const pneuLink = document.createElement('a');
                    pneuLink.href = `https://www.pneustore.com.br/search/?text=${encodeURIComponent(pneuMedidaSemEspaco)}`;
                    pneuLink.target = '_blank';
                    pneuLink.rel = 'noopener noreferrer';
                    pneuLink.className = 'inline-flex items-center text-xs font-medium text-brand-primary hover:underline mt-1';
                    pneuLink.innerHTML = `Ver pneus recomendados <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="ml-1"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`;
                    dd.appendChild(pneuLink);
                }
            }
        }
        sectionCard.appendChild(list);
        gridContainer.appendChild(sectionCard);
    }
    techSheetResult.appendChild(gridContainer);
}

getTechSheetBtn.addEventListener('click', async () => {
    if (!currentFipeData) return;
    geminiAssistantLoader.classList.remove('hidden');
    techSheetResult.classList.add('hidden');
    getTechSheetBtn.disabled = true;

    const { Marca, Modelo, AnoModelo } = currentFipeData;
    const prompt = `Gere a ficha técnica para o veículo ${Marca} ${Modelo} ano ${AnoModelo}. Preencha o máximo de campos possível. Se uma informação não for encontrada, retorne 'N/A'.`;

    const responseJson = await callGeminiApi(prompt, techSheetSchema);
    try {
        const data = JSON.parse(responseJson);
        renderTechSheet(data);
    } catch (e) {
        techSheetResult.innerHTML = '<p class="text-center text-red-600">Não foi possível obter os dados estruturados. Tente novamente.</p>';
        console.error("Erro ao parsear JSON da ficha técnica:", e);
    }

    geminiAssistantLoader.classList.add('hidden');
    techSheetResult.classList.remove('hidden');
    getTechSheetBtn.disabled = false;
});

// --- Lógica Principal ---
async function fetchData(url) {
    toggleLoader(true);
    clearError();
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Não foi possível obter os dados.');
        return await response.json();
    } catch (err) {
        showError(err.message);
        return null;
    } finally {
        toggleLoader(false);
    }
}

function populateSuggestions(container, dataList, onSelectCallback) {
    container.innerHTML = '';
    if (dataList.length === 0) {
        const noResult = document.createElement('div');
        noResult.className = 'p-3 text-gray-500';
        noResult.textContent = 'Nenhum resultado encontrado';
        container.appendChild(noResult);
        container.classList.remove('hidden');
        return;
    }

    dataList.forEach(item => {
        const suggestionItem = document.createElement('div');
        suggestionItem.className = 'p-3 hover:bg-gray-100 cursor-pointer';
        suggestionItem.textContent = item.nome;
        suggestionItem.addEventListener('click', () => {
            onSelectCallback(item);
            container.classList.add('hidden');
        });
        container.appendChild(suggestionItem);
    });
    container.classList.remove('hidden');
}

function resetForm() {
    hideResults();
    clearError();
    vehicleTypeSelect.value = '';
    brandContainer.classList.add('hidden');
    modelContainer.classList.add('hidden');
    yearContainer.classList.add('hidden');
    brandSearchInput.value = '';
    modelSearchInput.value = '';
    yearSelect.innerHTML = '<option value="">Selecione o ano</option>';
    yearSelect.disabled = true;

    allBrands = [];
    allModels = [];

    driverAgeInput.value = '';
    insuranceResultContainer.classList.add('hidden', 'visible');
    ipvaResultContainer.classList.add('hidden');
    stateSelect.value = '';

    projectionResultContainer.classList.add('hidden', 'visible');
    calculateProjectionBtn.disabled = true;
    projectionHelperText.classList.remove('hidden');

    techSheetResult.classList.add('hidden');
    techSheetResult.innerHTML = '';
    getTechSheetBtn.disabled = false;

    annualInsuranceCost = 0;
    annualIpvaCost = 0;
    selectedIpvaRate = 0;
    currentFipeData = null;

    switchTab('ia');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
resetButton.addEventListener('click', resetForm);

// Event Listeners FIPE com busca e sugestões
vehicleTypeSelect.addEventListener('change', async () => {
    hideResults();
    modelContainer.classList.add('hidden');
    yearContainer.classList.add('hidden');
    allBrands = [];
    allModels = [];
    brandSearchInput.value = '';
    modelSearchInput.value = '';

    if (vehicleTypeSelect.value) {
        const brands = await fetchData(`${API_BASE_URL}/${vehicleTypeSelect.value}/marcas`);
        if (brands) {
            allBrands = brands;
            brandContainer.classList.remove('hidden');
            brandSearchInput.focus();
        }
    } else {
        brandContainer.classList.add('hidden');
    }
});

brandSearchInput.addEventListener('input', () => {
    const searchTerm = brandSearchInput.value.toLowerCase();
    const filteredBrands = allBrands.filter(brand => brand.nome.toLowerCase().includes(searchTerm));
    populateSuggestions(brandSuggestions, filteredBrands, async (selectedBrand) => {
        brandSearchInput.value = selectedBrand.nome;
        brandCodeInput.value = selectedBrand.codigo;
        modelContainer.classList.remove('hidden');
        yearContainer.classList.add('hidden');
        modelSearchInput.value = '';
        allModels = [];
        const data = await fetchData(`${API_BASE_URL}/${vehicleTypeSelect.value}/marcas/${selectedBrand.codigo}/modelos`);
        if (data && data.modelos) {
            allModels = data.modelos;
            modelSearchInput.focus();
        }
    });
});

modelSearchInput.addEventListener('input', () => {
    const searchTerm = modelSearchInput.value.toLowerCase();
    const filteredModels = allModels.filter(model => model.nome.toLowerCase().includes(searchTerm));
    populateSuggestions(modelSuggestions, filteredModels, async (selectedModel) => {
        modelSearchInput.value = selectedModel.nome;
        modelCodeInput.value = selectedModel.codigo;
        yearContainer.classList.remove('hidden');
        yearSelect.innerHTML = '<option value="">Carregando anos...</option>';
        const years = await fetchData(`${API_BASE_URL}/${vehicleTypeSelect.value}/marcas/${brandCodeInput.value}/modelos/${selectedModel.codigo}/anos`);
        if (years) {
            yearSelect.innerHTML = '<option value="">Selecione o ano</option>';
            years.forEach(year => {
                const option = document.createElement('option');
                option.value = year.codigo;
                option.textContent = year.nome;
                yearSelect.appendChild(option);
            });
            yearSelect.disabled = false;
        }
    });
});

yearSelect.addEventListener('change', async () => {
    hideResults();
    if (yearSelect.value) {
        const data = await fetchData(`${API_BASE_URL}/${vehicleTypeSelect.value}/marcas/${brandCodeInput.value}/modelos/${modelCodeInput.value}/anos/${yearSelect.value}`);
        if (data) displayResult(data);
    }
});

document.addEventListener('click', (event) => {
    if (!brandContainer.contains(event.target)) brandSuggestions.classList.add('hidden');
    if (!modelContainer.contains(event.target)) modelSuggestions.classList.add('hidden');
});

function displayResult(data) {
    currentFipeData = data;
    document.getElementById('result-title').textContent = `${data.Marca} ${data.Modelo}`;
    document.getElementById('result-price').textContent = data.Valor;
    currentFipeValue = parseCurrency(data.Valor);
    calculateAuctionValues(currentFipeValue);
    resetFormPartials();
    resultsContainer.classList.remove('hidden');
    switchTab('ia');
}

function resetFormPartials() {
    stateSelect.value = '';
    ipvaResultContainer.classList.add('hidden');
    driverAgeInput.value = '';
    insuranceResultContainer.classList.add('hidden');
    projectionResultContainer.classList.add('hidden');
    calculateProjectionBtn.disabled = true;
    projectionHelperText.classList.remove('hidden');
    techSheetResult.classList.add('hidden');
    techSheetResult.innerHTML = '';
    getTechSheetBtn.disabled = false;
    annualInsuranceCost = 0;
    annualIpvaCost = 0;
}

function calculateAuctionValues(fipeValue) {
    const maxBid = fipeValue * 0.45;
    const fee = maxBid * 0.05;
    const totalCost = maxBid + fee;
    document.getElementById('auction-price').textContent = formatCurrency(maxBid);
    document.getElementById('auctioneer-fee').textContent = formatCurrency(fee);
    document.getElementById('total-auction-cost').textContent = formatCurrency(totalCost);
}

// Seguro
calculateInsuranceBtn.addEventListener('click', () => {
    const age = parseInt(driverAgeInput.value);
    if (!age || age <= 0) { alert("Por favor, insira uma idade válida."); return; }
    const basePremium = currentFipeValue * 0.05;
    let finalPremium = basePremium;
    const adjustments = [`<li>Prêmio Base (5% FIPE): ${formatCurrency(basePremium)}</li>`];
    const origin = vehicleOriginSelect.value;
    if (origin === 'financeira') { finalPremium += basePremium * 0.10; adjustments.push('<li>Origem (Financeira): +10%</li>'); }
    else if (origin === 'furto_roubo') { finalPremium += basePremium * 0.15; adjustments.push('<li>Origem (Furto/Roubo): +15%</li>'); }
    else if (origin === 'sinistro') { finalPremium += basePremium * 0.50; adjustments.push('<li>Origem (Sinistro): +50%</li>'); }
    if (age < 25) { finalPremium += basePremium * 0.30; adjustments.push('<li>Idade (&lt; 25 anos): +30%</li>'); }
    else if (age > 45) { finalPremium -= basePremium * 0.10; adjustments.push('<li>Idade (&gt; 45 anos): -10%</li>'); }
    if (locationSelect.value === 'capital') { finalPremium += basePremium * 0.15; adjustments.push('<li>Local (Capital): +15%</li>'); }
    annualInsuranceCost = finalPremium;
    insuranceAnnual.textContent = formatCurrency(finalPremium);
    insuranceMonthly.textContent = formatCurrency(finalPremium / 12);
    insuranceAdjustments.innerHTML = adjustments.join('');
    insuranceResultContainer.classList.remove('hidden', 'visible');
    setTimeout(() => insuranceResultContainer.classList.add('visible'), 10);
    checkProjectionButtonState();
});
vehicleOriginSelect.addEventListener('change', () => { insuranceWarning.classList.toggle('hidden', vehicleOriginSelect.value !== 'sinistro'); });

// IPVA
function populateStates() { for (const state in ipvaRates) { const option = document.createElement('option'); option.value = state; option.textContent = state; stateSelect.appendChild(option); } }
stateSelect.addEventListener('change', () => {
    const selectedState = stateSelect.value;
    if (selectedState && currentFipeValue > 0) {
        const rate = ipvaRates[selectedState];
        const ipvaValue = currentFipeValue * (rate / 100);
        annualIpvaCost = ipvaValue;
        selectedIpvaRate = rate;
        ipvaResult.textContent = formatCurrency(ipvaValue);
        ipvaRateInfo.textContent = `Cálculo baseado na alíquota de ${rate}% para ${selectedState}.`;
        ipvaResultContainer.classList.remove('hidden');
        checkProjectionButtonState();
    } else {
        ipvaResultContainer.classList.add('hidden');
        annualIpvaCost = 0;
        checkProjectionButtonState();
    }
});

// Projeção
function checkProjectionButtonState() {
    if (annualInsuranceCost > 0 && annualIpvaCost > 0) {
        calculateProjectionBtn.disabled = false;
        projectionHelperText.classList.add('hidden');
    } else {
        calculateProjectionBtn.disabled = true;
        projectionHelperText.classList.remove('hidden');
    }
}
calculateProjectionBtn.addEventListener('click', () => {
    let vehicleValue = currentFipeValue;
    const insuranceRate = annualInsuranceCost / currentFipeValue;
    const ipvaRatePercent = selectedIpvaRate / 100;
    let totalCost = 0;
    projectionTableBody.innerHTML = '';
    for (let i = 1; i <= 4; i++) {
        const depreciationValue = vehicleValue * 0.10;
        const insuranceValue = vehicleValue * insuranceRate;
        const ipvaValue = vehicleValue * ipvaRatePercent;
        const yearlyCost = depreciationValue + insuranceValue + ipvaValue;
        totalCost += yearlyCost;
        const row = `<tr class="border-b hover:bg-gray-50"><td class="px-4 py-3 font-medium">${i}</td><td class="px-4 py-3">${formatCurrency(depreciationValue)}</td><td class="px-4 py-3">${formatCurrency(insuranceValue)}</td><td class="px-4 py-3">${formatCurrency(ipvaValue)}</td><td class="px-4 py-3 font-bold">${formatCurrency(yearlyCost)}</td></tr>`;
        projectionTableBody.innerHTML += row;
        vehicleValue -= depreciationValue;
    }
    projectionTotalCost.textContent = formatCurrency(totalCost);
    projectionMonthlyCost.textContent = `(Média de ${formatCurrency(totalCost / 48)} por mês)`;
    projectionResultContainer.classList.remove('hidden');
    setTimeout(() => projectionResultContainer.classList.add('visible'), 10);
});

// Inicialização
populateStates();
