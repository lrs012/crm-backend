const CAPITAL_MINIMO_IDX = 1; // "de R$20mil a R$50mil" ou mais (Q8 / Q11)
const CAPITAL_OURO_IDX = 2; // "de R$50mil a R$150mil" ou mais
const CONHECIMENTO_MINIMO_IDX = 1; // "Já estudei bastante" ou mais (Q9)
const ULTIMA_OPCAO_COM_EXPERIENCIA_IDX = 3; // Q3: opções 0 a 3 = já investiu em leilão

const inteiro = (v) => Number.isInteger(v);

function calcularTier(endingType, idx) {
  if (endingType !== 'qualified') return 'desqualificado';

  const r = Array.isArray(idx) ? idx : [];
  const capitalIdx = inteiro(r[7]) ? r[7] : r[10];

  const capital = inteiro(capitalIdx) && capitalIdx >= CAPITAL_MINIMO_IDX;
  const capitalOuro = inteiro(capitalIdx) && capitalIdx >= CAPITAL_OURO_IDX;
  const experiencia = inteiro(r[2]) && r[2] >= 0 && r[2] <= ULTIMA_OPCAO_COM_EXPERIENCIA_IDX;
  const conhecimento = inteiro(r[8]) && r[8] >= CONHECIMENTO_MINIMO_IDX;
  const preparado = conhecimento || experiencia;

  if (capitalOuro && preparado) return 'padrao_ouro';
  if (capital && preparado) return 'imediato';
  if (!capital && experiencia) return 'futuro';
  if (capital) return 'capitalizado';
  return 'desqualificado';
}

module.exports = { calcularTier };
