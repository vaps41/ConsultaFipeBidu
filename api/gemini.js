// api/gemini.js - Função Segura para Vercel

export default async function handler(request, response) {
  // Garante que o método da requisição seja POST
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }
  
  // Pega o prompt e o schema enviados pelo front-end
  const { prompt, schema } = request.body;
  
  // Pega a chave secreta das Variáveis de Ambiente da Vercel
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
      return response.status(500).json({ error: 'Chave de API do Gemini não configurada no servidor.' });
  }

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
  };

  if (schema) {
    payload.generationConfig = {
      responseMimeType: "application/json",
      responseSchema: schema,
    };
  }

  try {
    const geminiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await geminiResponse.json();

    if (!geminiResponse.ok) {
        console.error("Erro da API Gemini:", data);
        return response.status(geminiResponse.status).json({ error: data.error?.message || 'Erro ao comunicar com a API do Gemini.' });
    }
    
    // Envia a resposta de volta para o site
    response.status(200).json(data);

  } catch (error) {
    console.error("Erro na função do servidor:", error);
    response.status(500).json({ error: error.message });
  }
}

