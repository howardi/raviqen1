import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Building2, Plus, Users, Loader2, Crown, UserPlus, ArrowLeft } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import BackToTop from "@/components/BackToTop";

export default function Organizations() {
  const { user, refreshUser } = useAuth();
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [creating, setCreating] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [formData, setFormData] = useState({ name: "", description: "", industry: "", country: "" });
  const [inviteData, setInviteData] = useState({ email: "", name: "", role: "member" });
  const { toast } = useToast();

  const loadOrgs = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const memberships = await base44.entities.OrganizationMember.filter({ user_id: user.id });
      const ownedOrgs = await base44.entities.Organization.filter({ owner_id: user.id });
      const orgMap = new Map();
      for (const m of memberships) {
        if (m.organization_id) orgMap.set(m.organization_id, m);
      }
      for (const o of ownedOrgs) {
        if (!orgMap.has(o.id)) {
          orgMap.set(o.id, { organization_id: o.id, organization_name: o.name, role: "company_admin", status: "active" });
        }
      }
      setOrgs(Array.from(orgMap.values()));
    } catch (e) {
      toast({ title: "Error", description: "Failed to load organizations", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadOrgs(); }, [user]);

  const loadMembers = async (orgId) => {
    setMembersLoading(true);
    try {
      const data = await base44.entities.OrganizationMember.filter({ organization_id: orgId });
      setMembers(data);
    } catch (e) {
      toast({ title: "Error", description: "Failed to load members", variant: "destructive" });
    } finally {
      setMembersLoading(false);
    }
  };

  const handleSelectOrg = (org) => {
    setSelectedOrg(org);
    loadMembers(org.organization_id);
  };

  const handleCreateOrg = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const response = await base44.functions.invoke("createOrganization", formData);
      if (response?.data?.success) {
        toast({ title: "Organization created", description: `${formData.name} is now active` });
        setShowCreate(false);
        setFormData({ name: "", description: "", industry: "", country: "" });
        loadOrgs();
        // Refresh the user session so the elevated role (company_admin)
        // and unlocked sidebar modules appear instantly without logout.
        await refreshUser();
      } else {
        toast({ title: "Error", description: response?.data?.error || "Failed to create organization", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Error", description: e.message || "Failed to create organization", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleInviteMember = async (e) => {
    e.preventDefault();
    setInviting(true);
    try {
      const response = await base44.functions.invoke("inviteOrgMember", {
        organization_id: selectedOrg.organization_id,
        organization_name: selectedOrg.organization_name,
        member_email: inviteData.email,
        member_name: inviteData.name,
        role: inviteData.role,
      });
      if (response?.data?.success) {
        toast({ title: "Member invited", description: `${inviteData.email} has been added` });
        setShowInvite(false);
        setInviteData({ email: "", name: "", role: "member" });
        loadMembers(selectedOrg.organization_id);
      } else {
        toast({ title: "Error", description: response?.data?.error || "Failed to invite member", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Error", description: e.message || "Failed to invite member", variant: "destructive" });
    } finally {
      setInviting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  // Organization detail view
  if (selectedOrg) {
    const isCompanyAdmin = selectedOrg.role === "company_admin";
    return (
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <button onClick={() => setSelectedOrg(null)} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft className="w-4 h-4" /> Back to organizations
        </button>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-slate-900 truncate">{selectedOrg.organization_name}</h1>
              <p className="text-sm text-slate-500">Your role: <span className="font-medium capitalize">{selectedOrg.role.replace("_", " ")}</span></p>
            </div>
          </div>
          {isCompanyAdmin && (
            <Button onClick={() => setShowInvite(true)} className="shrink-0">
              <UserPlus className="w-4 h-4 mr-2" /> Invite Member
            </Button>
          )}
        </div>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-700">Members ({members.length})</h2>
          </div>
          {membersLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
          ) : members.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No members yet</p>
          ) : (
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-600">
                    {(m.user_name || m.user_email || "?")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{m.user_name || m.user_email}</p>
                    <p className="text-xs text-slate-400 truncate">{m.user_email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.role === "company_admin" && <Crown className="w-3.5 h-3.5 text-amber-500" />}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${m.role === "company_admin" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                      {m.role.replace("_", " ")}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${m.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {m.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {showInvite && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowInvite(false)}>
            <Card className="w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
              <div>
                <h2 className="text-lg font-semibold">Invite Member</h2>
                <p className="text-sm text-slate-500">Add a member to {selectedOrg.organization_name}</p>
              </div>
              <form onSubmit={handleInviteMember} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="invite-email">Email Address</Label>
                  <Input id="invite-email" type="email" required value={inviteData.email} onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })} placeholder="member@company.com" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="invite-name">Full Name (optional)</Label>
                  <Input id="invite-name" value={inviteData.name} onChange={(e) => setInviteData({ ...inviteData, name: e.target.value })} placeholder="John Doe" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="invite-role">Role</Label>
                  <select id="invite-role" value={inviteData.role} onChange={(e) => setInviteData({ ...inviteData, role: e.target.value })} className="w-full h-10 rounded-md border border-slate-200 px-3 text-sm">
                    <option value="company_admin">Company Admin</option>
                    <option value="executive">Executive</option>
                    <option value="manager">Manager</option>
                    <option value="hr_personnel">HR Personnel</option>
                    <option value="restaurant_manager">Restaurant Manager</option>
                    <option value="operations">Operations</option>
                    <option value="front_desk">Front Desk</option>
                    <option value="investigator">Investigator / Auditor</option>
                    <option value="standard_user">Standard User</option>
                    <option value="read_only">Read Only</option>
                    <option value="member">Member</option>
                  </select>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setShowInvite(false)}>Cancel</Button>
                  <Button type="submit" className="flex-1" disabled={inviting}>
                    {inviting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Inviting...</> : "Send Invite"}
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}
      </div>
    );
  }

  // Organizations list view
  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900">Organizations</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your workspaces and team members</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="shrink-0 self-start sm:self-auto">
          <Plus className="w-4 h-4 mr-2" /> Create Organization
        </Button>
      </div>

      {orgs.length === 0 ? (
        <Card className="p-12 text-center">
          <Building2 className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <h3 className="text-sm font-semibold text-slate-700">No organizations yet</h3>
          <p className="text-xs text-slate-400 mt-1 mb-4">Create your first workspace to get started</p>
          <Button onClick={() => setShowCreate(true)} size="sm">
            <Plus className="w-4 h-4 mr-2" /> Create Organization
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {orgs.map((org) => (
            <Card key={org.organization_id} className="p-5 hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleSelectOrg(org)}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-800 truncate">{org.organization_name}</h3>
                    {org.role === "company_admin" && <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 capitalize">{org.role.replace("_", " ")}</p>
                  <p className="text-xs text-slate-400 mt-2">{org.status === "active" ? "Active" : org.status}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
          <Card className="w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <h2 className="text-lg font-semibold">Create Organization</h2>
              <p className="text-sm text-slate-500">You'll be the Company Admin for this workspace</p>
            </div>
            <form onSubmit={handleCreateOrg} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="org-name">Organization Name *</Label>
                <Input id="org-name" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Acme Corporation" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="org-desc">Description</Label>
                <Input id="org-desc" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Brief description" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="org-industry">Industry</Label>
                  <Input id="org-industry" value={formData.industry} onChange={(e) => setFormData({ ...formData, industry: e.target.value })} placeholder="Finance" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="org-country">Country</Label>
                  <Input id="org-country" value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value })} placeholder="Nigeria" />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button type="submit" className="flex-1" disabled={creating || !formData.name}>
                  {creating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</> : "Create"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      <BackToTop />
    </div>
  );
}