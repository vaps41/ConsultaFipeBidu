// api/validar-email.js
// Integração Hotmart + Vercel (PRODUÇÃO) - Funcionando

const HOTMART_AUTH_URL = 'https://api-sec-vlc.hotmart.com/security/oauth/token';
const HOTMART_SALES_URL = 'https://developers.hotmart.com/payments/api/v1/sales/history';

export default async function handler(request, response) {
    // --- CORS ---
    response.setHeader('Access-Control-Allow-Credentials', true);
    response.setHeader('Access-Control-Allow-Origin', '*'); // Alterar para domínio real em produção
    response.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (request.method === 'OPTIONS') return response.status(204).end();

    if (request.method !== 'POST') {
        return response.status(405).json({ message: 'Método não permitido' });
    }

    try {
        const { email } = request.body;
        if (!email) return response.status(400).json({ message: 'E-mail é obrigatório' });

        const { HOTMART_CLIENT_ID, HOTMART_CLIENT_SECRET, HOTMART_PRODUCT_ID } = process.env;
        if (!HOTMART_CLIENT_ID || !HOTMART_CLIENT_SECRET || !HOTMART_PRODUCT_ID) {
            console.error("❌ Variáveis de ambiente não configuradas corretamente.");
            return response.status(500).json({ message: 'Erro de configuração do servidor.' });
        }

        const token = await getHotmartToken(HOTMART_CLIENT_ID, HOTMART_CLIENT_SECRET);
        if (!token) return response.status(500).json({ message: 'Falha ao autenticar com Hotmart.' });

        const hasAccess = await checkUserPurchase(token, email, HOTMART_PRODUCT_ID);
        if (hasAccess) {
            console.log(`✅ Acesso concedido a ${email}`);
            return response.status(200).json({ message: 'Acesso liberado' });
        } else {
            console.log(`🚫 Acesso negado a ${email}`);
            return response.status(403).json({ message: 'Nenhuma compra ativa encontrada para este e-mail.' });
        }

    } catch (error) {
        console.error('🔥 Erro inesperado:', error.message, error.stack);
        return response.status(500).json({ message: 'Erro inesperado no servidor.' });
    }
}

async function getHotmartToken(clientId, clientSecret) {
    try {
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
            console.error('Erro ao obter token:', res.status, text);
            return null;
        }

        const data = await res.json();
        return data.access_token;
    } catch (err) {
        console.error('Erro ao solicitar token:', err.message);
        return null;
    }
}

async function checkUserPurchase(token, userEmail, productId) {
    try {
        const validStatus = ['approved', 'completed', 'active'];
        const invalidStatus = ['canceled', 'refunded', 'chargeback', 'blocked', 'expired', 'pending', 'refused'];

        const queries = [
            { url: `${HOTMART_SALES_URL}?email=${encodeURIComponent(userEmail)}&product=${encodeURIComponent(productId)}` },
            { url: `${HOTMART_SALES_URL}?buyer_email=${encodeURIComponent(userEmail)}&product_id=${encodeURIComponent(productId)}` }
        ];

        let data = null;
        for (const q of queries) {
            try {
                const res = await fetch(q.url, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
                });
                if (!res.ok) continue;
                data = await res.json();
                if (Array.isArray(data.items) && data.items.length > 0) break;
            } catch { continue; }
        }

        if (!data || !Array.isArray(data.items) || data.items.length === 0) return false;

        const extractStatus = (item) => item?.purchase?.transaction_status || item?.purchase?.status || item?.transaction?.status || item?.status || null;
        const itemsWithStatus = data.items.map(i => ({ ...i, _status: extractStatus(i) })).filter(i => i._status);

        if (itemsWithStatus.length === 0) return false;

        itemsWithStatus.sort((a, b) => {
            const getTime = (item) => {
                const pd = item.purchase?.purchase_date || item.purchase?.approved_date || item.purchase?.order_date;
                return pd ? (typeof pd === 'number' ? pd * 1000 : new Date(pd).getTime()) : 0;
            };
            return getTime(b) - getTime(a);
        });

        const latest = itemsWithStatus[0];
        const latestStatus = latest._status.toLowerCase();

        if (!validStatus.includes(latestStatus)) return false;
        if (itemsWithStatus.some(item => invalidStatus.includes(item._status.toLowerCase()))) return false;

        return true;

    } catch (err) {
        console.error('Erro em checkUserPurchase:', err.message);
        return false;
    }
}
