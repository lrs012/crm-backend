const crypto = require('crypto');

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

// Compara senhas em tempo constante, para não vazar informação pelo tempo de resposta
function senhaDashboardValida(req) {
  const esperada = process.env.DASHBOARD_PASSWORD;
  const recebida = req.headers['x-dashboard-password'];
  if (!esperada || typeof recebida !== 'string') return false;

  const a = crypto.createHash('sha256').update(recebida).digest();
  const b = crypto.createHash('sha256').update(esperada).digest();
  return crypto.timingSafeEqual(a, b);
}

// Guardamos só um hash do IP (nunca o IP em si)
function hashDoIp(req) {
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'desconhecido';
  return crypto.createHmac('sha256', process.env.SUPABASE_SERVICE_KEY || 'sem-chave').update(ip).digest('hex');
}

function desdeMinutos(minutos) {
  return new Date(Date.now() - minutos * 60 * 1000).toISOString();
}

async function contar(consulta) {
  const resposta = await supabase(consulta, {
    headers: { Prefer: 'count=exact', Range: '0-0', 'Range-Unit': 'items' }
  });
  if (!resposta.ok) throw new Error(`contagem falhou (${resposta.status})`);
  const total = (resposta.headers.get('content-range') || '').split('/')[1];
  return Number.parseInt(total, 10) || 0;
}

async function excedeLimite(tabela, ipHash, maximo, minutos) {
  const total = await contar(
    `${tabela}?select=id&ip_hash=eq.${ipHash}&created_at=gte.${encodeURIComponent(desdeMinutos(minutos))}`
  );
  return total >= maximo;
}

const escaparLike = (valor) => valor.replace(/[\\%_]/g, (c) => `\\${c}`);

// Mesmo email ou telefone nas últimas 24h conta como envio repetido
async function leadRepetido(email, telefone) {
  const desde = encodeURIComponent(desdeMinutos(24 * 60));
  const porEmail = await contar(
    `leads?select=id&email=ilike.${encodeURIComponent(escaparLike(email))}&created_at=gte.${desde}`
  );
  if (porEmail > 0) return true;
  const porTelefone = await contar(
    `leads?select=id&telefone=eq.${encodeURIComponent(telefone)}&created_at=gte.${desde}`
  );
  return porTelefone > 0;
}

module.exports = { supabase, senhaDashboardValida, hashDoIp, excedeLimite, leadRepetido };
