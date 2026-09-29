# CRM Backend - Node.js + Express + Twilio

Backend MVP para receber leads do quiz, salvar no banco de dados e enviar notificações no WhatsApp.

## Setup Local

```bash
npm install
npm start
```

Servidor rodará em `http://localhost:3000`

## Deploy no Railway

### Opção 1: Via Web (Mais Fácil)

1. Acesse: https://railway.app
2. Clique em **New Project** → **Deploy from GitHub**
3. Conecte sua conta GitHub
4. Selecione este repositório
5. Configure as variáveis de ambiente:

```
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+1234567890
YOUR_WHATSAPP=whatsapp:+5500000000000
GOOGLE_SHEET_ID=your_google_sheet_id
NODE_ENV=production
```

6. Clique em **Deploy**

Railway gera uma URL automaticamente (ex: `https://seu-projeto-production.railway.app`)

### Opção 2: Via CLI

```bash
railway login
railway init
railway up
```

## Endpoints

- `GET /` - Health check
- `GET /api/health` - Health check
- `POST /api/leads` - Receber novo lead
- `GET /api/leads` - Listar todos os leads

## Depois do Deploy

1. **Atualizar URL no Quiz:**
   - Altere `BACKEND_URL` no quiz para a URL do Railway
   - Redeploy o quiz no Vercel

2. **Testar:**
   - Faça o quiz completo
   - Verifique se o lead aparece em `/api/leads`
   - Confirme se recebeu WhatsApp

## Tecnologias

- Node.js + Express
- SQLite (banco de dados)
- Twilio (WhatsApp)
- CORS habilitado

## Próximas Etapas

- [ ] Adicionar integração com Google Sheets
- [ ] Criar Dashboard de leads
- [ ] Adicionar autenticação
- [ ] Criar painel de administração
