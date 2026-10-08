const nodemailer = require('nodemailer');
const { calcularTier } = require('../lib/tier');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_EMAIL,
    pass: process.env.GMAIL_PASSWORD
  }
});

const crypto = require('crypto');

const sha256 = (valor) => crypto.createHash('sha256').update(valor).digest('hex');

function normalizarTelefone(telefone) {
  const digitos = String(telefone || '').replace(/\D/g, '');
  if (!digitos) return null;
  return digitos.startsWith('55') && digitos.length >= 12 ? digitos : `55${digitos}`;
}

async function enviarMetaCapi({ lead, nome, email, telefone, eventId, fbp, fbc, sourceUrl }, req) {
  const token = process.env.META_CAPI_TOKEN;
  if (!token) {
    console.log('⚠️ META_CAPI_TOKEN ausente: evento Meta não enviado');
    return false;
  }

  try {
    const datasetId = process.env.META_DATASET_ID || '2584671361927257';
    const versao = process.env.META_GRAPH_VERSION || 'v25.0';
    const partes = String(nome).trim().toLowerCase().split(/\s+/);
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();

    const userData = {
      em: [sha256(String(email).trim().toLowerCase())],
      fn: [sha256(partes[0])],
      ln: partes.length > 1 ? [sha256(partes[partes.length - 1])] : undefined,
      country: [sha256('br')],
      external_id: [sha256(String(lead.id))],
      client_user_agent: req.headers['user-agent'] || undefined,
      client_ip_address: ip || undefined,
      fbp: fbp || undefined,
      fbc: fbc || undefined
    };
    const ph = normalizarTelefone(telefone);
    if (ph) userData.ph = [sha256(ph)];

    const payload = {
      access_token: token,
      data: [{
        event_name: 'Lead',
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId || crypto.randomUUID(),
        action_source: 'website',
        event_source_url: /^https?:\/\//.test(sourceUrl || '') ? sourceUrl : undefined,
        user_data: userData
      }]
    };
    if (process.env.META_TEST_EVENT_CODE) {
      payload.test_event_code = process.env.META_TEST_EVENT_CODE;
    }

    const resposta = await fetch(`https://graph.facebook.com/${versao}/${datasetId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000)
    });
    const corpo = await resposta.json().catch(() => ({}));

    if (!resposta.ok) {
      console.error('❌ Meta CAPI erro:', resposta.status, JSON.stringify(corpo.error || corpo));
      return false;
    }
    console.log('✅ Meta CAPI: eventos recebidos =', corpo.events_received);
    return true;
  } catch (error) {
    console.error('❌ Meta CAPI falhou:', error.message);
    return false;
  }
}

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

async function enviarEmail(dados) {
  try {
    const mensagem = `
🎯 NOVO LEAD QUALIFICADO - GRUPO RZ

📌 INFORMAÇÕES PESSOAIS
Nome: ${dados.nome}
Email: ${dados.email}
Telefone: ${dados.telefone}
Profissão: ${dados.profissao}

📋 RESPOSTAS DO QUIZ:
${dados.respostas}

---
Dashboard: https://dashboard-deploy-zeta-drab.vercel.app
    `.trim();

    await transporter.sendMail({
      from: process.env.GMAIL_EMAIL,
      to: process.env.GMAIL_EMAIL,
      subject: `🎯 Novo Lead Qualificado - ${dados.nome}`,
      text: mensagem
    });

    console.log('✅ Email enviado com sucesso');
    return true;
  } catch (error) {
    console.error('❌ Erro ao enviar email:', error.message);
    return false;
  }
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
      const { nome, email, telefone, profissao, q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q11, q12, q13, q14, q15, respostas_idx, event_id, fbp, fbc, event_source_url } = req.body;

      if (!nome || !email || !telefone) {
        return res.status(400).json({ error: 'Nome, email e telefone são obrigatórios' });
      }

      const respostas = `
1. ${q1 || '-'}
2. ${q2 || '-'}
3. ${q3 || '-'}
4. ${q4 || '-'}
5. ${q5 || '-'}
6. ${q6 || '-'}
7. ${q7 || '-'}
8. ${q8 || '-'}
9. ${q9 || '-'}
10. ${q10 || '-'}
11. ${q11 || '-'}
12. ${q12 || '-'}
13. ${q13 || '-'}
14. ${q14 || '-'}
15. ${q15 || '-'}
      `.trim();

      const insert = await supabase('leads', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          nome,
          email,
          telefone,
          profissao,
          responses: respostas,
          ending_type: 'qualified',
          tier: Array.isArray(respostas_idx) ? calcularTier('qualified', respostas_idx) : null
        })
      });

      if (!insert.ok) {
        console.error('Erro ao salvar lead:', insert.status, await insert.text());
        return res.status(500).json({ error: 'Erro ao salvar lead' });
      }

      const [lead] = await insert.json();
      console.log(`✅ Lead salvo: ${nome}`);

      await Promise.allSettled([
        enviarEmail({ nome, email, telefone, profissao, respostas }),
        enviarMetaCapi({
          lead,
          nome,
          email,
          telefone,
          eventId: event_id,
          fbp,
          fbc,
          sourceUrl: event_source_url
        }, req)
      ]);

      return res.json({
        success: true,
        message: 'Lead recebido com sucesso',
        id: lead.id
      });
    }

    if (req.method === 'GET') {
      if (
        !process.env.DASHBOARD_PASSWORD ||
        req.headers['x-dashboard-password'] !== process.env.DASHBOARD_PASSWORD
      ) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const list = await supabase('leads?select=*&order=created_at.desc');
      if (!list.ok) {
        console.error('Erro ao listar leads:', list.status, await list.text());
        return res.status(500).json({ error: 'Erro ao buscar leads' });
      }
      return res.json(await list.json());
    }

    return res.status(405).json({ error: 'Método não permitido' });
  } catch (error) {
    console.error('Erro:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};
