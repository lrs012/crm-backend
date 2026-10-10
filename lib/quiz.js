const OPCOES = require('./opcoes.json');

const TOTAL = OPCOES.length; // perguntas de múltipla escolha (Q1 a Q15)

// Reproduz getNextQuestion() do quiz.html. Devolve o índice da próxima pergunta
// ou o nome de um final antecipado.
function proxima(atual, r) {
  if (atual === 0 && r[0] === 0) return 'young';
  if (atual === 1 && (r[1] === 0 || r[1] === 1 || r[1] === 2)) return 8;
  if (atual === 2 && (r[2] === 4 || r[2] === 5)) return 8;
  if (atual === 5 && r[5] === 6) return 7;
  if (atual === 7) return 15;
  if (atual === 10 && r[10] === 0) return 'notQualified';
  if (atual === 12 && r[12] === 0) return 13;
  if (atual === 12) return 14;
  if (atual === 13 && r[13] === 0) return 'highExpectation';
  if (atual === 14 && r[14] === 0) return 'highExpectation';
  return atual + 1;
}

// idx: array de 15 posições (índice da opção escolhida ou null).
// Retorna { valido, ending } onde ending ∈ qualified | young | highExpectation | notQualified.
function simularCaminho(idx) {
  if (!Array.isArray(idx) || idx.length !== TOTAL) return { valido: false };

  const visitadas = new Set();
  let atual = 0;

  while (true) {
    const resposta = idx[atual];
    if (!Number.isInteger(resposta) || resposta < 0 || resposta >= OPCOES[atual].length) {
      return { valido: false };
    }
    visitadas.add(atual);

    const prox = proxima(atual, idx);
    let ending = null;

    if (typeof prox === 'string') ending = prox;
    else if (prox >= TOTAL) ending = 'qualified';

    if (ending) {
      const sobras = idx.some((v, i) => !visitadas.has(i) && v !== null);
      return sobras ? { valido: false } : { valido: true, ending };
    }

    if (visitadas.has(prox)) return { valido: false };
    atual = prox;
  }
}

function textosDasRespostas(idx) {
  return idx.map((v, i) => (Number.isInteger(v) ? OPCOES[i][v] : ''));
}

module.exports = { simularCaminho, textosDasRespostas, OPCOES };
