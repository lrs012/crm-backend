const nodemailer = require('nodemailer');
const { calcularTier } = require('../lib/tier');
const { simularCaminho, textosDasRespostas } = require('../lib/quiz');
const { validarContato, sinaisMeta } = require('../lib/validacao');
const { supabase, senhaDashboardValida, hashDoIp, excedeLimite, leadRepetido } = require('../lib/seguranca');

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

const LIMITE_LEADS_POR_HORA = Number(process.env.LIMITE_LEADS_HORA) || 10;

function recusar(res, status, motivo) {
  console.warn(`⛔ Lead recusado: ${motivo}`);
  return res.status(status).json({ error: 'Dados inválidos' });
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
      const body = req.body && typeof req.body === 'object' ? req.body : {};

      const caminho = simularCaminho(body.respostas_idx);
      if (!caminho.valido) return recusar(res, 400, 'respostas fora de um caminho possível');
      if (caminho.ending !== 'qualified') return recusar(res, 400, 'caminho não termina em qualificado');

      const contato = validarContato(body);
      if (!contato.ok) return recusar(res, 400, `campo inválido: ${contato.motivo}`);
      const { nome, email, telefone, profissao } = contato.dados;

      const ipHash = hashDoIp(req);
      if (await excedeLimite('leads', ipHash, LIMITE_LEADS_POR_HORA, 60)) {
        console.warn('⛔ Lead recusado: limite de envios por hora');
        return res.status(429).json({ error: 'Muitas tentativas. Tente novamente mais tarde.' });
      }

      if (await leadRepetido(email, telefone)) {
        console.log('↩️ Lead repetido nas últimas 24h: ignorado');
        return res.json({ success: true, duplicate: true });
      }

      const respostas = textosDasRespostas(body.respostas_idx)
        .map((texto, i) => `${i + 1}. ${texto || '-'}`)
        .join('\n');

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
          tier: calcularTier('qualified', body.respostas_idx),
          ip_hash: ipHash
        })
      });

      if (!insert.ok) {
        console.error('Erro ao salvar lead:', insert.status, await insert.text());
        return res.status(500).json({ error: 'Erro ao salvar lead' });
      }

      const [lead] = await insert.json();
      console.log(`✅ Lead salvo: ${nome}`);

      const sinais = sinaisMeta(body);
      await Promise.allSettled([
        enviarEmail({ nome, email, telefone, profissao, respostas }),
        enviarMetaCapi({
          lead,
          nome,
          email,
          telefone,
          eventId: sinais.eventId,
          fbp: sinais.fbp,
          fbc: sinais.fbc,
          sourceUrl: sinais.sourceUrl
        }, req)
      ]);

      return res.json({
        success: true,
        message: 'Lead recebido com sucesso',
        id: lead.id
      });
    }

    if (req.method === 'GET') {
      if (!senhaDashboardValida(req)) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const list = await supabase('leads?select=*&order=created_at.desc');
      if (!list.ok) {
        console.error('Erro ao listar leads:', list.status, await list.text());
        return res.status(500).json({ error: 'Erro ao buscar leads' });
      }
      const leads = await list.json();
      return res.json(leads.map(({ ip_hash, ...resto }) => resto));
    }

    return res.status(405).json({ error: 'Método não permitido' });
  } catch (error) {
    console.error('Erro:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};
