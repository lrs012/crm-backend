const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_EMAIL,
    pass: process.env.GMAIL_PASSWORD
  }
});

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
      const { nome, email, telefone, profissao, q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q11, q12, q13, q14, q15 } = req.body;

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
          ending_type: 'qualified'
        })
      });

      if (!insert.ok) {
        console.error('Erro ao salvar lead:', insert.status, await insert.text());
        return res.status(500).json({ error: 'Erro ao salvar lead' });
      }

      const [lead] = await insert.json();
      console.log(`✅ Lead salvo: ${nome}`);

      await enviarEmail({ nome, email, telefone, profissao, respostas });

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
