import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Lock, Mail, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { useAuth } from "@/lib/AuthContext";
import { getRoleHomeRoute } from "@/lib/permissions";

export default function ChangePassword() {
  const { user, logout } = useAuth();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [clearing, setClearing] = useState(false);

  const sendResetLink = async () => {
    if (!user?.email) return;
    setSending(true);
    setError("");
    try {
      await base44.auth.resetPasswordRequest(user.email);
      setSent(true);
    } catch (err) {
      setError(err.message || "Failed to send reset link");
    } finally {
      setSending(false);
    }
  };

  const handleAlreadyChanged = async () => {
    setClearing(true);
    setError("");
    try {
      await base44.auth.updateMe({ requires_reset: false });
      window.location.href = getRoleHomeRoute(user);
    } catch (err) {
      setError(err.message || "Unable to update. Please log out and try again.");
    } finally {
      setClearing(false);
    }
  };

  const handleLogout = () => {
    logout(false);
    window.location.href = "/login";
  };

  return (
    <AuthLayout
      icon={Lock}
      title="Password change required"
      subtitle="You must set a new password before continuing"
    >
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <div className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-200">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-900">Security Notice</p>
            <p className="text-xs text-amber-700 mt-1">
              Your account was created with an administrator-assigned password. For security, you must change it before accessing the platform.
            </p>
          </div>
        </div>
      </div>

      {sent ? (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-emerald-900">Reset link sent</p>
                <p className="text-xs text-emerald-700 mt-1">
                  Check your email ({user?.email}) for a password reset link. Click the link to set your new password, then return here and confirm below.
                </p>
              </div>
            </div>
          </div>
          <Button onClick={sendResetLink} variant="outline" className="w-full h-11" disabled={sending}>
            {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
            Resend reset link
          </Button>
        </div>
      ) : (
        <Button onClick={sendResetLink} className="w-full h-12 font-medium" disabled={sending || !user?.email}>
          {sending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Sending reset link...
            </>
          ) : (
            <>
              <Mail className="w-4 h-4 mr-2" />
              Send password reset link
            </>
          )}
        </Button>
      )}

      <div className="mt-6 pt-6 border-t border-border space-y-2">
        <p className="text-xs text-muted-foreground text-center mb-3">
          Already changed your password via the reset link?
        </p>
        <Button onClick={handleAlreadyChanged} variant="outline" className="w-full h-11" disabled={clearing}>
          {clearing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
          I've already changed my password
        </Button>
        <Button onClick={handleLogout} variant="ghost" className="w-full h-11">
          Log out
        </Button>
      </div>
    </AuthLayout>
  );
}