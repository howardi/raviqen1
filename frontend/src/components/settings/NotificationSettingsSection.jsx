import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { useCompanyProfile } from "@/lib/CompanyProfileContext";
import { Mail, Save, Loader2, Send, Bell, CheckCircle2 } from "lucide-react";

export default function NotificationSettingsSection() {
  const { toast } = useToast();
  const { profile, loadProfile } = useCompanyProfile();
  const [notificationEmail, setNotificationEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  useEffect(() => {
    if (profile) setNotificationEmail(profile.notification_email || "");
  }, [profile]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (profile?.id) {
        await base44.entities.CompanyProfile.update(profile.id, { ...profile, notification_email: notificationEmail });
      } else {
        await base44.entities.CompanyProfile.create({ company_name: "My Company", notification_email: notificationEmail });
      }
      await loadProfile();
      toast({ title: "Notification email saved", description: "Daily reports and activity alerts will be sent to this address." });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleTestNotification = async () => {
    if (!notificationEmail) return;
    setSendingTest(true);
    try {
      await base44.integrations.Core.SendEmail({
        to: notificationEmail,
        subject: "RAVIQEN: Test Notification",
        body: `This is a test notification from RAVIQEN.\n\nIf you received this email, your notification settings are correctly configured.\n\nYou will receive the following types of alerts at this address:\n- Daily report submissions\n- Flagged transaction alerts\n- High-risk activity notifications\n\nRAVIQEN Risk & Compliance Intelligence`,
      });
      toast({ title: "Test notification sent", description: `Check ${notificationEmail} for the test email.` });
    } catch (err) {
      toast({ title: "Error", description: err.message || "Failed to send test notification", variant: "destructive" });
    }
    setSendingTest(false);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
          <Bell className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[#231F20]">Notification & Alert Email</h3>
          <p className="text-xs text-slate-500">Daily reports and activity alerts are sent to this address</p>
        </div>
      </div>

      <div className="mb-4 p-3 rounded-lg bg-blue-50/60 border border-blue-100 flex items-start gap-2">
        <Mail className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-700">
          <p className="font-medium mb-1">What gets sent here:</p>
          <ul className="space-y-0.5 text-blue-600">
            <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3" /> Daily report submissions from your team</li>
            <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3" /> Flagged transaction alerts from autonomous scans</li>
            <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3" /> High-risk activity notifications</li>
          </ul>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-3">
        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1 block">Notification Email Address</label>
          <input
            type="email"
            value={notificationEmail}
            onChange={(e) => setNotificationEmail(e.target.value)}
            placeholder="alerts@yourcompany.com"
            className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:border-slate-400 focus:ring-1 focus:ring-slate-300 outline-none"
          />
          <p className="text-[10px] text-slate-400 mt-1">This is separate from your primary contact email. Use a shared inbox or distribution list for team visibility.</p>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving || !notificationEmail}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
          <button
            type="button"
            onClick={handleTestNotification}
            disabled={sendingTest || !notificationEmail}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            {sendingTest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send Test
          </button>
        </div>
      </form>
    </div>
  );
}