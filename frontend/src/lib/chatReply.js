const TOPICS = [
  {
    test: /investigat/,
    answer: "Investigations follow five steps: Evidence, AI Summary, Cross-Reference, AI Analyst, and Decision. Open Investigations in the sidebar for a case, or Overall Business Investigation for cross-department findings. A finding stays tied to an ingested report. Mark it Investigated or Resolved there.",
  },
  {
    test: /alert|risk scor/,
    answer: "Alerts list flagged activity with a risk level and status. Open Alerts in the sidebar to review them. Risk labels come from the recorded transaction or report. I will only quote a count or amount after those records load.",
  },
  {
    test: /ingest|upload|csv|excel|pdf/,
    answer: "Data ingestion accepts CSV, Excel, PDF, Word, and images. In the command center, a submitted department report stays locked until you review it and choose Ingest Data. Analysis uses ingested records only.",
  },
  {
    test: /procurement|variance|market price/,
    answer: "Procurement variance compares a quoted unit price with a public listing. A market price is kept only when that page is fetched and the same amount is printed on it. Open Procurement Variance to review those lines.",
  },
  {
    test: /command center|oversight|department/,
    answer: "The Super Admin Command Center is under Oversight. The tabs are HR, Procurement, Restaurant, Accountant, Audit, Operations, Front Desk, Maintenance, and Overall Business Investigation. Department users only see their own form.",
  },
  {
    test: /quickbooks|ezee|burrp|pos|connector/,
    answer: "POS connectors cover QuickBooks and eZee Burrp. You can sync from the cloud connection or upload a file manually from Data Ingestion.",
  },
  {
    test: /compliance|financial impact/,
    answer: "Compliance notes stay attached to the investigation. A financial impact figure is the recorded transaction amount only. I will not estimate exposure that is not on the record.",
  },
];

export function replyFromPlatform(userText) {
  const q = String(userText || "").trim().toLowerCase();
  if (!q) return "Ask about investigations, alerts, ingestion, or procurement, or ask me to list the records that are loaded.";
  if (/^(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(q)) {
    return "Hello. I can help with investigations, alerts, data ingestion, procurement checks, and the command center. Ask how one of those works, or ask me to list alerts, transactions, or open investigations.";
  }
  const topic = TOPICS.find((item) => item.test.test(q));
  if (topic) return topic.answer;
  return "I answer from the RAVIQEN product and from records that are loaded. Ask how investigations, alerts, ingestion, or procurement variance work, or ask me to list flagged alerts. I will not invent transactions or amounts.";
}
