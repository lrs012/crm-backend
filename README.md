# CRM Backend - Vercel Functions

Recebe leads do quiz (`POST /api/leads`), guarda em memória e envia email de notificação via Nodemailer/Gmail. `GET /api/leads` lista os leads.

Variáveis de ambiente (configurar no painel da Vercel, nunca no código):

- `GMAIL_EMAIL`
- `GMAIL_PASSWORD` (senha de app do Gmail)
