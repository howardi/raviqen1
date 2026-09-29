import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { syncProfile } from "@/lib/entityIntelligence";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import EntityRiskPanel from "@/components/entity/EntityRiskPanel";
import EntityLedger from "@/components/entity/EntityLedger";
import EntityBaselinePanel from "@/components/entity/EntityBaselinePanel";
import EntityNetworkGraph from "@/components/entity/EntityNetworkGraph";
import BackToTop from "@/components/BackToTop";
import RiskBadge from "@/components/RiskBadge";
import { ArrowLeft, Building2, RefreshCw, Loader2, MapPin, Mail, Phone, Globe, FileText, Hash } from "lucide-react";

export default function EntityIntelligenceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const data = await base44.entities.EntityProfile.get(id);
      setProfile(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const handleSync = async () => {
    if (!profile) return;
    setSyncing(true);
    try {
      const allProfiles = await base44.entities.EntityProfile.list("-created_date", 200);
      const synced = await syncProfile(profile, allProfiles, user);
      setProfile(synced);
      await loadProfile();
    } catch (e) { console.error(e); }
    finally { setSyncing(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-slate-300 animate-spin" /></div>;
  if (!profile) return (
    <div className="text-center py-20">
      <p className="text-sm text-slate-400 mb-4">Entity profile not found</p>
      <Link to="/entity-intelligence" className="text-sm text-slate-700 underline">Back to Entity Intelligence</Link>
    </div>
  );

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate("/entity-intelligence")} className="p-2 rounded-lg hover:bg-slate-100 transition-colors shrink-0">
              <ArrowLeft className="w-4 h-4 text-slate-600" />
            </button>
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-slate-500" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-[#231F20] truncate">{profile.legal_name}</h1>
              <p className="text-xs text-slate-400 font-mono">{profile.profile_id || "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <RiskBadge level={profile.risk_level} />
            <span className="text-sm font-bold tabular-nums text-slate-700">{profile.risk_score}/100</span>
            <button onClick={handleSync} disabled={syncing}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors">
              {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {syncing ? "Syncing…" : "Sync Now"}
            </button>
          </div>
        </div>
      </header>

      <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
        {/* Identity Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Entity Identity</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <IdentityField icon={Building2} label="Legal Name" value={profile.legal_name} />
            <IdentityField icon={Building2} label="Trading Name" value={profile.trading_name} />
            <IdentityField icon={Hash} label="Tax ID / TIN / VAT" value={profile.tax_id} />
            <IdentityField icon={FileText} label="Registration Number" value={profile.registration_number} />
            <IdentityField icon={MapPin} label="Address" value={profile.address} />
            <IdentityField icon={Globe} label="Country" value={profile.country} />
            <IdentityField icon={Mail} label="Contact Email" value={profile.contact_email} />
            <IdentityField icon={Phone} label="Contact Phone" value={profile.contact_phone} />
            <IdentityField icon={Building2} label="Industry" value={profile.industry} />
          </div>
          {profile.bank_accounts?.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Known Bank Accounts</p>
              <div className="flex flex-wrap gap-2">
                {profile.bank_accounts.map((ba, i) => (
                  <span key={i} className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100 text-xs font-mono text-slate-700">
                    {ba.account || ba}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="risk" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
            <TabsTrigger value="risk">Risk & Screening</TabsTrigger>
            <TabsTrigger value="ledger">Ledger</TabsTrigger>
            <TabsTrigger value="baseline">Baseline</TabsTrigger>
            <TabsTrigger value="network">Network</TabsTrigger>
          </TabsList>
          <TabsContent value="risk" className="mt-4"><EntityRiskPanel profile={profile} /></TabsContent>
          <TabsContent value="ledger" className="mt-4"><EntityLedger profile={profile} /></TabsContent>
          <TabsContent value="baseline" className="mt-4"><EntityBaselinePanel profile={profile} /></TabsContent>
          <TabsContent value="network" className="mt-4"><EntityNetworkGraph profile={profile} /></TabsContent>
        </Tabs>
      </div>
      <BackToTop />
    </div>
  );
}

function IdentityField({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</p>
        <p className="text-sm text-slate-700 truncate">{value || "—"}</p>
      </div>
    </div>
  );
}