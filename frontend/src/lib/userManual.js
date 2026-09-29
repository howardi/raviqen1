import { jsPDF } from "jspdf";
import { buildDocxBlob } from "@/lib/docxBuilder";

// Comprehensive step-by-step organization user manual for the RAVIQEN platform.
// Builds a multi-page document in-memory and triggers a browser download.
// Supports two formats: PDF (jsPDF) and Word (.doc via Word-compatible HTML).

const PRIMARY = [35, 31, 32]; // #231F20
const MUTED = [100, 116, 139]; // slate-500
const ACCENT = [20, 164, 142]; // teal
const BODY_COLOR = [51, 51, 51];

// Shared manual content — used by both the PDF and Word generators so the two
// documents always stay in sync.
export const MANUAL_SECTIONS = [
  {
    title: "1. Getting Started",
    intro:
      "RAVIQEN is an AI-powered risk and compliance intelligence platform that helps your organization detect, investigate, and remediate financial and operational risk. This section walks you through every step of signing in for the first time, recovering access, and completing initial setup so you can begin using the platform confidently.",
    steps: [
      "Open the RAVIQEN app URL in your browser. If you are a new visitor, the landing page describes the platform's capabilities, pricing, and solutions; click Login (top right) or the Get Started button to begin the sign-in flow.",
      "On the Login page, enter your registered work email and password, then click Sign In. If your administrator enabled Google sign-in, you can use the Continue with Google button to authenticate without typing a password.",
      "If you do not yet have an account, click the Register link on the login page, enter your email and a secure password, and complete the multi-step registration (email verification OTP). Your administrator must then assign you a role before you can access the full platform.",
      "If you forgot your password, click the Forgot Password link, enter your email, and follow the reset link sent to your inbox to set a new password. The link expires after a short window for security; request a new one if it has lapsed.",
      "First-time users may be prompted to set a new password (if an administrator created the account with a temporary password) or to complete the guided onboarding wizard. Follow each on-screen step to configure your organization profile, default currency, and notification preferences.",
      "After signing in you land on your role-based home page. Administrators see the full Dashboard with organization-wide metrics; other roles (Analyst, Reviewer, Compliance Officer, etc.) see the modules their administrator assigned to that role.",
      "Use the sidebar on the left to navigate between modules. Press Cmd/Ctrl+K (or click the Search field) to open the global search palette and jump to any page quickly by typing part of its name.",
      "Use the theme toggle (moon/sun icon at the bottom of the sidebar) to switch between light and dark mode; your choice is remembered on this device.",
      "To sign out, click the arrow icon next to your profile at the bottom of the sidebar. Always sign out from shared or public computers.",
    ],
    tip: "If you are an administrator, your first task after onboarding is to invite your team members and assign each person a role from the User Management page so they can access the right modules.",
  },
  {
    title: "2. Dashboard",
    intro:
      "The Dashboard is your risk health command center. It summarizes total exposure, open alerts, anomalies, and AI-generated briefings in one view, and lets you drill into any metric for detail.",
    steps: [
      "Review the greeting header which shows the current local time, weather for your location, and your role scope (organization-wide for admins, scoped for other roles).",
      "Use the time-range selector (7 Days, 30 Days, 90 Days, All Time) to filter every metric, chart, and list on the page to that period. The selection is applied instantly.",
      "Use the currency selector to convert all monetary values (exposure, amounts) into your preferred display currency using live exchange rates.",
      "Read the AI Risk Briefing card for a plain-language summary of your current risk posture and a recommended next action; click Regenerate to refresh the analysis with the latest data.",
      "Check the Critical Action Required panel for high-risk flagged transactions; click Investigate to open a new investigation pre-filled with the transaction, or Delete to remove a record you have confirmed is not needed.",
      "Review the four stat cards: Total Exposure (sum of flagged transaction amounts), Open Alerts, Average Risk Score across transactions, and Transactions Monitored for the selected period.",
      "Inspect the Risk Activity Trend chart, which shows flagged versus clean transactions over time with a dotted predictive forecast for the next period.",
      "Read the Risk Health ring for a composite risk score, the Anomaly Detection panel for unusual patterns, and the Risk Factors breakdown for the top contributors to your risk score.",
      "Open the Priority Alerts list and click any alert to investigate it; use Risk by Category to see where exposure concentrates across your transaction categories.",
      "The Data Integrity Verification badge confirms that the numbers shown match a fresh recomputation from source records; click Re-validate to re-run the independent check at any time.",
      "Use the Quick Actions row to jump straight to common workflows: ingest data, open an investigation, view alerts, run a scan, or export a report.",
    ],
    tip: "If the Dashboard shows an empty state with an Ingest Data prompt, you have no transactions yet. Click Ingest Data to upload your first dataset — every metric on this page populates automatically once data exists.",
  },
  {
    title: "3. Data Ingestion",
    intro:
      "Data Ingestion is how transaction records enter RAVIQEN. You can upload files manually or connect a live POS or accounting source. Every upload is scanned, validated, and risk-scored automatically by the autonomous engine.",
    steps: [
      "Open Data Ingestion from the sidebar.",
      "Choose your data source, then drag and drop a CSV, Excel, or JSON file into the upload zone (or click the zone to browse your computer). The file must contain at minimum a transaction ID, vendor name, and amount.",
      "The autonomous scanner runs automatically the moment a file is uploaded: it reads each record, flags anomalies, quarantines suspicious rows, resolves or creates entity profiles, and generates alerts for high-risk items.",
      "Watch the scan progress indicator; when complete, review the batch summary showing total records, valid records, flagged records, quarantined records, alerts generated, and cases opened.",
      "Use the search and filter controls to find past batches by date, source, or status; select one or more batches to delete them in bulk if they were uploaded in error.",
      "To connect a live POS or accounting source (for example QuickBooks or eZee Burrp), use the POS Connectors section to set up an integration. Once connected, RAVIQEN can pull data on a schedule.",
      "Every ingestion batch is stamped with a batch ID you can reference from investigations and screening results for full traceability.",
    ],
    tip: "Always review the quarantined records after a large upload — these are the rows the engine could not validate and may need manual correction before they enter your workspace.",
  },
  {
    title: "4. Screening Engine",
    intro:
      "The Screening Engine reviews ingested records against sanctions, PEP, and risk lists before they enter your workspace. It is your first line of defense against doing business with prohibited or high-risk parties.",
    steps: [
      "Open Screening Engine from the sidebar.",
      "Upload a file or select an existing batch to run through the screening pipeline.",
      "Review per-record screening results in the results table: matches, discrepancies, and not-found statuses are listed with the matched list and a confidence indicator.",
      "Click any record to inspect the full screening detail, including the matched lists, the source data that was screened, and the exact field that triggered the match.",
      "Resolve discrepancies by updating the record (correcting a typo, for example) or escalating it to an investigation if the match looks genuine.",
      "Records that screen clear are released into your workspace; records that match a sanctions or PEP list are held for review and never auto-approve.",
    ],
    tip: "A partial match is not a confirmed hit — it often means a name is similar to a listed entity. Open the detail view and compare identifiers (date of birth, nationality, tax ID) before deciding.",
  },
  {
    title: "5. Alerts",
    intro:
      "Alerts surface flagged transactions that need attention, ranked by risk score. They are generated automatically by the risk rules engine and the autonomous scanner, and can also be created manually.",
    steps: [
      "Open Alerts from the sidebar to see all generated alerts, newest first.",
      "Use the risk-level (low, medium, high, critical) and status (open, investigating, resolved, dismissed) filters to narrow the list to what you need to work on.",
      "Click an alert to view its full detail and open a linked investigation if one exists; if not, you can start one from the alert.",
      "Use the remediation menu on each alert to take immediate action: freeze a transaction, suspend a vendor, deploy a KYB questionnaire, or escalate the case.",
      "Change an alert's status as you work through it — open when first raised, investigating while you review, resolved once closed, or dismissed if it was a false positive.",
      "High and critical alerts also appear in the notification bell at the top of the sidebar so you never miss an urgent item.",
    ],
    tip: "Dismiss an alert only after you have documented why it is a false positive in the linked investigation. A dismissed alert without a reason cannot be audited later.",
  },
  {
    title: "6. Investigations & Case Management",
    intro:
      "Investigations follow a guided 5-step wizard that builds an evidence-backed case file from start to finish. Each step feeds the next, and the AI analyst layers in grounded explanations, recommendations, and similar-case detection.",
    steps: [
      "From an alert or the Investigations page, click New Investigation or Investigate to open the wizard with the transaction and vendor pre-filled.",
      "Step 1 — Evidence: add the transaction, vendor, and your initial notes. Attach any supporting documents here.",
      "Step 2 — Cross-Reference: pull matching records from connected sources (QuickBooks, POS, inventory) to confirm the transaction details against independent records.",
      "Step 3 — AI Analyst: generate a grounded explanation of why the transaction was flagged, a list of recommended actions, and detection of similar past cases.",
      "Step 4 — Decision: record the outcome — confirmed anomaly, false positive, process error, or escalated — and add any final notes.",
      "Step 5 — Summary: review the AI-generated executive summary and conclusion, then export the final report as a PDF for filing or archival.",
      "Switch between List and Kanban views on the Investigations page to manage cases by status; the Kanban view lets you drag cases between columns as they progress.",
      "Use Case Management to group related investigations together and track them as a single case file, which is useful when one vendor spans multiple suspicious transactions.",
    ],
    tip: "You can save and leave an investigation at any step — the wizard preserves your progress. Come back later from the Investigations list and resume exactly where you stopped.",
  },
  {
    title: "7. Entity Intelligence",
    intro:
      "Entity Profiles consolidate everything RAVIQEN knows about a vendor or counterparty into one record: baseline behavior, transaction ledger, linked counterparties, shared identifiers, and screening status.",
    steps: [
      "Open Entity Intelligence to browse all entity profiles, sorted by risk score.",
      "Click a profile to see its baseline risk tag, full ledger of transactions, linked counterparties, and any shared identifiers (bank accounts, tax IDs, addresses) with other entities.",
      "Review the sanctions and PEP checks, the collusion probability score, and the active anomaly flags that contributed to the current risk level.",
      "Use the network graph to visualize relationships between entities; shared identifiers appear as connecting edges.",
      "Merge duplicate profiles using the merge dialog when the same vendor appears under multiple records (for example, slight name variations). Merging preserves all transaction history.",
      "Each profile shows a risk trend over time so you can see whether a vendor's risk is improving or worsening.",
    ],
    tip: "A blacklisted profile is blocked from receiving payments automatically. Review the evidence in the profile before lifting a blacklist, and record the reason in the case file.",
  },
  {
    title: "8. Autonomous Engine",
    intro:
      "The Autonomous Engine continuously scans ingested data and opens cases automatically. It runs after every ingestion and can also be triggered manually for an immediate re-scan.",
    steps: [
      "Open Autonomous Engine to view recent scans and engine statistics (records scanned, alerts generated, cases opened).",
      "Review each scan's record counts, discrepancies found, alerts generated, and cases opened or updated.",
      "Click a scan to open its case briefing and review the AI summary of what the engine found and why it acted.",
      "Trigger a manual scan from the Data Ingestion page if you need an immediate re-scan after a rule change or a new data source connection.",
      "The engine respects your risk rules: any rule you enable in the Risk Rules Engine is applied during every scan.",
    ],
    tip: "If the engine opens a case you believe is incorrect, review the cited signals in the case briefing — they show exactly which rule or anomaly triggered the automatic case.",
  },
  {
    title: "9. Sanctions Screening",
    intro:
      "Screen vendors and individuals against global sanctions and PEP (Politically Exposed Persons) lists before onboarding them or approving payments.",
    steps: [
      "Open Sanctions Screening from the sidebar.",
      "Enter the entity name and any identifiers you have (registration number, country, date of birth for individuals).",
      "Run the screening and review match results: clear, match, or partial match, with the cited list source and a confidence score.",
      "Escalate any match to an investigation to build a full case file, or mark it as a false positive after documenting why the match is not the listed entity.",
      "Screening results are saved to the entity profile so you have a permanent audit trail of every check.",
    ],
    tip: "Screen a vendor before you onboard them, not just when a payment is flagged. Early screening prevents risky relationships from forming in the first place.",
  },
  {
    title: "10. Network Explorer",
    intro:
      "Network Explorer visualizes relationships and shared identifiers across your entity graph so you can spot collusion, shell-company networks, and hidden links between vendors.",
    steps: [
      "Open Network Explorer to render the interactive graph of all your entities and their connections.",
      "Click any node to inspect its profile and its linked counterparties in the side panel.",
      "Use the filter controls to highlight specific shared identifiers — shared bank accounts, tax IDs, or addresses — to surface entities that look unrelated but share infrastructure.",
      "Adjust the layout and zoom to focus on a cluster of interest.",
      "Export the current view as an image for inclusion in investigation reports or regulatory filings.",
    ],
    tip: "Two vendors sharing a bank account is a strong collusion signal. Trace the shared identifier in the graph and open a collusion-detection case from the linked profiles.",
  },
  {
    title: "11. Analytics & Insights",
    intro:
      "Analytics turns your data into trends, distributions, and conversational queries. Use it to answer business questions in plain language without building a report from scratch.",
    steps: [
      "Open Analytics / Insights to view trend and distribution charts across your transactions and alerts.",
      "Adjust the time range and category filters to focus the analysis on a specific period or segment.",
      "Use the conversational analytics box to ask plain-language questions about your data, such as 'Which vendor had the most flagged transactions last month?'",
      "Export any chart as an image for a presentation, or add it to a scheduled report so it refreshes automatically.",
      "Use the insights to brief leadership or to decide where to tighten risk rules.",
    ],
    tip: "If a conversational query returns no result, rephrase it with a specific time period and a specific metric — the assistant works best with concrete questions.",
  },
  {
    title: "12. Risk Rules Engine",
    intro:
      "Define custom rules that automatically flag transactions matching your criteria. Rules run on every new and re-scanned transaction, so you can encode your organization's specific risk policy.",
    steps: [
      "Open Risk Rules Engine from the sidebar to see all rules, their priority, and how many times each has triggered.",
      "Click New Rule and set the field, operator, threshold, and the resulting action (flag, quarantine, alert).",
      "Enable or disable rules with the toggle; disabled rules stop triggering immediately but keep their history.",
      "Use the AI Suggest button to generate candidate rules from recent anomalies the engine detected — a fast way to codify a new fraud pattern.",
      "Click Test Rule to evaluate a rule against recent transactions and preview exactly which records it would match before you enable it.",
      "Order rules by priority so the most important checks run first; a transaction can trigger multiple rules.",
    ],
    tip: "Start with a narrow rule and widen it after testing. A rule that is too broad floods your alerts with false positives and erodes trust in the engine.",
  },
  {
    title: "13. Autonomous Intelligence Modules",
    intro:
      "Advanced AI modules for specialized risk scenarios. Each module focuses on one risk type and produces a structured, exportable result.",
    steps: [
      "Collusion Detector: identify coordinated activity between vendors using shared identifiers and transaction timing patterns.",
      "What-If Sandbox: simulate rule changes and threshold adjustments to predict their impact before you apply them for real.",
      "Insider Threat: monitor user sessions and bulk exports for suspicious behavior, such as unusual download volume or after-hours access.",
      "Crypto Audit: review crypto-asset transaction reports and audit trails for flagged wallets.",
      "OSINT Scanner: gather open-source intelligence on a target entity or individual from public records and news.",
      "Vendor Verification: run KYB questionnaires and document checks on vendors before onboarding them.",
      "FX Stress Test: model currency exposure under shock scenarios to see how exchange-rate moves would affect your exposure.",
      "Regulatory Horizon: track upcoming regulatory changes and their business impact so you can prepare in advance.",
    ],
    tip: "These modules are most powerful when used together — for example, run OSINT on a vendor flagged by the Collusion Detector to build a richer case file.",
  },
  {
    title: "14. Workforce & Operations",
    intro:
      "Manage daily operational reporting and HR data. These modules keep your operational and people data as governed as your financial data.",
    steps: [
      "Daily Reports: submit and review daily departmental reports. Reviewers can comment, flag, or archive submitted reports, and submitters see reviewer feedback inline.",
      "HR Dashboard: manage employees, attendance, payroll, background checks, and HR alerts. This module requires administrator access.",
      "Upload employee and attendance files in the HR Dashboard; the engine computes payroll, applies late and absence deductions, and flags payroll anomalies automatically.",
      "Background checks can be initiated from an employee profile and linked back to that profile for a complete record.",
      "HR alerts surface issues like unusual overtime, attendance anomalies, or payroll discrepancies for review.",
    ],
    tip: "Payroll anomalies are often the first sign of buddy-punching or ghost employees. Review every flagged payroll record before approving disbursement.",
  },
  {
    title: "15. Utilities & Planning",
    intro:
      "Planning tools for resource coordination, useful for organizations that manage field operations or relief efforts.",
    steps: [
      "Calendar: schedule and track relief efforts, volunteer dispatches, supply deliveries, and coordination meetings. Each event can carry a location, priority, and assigned team.",
      "Resource Calculator: estimate the required resources — volunteers, supplies, and budget — for a planned effort based on the population affected and the duration.",
      "Link calendar events to the Resource Calculator to keep planning and scheduling in one place.",
    ],
    tip: "Set the priority on calendar events so the most critical efforts surface first in your team's daily view.",
  },
  {
    title: "16. Reports & Exports",
    intro:
      "Generate and export regulatory and investigative reports. Reports follow a standardized template so every filing looks consistent and complete.",
    steps: [
      "Open Reports & Exports to browse report templates.",
      "Choose a report type — SAR (Suspicious Activity Report), STR (Suspicious Transaction Report), CTR (Currency Transaction Report), or an investigation summary — and generate it.",
      "Export reports as PDF for filing or archival; the export includes the full narrative, evidence, and cited signals.",
      "Use the Regulatory Reports page to manage draft, submitted, and archived filings and their deadlines so you never miss a filing window.",
      "Link a report to the investigation it came from so reviewers can trace a filing back to its source evidence.",
    ],
    tip: "File a report as a draft first and have a second reviewer approve it before submission. Two pairs of eyes catch errors before a filing becomes a matter of record.",
  },
  {
    title: "17. Administration",
    intro:
      "Administer your organization, users, integrations, and platform settings. Admin modules are restricted to administrator accounts.",
    steps: [
      "Integrations: connect external data sources (POS, accounting) and review the status of each connector.",
      "Settings: update your company profile, notification preferences, access control, backup and restore, and the danger zone (factory reset).",
      "Organizations: create and manage organizations and assign members to each one for multi-tenant isolation.",
      "User Management: invite users by email, assign each a role, activate pending accounts, and reset passwords. The role you assign controls which modules that user can access.",
      "Onboarding: review and approve onboarding requests submitted by new users who registered on their own.",
      "Team / Users: view your team members and their roles in one list.",
      "Audit Log: review the full trail of user actions across the platform — who did what, when, and from which IP. The log is read-only and tamper-evident.",
    ],
    tip: "Assign the narrowest role that lets each person do their job. A user who only needs to investigate does not need admin access to settings or user management.",
  },
  {
    title: "18. Technical Support & AI Chatbox",
    intro:
      "Get help and ask the AI assistant questions about your data and the platform.",
    steps: [
      "Technical Support: submit a support ticket with a subject, category, priority, and description. Track its status and any response from the support team in the same page.",
      "AI Chatbox: ask the assistant plain-language questions about risk, compliance, and your data. It responds in a friendly, professional tone and does not use markdown formatting, so answers read like a conversation.",
      "For urgent issues that block your work, submit a high-priority support ticket and also contact your organization administrator so they can escalate.",
      "Check the audit log if you suspect an issue was caused by a specific user action — it often pinpoints the source of a problem.",
    ],
    tip: "When submitting a support ticket, include the transaction ID or investigation ID and the exact steps you took. The more context you provide, the faster support can resolve it.",
  },
];

// ---------------------------------------------------------------------------
// PDF generator (jsPDF)
// ---------------------------------------------------------------------------

// Line heights tuned to the font sizes below so blocks never overlap.
const BODY_LH = 13;   // 10pt body text
const SECTION_LH = 18; // 13pt section heading
const TIP_LH = 12;    // 9pt tip text

function section(doc, title, y) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
  const lines = doc.splitTextToSize(title, doc.internal.pageSize.getWidth() - 2 * 72);
  lines.forEach((line) => {
    y = ensureSpace(doc, y, SECTION_LH);
    doc.text(line, 72, y);
    y += SECTION_LH;
  });
  return y + 4;
}

function body(doc, text, y) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(BODY_COLOR[0], BODY_COLOR[1], BODY_COLOR[2]);
  const lines = doc.splitTextToSize(text, doc.internal.pageSize.getWidth() - 2 * 72);
  lines.forEach((line) => {
    y = ensureSpace(doc, y, BODY_LH);
    doc.text(line, 72, y);
    y += BODY_LH;
  });
  return y + 4;
}

function steps(doc, list, y) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(BODY_COLOR[0], BODY_COLOR[1], BODY_COLOR[2]);
  list.forEach((step, i) => {
    const lines = doc.splitTextToSize(`${i + 1}. ${step}`, doc.internal.pageSize.getWidth() - 2 * 72 - 12);
    lines.forEach((line) => {
      y = ensureSpace(doc, y, BODY_LH);
      doc.text(line, 84, y);
      y += BODY_LH;
    });
    y += 3; // small gap between numbered items
  });
  return y + 2;
}

function tip(doc, text, y) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const lines = doc.splitTextToSize(text, doc.internal.pageSize.getWidth() - 2 * 72 - 40);
  const boxH = Math.max(24, lines.length * TIP_LH + 10);
  y = ensureSpace(doc, y, boxH + 4);
  const boxTop = y;
  doc.setFillColor(240, 253, 250); // teal-50
  doc.roundedRect(72, boxTop, doc.internal.pageSize.getWidth() - 2 * 72, boxH, 4, 4, "F");
  doc.setFont("helvetica", "bold");
  doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  doc.text("TIP", 80, boxTop + TIP_LH);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(BODY_COLOR[0], BODY_COLOR[1], BODY_COLOR[2]);
  let ty = boxTop + TIP_LH;
  lines.forEach((line) => {
    doc.text(line, 104, ty);
    ty += TIP_LH;
  });
  return boxTop + boxH + 6;
}

function ensureSpace(doc, y, needed = 30) {
  if (y > doc.internal.pageSize.getHeight() - 72 - needed) {
    doc.addPage();
    return 72;
  }
  return y;
}

const WATERMARK_LOGO_URL = "https://media.base44.com/images/public/6a90b256868de35f9bd5d6b1/b8d19ea41_logorav.png";

// Loads the logo PNG as a base64 data URL (used by the PDF watermark).
async function getWatermarkImageDataUrl() {
  try {
    const res = await fetch(WATERMARK_LOGO_URL);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    return null;
  }
}

// Fetches the raw logo PNG bytes for the .docx watermark. Opacity is applied
// inside the document via a DrawingML alpha modifier, so no canvas fading is
// needed — this keeps the watermark rendering reliably across Word and Pages.
async function getWatermarkBytes() {
  try {
    const res = await fetch(WATERMARK_LOGO_URL);
    const blob = await res.blob();
    return new Uint8Array(await blob.arrayBuffer());
  } catch (e) {
    return null;
  }
}

// Stamps the RAVIQEN logo centered on every page at low opacity.
async function addWatermark(doc) {
  const imgData = await getWatermarkImageDataUrl();
  if (!imgData) return;
  const pageCount = doc.internal.getNumberOfPages();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const imgW = pageW * 0.4;
  const imgH = imgW; // square logo
  const x = (pageW - imgW) / 2;
  const y = (pageH - imgH) / 2;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: 0.25 }));
    doc.addImage(imgData, "PNG", x, y, imgW, imgH, undefined, "FAST");
    doc.restoreGraphicsState();
  }
}

export async function buildUserManualPdf() {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  let y = 72;

  // Cover
  doc.setFillColor(10, 12, 16);
  doc.rect(0, 0, pageW, pageH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(30);
  doc.setTextColor(255, 255, 255);
  doc.text("RAVIQEN", pageW / 2, 220, { align: "center" });
  doc.setFontSize(16);
  doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  doc.text("Organization User Manual", pageW / 2, 250, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(180, 180, 180);
  doc.text("A step-by-step guide to using the RAVIQEN", pageW / 2, 290, { align: "center" });
  doc.text("Risk & Compliance Intelligence Platform", pageW / 2, 308, { align: "center" });
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(`Version 2.0  ·  ${new Date().toLocaleDateString()}`, pageW / 2, pageH - 72, { align: "center" });

  doc.addPage();
  doc.setFillColor(255, 255, 255);
  y = 72;

  // Table of contents
  y = section(doc, "Table of Contents", y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(BODY_COLOR[0], BODY_COLOR[1], BODY_COLOR[2]);
  MANUAL_SECTIONS.forEach((s) => {
    y = ensureSpace(doc, y, 16);
    doc.text(s.title, 72, y);
    y += 16;
  });

  // Sections
  MANUAL_SECTIONS.forEach((s) => {
    doc.addPage();
    y = 72;
    y = section(doc, s.title, y);
    y = body(doc, s.intro, y);
    y += 4;
    y = steps(doc, s.steps, y);
    if (s.tip) {
      y += 4;
      y = tip(doc, s.tip, y);
    }
  });

  // Closing page
  doc.addPage();
  y = 72;
  y = section(doc, "Need More Help?", y);
  y = body(
    doc,
    "If you encounter an issue not covered in this manual, submit a ticket via the Technical Support page or contact your organization administrator. RAVIQEN is continuously improved — check back for updated versions of this manual.",
    y
  );
  y += 10;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("RAVIQEN — Build trust first. Investigate with evidence. Remediate with confidence.", 72, y);

  await addWatermark(doc);
  doc.save("RAVIQEN-User-Manual.pdf");
}

// ---------------------------------------------------------------------------
// Word generator (.docx — Office Open XML)
// ---------------------------------------------------------------------------

export async function buildUserManualWord() {
  const today = new Date().toLocaleDateString();

  const content = [
    { type: "spacer" },
    { type: "spacer" },
    { type: "spacer" },
    { type: "title", text: "RAVIQEN" },
    { type: "subtitle", text: "Organization User Manual" },
    { type: "body", text: "A step-by-step guide to using the RAVIQEN Risk & Compliance Intelligence Platform" },
    { type: "muted", text: `Version 2.0 · ${today}` },
    { type: "spacer" },
    { type: "heading", text: "Table of Contents" },
    { type: "bullets", items: MANUAL_SECTIONS.map((s) => s.title) },
    { type: "spacer" },
  ];

  MANUAL_SECTIONS.forEach((s) => {
    content.push({ type: "heading", text: s.title });
    content.push({ type: "body", text: s.intro });
    content.push({ type: "list", items: s.steps });
    if (s.tip) content.push({ type: "tip", text: s.tip });
    content.push({ type: "spacer" });
  });

  content.push({ type: "heading", text: "Need More Help?" });
  content.push({
    type: "body",
    text: "If you encounter an issue not covered in this manual, submit a ticket via the Technical Support page or contact your organization administrator. RAVIQEN is continuously improved — check back for updated versions of this manual.",
  });
  content.push({
    type: "muted",
    text: "RAVIQEN — Build trust first. Investigate with evidence. Remediate with confidence.",
  });

  const watermarkBytes = await getWatermarkBytes();
  const blob = buildDocxBlob(content, watermarkBytes);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "RAVIQEN-User-Manual.docx";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}