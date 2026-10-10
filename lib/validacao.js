const CONTROLE = /[\u0000-\u001F\u007F]/;

// Mesmas regras do quiz.html (isValidName, isValidPhone, isValidEmail)
function nomeValido(nome) {
  const partes = nome.trim().split(/\s+/);
  return partes.length >= 2 && partes.every((p) => p.length >= 2);
}

function emailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function telefoneValido(telefone) {
  const digitos = telefone.replace(/\D/g, '');
  return digitos.length === 10 || digitos.length === 11;
}

function textoSeguro(valor, maximo) {
  return typeof valor === 'string' && valor.length <= maximo && !CONTROLE.test(valor);
}

function validarContato({ nome, email, telefone, profissao }) {
  if (!textoSeguro(nome, 120) || !nomeValido(nome)) return { ok: false, motivo: 'nome' };
  if (!textoSeguro(email, 254) || !emailValido(email)) return { ok: false, motivo: 'email' };
  if (!textoSeguro(telefone, 30) || !telefoneValido(telefone)) return { ok: false, motivo: 'telefone' };
  if (!textoSeguro(profissao, 120) || !profissao.trim()) return { ok: false, motivo: 'profissao' };

  return {
    ok: true,
    dados: {
      nome: nome.trim(),
      email: email.trim(),
      telefone: telefone.trim(),
      profissao: profissao.trim()
    }
  };
}

const FBP = /^fb\.\d{1,2}\.\d{10,16}\.\d{1,20}$/;
const FBC = /^fb\.\d{1,2}\.\d{10,16}\.[\w-]{1,300}$/;

function sinaisMeta({ event_id, fbp, fbc, event_source_url }) {
  return {
    eventId: typeof event_id === 'string' && /^[\w-]{1,100}$/.test(event_id) ? event_id : undefined,
    fbp: typeof fbp === 'string' && FBP.test(fbp) ? fbp : undefined,
    fbc: typeof fbc === 'string' && FBC.test(fbc) ? fbc : undefined,
    sourceUrl:
      typeof event_source_url === 'string' && event_source_url.length <= 500 && /^https?:\/\//.test(event_source_url)
        ? event_source_url
        : undefined
  };
}

module.exports = { validarContato, sinaisMeta };
