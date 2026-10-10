const { calcularTier } = require('../lib/tier');
const { simularCaminho } = require('../lib/quiz');
const { supabase, senhaDashboardValida, hashDoIp, excedeLimite } = require('../lib/seguranca');

const LIMITE_RESPOSTAS_POR_HORA = Number(process.env.LIMITE_RESPOSTAS_HORA) || 60;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-dashboard-password');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'POST') {
      const { ending_type, respostas_idx } = req.body && typeof req.body === 'object' ? req.body : {};

      const caminho = simularCaminho(respostas_idx);
      if (!caminho.valido || caminho.ending !== ending_type) {
        console.warn('⛔ Resposta recusada: caminho inconsistente');
        return res.status(400).json({ error: 'Dados inválidos' });
      }

      const ipHash = hashDoIp(req);
      if (await excedeLimite('quiz_responses', ipHash, LIMITE_RESPOSTAS_POR_HORA, 60)) {
        console.warn('⛔ Resposta recusada: limite de envios por hora');
        return res.status(429).json({ error: 'Muitas tentativas. Tente novamente mais tarde.' });
      }

      const insert = await supabase('quiz_responses', {
        method: 'POST',
        body: JSON.stringify({
          ending_type,
          tier: calcularTier(ending_type, respostas_idx),
          answers: respostas_idx,
          ip_hash: ipHash
        })
      });

      if (!insert.ok) {
        console.error('Erro ao salvar resposta:', insert.status, await insert.text());
        return res.status(500).json({ error: 'Erro ao salvar resposta' });
      }

      return res.json({ success: true });
    }

    if (req.method === 'GET') {
      if (!senhaDashboardValida(req)) {
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
