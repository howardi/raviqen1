import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Loader2, ShieldCheck, UserPlus, LogIn } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import GoogleIcon from "@/components/GoogleIcon";
import { toast } from "@/components/ui/use-toast";
import { safeReturnTo } from "@/lib/authReturnTo";
import { getRoleHomeRoute } from "@/lib/permissions";

export default function AuthPanel({ defaultTab = "login" }) {
  const [tab, setTab] = useState(defaultTab);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const autoSubmittedRef = useRef(false);

  // Auto-submit OTP when all 6 digits are entered or pasted
  useEffect(() => {
    if (showOtp && otpCode.length === 6 && !autoSubmittedRef.current && !loading) {
      autoSubmittedRef.current = true;
      handleVerify();
    }
    if (otpCode.length < 6) {
      autoSubmittedRef.current = false;
    }
  }, [otpCode, showOtp, loading]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await base44.auth.loginViaEmailPassword(email, password);
      const currentUser = await base44.auth.me();
      if (currentUser?.requires_reset) {
        window.location.href = "/change-password";
        return;
      }
      const returnTo = safeReturnTo();
      if (returnTo && returnTo !== "/") {
        window.location.href = returnTo;
      } else {
        window.location.href = getRoleHomeRoute(currentUser);
      }
    } catch (err) {
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await base44.auth.register({ email, password });
      setShowOtp(true);
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await base44.auth.verifyOtp({ email, otpCode });
      if (result?.access_token) {
        base44.auth.setToken(result.access_token);
      }
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err.message || "Invalid verification code");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    try {
      await base44.auth.resendOtp(email);
      toast({ title: "Code sent", description: "Check your email for the new code." });
    } catch (err) {
      setError(err.message || "Failed to resend code");
    }
  };

  const handleGoogle = () => {
    base44.auth.loginWithProvider("google", safeReturnTo());
  };

  if (showOtp) {
    return (
      <div className="space-y-5">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-3">
            <Mail className="w-6 h-6 text-emerald-400" />
          </div>
          <h3 className="text-lg font-semibold text-white">Verify your email</h3>
          <p className="text-sm text-slate-400 mt-1">We sent a 6-digit code to {email}</p>
        </div>
        {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}
        <div className="flex justify-center">
          <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode} autoFocus autoComplete="one-time-code">
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>
        <Button className="w-full h-11 bg-emerald-600 hover:bg-emerald-500" onClick={handleVerify} disabled={loading || otpCode.length < 6}>
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying...</> : "Verify & Continue"}
        </Button>
        <p className="text-center text-sm text-slate-400">
          Didn't receive the code?{" "}
          <button onClick={handleResend} className="text-emerald-400 font-medium hover:underline">Resend</button>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-slate-900/60 border border-slate-800">
        <button
          onClick={() => { setTab("login"); setError(""); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${tab === "login" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-300"}`}
        >
          <LogIn className="w-4 h-4" /> Log in
        </button>
        <button
          onClick={() => { setTab("signup"); setError(""); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${tab === "signup" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-300"}`}
        >
          <UserPlus className="w-4 h-4" /> Sign up
        </button>
      </div>

      <Button variant="outline" className="w-full h-11 bg-transparent border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white" onClick={handleGoogle}>
        <GoogleIcon className="w-5 h-5 mr-2" /> Continue with Google
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800" /></div>
        <div className="relative flex justify-center text-xs"><span className="bg-slate-950 px-3 text-slate-600">or</span></div>
      </div>

      {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}

      {tab === "login" ? (
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="login-email" className="text-slate-300 text-xs">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input id="login-email" type="email" autoComplete="email" autoFocus placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 h-11 bg-slate-900/60 border-slate-700 text-white placeholder:text-slate-600" required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="login-password" className="text-slate-300 text-xs">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input id="login-password" type="password" autoComplete="current-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 h-11 bg-slate-900/60 border-slate-700 text-white placeholder:text-slate-600" required />
            </div>
          </div>
          <Button type="submit" className="w-full h-11 bg-emerald-600 hover:bg-emerald-500" disabled={loading}>
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Logging in...</> : "Log in"}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleSignup} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="signup-email" className="text-slate-300 text-xs">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input id="signup-email" type="email" autoComplete="email" autoFocus placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 h-11 bg-slate-900/60 border-slate-700 text-white placeholder:text-slate-600" required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="signup-password" className="text-slate-300 text-xs">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input id="signup-password" type="password" autoComplete="new-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 h-11 bg-slate-900/60 border-slate-700 text-white placeholder:text-slate-600" required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="signup-confirm" className="text-slate-300 text-xs">Confirm Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input id="signup-confirm" type="password" autoComplete="new-password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pl-10 h-11 bg-slate-900/60 border-slate-700 text-white placeholder:text-slate-600" required />
            </div>
          </div>
          <Button type="submit" className="w-full h-11 bg-emerald-600 hover:bg-emerald-500" disabled={loading}>
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating account...</> : "Create account"}
          </Button>
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/10">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-300/80 leading-relaxed">
              New accounts start as <span className="font-semibold">Pending</span>. A Super Admin must assign your role before you can access modules.
            </p>
          </div>
        </form>
      )}
    </div>
  );
}