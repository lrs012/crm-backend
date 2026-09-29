require('dotenv').config();
const express = require('express');
const cors = require('cors');
const twilio = require('twilio');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Database setup
const db = new sqlite3.Database(':memory:', (err) => {
  if (err) console.error(err.message);
  else console.log('✅ SQLite database connected');
});

// Create leads table
db.run(`
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT NOT NULL,
    telefone TEXT NOT NULL,
    profissao TEXT NOT NULL,
    responses TEXT NOT NULL,
    ending_type TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Twilio setup
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Função para enviar WhatsApp
async function enviarWhatsApp(dados) {
  try {
    const mensagem = `🎯 NOVO LEAD QUALIFICADO

Nome: ${dados.nome}
Email: ${dados.email}
Telefone: ${dados.telefone}
Profissão: ${dados.profissao}

📋 RESPOSTAS:
${dados.respostas}

---
Dashboard: https://seu-crm.com
`;

    await twilioClient.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to: process.env.YOUR_WHATSAPP,
      body: mensagem,
    });

    console.log('✅ WhatsApp enviado com sucesso');
    return true;
  } catch (error) {
    console.error('❌ Erro ao enviar WhatsApp:', error.message);
    return false;
  }
}

// Endpoint para receber dados do quiz
app.post('/api/leads', async (req, res) => {
  try {
    const { nome, email, telefone, profissao, q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q11, q12, q13, q14, q15 } = req.body;

    // Validação básica
    if (!nome || !email || !telefone) {
      return res.status(400).json({ error: 'Nome, email e telefone são obrigatórios' });
    }

    // Formatar respostas
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

    // Salvar no banco de dados
    db.run(
      `INSERT INTO leads (nome, email, telefone, profissao, responses, ending_type) VALUES (?, ?, ?, ?, ?, ?)`,
      [nome, email, telefone, profissao, respostas, 'qualified'],
      async function (err) {
        if (err) {
          console.error('Erro ao salvar lead:', err.message);
          return res.status(500).json({ error: 'Erro ao salvar lead' });
        }

        console.log(`✅ Lead salvo: ${nome}`);

        // Enviar WhatsApp
        await enviarWhatsApp({
          nome,
          email,
          telefone,
          profissao,
          respostas
        });

        // Retornar sucesso
        res.json({
          success: true,
          message: 'Lead recebido com sucesso',
          id: this.lastID
        });
      }
    );
  } catch (error) {
    console.error('Erro no servidor:', error.message);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Endpoint para listar todos os leads
app.get('/api/leads', (req, res) => {
  db.all('SELECT * FROM leads ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao buscar leads' });
    }
    res.json(rows);
  });
});

// Raiz
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'CRM Backend rodando!' });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'CRM Backend rodando!' });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log(`📊 API disponível em http://localhost:${PORT}/api`);
});
