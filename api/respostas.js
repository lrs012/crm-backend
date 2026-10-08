const { calcularTier } = require('../lib/tier');

const ENDINGS = ['qualified', 'young', 'highExpectation', 'notQualified'];

function supabase(path, options = {}) {
  const base = (process.env.SUPABASE_URL || '').replace(/\/(rest\/v1)?\/?$/, '');
  return fetch(`${base}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: process.env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
}

function respostasValidas(idx) {
  return (
    Array.isArray(idx) &&
    idx.length === 15 &&
    idx.every((v) => v === null || (Number.isInteger(v) && v >= 0 && v <= 9))
  );
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-dashboard-password');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'POST') {
      const { ending_type, respostas_idx } = req.body || {};

      if (!ENDINGS.includes(ending_type) || !respostasValidas(respostas_idx)) {
        return res.status(400).json({ error: 'Dados inválidos' });
      }

      const insert = await supabase('quiz_responses', {
        method: 'POST',
        body: JSON.stringify({
          ending_type,
          tier: calcularTier(ending_type, respostas_idx),
          answers: respostas_idx
        })
      });

      if (!insert.ok) {
        console.error('Erro ao salvar resposta:', insert.status, await insert.text());
        return res.status(500).json({ error: 'Erro ao salvar resposta' });
      }

      return res.json({ success: true });
    }

    if (req.method === 'GET') {
      if (
        !process.env.DASHBOARD_PASSWORD ||
        req.headers['x-dashboard-password'] !== process.env.DASHBOARD_PASSWORD
      ) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const list = await supabase('quiz_responses?select=id,ending_type,tier,created_at&order=created_at.desc&limit=5000');
      if (!list.ok) {
        console.error('Erro ao listar respostas:', list.status, await list.text());
        return res.status(500).json({ error: 'Erro ao buscar respostas' });
      }
      return res.json(await list.json());
    }

    return res.status(405).json({ error: 'Método não permitido' });
  } catch (error) {
    console.error('Erro:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};
