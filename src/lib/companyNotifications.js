import { base44 } from "@/api/base44Client";

// Fetch the company's notification email from the CompanyProfile entity
export const getCompanyNotificationEmail = async () => {
  try {
    const profiles = await base44.entities.CompanyProfile.list("-created_date", 1);
    return profiles[0]?.notification_email || null;
  } catch (e) {
    return null;
  }
};

// Fetch the full company profile
export const getCompanyProfile = async () => {
  try {
    const profiles = await base44.entities.CompanyProfile.list("-created_date", 1);
    return profiles[0] || null;
  } catch (e) {
    return null;
  }
};

// Send a notification email to the company's configured notification address
// Returns true if sent, false if no email configured or send failed
export const sendCompanyNotification = async (subject, body) => {
  const email = await getCompanyNotificationEmail();
  if (!email) return false;
  try {
    await base44.integrations.Core.SendEmail({ to: email, subject, body });
    return true;
  } catch (e) {
    console.error("Company notification failed:", e);
    return false;
  }
};

// Send a daily report notification to the company's notification email
export const sendDailyReportNotification = async (report, submitterName) => {
  const deptLabels = {
    restaurant: "Restaurant / F&B", operations: "Operations", front_desk: "Front Desk",
    hr: "Human Resources", finance: "Finance", general: "General",
  };
  return sendCompanyNotification(
    `RAVIQEN Daily Report: ${report.title}`,
    `A new daily report has been submitted to your RAVIQEN workspace.\n\n` +
    `Title: ${report.title}\n` +
    `Department: ${deptLabels[report.department] || report.department}\n` +
    `Report Date: ${report.report_date}\n` +
    `Priority: ${report.priority || "normal"}\n` +
    `Submitted by: ${submitterName}\n\n` +
    `Log in to RAVIQEN to review the full report.\n\n` +
    `RAVIQEN Risk & Compliance Intelligence`
  );
};

// Send a flagged-transaction alert to the company's notification email
export const sendFlaggedTransactionAlert = async (filename, summary) => {
  return sendCompanyNotification(
    `RAVIQEN Alert: ${summary.flagged} flagged transaction(s) detected`,
    `The RAVIQEN Autonomous Scanning Engine processed "${filename}" and flagged ${summary.flagged} transaction(s).\n\n` +
    `Summary:\n` +
    `- Total records: ${summary.total}\n` +
    `- Clean: ${summary.clean}\n` +
    `- Flagged: ${summary.flagged}\n` +
    `- Quarantined: ${summary.quarantined}\n` +
    `- Alerts generated: ${summary.alerts}\n` +
    `- Cases opened: ${summary.casesOpened}\n` +
    `- New entities: ${summary.newEntities}\n\n` +
    `Review the flagged transactions in the RAVIQEN dashboard.\n\n` +
    `RAVIQEN Risk & Compliance Intelligence`
  );
};