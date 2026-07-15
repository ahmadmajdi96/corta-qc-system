import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";

export type PdfSection = {
  title: string;
  columns: string[];
  rows: (string | number)[][];
};

export async function exportPdfReport(opts: {
  title: string;
  subtitle?: string;
  sections: PdfSection[];
  filename?: string;
  auditEntityType?: string;
  auditEntityId?: string;
}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const now = new Date();
  doc.setFontSize(16);
  doc.text(opts.title, 40, 50);
  doc.setFontSize(10);
  doc.setTextColor(120);
  if (opts.subtitle) doc.text(opts.subtitle, 40, 66);
  doc.text(`Generated: ${now.toLocaleString()}`, 40, 80);

  let y = 100;
  for (const s of opts.sections) {
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(s.title, 40, y);
    y += 8;
    autoTable(doc, {
      startY: y,
      head: [s.columns],
      body: s.rows,
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [37, 99, 235] },
      margin: { left: 40, right: 40 },
    });
    // @ts-expect-error jspdf-autotable augments lastAutoTable
    y = (doc.lastAutoTable?.finalY ?? y) + 24;
  }

  const filename = opts.filename ?? `report_${now.toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);

  // Audit log
  try {
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from("audit_logs").insert({
      user_id: userData.user?.id ?? null,
      action: "pdf_report_export",
      entity_type: opts.auditEntityType ?? "report",
      entity_id: opts.auditEntityId ?? null,
      details: { title: opts.title, filename, generated_at: now.toISOString() },
    } as any);
  } catch (e) {
    console.warn("audit log failed", e);
  }
}
