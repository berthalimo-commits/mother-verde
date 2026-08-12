import { jsPDF } from 'jspdf';

const LABELS = {
  es: { title: 'Bitácora de cultivo', fecha: 'Fecha', etapa: 'Etapa', datos: 'Datos', notas: 'Notas', generado: 'Generado el', pagina: 'Página', sinFecha: 'Sin fecha', sinNotas: '(sin notas)', entradas: 'entradas' },
  en: { title: 'Grow Journal', fecha: 'Date', etapa: 'Stage', datos: 'Readings', notas: 'Notes', generado: 'Generated on', pagina: 'Page', sinFecha: 'No date', sinNotas: '(no notes)', entradas: 'entries' },
  de: { title: 'Anbau-Tagebuch', fecha: 'Datum', etapa: 'Phase', datos: 'Messwerte', notas: 'Notizen', generado: 'Erstellt am', pagina: 'Seite', sinFecha: 'Kein Datum', sinNotas: '(keine Notizen)', entradas: 'Einträge' },
  fr: { title: 'Journal de culture', fecha: 'Date', etapa: 'Étape', datos: 'Mesures', notas: 'Notes', generado: 'Généré le', pagina: 'Page', sinFecha: 'Sans date', sinNotas: '(sans notes)', entradas: 'entrées' },
};

function formatDatos(e, L){
  const parts = [];
  if(e.ph) parts.push(`pH ${e.ph}`);
  if(e.ec) parts.push(`EC ${e.ec}`);
  if(e.temp) parts.push(`${e.temp}°C`);
  if(e.hum) parts.push(`${e.hum}% HR`);
  return parts.join('  ·  ');
}

window.exportBitacoraPDF = function(){
  const entries = (window.getBitEntries?.() || []).slice().sort((a,b)=> new Date(a.fecha) - new Date(b.fecha));
  const lang = window.getCurrentLang?.() || 'es';
  const L = LABELS[lang] || LABELS.es;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const marginX = 48;
  let y = 56;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(50, 74, 44);
  doc.text(L.title, marginX, y);
  y += 22;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  const today = new Date().toLocaleDateString(lang);
  doc.text(`${L.generado} ${today} — ${entries.length} ${L.entradas}`, marginX, y);
  y += 24;
  doc.setDrawColor(210, 210, 200);
  doc.line(marginX, y, pageW - marginX, y);
  y += 20;

  entries.forEach((e) => {
    const notaLines = doc.splitTextToSize(e.nota || L.sinNotas, pageW - marginX * 2);
    const blockHeight = 40 + notaLines.length * 13;
    if(y + blockHeight > doc.internal.pageSize.getHeight() - 50){
      doc.addPage();
      y = 56;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(50, 74, 44);
    doc.text(`${e.fecha || L.sinFecha}  ·  ${e.etapa || ''}`, marginX, y);
    y += 16;

    const datos = formatDatos(e, L);
    if(datos){
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(61, 107, 121);
      doc.text(datos, marginX, y);
      y += 14;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(60, 74, 61);
    doc.text(notaLines, marginX, y);
    y += notaLines.length * 13 + 14;
  });

  const pageCount = doc.internal.getNumberOfPages();
  for(let i = 1; i <= pageCount; i++){
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text(`Mother Verde — ${L.pagina} ${i}/${pageCount}`, marginX, doc.internal.pageSize.getHeight() - 30);
  }

  doc.save(`bitacora-cultivo-${new Date().toISOString().slice(0,10)}.pdf`);
};
