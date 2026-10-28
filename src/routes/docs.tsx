import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDown, ArrowLeft, ArrowRight, BookOpen, ChevronRight, FileText, Maximize2, Printer, Search, X } from "lucide-react";
import { createContext, isValidElement, useContext, useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "CORTA QC — Technical Documentation" },
      { name: "description", content: "Complete technical documentation for CORTA QC: modules, workflows, data model, roles, quality gates and deployment." },
      { property: "og:title", content: "CORTA QC — Technical Documentation" },
      { property: "og:description", content: "Modules, workflows, data model, roles and deployment guide for the CORTA QC quality suite." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DocsPage,
});

const IMG = (n: string) => `/doc-images/${n}.jpg`;
const PrintGuideContext = createContext(false);

type Section = { id: string; title: string; group: string };
const SECTIONS: Section[] = [
  { id: "overview", title: "System overview", group: "Introduction" },
  { id: "architecture", title: "Architecture", group: "Introduction" },
  { id: "roles", title: "Roles & permissions", group: "Introduction" },
  { id: "login", title: "Sign-in", group: "Introduction" },
  { id: "dashboard", title: "Control Center", group: "Operations" },
  { id: "live", title: "Live Floor", group: "Operations" },
  { id: "work-orders", title: "Work Orders", group: "Operations" },
  { id: "requests", title: "Requests", group: "Operations" },
  { id: "plans", title: "Inspection Plans (ITP)", group: "Quality" },
  { id: "inspections", title: "Inspections & Execution", group: "Quality" },
  { id: "ncs", title: "Non-Conformances (NCR)", group: "Quality" },
  { id: "ca", title: "Corrective Actions", group: "Quality" },
  { id: "capa", title: "CAPA (8D / 5-Why / Fishbone / A3)", group: "Quality" },
  { id: "holds", title: "Quality Holds", group: "Quality" },
  { id: "spc", title: "SPC / Control Charts", group: "Quality" },
  { id: "calibration", title: "Calibration & MSA", group: "Quality" },
  { id: "incoming", title: "Incoming Inspection", group: "Supply chain" },
  { id: "scars", title: "Supplier SCARs", group: "Supply chain" },
  { id: "complaints", title: "Customer Complaints", group: "Supply chain" },
  { id: "master", title: "Master data", group: "Master data" },
  { id: "reports", title: "Reports & exports", group: "Administration" },
  { id: "admin", title: "Administration & audit", group: "Administration" },
  { id: "automation", title: "Automation & gates", group: "Reference" },
  { id: "data-model", title: "Data model", group: "Reference" },
  { id: "deployment", title: "Deployment", group: "Reference" },
];

function Flow({ steps }: { steps: string[] }) {
  return <div className="my-7 border-y border-border py-5">
    <h3 className="mb-4 font-mono text-xs uppercase text-muted-foreground">Workflow</h3>
    <ol className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center" aria-label="Workflow diagram">
      {steps.map((step, i) => <li key={step} className="flex min-w-0 items-center gap-3">
        <div className="flex min-h-12 max-w-48 items-center gap-2 rounded-md border border-primary/25 bg-primary/5 px-3 py-2">
          <span className="font-mono text-xs text-primary">{String(i + 1).padStart(2, "0")}</span><span className="text-xs font-medium">{step}</span>
        </div>
        {i < steps.length - 1 && <><ArrowRight aria-hidden className="hidden size-4 shrink-0 text-muted-foreground sm:block"/><ArrowDown aria-hidden className="size-4 shrink-0 text-muted-foreground sm:hidden"/></>}
      </li>)}
    </ol>
  </div>;
}

function Shot({ name, caption }: { name: string; caption: string }) {
  const [open, setOpen] = useState(false);
  const printGuide = useContext(PrintGuideContext);
  const captionId = `${printGuide ? "print-" : ""}caption-${name}`;
  return <>
    <figure className="my-7">
      <div className="relative overflow-hidden rounded-md border border-border bg-card">
        <img src={IMG(name)} alt={caption} loading={printGuide ? "eager" : "lazy"} width={1440} height={900} className="h-auto w-full" />
        <Button variant="secondary" size="icon" title="Enlarge screenshot" aria-label={`Enlarge ${caption} screenshot`} onClick={() => setOpen(true)} className="absolute right-3 top-3 print:hidden"><Maximize2 /></Button>
      </div>
      <figcaption className="mt-3 text-xs leading-5 text-muted-foreground">{caption}</figcaption>
    </figure>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto bg-background" aria-describedby={captionId}><DialogHeader><DialogTitle>{caption}</DialogTitle></DialogHeader><img src={IMG(name)} alt={`${caption} enlarged application screenshot`} width={1440} height={900} className="h-auto w-full rounded-md"/><p id={captionId} className="text-xs leading-5 text-muted-foreground">{caption}</p></DialogContent></Dialog>
  </>;
}

function Sec({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const index = SECTIONS.findIndex(section => section.id === id);
  const printGuide = useContext(PrintGuideContext);
  const sectionId = `${printGuide ? "print-" : ""}${id}`;
  return <article id={sectionId} className="doc-chapter min-w-0 scroll-mt-20" aria-labelledby={`title-${sectionId}`}>
    <div className="mb-4 flex items-center gap-2 font-mono text-xs text-muted-foreground"><span className="text-primary">{String(index + 1).padStart(2, "0")}</span><ChevronRight className="size-3"/>{SECTIONS[index]?.group}</div>
    <h2 id={`title-${sectionId}`} className="text-2xl font-semibold sm:text-3xl">{title.replace(/^\d+\.\s*/, "")}</h2>
    <div className="mt-4 space-y-5 text-sm leading-7 text-foreground [&>p:first-child]:max-w-3xl [&>p:first-child]:text-base [&>p:first-child]:text-muted-foreground [&_strong]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_code]:text-xs [&_code]:text-foreground">{children}</div>
  </article>;
}

function searchableText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(searchableText).join(" ");
  if (isValidElement<{ children?: ReactNode; title?: string; rows?: string[][]; steps?: string[] }>(node)) {
    return [node.props.title, node.props.rows?.flat().join(" "), node.props.steps?.join(" "), searchableText(node.props.children)].join(" ");
  }
  return "";
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="my-4 overflow-x-auto rounded-md border border-border">
      <table className="w-full text-left text-sm">
        <thead className="bg-secondary text-foreground">
          <tr>{head.map((h) => <th key={h} className="px-4 py-3 text-xs font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border">
              {r.map((c, j) => <td key={j} className="px-4 py-3 align-top text-xs leading-6">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DocsPage() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("overview");
  const [mode, setMode] = useState<"chapter" | "all">("chapter");
  useEffect(() => {
    const syncHash = () => {
      const id = window.location.hash.slice(1);
      if (!id || SECTIONS.some(section => section.id === id)) { setSelected(id || "overview"); setMode("chapter"); setQuery(""); }
    };
    syncHash();
    window.addEventListener("hashchange", syncHash);
    window.addEventListener("popstate", syncHash);
    return () => {
      window.removeEventListener("hashchange", syncHash);
      window.removeEventListener("popstate", syncHash);
    };
  }, []);
  const chapters = [
          <Sec id="overview" title="1. System overview">
            <p><strong>CORTA QC</strong> is a manufacturing Quality Management System (QMS) integrated with shop-floor execution (MES). It covers the full quality lifecycle: planning (Inspection & Test Plans), execution (inspections with measurements), detection (non-conformances, holds, SPC signals), correction (corrective actions, CAPA, supplier SCARs) and verification (reports, KPIs, audit trail).</p>
            <p>It supports compliance profiles (e.g. <strong>AS/EN/JISQ 9100 Aerospace</strong>, ISO 9001, food safety) selectable from the top bar, which adjust terminology and gate strictness.</p>
            <Flow steps={["Plan (ITP)", "Work Order", "Inspect", "Detect NC / Hold", "Disposition", "CAPA", "Verify & Close", "Report"]} />
          </Sec>,

          <Sec id="architecture" title="2. Architecture">
            <ul>
              <li><strong>Frontend:</strong> React 19, TanStack Router/Query, Tailwind v4, shadcn/ui, Recharts, jsPDF.</li>
              <li><strong>Backend:</strong> managed PostgreSQL with Auth, Storage and Row-Level Security (RLS). Business rules live in the database as triggers and functions so they are enforced regardless of client.</li>
              <li><strong>Scheduling:</strong> <code>pg_cron</code> runs daily escalations (<code>run_overdue_escalations()</code>) with results logged in <code>cron_run_log</code>.</li>
              <li><strong>Notifications:</strong> database functions <code>notify()</code> / <code>notify_role()</code> push in-app alerts (bell icon in the header).</li>
              <li><strong>Search:</strong> global ⌘K / Ctrl+K palette across products, work orders, inspections, NCs, CAPAs.</li>
            </ul>
          </Sec>,

          <Sec id="roles" title="3. Roles & permissions">
            <Table head={["Role", "Capabilities"]} rows={[
              ["administrator", "Full access, user/role management, settings, destructive actions, audit log."],
              ["quality_manager", "Products, specs, plans approval, NC disposition, CAPA closure, hold release."],
              ["qc_engineer", "Plans, SPC, CAPA authoring, calibration records."],
              ["inspector", "Executes inspections, records measurements, raises NCs."],
              ["auditor", "Read-only across the platform, verifies corrective actions."],
              ["viewer", "Read-only dashboards."],
            ]} />
            <p>Roles are stored in a protected <code>user_roles</code> table and checked by RLS policies; they are never derived from user-editable profile data.</p>
          </Sec>,

          <Sec id="login" title="4. Sign-in">
            <p>Users sign in with email and password. Accounts are created by an administrator (self sign-up and password reset are disabled on the login screen). Accidental spaces and auto-capitalisation are stripped. After sign-in the user is forwarded to the Control Center.</p>
            <Shot name="login" caption="Sign-in screen" />
          </Sec>,

          <Sec id="dashboard" title="5. Control Center (Dashboard)">
            <p>Live QMS overview: KPI tiles (30-day pass rate, inspections today, open NCs, overdue CAs, quality holds), 14-day pass-rate trend, overall pass gauge, latest work orders and the NC feed. Quick actions: <strong>New Inspection</strong> and <strong>Raise NC</strong>.</p>
            <Shot name="dashboard" caption="Control Center" />
          </Sec>,

          <Sec id="live" title="6. Live Floor">
            <p>Real-time WIP view of active work orders per line/station, the live inspection queue and hold alerts. Data refreshes automatically.</p>
            <Shot name="live" caption="Live Floor" />
          </Sec>,

          <Sec id="work-orders" title="7. Work Orders">
            <p>Every work order must reference a product, lot number, line and planned quantity (minimum 1; planned end must be after start).</p>
            <Flow steps={["planned", "released", "in_progress", "completed", "closed"]} />
            <p>Any status can move to <code>on_hold</code> when a quality hold is opened on the WO or lot. The detail page shows operations, linked inspections, NCs and holds.</p>
            <Shot name="work-orders" caption="Work order list" />
            <Shot name="work-order-detail" caption="Work order detail with linked quality records" />
          </Sec>,

          <Sec id="requests" title="8. Requests">
            <p>Intake for new product / specification requests. Requests move through submitted → under review → approved / rejected, with tabs, pagination, search and CSV export.</p>
            <Shot name="requests" caption="Requests" />
          </Sec>,

          <Sec id="plans" title="9. Inspection Plans (ITP)">
            <p>Plans define <strong>what</strong> to check, <strong>how</strong> (method: dimensional, visual, NDT, functional) and <strong>acceptance criteria</strong>. Plan types: incoming, in-process, final. Each characteristic can be flagged as a <strong>Hold</strong>, <strong>Witness</strong> or <strong>Review</strong> point.</p>
            <Flow steps={["Draft", "Add characteristics", "Approve (e-signature)", "Frozen revision", "New revision"]} />
            <p>Once approved via <code>approve_inspection_plan</code>, characteristics are frozen by the trigger <code>trg_plan_char_frozen</code>; changes require <code>new_plan_revision</code>, preserving history.</p>
            <Shot name="inspection-plans" caption="Inspection plan library" />
          </Sec>,

          <Sec id="inspections" title="10. Inspections & Execution">
            <p>Inspections are scheduled (calendar view) or created from a work order. During execution, the form adapts per method:</p>
            <Table head={["Method", "Inputs", "Verdict"]} rows={[
              ["Dimensional / numeric", "Value, gage", "Pass if within LSL–USL"],
              ["Visual / attribute", "OK / NOK, N/A", "Direct"],
              ["NDT", "Method, reference standard, result", "Compared to ITP acceptance criteria"],
              ["Functional", "Expected, observed, result", "Compared to ITP acceptance criteria"],
              ["Hold / Witness / Review", "Result details, sign-off", "Contributes to overall verdict"],
            ]} />
            <Flow steps={["scheduled", "in_progress", "record measurements", "completed (pass / fail)"]} />
            <ul>
              <li>Measurements with a gage are blocked if the gage is <strong>overdue</strong> or out of service (<code>trg_meas_gage_cal</code>).</li>
              <li>A failing inspection automatically opens a <strong>Quality Hold</strong> on the WO and lot.</li>
              <li>Progress is broken down per ITP row and method by PASS / FAIL / Pending / N-A.</li>
              <li>Cancel requires a reason; reopen is administrator-only.</li>
            </ul>
            <Shot name="inspections" caption="Inspection list" />
            <Shot name="inspections-calendar" caption="Inspection calendar" />
          </Sec>,

          <Sec id="ncs" title="11. Non-Conformances (NCR)">
            <p>NCs are raised manually or from failed inspections. The board view supports drag-and-drop between statuses; the list view supports filters by stage, method, date and severity.</p>
            <Flow steps={["open", "investigation", "segregation / quarantine", "disposition (e-signature)", "CAPA (if required)", "closed"]} />
            <ul>
              <li><strong>Segregation</strong>: location, quantity and quarantine tag are recorded and persisted.</li>
              <li><strong>Disposition</strong>: use-as-is, rework, repair, scrap, return-to-supplier — signed with an electronic signature (password re-entry, meaning, timestamp).</li>
              <li><strong>CAPA auto-creation</strong>: critical/major severity or use-as-is/repair dispositions automatically create a linked CAPA.</li>
              <li><code>enforce_nc_closure</code> blocks closure until the linked CAPA's effectiveness is verified.</li>
            </ul>
            <Shot name="non-conformances" caption="NC board" />
            <Shot name="nc-list" caption="NC list with filters" />
          </Sec>,

          <Sec id="ca" title="12. Corrective Actions">
            <p>Individual action items with owner, due date and verification. Overdue actions escalate automatically at 7 / 14 / 30 days (L1 / L2 / L3).</p>
            <Flow steps={["open", "in_progress", "implemented", "verified", "closed"]} />
            <Shot name="corrective-actions" caption="Corrective actions" />
          </Sec>,

          <Sec id="capa" title="13. CAPA">
            <p>CAPA records support four methodologies; the step set displayed matches the chosen one:</p>
            <Table head={["Methodology", "Steps"]} rows={[
              ["8D", "D1 Team · D2 Problem · D3 Containment · D4 Root cause · D5 Corrective · D6 Implement · D7 Prevent · D8 Recognition"],
              ["5-Why", "Problem · Why 1–5 · Root cause · Action"],
              ["Fishbone", "Man · Machine · Method · Material · Measurement · Environment · Root cause"],
              ["A3", "Background · Current state · Target · Analysis · Countermeasures · Plan · Follow-up"],
            ]} />
            <p><code>enforce_capa_8d_gates</code> prevents advancing without completing prior steps; closure requires an electronic signature and effectiveness verification.</p>
            <Shot name="capa" caption="CAPA register" />
          </Sec>,

          <Sec id="holds" title="14. Quality Holds">
            <p>Holds quarantine a lot or work order. Every status and quantity change is logged by <code>log_hold_status</code>.</p>
            <Flow steps={["open", "under_review", "disposition", "released / rework / scrapped / returned"]} />
            <Shot name="holds" caption="Quality holds" />
          </Sec>,

          <Sec id="spc" title="15. SPC / Control Charts">
            <p>X̄/R charts built from inspection subgroups with UCL/LCL, Cp/Cpk. <code>evaluate_spc_signals</code> applies <strong>Nelson rules 1–8</strong> (point beyond 3σ, 9 on one side, 6 trending, 14 alternating, 2 of 3 beyond 2σ, 4 of 5 beyond 1σ, 15 within 1σ, 8 outside 1σ). Control limits are locked once established (<code>trg_spc_limits_lock</code>).</p>
            <Shot name="spc" caption="SPC (charts appear as samples are recorded)" />
          </Sec>,

          <Sec id="calibration" title="16. Calibration & MSA">
            <p>Gage registry with status active / due / overdue / out_of_service. Calibration records store result, certificate and next due date. A failed calibration triggers an <strong>out-of-tolerance (OOT)</strong> impact review listing measurements taken with that gage (<code>enforce_cal_oot</code>). MSA studies (Gage R&R, linearity, bias) are kept per gage.</p>
            <Flow steps={["Register gage", "Calibrate", "Pass → next due", "Fail → OOT review → affected inspections"]} />
            <Shot name="calibration" caption="Gage registry" />
          </Sec>,

          <Sec id="incoming" title="17. Incoming Inspection">
            <p>Receiving inspection of supplier lots. The built-in <strong>ISO 2859-1</strong> sampling calculator (<code>iso_2859_1_sample</code>) returns code letter, sample size and Ac/Re (e.g. lot 500, AQL 1.0 → H, n=50, Ac 1 / Re 2).</p>
            <Flow steps={["Receive lot", "Sample (ISO 2859-1)", "Inspect", "Accept / Reject → SCAR"]} />
            <Shot name="incoming" caption="Incoming lots" />
            <Shot name="suppliers" caption="Suppliers" />
          </Sec>,

          <Sec id="scars" title="18. Supplier SCARs">
            <p>Supplier Corrective Action Requests are auto-numbered, routed to the quality manager role, and tracked through issued → supplier response → verified → closed.</p>
            <Shot name="supplier-scars" caption="Supplier SCARs" />
          </Sec>,

          <Sec id="complaints" title="19. Customer Complaints">
            <p>Auto-numbered complaint register with severity, product/lot traceability and link to NC/CAPA. New complaints notify the responsible roles.</p>
            <Shot name="complaints" caption="Customer complaints" />
          </Sec>,

          <Sec id="master" title="20. Master data">
            <p>Products (with versioned quality specifications), production lines and stations. A specification version increments automatically on save.</p>
            <Shot name="products" caption="Products" />
            <Shot name="lines" caption="Production lines" />
            <Shot name="stations" caption="Stations" />
          </Sec>,

          <Sec id="reports" title="21. Reports & exports">
            <p>Inspection and NC dashboards with filters (stage, method, date, severity), KPI tiles from <code>qms_kpi_summary</code>, and an acceptance-criteria verification view grouping execution results and NCRs. All tables support 25/50/100/200 rows per page, search, dynamic filters and CSV export; reports export to PDF (exports are audit-logged).</p>
            <Shot name="reports" caption="Reports" />
          </Sec>,

          <Sec id="admin" title="22. Administration & audit">
            <p>User management, role assignment, units, severities and system settings. The audit log records every create/update/delete with user, timestamp and before/after values, filterable by entity, action and date range with CSV export.</p>
            <Shot name="admin" caption="Administration" />
            <Shot name="audit" caption="Audit log" />
          </Sec>,

          <Sec id="automation" title="23. Automation & quality gates (reference)">
            <Table head={["Function / trigger", "Purpose"]} rows={[
              ["approve_inspection_plan / new_plan_revision", "Plan approval and immutable revisions"],
              ["trg_plan_char_frozen", "Blocks edits to approved plan characteristics"],
              ["trg_meas_gage_cal", "Blocks measurements with overdue gages"],
              ["trg_spc_limits_lock", "Locks established control limits"],
              ["evaluate_spc_signals", "Nelson rules 1–8"],
              ["enforce_nc_closure", "NC closure requires verified CAPA"],
              ["enforce_capa_8d_gates", "Sequential CAPA step completion"],
              ["enforce_cal_oot", "OOT impact on failed calibration"],
              ["log_hold_status", "Hold history and quantity changes"],
              ["run_overdue_escalations (pg_cron, daily)", "L1/L2/L3 escalations at 7/14/30 days"],
              ["iso_2859_1_sample", "ISO 2859-1 sampling plans"],
              ["notify / notify_role", "In-app notifications"],
            ]} />
          </Sec>,

          <Sec id="data-model" title="24. Data model">
            <Table head={["Domain", "Tables"]} rows={[
              ["Identity", "profiles, roles, user_roles, permissions, role_permissions"],
              ["Master data", "products, product_categories, quality_specifications, specification_items, measurement_units, severities, production_lines, stations, suppliers"],
              ["Execution", "work_orders, wo_operations, inspection_plans, plan_characteristics, inspection_schedules, inspections, inspection_measurements"],
              ["Quality events", "non_conformances, corrective_actions, capa_records, quality_holds, hold_scope_actions, customer_complaints, supplier_scars"],
              ["Metrology / SPC", "gages, calibration_records, msa_studies, gauge_usage_history, spc_samples"],
              ["Supply", "incoming_lots"],
              ["System", "audit_logs, notifications, cron_run_log"],
            ]} />
            <p>All tables use UUID primary keys, <code>created_at</code>/<code>updated_at</code> timestamps and RLS policies per role.</p>
          </Sec>,

          <Sec id="deployment" title="25. Deployment">
            <p>The application ships with a <code>Dockerfile</code> and <code>docker-compose.yml</code> (port 8120). Allowed hosts include <code>qms.cortanexai.com</code> and <code>qms.manuqube.com</code>.</p>
            <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-4 font-mono text-xs text-foreground">{`docker compose up -d --build
# open http://<server>:8120/docs`}</pre>
            <p>This documentation page is public (no sign-in) at <code>/docs</code>. Screenshots are bundled with the app under <code>/doc-images/</code>, so they display on any server hosting the app with no external dependency.</p>
          </Sec>,
  ];
  const groups = [...new Set(SECTIONS.map(section => section.group))];
  const normalized = query.trim().toLowerCase();
  const filtered = SECTIONS.filter((section, index) => `${section.title} ${section.group} ${searchableText(chapters[index])}`.toLowerCase().includes(normalized));
  const activeSection = filtered.find(section => section.id === selected) ?? filtered[0];
  const activeId = activeSection?.id;
  const index = activeSection ? SECTIONS.indexOf(activeSection) : -1;
  const navigationIndex = filtered.findIndex(section => section.id === activeId);
  const select = (id: string) => {
    setSelected(id); setMode("chapter");
    window.history.pushState(null, "", `#${id}`);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const visible = mode === "all" ? filtered.map(section => chapters[SECTIONS.indexOf(section)]) : index < 0 ? [] : [chapters[index]];
  return <div className="technical-docs mx-auto max-w-[1600px] p-4 sm:p-6">
    <header className="doc-header mb-8 border-b border-border pb-6">
      <div className="mb-3 flex items-center gap-2 text-xs text-primary"><BookOpen className="size-4"/><span className="font-mono uppercase">Engineering & operations reference</span></div>
      <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-semibold">CORTA QC Documentation</h1><p className="mt-3 text-sm text-muted-foreground">Architecture, workflows, quality gates and operating procedures.</p></div><div className="flex flex-wrap gap-2"><Button onClick={() => window.print()} variant="outline" className="print:hidden"><Printer/>Print / PDF</Button><Button asChild variant="ghost" className="print:hidden"><Link to="/auth">Open the system<ArrowRight/></Link></Button></div></div>
      <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs text-muted-foreground"><span>25 chapters</span><span>26 actual screenshots</span><span className="text-warning">Implementation reference · not a commissioning certificate</span></div>
    </header>
    <div className="grid min-w-0 gap-8 lg:grid-cols-[250px_minmax(0,1fr)] xl:gap-12">
      <aside className="doc-navigation min-w-0 print:hidden"><div className="lg:sticky lg:top-20">
        <div className="relative"><Search className="absolute left-3 top-3 size-4 text-muted-foreground"/><Input aria-label="Search documentation" placeholder="Search documentation…" value={query} onChange={event => setQuery(event.target.value)} className="h-10 pl-9 pr-9"/>{query && <Button size="icon" variant="ghost" className="absolute right-1 top-1 size-8" onClick={() => setQuery("")} aria-label="Clear documentation search"><X/></Button>}</div>
        <div className="mt-3 flex border-b border-border pb-3"><Button size="sm" variant={mode === "chapter" ? "secondary" : "ghost"} onClick={() => setMode("chapter")} aria-pressed={mode === "chapter"}><BookOpen/>Chapter</Button><Button size="sm" variant={mode === "all" ? "secondary" : "ghost"} onClick={() => setMode("all")} aria-pressed={mode === "all"}><FileText/>Full guide</Button></div>
        {query && <p className="mt-3 text-xs text-muted-foreground" role="status">{filtered.length} matching chapters</p>}
        <nav aria-label="Documentation chapters" className="mt-4 max-h-52 overflow-y-auto pr-1 lg:max-h-[65vh]">{groups.map(group => {
          const items = filtered.filter(section => section.group === group);
          if (!items.length) return null;
          return <div key={group} className="mb-5"><h2 className="mb-2 font-mono text-[10px] uppercase text-muted-foreground">{group}</h2>{items.map(section => <Button key={section.id} variant="ghost" onClick={() => select(section.id)} aria-current={activeId === section.id && mode === "chapter" ? "page" : undefined} className={`mb-1 h-auto min-h-9 w-full justify-start whitespace-normal py-2 text-left text-xs leading-5 ${activeId === section.id && mode === "chapter" ? "border-l-2 border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}><span className="w-5 shrink-0 font-mono text-[10px]">{String(SECTIONS.indexOf(section) + 1).padStart(2, "0")}</span>{section.title}</Button>)}</div>;
        })}{filtered.length === 0 && <div className="py-6 text-sm text-muted-foreground">No matching chapters.</div>}</nav>
      </div></aside>
      <main className="min-w-0 max-w-[1080px]">
        <div className="doc-visible space-y-16">{visible.map((chapter) => chapter && <div key={chapter.props.id}>{chapter}</div>)}{visible.length === 0 && <p className="py-12 text-muted-foreground">No chapters match this search.</p>}</div>
        <PrintGuideContext.Provider value={true}><div className="doc-print-only hidden space-y-16">{chapters.map(chapter => <div key={chapter.props.id}>{chapter}</div>)}</div></PrintGuideContext.Provider>
        {mode === "chapter" && activeSection && <footer className="mt-12 flex flex-wrap justify-between gap-3 border-t border-border pt-5 print:hidden"><Button variant="ghost" disabled={navigationIndex <= 0} onClick={() => { const prev = filtered[navigationIndex - 1]; if (prev) select(prev.id); }}><ArrowLeft/>Previous chapter</Button><Button variant="outline" disabled={navigationIndex >= filtered.length - 1} onClick={() => { const next = filtered[navigationIndex + 1]; if (next) select(next.id); }}>Next chapter<ArrowRight/></Button></footer>}
        <p className="mt-10 border-t border-border py-5 text-xs leading-5 text-muted-foreground">CORTA QC · Technical reference · Screenshots use demonstration records. No credentials are included.</p>
      </main>
    </div>
  </div>;
}
