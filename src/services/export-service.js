// Exports du dossier projet : TXT, PDF (jsPDF) et DOCX (docx), générés côté navigateur.
import { jsPDF } from 'jspdf';
import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import { generateProjectDossier, generateProjectDossierSections } from './dossier-generator';

const DOSSIER_TITLE = 'Dossier projet AetherAccess';

function slugify(text) {
  return (text || 'projet')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'projet';
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportDossierTxt(project = {}) {
  downloadBlob(
    new Blob([generateProjectDossier(project)], { type: 'text/plain;charset=utf-8' }),
    `dossier-aetheraccess-${slugify(project.name)}.txt`,
  );
}

export function exportDossierPdf(project = {}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const marginX = 15;
  const maxWidth = 180;
  let y = 20;

  const ensureSpace = (needed) => {
    if (y + needed > 280) {
      doc.addPage();
      y = 20;
    }
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(DOSSIER_TITLE, marginX, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90, 110, 100);
  doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} — document à relire et à confirmer avec l’entreprise.`, marginX, y);
  doc.setTextColor(20, 53, 43);
  y += 10;

  for (const section of generateProjectDossierSections(project)) {
    ensureSpace(16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(section.heading, marginX, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    for (const line of section.lines) {
      const wrapped = doc.splitTextToSize(line, maxWidth);
      ensureSpace(wrapped.length * 5.2);
      doc.text(wrapped, marginX, y);
      y += wrapped.length * 5.2;
    }
    y += 4;
  }

  doc.save(`dossier-aetheraccess-${slugify(project.name)}.pdf`);
}

export async function exportDossierDocx(project = {}) {
  const children = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun({ text: DOSSIER_TITLE, bold: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.LEFT,
      children: [
        new TextRun({
          text: `Généré le ${new Date().toLocaleDateString('fr-FR')} — document à relire et à confirmer avec l’entreprise.`,
          italics: true,
          size: 18,
        }),
      ],
    }),
    new Paragraph({ text: '' }),
  ];

  for (const section of generateProjectDossierSections(project)) {
    children.push(
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: section.heading, bold: true })] }),
      ...section.lines.map((line) => new Paragraph({ text: line })),
      new Paragraph({ text: '' }),
    );
  }

  const document_ = new Document({
    creator: 'AetherAccess',
    title: DOSSIER_TITLE,
    sections: [{ children }],
  });
  const blob = await Packer.toBlob(document_);
  downloadBlob(blob, `dossier-aetheraccess-${slugify(project.name)}.docx`);
}
