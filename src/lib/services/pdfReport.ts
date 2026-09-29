import { jsPDF } from 'jspdf';
import { MonthlyClosureSummary } from '../../types';
import { formatCurrency, getMonthYearLabel } from '../formatters';

export interface ReportMonthItem {
  cycle: string;
  year: number;
  month: number;
  label: string;
  isClosed: boolean;
  summary: MonthlyClosureSummary;
}

export interface PDFReportData {
  spaceName: string;
  periodLabel: string;
  totalIncome: number;
  totalExpenses: number;
  finalBalance: number;
  fixedExpenses: number;
  variableExpenses: number;
  installments: number;
  previstoRealizado?: {
    entries: { previsto: number; realizado: number };
    fixed: { previsto: number; realizado: number };
    variable: { previsto: number; realizado: number };
    installments: { previsto: number; realizado: number };
    expenses: { previsto: number; realizado: number };
    result: { previsto: number; realizado: number };
  } | null;
  months: ReportMonthItem[];
  generatedBy?: string;
}

export function generateFinancialPDFReport(data: PDFReportData): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let currentY = margin;

  // Helper para adicionar novo cabeçalho se a página encher
  const checkNewPage = (neededHeight: number) => {
    if (currentY + neededHeight > pageHeight - 20) {
      addFooter();
      doc.addPage();
      currentY = margin;
      drawSubHeader();
    }
  };

  const drawSubHeader = () => {
    doc.setFillColor(7, 92, 69); // #075C45
    doc.rect(margin, currentY, contentWidth, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text('POUPAGAIO FINANCE — RELATÓRIO FINANCEIRO (CONTINUAÇÃO)', margin + 4, currentY + 5.5);
    currentY += 12;
  };

  const addFooter = () => {
    const pageNum = doc.getNumberOfPages();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 130, 125);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    doc.text('Poupagaio Finance • Desenvolvido por Mateus Araujo', margin, pageHeight - 8);
    doc.text(`Página ${pageNum}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  };

  // ==========================================
  // CABEÇALHO DO RELATÓRIO
  // ==========================================
  doc.setFillColor(7, 92, 69); // #075C45
  doc.roundedRect(margin, currentY, contentWidth, 24, 3, 3, 'F');

  // Título e Subtítulo
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('POUPAGAIO FINANCE', margin + 6, currentY + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(220, 245, 230);
  doc.text('RELATÓRIO FINANCEIRO EXECUTIVO', margin + 6, currentY + 15);

  doc.setFontSize(8);
  doc.setTextColor(190, 220, 205);
  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR') + ' às ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  doc.text(`Espaço: ${data.spaceName || 'Principal'}  |  Emitido em: ${dateStr}`, margin + 6, currentY + 20);

  currentY += 28;

  // ==========================================
  // PERÍODO SELECIONADO BANNER
  // ==========================================
  doc.setFillColor(242, 247, 244);
  doc.setDrawColor(210, 230, 220);
  doc.roundedRect(margin, currentY, contentWidth, 10, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(7, 92, 69);
  doc.text(`PERÍODO: ${data.periodLabel.toUpperCase()}`, margin + 4, currentY + 6.5);

  currentY += 14;

  // ==========================================
  // 1. RESUMO FINANCEIRO (3 CARDS LADO A LADO)
  // ==========================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(32, 39, 36);
  doc.text('1. RESUMO FINANCEIRO CONSOLIDADO', margin, currentY);
  currentY += 4;

  const cardWidth = (contentWidth - 6) / 3;
  const cardHeight = 18;

  // Card 1: Receitas
  doc.setFillColor(240, 253, 244); // bg-emerald-50
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(margin, currentY, cardWidth, cardHeight, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(22, 101, 52); // green-800
  doc.text('TOTAL RECEITAS', margin + 3, currentY + 5.5);
  doc.setFontSize(11);
  doc.setTextColor(21, 128, 61); // green-700
  doc.text(formatCurrency(data.totalIncome), margin + 3, currentY + 13);

  // Card 2: Despesas
  const card2X = margin + cardWidth + 3;
  doc.setFillColor(255, 241, 242); // bg-rose-50
  doc.setDrawColor(254, 205, 211);
  doc.roundedRect(card2X, currentY, cardWidth, cardHeight, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(159, 18, 57); // rose-800
  doc.text('TOTAL DESPESAS', card2X + 3, currentY + 5.5);
  doc.setFontSize(11);
  doc.setTextColor(225, 29, 72); // rose-600
  doc.text(formatCurrency(data.totalExpenses), card2X + 3, currentY + 13);

  // Card 3: Saldo
  const card3X = margin + (cardWidth + 3) * 2;
  const isPositiveBalance = data.finalBalance >= 0;
  doc.setFillColor(isPositiveBalance ? 240 : 255, isPositiveBalance ? 253 : 241, isPositiveBalance ? 244 : 242);
  doc.setDrawColor(isPositiveBalance ? 187 : 254, isPositiveBalance ? 247 : 205, isPositiveBalance ? 208 : 211);
  doc.roundedRect(card3X, currentY, cardWidth, cardHeight, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(isPositiveBalance ? 22 : 159, isPositiveBalance ? 101 : 18, isPositiveBalance ? 52 : 57);
  doc.text('SALDO LÍQUIDO', card3X + 3, currentY + 5.5);
  doc.setFontSize(11);
  doc.setTextColor(isPositiveBalance ? 21 : 225, isPositiveBalance ? 128 : 29, isPositiveBalance ? 61 : 72);
  doc.text(formatCurrency(data.finalBalance), card3X + 3, currentY + 13);

  currentY += cardHeight + 8;

  // ==========================================
  // 2. COMPOSIÇÃO E DETALHAMENTO DE DESPESAS
  // ==========================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(32, 39, 36);
  doc.text('2. COMPOSIÇÃO DAS DESPESAS', margin, currentY);
  currentY += 4;

  const totalExp = data.totalExpenses > 0 ? data.totalExpenses : 1;
  const fixedPct = data.totalExpenses > 0 ? ((data.fixedExpenses / totalExp) * 100).toFixed(1) : '0.0';
  const varPct = data.totalExpenses > 0 ? ((data.variableExpenses / totalExp) * 100).toFixed(1) : '0.0';
  const instPct = data.totalExpenses > 0 ? ((data.installments / totalExp) * 100).toFixed(1) : '0.0';

  const compColWidth = (contentWidth - 6) / 3;
  const compHeight = 16;

  // Gastos Fixos
  doc.setFillColor(254, 249, 195); // amber-100
  doc.setDrawColor(253, 230, 138);
  doc.roundedRect(margin, currentY, compColWidth, compHeight, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(146, 64, 14); // amber-800
  doc.text(`GASTOS FIXOS (${fixedPct}%)`, margin + 3, currentY + 5.5);
  doc.setFontSize(10);
  doc.setTextColor(32, 39, 36);
  doc.text(formatCurrency(data.fixedExpenses), margin + 3, currentY + 12);

  // Gastos Variáveis
  const comp2X = margin + compColWidth + 3;
  doc.setFillColor(255, 241, 242);
  doc.setDrawColor(254, 205, 211);
  doc.roundedRect(comp2X, currentY, compColWidth, compHeight, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(159, 18, 57);
  doc.text(`GASTOS VARIÁVEIS (${varPct}%)`, comp2X + 3, currentY + 5.5);
  doc.setFontSize(10);
  doc.setTextColor(32, 39, 36);
  doc.text(formatCurrency(data.variableExpenses), comp2X + 3, currentY + 12);

  // Parcelados
  const comp3X = margin + (compColWidth + 3) * 2;
  doc.setFillColor(243, 232, 255); // purple-100
  doc.setDrawColor(233, 213, 255);
  doc.roundedRect(comp3X, currentY, compColWidth, compHeight, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(107, 33, 168); // purple-800
  doc.text(`PARCELAMENTOS (${instPct}%)`, comp3X + 3, currentY + 5.5);
  doc.setFontSize(10);
  doc.setTextColor(32, 39, 36);
  doc.text(formatCurrency(data.installments), comp3X + 3, currentY + 12);

  currentY += compHeight + 8;

  // ==========================================
  // 3. ANÁLISE PREVISTO X REALIZADO
  // ==========================================
  if (data.previstoRealizado) {
    checkNewPage(45);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(32, 39, 36);
    doc.text('3. ANÁLISE PREVISTO X REALIZADO', margin, currentY);
    currentY += 4;

    // Cabeçalho da Tabela
    doc.setFillColor(240, 242, 241);
    doc.rect(margin, currentY, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(70, 80, 75);

    const colXCategory = margin + 3;
    const colXPrevisto = margin + 65;
    const colXRealizado = margin + 105;
    const colXDiferenca = margin + 145;
    const colXProgresso = margin + contentWidth - 4;

    doc.text('CATEGORIA', colXCategory, currentY + 4.5);
    doc.text('PREVISTO', colXPrevisto, currentY + 4.5, { align: 'right' });
    doc.text('REALIZADO', colXRealizado, currentY + 4.5, { align: 'right' });
    doc.text('DIFERENÇA', colXDiferenca, currentY + 4.5, { align: 'right' });
    doc.text('PROGRESSO', colXProgresso, currentY + 4.5, { align: 'right' });
    currentY += 7;

    const prRows = [
      {
        name: 'Entradas (Receitas)',
        p: data.previstoRealizado.entries.previsto,
        r: data.previstoRealizado.entries.realizado,
        isExpense: false,
      },
      {
        name: 'Gastos Fixos',
        p: data.previstoRealizado.fixed.previsto,
        r: data.previstoRealizado.fixed.realizado,
        isExpense: true,
      },
      {
        name: 'Gastos Variáveis',
        p: data.previstoRealizado.variable.previsto,
        r: data.previstoRealizado.variable.realizado,
        isExpense: true,
      },
      {
        name: 'Parcelados',
        p: data.previstoRealizado.installments.previsto,
        r: data.previstoRealizado.installments.realizado,
        isExpense: true,
      },
      {
        name: 'Total Geral de Despesas',
        p: data.previstoRealizado.expenses.previsto,
        r: data.previstoRealizado.expenses.realizado,
        isExpense: true,
        isTotal: true,
      },
      {
        name: 'Resultado Líquido',
        p: data.previstoRealizado.result.previsto,
        r: data.previstoRealizado.result.realizado,
        isExpense: false,
        isResult: true,
      },
    ];

    prRows.forEach((row, i) => {
      const rowH = 6.5;
      const isEven = i % 2 === 0;

      if (row.isResult) {
        doc.setFillColor(235, 245, 240);
        doc.rect(margin, currentY, contentWidth, rowH, 'F');
      } else if (isEven) {
        doc.setFillColor(250, 252, 251);
        doc.rect(margin, currentY, contentWidth, rowH, 'F');
      }

      doc.setFont('helvetica', row.isTotal || row.isResult ? 'bold' : 'normal');
      doc.setFontSize(8);
      doc.setTextColor(row.isResult ? 7 : 32, row.isResult ? 92 : 39, row.isResult ? 69 : 36);
      doc.text(row.name, colXCategory, currentY + 4.5);

      doc.text(formatCurrency(row.p), colXPrevisto, currentY + 4.5, { align: 'right' });

      // Cor para o realizado
      if (row.isExpense) {
        doc.setTextColor(225, 29, 72);
      } else {
        doc.setTextColor(22, 101, 52);
      }
      doc.text(formatCurrency(row.r), colXRealizado, currentY + 4.5, { align: 'right' });

      // Diferença
      const diff = row.isExpense ? row.p - row.r : row.r - row.p;
      doc.setTextColor(diff >= 0 ? 22 : 225, diff >= 0 ? 101 : 29, diff >= 0 ? 52 : 72);
      doc.text(formatCurrency(diff), colXDiferenca, currentY + 4.5, { align: 'right' });

      // Progresso
      const pct = row.p > 0 ? `${((row.r / row.p) * 100).toFixed(0)}%` : '—';
      doc.setTextColor(32, 39, 36);
      doc.text(pct, colXProgresso, currentY + 4.5, { align: 'right' });

      currentY += rowH;
    });

    currentY += 8;
  }

  // ==========================================
  // 4. EVOLUÇÃO E COMPARATIVO DE COMPETÊNCIAS
  // ==========================================
  checkNewPage(40);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(32, 39, 36);
  doc.text('4. COMPARATIVO DAS COMPETÊNCIAS DO PERÍODO', margin, currentY);
  currentY += 4;

  // Cabeçalho da Tabela de Competências
  doc.setFillColor(240, 242, 241);
  doc.rect(margin, currentY, contentWidth, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(70, 80, 75);

  const compColMonth = margin + 3;
  const compColStatus = margin + 45;
  const compColIncome = margin + 85;
  const compColExpense = margin + 125;
  const compColBalance = margin + contentWidth - 4;

  doc.text('COMPETÊNCIA', compColMonth, currentY + 4.5);
  doc.text('STATUS', compColStatus, currentY + 4.5);
  doc.text('RECEITAS', compColIncome, currentY + 4.5, { align: 'right' });
  doc.text('DESPESAS', compColExpense, currentY + 4.5, { align: 'right' });
  doc.text('SALDO FINAL', compColBalance, currentY + 4.5, { align: 'right' });
  currentY += 7;

  data.months.forEach((m, i) => {
    checkNewPage(8);

    const rowH = 6.5;
    if (i % 2 === 0) {
      doc.setFillColor(250, 252, 251);
      doc.rect(margin, currentY, contentWidth, rowH, 'F');
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(32, 39, 36);
    doc.text(m.label, compColMonth, currentY + 4.5);

    // Status
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    if (m.isClosed) {
      doc.setTextColor(22, 101, 52);
      doc.text('Fechado', compColStatus, currentY + 4.5);
    } else {
      doc.setTextColor(180, 83, 9);
      doc.text('Aberto', compColStatus, currentY + 4.5);
    }

    // Receitas
    doc.setFontSize(8);
    doc.setTextColor(22, 101, 52);
    doc.text(formatCurrency(m.summary.total_income), compColIncome, currentY + 4.5, { align: 'right' });

    // Despesas
    doc.setTextColor(225, 29, 72);
    doc.text(formatCurrency(m.summary.total_expenses), compColExpense, currentY + 4.5, { align: 'right' });

    // Saldo
    const bal = m.summary.final_balance;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(bal >= 0 ? 22 : 225, bal >= 0 ? 101 : 29, bal >= 0 ? 52 : 72);
    doc.text(formatCurrency(bal), compColBalance, currentY + 4.5, { align: 'right' });

    currentY += rowH;
  });

  // Finaliza a última página com o rodapé
  addFooter();

  // Salva o documento PDF
  const cleanPeriod = data.periodLabel.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const filename = `Poupagaio_Relatorio_Financeiro_${cleanPeriod}_${now.toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}
