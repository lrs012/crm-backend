const nodemailer = require('nodemailer');

let leads = [];

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_EMAIL,
    pass: process.env.GMAIL_PASSWORD
  }
});

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
Dashboard: https://dashboard-deploy-l0rd4z2s8-lrs012.vercel.app
Acesso: admin / admin123
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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

      const lead = {
        id: leads.length + 1,
        nome,
        email,
        telefone,
        profissao,
        responses: respostas,
        ending_type: 'qualified',
        created_at: new Date().toISOString()
      };

      leads.push(lead);
      console.log(`✅ Lead salvo: ${nome}`);

      await enviarEmail({
        nome,
        email,
        telefone,
        profissao,
        respostas
      });

      return res.json({
        success: true,
        message: 'Lead recebido com sucesso',
        id: lead.id
      });
    }

    if (req.method === 'GET') {
      return res.json(leads);
    }

    return res.status(405).json({ error: 'Método não permitido' });

  } catch (error) {
    console.error('Erro:', error);
    return res.status(500).json({ error: error.message });
  }
};
