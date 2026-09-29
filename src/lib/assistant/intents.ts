import { ActiveTab } from '../../types';

export interface AssistantIntent {
  id: string;
  keywords: string[];
  title: string;
  response: string;
  steps?: string[];
  actionTab?: ActiveTab;
  actionLabel?: string;
}

export const ASSISTANT_INTENTS: AssistantIntent[] = [
  {
    id: 'create-variable-expense',
    keywords: ['despesa', 'gasto', 'compras', 'comprar', 'pagar', 'nota', 'variável', 'gastos'],
    title: 'Cadastrar Gasto Variável',
    response: 'É muito simples! Você pode cadastrar uma despesa em Gastos Variáveis de duas formas:',
    steps: [
      'Clique em "Cadastrar despesa" no menu rápido.',
      'Ou acesse a aba "Gastos Variáveis" e clique em "Nova despesa".',
      'Se quiser, já posso abrir a tela para você! 🚀'
    ],
    actionTab: 'variable_expenses',
    actionLabel: 'Abrir Gastos Variáveis',
  },
  {
    id: 'create-entry',
    keywords: ['entrada', 'receita', 'salario', 'salário', 'ganho', 'receber', 'renda', 'deposito'],
    title: 'Cadastrar Entrada',
    response: 'Para registrar um valor recebido ou previsto no seu orçamento:',
    steps: [
      'Acesse a aba "Entradas" no aplicativo.',
      'Clique em "Nova Entrada" e informe a descrição, valor e data de recebimento.',
      'Você também pode marcar a entrada como já recebida ou pendente.'
    ],
    actionTab: 'entries',
    actionLabel: 'Abrir Entradas',
  },
  {
    id: 'create-fixed-expense',
    keywords: ['fixo', 'fixos', 'aluguel', 'luz', 'agua', 'água', 'internet', 'conta fixa', 'recorrente'],
    title: 'Cadastrar Gasto Fixo',
    response: 'Os Gastos Fixos ajudam a prever suas contas recorrentes de todo mês:',
    steps: [
      'Acesse "Gastos Fixos" no menu.',
      'Adicione contas como Aluguel, Energia ou Condomínio.',
      'O Poupagaio projeta essas despesas automaticamente a cada competência.'
    ],
    actionTab: 'fixed_expenses',
    actionLabel: 'Abrir Gastos Fixos',
  },
  {
    id: 'create-installment',
    keywords: ['parcela', 'parcelado', 'parcelas', 'cartao', 'cartão', 'fatura', 'credito', 'crédito'],
    title: 'Cadastrar Parcelamento',
    response: 'Cadastre suas compras divididas no cartão ou carne:',
    steps: [
      'Acesse "Parcelados" na navegação.',
      'Informe o valor total, número de parcelas e o cartão utilizado.',
      'O sistema distribuirá o valor exato nas faturas dos próximos meses.'
    ],
    actionTab: 'installments',
    actionLabel: 'Abrir Parcelados',
  },
  {
    id: 'view-goals',
    keywords: ['meta', 'metas', 'objetivo', 'economia', 'economizar', 'cofrinho', 'guardar'],
    title: 'Ver e Criar Metas',
    response: 'As Metas ajudam você a juntar dinheiro para seus sonhos:',
    steps: [
      'Acesse "Metas" para acompanhar o progresso de acúmulo.',
      'Defina o valor alvo e a data limite desejada.',
      'Deposite novos aportes à medida que for guardando dinheiro.'
    ],
    actionTab: 'goals',
    actionLabel: 'Ver minhas Metas',
  },
  {
    id: 'view-market',
    keywords: ['mercado', 'compras', 'supermercado', 'lista', 'itens', 'carrinho', 'feira'],
    title: 'Lista de Mercado',
    response: 'Organize suas feiras e compras de supermercado com facilidade:',
    steps: [
      'Acesse "Mercado" para criar listas por categoria.',
      'Marque os itens no carrinho enquanto faz as compras.',
      'Ao finalizar, converta a lista diretamente em um gasto do mês!'
    ],
    actionTab: 'market',
    actionLabel: 'Ir para o Mercado',
  },
  {
    id: 'view-reports',
    keywords: ['relatorio', 'relatório', 'grafico', 'gráfico', 'evolucao', 'evolução', 'visao', 'visão', 'analise', 'análise'],
    title: 'Visão Financeira e Relatórios',
    response: 'A Visão Financeira traz gráficos detalhados do seu orçamento:',
    steps: [
      'Confira a composição de gastos por categoria no gráfico donut.',
      'Acompanhe a evolução de Entradas vs Despesas nos últimos meses.',
      'Analise a taxa de sobra para entender sua saúde financeira.'
    ],
    actionTab: 'reports',
    actionLabel: 'Ver Visão Financeira',
  },
  {
    id: 'month-closing',
    keywords: ['fechamento', 'fechar', 'mes', 'mês', 'competencia', 'competência', 'consolidar'],
    title: 'Fechamento do Mês',
    response: 'O Fechamento de Mês consolida seu histórico financeiro:',
    steps: [
      'Acesse "Fechamento" ao final de cada mês.',
      'Confira o saldo final acumulado e o resumo de pendências.',
      'Encerre a competência com segurança e inicie o novo mês.'
    ],
    actionTab: 'closing',
    actionLabel: 'Abrir Fechamento',
  },
  {
    id: 'wishlist',
    keywords: ['desejo', 'desejos', 'sonho', 'comprar', 'futuro', 'planejar', 'wishlist'],
    title: 'Lista de Desejos',
    response: 'Guarde os itens e compras que você pretende fazer no futuro:',
    steps: [
      'Acesse "Lista de Desejos".',
      'Defina a prioridade de cada item (Alta, Média ou Baixa).',
      'Planeje suas aquisições sem comprometer o orçamento do mês.'
    ],
    actionTab: 'wishlist',
    actionLabel: 'Ver Lista de Desejos',
  },
  {
    id: 'profile-security',
    keywords: ['perfil', 'senha', 'usuario', 'usuário', 'conta', 'segurança', 'nome'],
    title: 'Meu Perfil e Configurações',
    response: 'Gerencie seus dados pessoais e preferências:',
    steps: [
      'Acesse "Meu Perfil" no canto superior ou pelo menu.',
      'Atualize seu nome de exibição e foto.',
      'Altere sua senha de acesso e preferências de tema.'
    ],
    actionTab: 'profile',
    actionLabel: 'Ir para Meu Perfil',
  },
  {
    id: 'space-switch',
    keywords: ['espaço', 'espaco', 'familia', 'família', 'trocar', 'mudar', 'compartilhado'],
    title: 'Alternar Espaço Financeiro',
    response: 'Você pode ter múltiplos espaços (Pessoal, Casal, Trabalho, etc.):',
    steps: [
      'No topo da tela, clique no seletor de Espaço ao lado do logo do Poupagaio.',
      'Escolha o espaço desejado para visualizar lançamentos daquele grupo.',
      'Você também pode criar um novo espaço a qualquer momento.'
    ],
  },
  {
    id: 'support-help',
    keywords: ['suporte', 'ajuda', 'contato', 'duvida', 'dúvida', 'problema', 'bug', 'email', 'e-mail'],
    title: 'Central de Suporte',
    response: 'Nossa equipe está pronta para te ajudar com qualquer dúvida:',
    steps: [
      'Acesse a aba "Suporte" no menu principal.',
      'Consulte as perguntas frequentes ou envie uma mensagem direta.',
      'E-mail oficial de contato: poupagaiofinance@gmail.com'
    ],
    actionTab: 'support',
    actionLabel: 'Falar com o Suporte',
  },
];

export function findIntentByQuery(query: string): AssistantIntent | null {
  if (!query || query.trim().length === 0) return null;
  const cleanQuery = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  let bestMatch: AssistantIntent | null = null;
  let highestScore = 0;

  for (const intent of ASSISTANT_INTENTS) {
    let score = 0;
    for (const keyword of intent.keywords) {
      const cleanKeyword = keyword.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (cleanQuery.includes(cleanKeyword)) {
        score += 1;
      }
    }
    if (score > highestScore) {
      highestScore = score;
      bestMatch = intent;
    }
  }

  return highestScore > 0 ? bestMatch : null;
}
