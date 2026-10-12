import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

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
  return (
    <div className="my-5 flex flex-wrap items-center gap-2">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <div className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 font-mono text-xs text-primary">
            <span className="mr-2 opacity-60">{String(i + 1).padStart(2, "0")}</span>{s}
          </div>
          {i < steps.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
        </div>
      ))}
    </div>
  );
}

function Shot({ name, caption }: { name: string; caption: string }) {
  return (
    <figure className="my-6 overflow-hidden rounded-xl border border-border bg-card">
      <a href={IMG(name)} target="_blank" rel="noreferrer">
        <img src={IMG(name)} alt={caption} loading="lazy" className="w-full" />
      </a>
      <figcaption className="border-t border-border px-4 py-2 text-xs text-muted-foreground">{caption}</figcaption>
    </figure>
  );
}

function Sec({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 border-b border-border py-10">
      <h2 className="mb-4 text-2xl font-semibold tracking-tight">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground [&_strong]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_code]:text-xs [&_code]:text-foreground">
        {children}
      </div>
    </section>
  );
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="my-4 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-xs">
        <thead className="bg-muted/50 text-foreground">
          <tr>{head.map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border">
              {r.map((c, j) => <td key={j} className="px-3 py-2 align-top">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DocsPage() {
  const groups = [...new Set(SECTIONS.map((s) => s.group))];
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-2 font-semibold">
            <BookOpen className="h-5 w-5 text-primary" /> CORTA QC <span className="font-normal text-muted-foreground">· Technical Documentation</span>
          </div>
          <Link to="/auth" className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">Open the system</Link>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-8 px-4">
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 overflow-y-auto py-8 lg:block">
          {groups.map((g) => (
            <div key={g} className="mb-5">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{g}</div>
              {SECTIONS.filter((s) => s.group === g).map((s) => (
                <a key={s.id} href={`#${s.id}`} className="block rounded px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground">{s.title}</a>
              ))}
            </div>
          ))}
        </aside>

        <main className="min-w-0 max-w-4xl flex-1 pb-24">
          <Sec id="overview" title="1. System overview">
            <p><strong>CORTA QC</strong> is a manufacturing Quality Management System (QMS) integrated with shop-floor execution (MES). It covers the full quality lifecycle: planning (Inspection & Test Plans), execution (inspections with measurements), detection (non-conformances, holds, SPC signals), correction (corrective actions, CAPA, supplier SCARs) and verification (reports, KPIs, audit trail).</p>
            <p>It supports compliance profiles (e.g. <strong>AS/EN/JISQ 9100 Aerospace</strong>, ISO 9001, food safety) selectable from the top bar, which adjust terminology and gate strictness.</p>
            <Flow steps={["Plan (ITP)", "Work Order", "Inspect", "Detect NC / Hold", "Disposition", "CAPA", "Verify & Close", "Report"]} />
          </Sec>

          <Sec id="architecture" title="2. Architecture">
            <ul>
              <li><strong>Frontend:</strong> React 19, TanStack Router/Query, Tailwind v4, shadcn/ui, Recharts, jsPDF.</li>
              <li><strong>Backend:</strong> managed PostgreSQL with Auth, Storage and Row-Level Security (RLS). Business rules live in the database as triggers and functions so they are enforced regardless of client.</li>
              <li><strong>Scheduling:</strong> <code>pg_cron</code> runs daily escalations (<code>run_overdue_escalations()</code>) with results logged in <code>cron_run_log</code>.</li>
              <li><strong>Notifications:</strong> database functions <code>notify()</code> / <code>notify_role()</code> push in-app alerts (bell icon in the header).</li>
              <li><strong>Search:</strong> global ⌘K / Ctrl+K palette across products, work orders, inspections, NCs, CAPAs.</li>
            </ul>
          </Sec>

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
          </Sec>

          <Sec id="login" title="4. Sign-in">
            <p>Users sign in with email and password. Accounts are created by an administrator (self sign-up and password reset are disabled on the login screen). Accidental spaces and auto-capitalisation are stripped. After sign-in the user is forwarded to the Control Center.</p>
            <Shot name="login" caption="Sign-in screen" />
          </Sec>

          <Sec id="dashboard" title="5. Control Center (Dashboard)">
            <p>Live QMS overview: KPI tiles (30-day pass rate, inspections today, open NCs, overdue CAs, quality holds), 14-day pass-rate trend, overall pass gauge, latest work orders and the NC feed. Quick actions: <strong>New Inspection</strong> and <strong>Raise NC</strong>.</p>
            <Shot name="dashboard" caption="Control Center" />
          </Sec>

          <Sec id="live" title="6. Live Floor">
            <p>Real-time WIP view of active work orders per line/station, the live inspection queue and hold alerts. Data refreshes automatically.</p>
            <Shot name="live" caption="Live Floor" />
          </Sec>

          <Sec id="work-orders" title="7. Work Orders">
            <p>Every work order must reference a product, lot number, line and planned quantity (minimum 1; planned end must be after start).</p>
            <Flow steps={["planned", "released", "in_progress", "completed", "closed"]} />
            <p>Any status can move to <code>on_hold</code> when a quality hold is opened on the WO or lot. The detail page shows operations, linked inspections, NCs and holds.</p>
            <Shot name="work-orders" caption="Work order list" />
            <Shot name="work-order-detail" caption="Work order detail with linked quality records" />
          </Sec>

          <Sec id="requests" title="8. Requests">
            <p>Intake for new product / specification requests. Requests move through submitted → under review → approved / rejected, with tabs, pagination, search and CSV export.</p>
            <Shot name="requests" caption="Requests" />
          </Sec>

          <Sec id="plans" title="9. Inspection Plans (ITP)">
            <p>Plans define <strong>what</strong> to check, <strong>how</strong> (method: dimensional, visual, NDT, functional) and <strong>acceptance criteria</strong>. Plan types: incoming, in-process, final. Each characteristic can be flagged as a <strong>Hold</strong>, <strong>Witness</strong> or <strong>Review</strong> point.</p>
            <Flow steps={["Draft", "Add characteristics", "Approve (e-signature)", "Frozen revision", "New revision"]} />
            <p>Once approved via <code>approve_inspection_plan</code>, characteristics are frozen by the trigger <code>trg_plan_char_frozen</code>; changes require <code>new_plan_revision</code>, preserving history.</p>
            <Shot name="inspection-plans" caption="Inspection plan library" />
          </Sec>

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
          </Sec>

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
          </Sec>

          <Sec id="ca" title="12. Corrective Actions">
            <p>Individual action items with owner, due date and verification. Overdue actions escalate automatically at 7 / 14 / 30 days (L1 / L2 / L3).</p>
            <Flow steps={["open", "in_progress", "implemented", "verified", "closed"]} />
            <Shot name="corrective-actions" caption="Corrective actions" />
          </Sec>

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
          </Sec>

          <Sec id="holds" title="14. Quality Holds">
            <p>Holds quarantine a lot or work order. Every status and quantity change is logged by <code>log_hold_status</code>.</p>
            <Flow steps={["open", "under_review", "disposition", "released / rework / scrapped / returned"]} />
            <Shot name="holds" caption="Quality holds" />
          </Sec>

          <Sec id="spc" title="15. SPC / Control Charts">
            <p>X̄/R charts built from inspection subgroups with UCL/LCL, Cp/Cpk. <code>evaluate_spc_signals</code> applies <strong>Nelson rules 1–8</strong> (point beyond 3σ, 9 on one side, 6 trending, 14 alternating, 2 of 3 beyond 2σ, 4 of 5 beyond 1σ, 15 within 1σ, 8 outside 1σ). Control limits are locked once established (<code>trg_spc_limits_lock</code>).</p>
            <Shot name="spc" caption="SPC (charts appear as samples are recorded)" />
          </Sec>

          <Sec id="calibration" title="16. Calibration & MSA">
            <p>Gage registry with status active / due / overdue / out_of_service. Calibration records store result, certificate and next due date. A failed calibration triggers an <strong>out-of-tolerance (OOT)</strong> impact review listing measurements taken with that gage (<code>enforce_cal_oot</code>). MSA studies (Gage R&R, linearity, bias) are kept per gage.</p>
            <Flow steps={["Register gage", "Calibrate", "Pass → next due", "Fail → OOT review → affected inspections"]} />
            <Shot name="calibration" caption="Gage registry" />
          </Sec>

          <Sec id="incoming" title="17. Incoming Inspection">
            <p>Receiving inspection of supplier lots. The built-in <strong>ISO 2859-1</strong> sampling calculator (<code>iso_2859_1_sample</code>) returns code letter, sample size and Ac/Re (e.g. lot 500, AQL 1.0 → H, n=50, Ac 1 / Re 2).</p>
            <Flow steps={["Receive lot", "Sample (ISO 2859-1)", "Inspect", "Accept / Reject → SCAR"]} />
            <Shot name="incoming" caption="Incoming lots" />
            <Shot name="suppliers" caption="Suppliers" />
          </Sec>

          <Sec id="scars" title="18. Supplier SCARs">
            <p>Supplier Corrective Action Requests are auto-numbered, routed to the quality manager role, and tracked through issued → supplier response → verified → closed.</p>
            <Shot name="supplier-scars" caption="Supplier SCARs" />
          </Sec>

          <Sec id="complaints" title="19. Customer Complaints">
            <p>Auto-numbered complaint register with severity, product/lot traceability and link to NC/CAPA. New complaints notify the responsible roles.</p>
            <Shot name="complaints" caption="Customer complaints" />
          </Sec>

          <Sec id="master" title="20. Master data">
            <p>Products (with versioned quality specifications), production lines and stations. A specification version increments automatically on save.</p>
            <Shot name="products" caption="Products" />
            <Shot name="lines" caption="Production lines" />
            <Shot name="stations" caption="Stations" />
          </Sec>

          <Sec id="reports" title="21. Reports & exports">
            <p>Inspection and NC dashboards with filters (stage, method, date, severity), KPI tiles from <code>qms_kpi_summary</code>, and an acceptance-criteria verification view grouping execution results and NCRs. All tables support 25/50/100/200 rows per page, search, dynamic filters and CSV export; reports export to PDF (exports are audit-logged).</p>
            <Shot name="reports" caption="Reports" />
          </Sec>

          <Sec id="admin" title="22. Administration & audit">
            <p>User management, role assignment, units, severities and system settings. The audit log records every create/update/delete with user, timestamp and before/after values, filterable by entity, action and date range with CSV export.</p>
            <Shot name="admin" caption="Administration" />
            <Shot name="audit" caption="Audit log" />
          </Sec>

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
          </Sec>

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
          </Sec>

          <Sec id="deployment" title="25. Deployment">
            <p>The application ships with a <code>Dockerfile</code> and <code>docker-compose.yml</code> (port 8120). Allowed hosts include <code>qms.cortanexai.com</code> and <code>qms.manuqube.com</code>.</p>
            <pre className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-4 font-mono text-xs text-foreground">{`docker compose up -d --build
# open http://<server>:8120/docs`}</pre>
            <p>This documentation page is public (no sign-in) at <code>/docs</code>. Screenshots are bundled with the app under <code>/doc-images/</code>, so they display on any server hosting the app with no external dependency.</p>
          </Sec>
        </main>
      </div>
    </div>
  );
}
