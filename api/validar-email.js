// api/validar-email.js
// Integração Hotmart + Vercel (PRODUÇÃO) - Versão DEBUG & Híbrida Corrigida

const HOTMART_AUTH_URL = 'https://api-sec-vlc.hotmart.com/security/oauth/token';
const HOTMART_SALES_URL = 'https://developers.hotmart.com/payments/api/v1/sales/history';

export default async function handler(request, response) {
    // --- CORS ---
    response.setHeader('Access-Control-Allow-Credentials', true);
    response.setHeader('Access-Control-Allow-Origin', '*'); 
    response.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (request.method === 'OPTIONS') return response.status(204).end();

    if (request.method !== 'POST') {
        return response.status(405).json({ message: 'Método não permitido' });
    }

    try {
        console.log('--- INICIANDO VALIDAÇÃO ---');
        const { email } = request.body;
        console.log(`📧 Verificando email: ${email}`);

        if (!email) return response.status(400).json({ message: 'E-mail é obrigatório' });

        const { HOTMART_CLIENT_ID, HOTMART_CLIENT_SECRET, HOTMART_PRODUCT_ID, HOTMART_PRODUCT_ID_2 } = process.env;
        
        // Log seguro das variáveis
        console.log('🔧 Configuração:', {
            hasClientId: !!HOTMART_CLIENT_ID,
            hasClientSecret: !!HOTMART_CLIENT_SECRET,
            productId1: HOTMART_PRODUCT_ID,
            productId2: HOTMART_PRODUCT_ID_2 || 'Não definido'
        });

        if (!HOTMART_CLIENT_ID || !HOTMART_CLIENT_SECRET || !HOTMART_PRODUCT_ID) {
            console.error("❌ ERRO CRÍTICO: Variáveis de ambiente faltando.");
            return response.status(500).json({ message: 'Erro de configuração do servidor.' });
        }

        const token = await getHotmartToken(HOTMART_CLIENT_ID, HOTMART_CLIENT_SECRET);
        if (!token) {
            console.error("❌ Falha ao obter Token. Verifique Client ID e Secret.");
            return response.status(500).json({ message: 'Falha na autenticação com Hotmart.' });
        }

        // --- Verificação Produto 1 ---
        console.log(`🔎 Buscando Produto 1 (ID: ${HOTMART_PRODUCT_ID})...`);
        let result1 = await checkUserPurchase(token, email, HOTMART_PRODUCT_ID);
        
        if (result1.hasAccess) {
            console.log(`✅ SUCESSO NO PRODUTO 1. Status: ${result1.status}`);
            return response.status(200).json({ message: 'Acesso liberado', debug: result1 });
        }

        // --- Verificação Produto 2 (Se existir) ---
        if (HOTMART_PRODUCT_ID_2) {
            console.log(`⚠️ Falha no Produto 1. Tentando Produto 2 (ID: ${HOTMART_PRODUCT_ID_2})...`);
            let result2 = await checkUserPurchase(token, email, HOTMART_PRODUCT_ID_2);
            
            if (result2.hasAccess) {
                console.log(`✅ SUCESSO NO PRODUTO 2. Status: ${result2.status}`);
                return response.status(200).json({ message: 'Acesso liberado', debug: result2 });
            }
        }

        console.log(`🚫 NEGADO: Nenhuma compra encontrada em nenhum produto.`);
        return response.status(403).json({ 
            message: 'Nenhuma compra ativa encontrada para este e-mail.',
            details: 'Verifique se o e-mail é exatamente o mesmo da compra.'
        });

    } catch (error) {
        console.error('🔥 ERRO FATAL NO SERVIDOR:', error);
        return response.status(500).json({ message: 'Erro interno no servidor.', error: error.message });
    }
}

// --- Funções Auxiliares ---

async function getHotmartToken(clientId, clientSecret) {
    try {
        console.log('🔑 Solicitando Token Hotmart...');
        const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
        const res = await fetch(HOTMART_AUTH_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${basicAuth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'grant_type=client_credentials'
        });

        if (!res.ok) {
            const text = await res.text();
            console.error(`❌ Erro Token: Status ${res.status} - ${text}`);
            return null;
        }

        const data = await res.json();
        console.log('✅ Token obtido com sucesso.');
        return data.access_token;
    } catch (err) {
        console.error('❌ Exceção ao pegar token:', err.message);
        return null;
    }
}

async function checkUserPurchase(token, userEmail, productId) {
    // --- CORREÇÃO DE STATUS ---
    // Adicionado 'complete' (sem d) que apareceu no seu log
    const validStatus = ['approved', 'completed', 'complete', 'active'];
    
    // Data ajustada (01/01/2025)
    const startDate = 1735689600000; 

    // --- ESTRATÉGIA DE BUSCA ---
    const strategies = [
        { name: "Recente (Padrão)", params: "" },
        { name: "Histórico (Desde 2025)", params: `&start_date=${startDate}` }
    ];

    for (const strategy of strategies) {
        console.log(`   🔄 Tentando estratégia: ${strategy.name}`);

        // --- CORREÇÃO DE URL ---
        // Removemos a query incorreta que gerava erro 400. 
        // Usamos apenas buyer_email e product_id que funcionou no seu log.
        const url = `${HOTMART_SALES_URL}?buyer_email=${encodeURIComponent(userEmail)}&product_id=${encodeURIComponent(productId)}${strategy.params}`;

        try {
            const res = await fetch(url, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
            });

            if (!res.ok) {
                const errorTxt = await res.text();
                // Ignora erro 400 se for apenas parâmetro e tenta o próximo, mas loga.
                console.log(`      ⚠️ Erro HTTP ${res.status}. Msg: ${errorTxt}`);
                continue; 
            }

            const data = await res.json();

            // Verifica se veio lista
            if (data && Array.isArray(data.items) && data.items.length > 0) {
                console.log(`      📦 Encontrados ${data.items.length} registros nesta consulta.`);
                
                // Analisa os itens encontrados
                const validItem = findValidItem(data.items, validStatus);
                
                if (validItem) {
                    return { hasAccess: true, status: validItem.statusFound };
                } else {
                    console.log(`      ⚠️ Registros encontrados, mas status inválido.`);
                }
            } else {
                console.log(`      ℹ️ Nenhum item retornado nesta consulta.`);
            }

        } catch (err) {
            console.error(`      ❌ Erro de conexão/parse: ${err.message}`);
        }
    }

    return { hasAccess: false, status: null };
}

function findValidItem(items, validStatusList) {
    // Normaliza os itens
    const itemsWithStatus = items.map(i => {
        const s = i?.purchase?.transaction_status || i?.purchase?.status || i?.transaction?.status || i?.status || 'unknown';
        return { ...i, _statusNormalized: s.toLowerCase() };
    });

    // Ordena do mais recente para o mais antigo
    itemsWithStatus.sort((a, b) => {
        const getTime = (item) => {
            const pd = item.purchase?.purchase_date || item.purchase?.approved_date || item.purchase?.order_date;
            return pd ? (typeof pd === 'number' ? pd : new Date(pd).getTime()) : 0;
        };
        return getTime(b) - getTime(a);
    });

    // Pega o status da transação mais recente
    const latest = itemsWithStatus[0];
    console.log(`      🔎 Status da transação mais recente: "${latest._statusNormalized}"`);

    if (validStatusList.includes(latest._statusNormalized)) {
        return { statusFound: latest._statusNormalized };
    }

    return null;
}
