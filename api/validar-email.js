// Esta é a versão final e funcional do seu back-end com um email de teste

export default async function handler(request, response) {
    // 1. Apenas aceita requisições POST
    if (request.method !== 'POST') {
        return response.status(405).json({ message: 'Método não permitido' });
    }

    try {
        const { email } = request.body;

        // --- NOVO: ACESSO DE TESTE ---
        // Se o email inserido for este, o acesso é liberado sem verificar a Hotmart.
        const TEST_EMAIL = 'teste@bidu.com';
        const Bidu_EMAIL = 'biduleilao@bidu.com.br';

        if (email === TEST_EMAIL || email === Bidu_EMAIL) {
            console.log('Acesso de teste concedido para:', email);
            return response.status(200).json({ message: 'Acesso liberado' });
        }
        // --- FIM DO ACESSO DE TESTE ---


        if (!email) {
            return response.status(400).json({ message: 'E-mail é obrigatório' });
        }

        // --- AUTENTICAÇÃO COM A HOTMART ---
        const authUrl = process.env.HOTMART_AUTH_URL;
        const basicToken = process.env.HOTMART_BASIC_TOKEN;
        const clientId = process.env.HOTMART_CLIENT_ID;
        const clientSecret = process.env.HOTMART_CLIENT_SECRET;
        const productId = process.env.HOTMART_PRODUCT_ID;

        // Verifica se todas as chaves secretas estão configuradas
        if (!authUrl || !basicToken || !clientId || !clientSecret || !productId) {
             console.error('ERRO: Variáveis de ambiente da Hotmart não configuradas na Vercel.');
             return response.status(500).json({ message: 'Erro de configuração do servidor.' });
        }

        const authResponse = await fetch(authUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${basicToken}`
            },
            body: JSON.stringify({
                grant_type: 'client_credentials',
                client_id: clientId,
                client_secret: clientSecret
            })
        });

        if (!authResponse.ok) {
            const errorBody = await authResponse.text();
            console.error('Erro de autenticação com a Hotmart:', errorBody);
            return response.status(500).json({ message: `Erro de autenticação com a Hotmart: ${errorBody}` });
        }

        const { access_token } = await authResponse.json();

        // --- VERIFICAÇÃO DA COMPRA ---
        const historyUrl = `https://api-hot-v1.hotmart.com/sales/history?buyer_email=${email}&product_id=${productId}&transaction_status=APPROVED,COMPLETE`;
        
        const historyResponse = await fetch(historyUrl, {
            headers: {
                'Authorization': `Bearer ${access_token}`
            }
        });

        if (!historyResponse.ok) {
             const errorBody = await historyResponse.text();
             console.error('Erro ao consultar histórico de compras:', errorBody);
            return response.status(500).json({ message: `Erro ao consultar histórico de compras: ${errorBody}` });
        }
        
        const historyData = await historyResponse.json();

        // Se a lista 'items' tiver pelo menos 1 resultado, o comprador é válido
        if (historyData.items && historyData.items.length > 0) {
            return response.status(200).json({ message: 'Acesso liberado' });
        } else {
            return response.status(403).json({ message: 'Acesso negado' });
        }

    } catch (error) {
        console.error('Erro inesperado na API:', error);
        return response.status(500).json({ message: 'Erro inesperado no servidor.' });
    }
}