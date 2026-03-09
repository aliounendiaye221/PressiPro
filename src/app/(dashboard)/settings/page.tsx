"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/auth-provider";
import { Package, Users, Plus, Trash2, Zap, Store, Phone, Smartphone, Save, CheckCircle, Weight, Pencil, X, UserX, UserCheck, Shield } from "lucide-react";
import { readOfflineCache, writeOfflineCache } from "@/lib/offline-cache";
import { enqueueOfflineAction } from "@/lib/offline-queue";

interface Service {
  id: string;
  name: string;
  price: number;
  category: string | null;
  isQuickItem: boolean;
  sortOrder: number;
  pricingType: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
}

interface TenantInfo {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  waveNumber: string | null;
  omNumber: string | null;
  logoUrl: string | null;
  brandPrimaryColor: string | null;
  brandAccentColor: string | null;
}

const TENANT_CACHE_KEY = "settings:tenant";
const SERVICES_CACHE_KEY = "settings:services";
const USERS_CACHE_KEY = "settings:users";

function formatFCFA(n: number) {
  return new Intl.NumberFormat("fr-SN").format(n) + " F";
}

export default function SettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const [tab, setTab] = useState<"pressing" | "services" | "users">("services");

  // Set default tab when user loads
  useEffect(() => {
    if (isAdmin) setTab("pressing");
  }, [isAdmin]);

  // Tenant info
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [tenantLoading, setTenantLoading] = useState(true);
  const [tenantForm, setTenantForm] = useState({
    name: "",
    address: "",
    phone: "",
    waveNumber: "",
    omNumber: "",
    logoUrl: "",
    brandPrimaryColor: "#0f766e",
    brandAccentColor: "#ecfeff",
  });
  const [tenantSaving, setTenantSaving] = useState(false);
  const [tenantSuccess, setTenantSuccess] = useState(false);
  const [tenantError, setTenantError] = useState("");
  const [tenantSyncMessage, setTenantSyncMessage] = useState("");

  // Services
  const [services, setServices] = useState<Service[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [showNewService, setShowNewService] = useState(false);
  const [newService, setNewService] = useState({ name: "", price: 0, category: "", isQuickItem: false, pricingType: "PER_ITEM" });
  const [serviceError, setServiceError] = useState("");
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [editForm, setEditForm] = useState({ name: "", price: 0, category: "", isQuickItem: false, pricingType: "PER_ITEM" });

  // Users
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [showNewUser, setShowNewUser] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "AGENT" });
  const [userError, setUserError] = useState("");
  const [userActionLoading, setUserActionLoading] = useState<string | null>(null);

  const fetchServices = useCallback(async () => {
    setServicesLoading(true);
    try {
      const res = await fetch("/api/services");
      if (res.ok) {
        const data = await res.json();
        setServices(data);
        writeOfflineCache(SERVICES_CACHE_KEY, data);
      } else {
        setServiceError("Erreur de chargement des services");
      }
    } catch {
      const cached = readOfflineCache<Service[]>(SERVICES_CACHE_KEY);
      if (cached) {
        setServices(cached.data);
      } else {
        setServiceError("Erreur réseau");
      }
    }
    setServicesLoading(false);
  }, []);

  const fetchUsers = useCallback(async () => {
    if (!isAdmin) return;
    setUsersLoading(true);
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
        writeOfflineCache(USERS_CACHE_KEY, data);
      }
    } catch {
      const cached = readOfflineCache<User[]>(USERS_CACHE_KEY);
      if (cached) {
        setUsers(cached.data);
      }
    }
    setUsersLoading(false);
  }, [isAdmin]);

  const fetchTenant = useCallback(async () => {
    if (!isAdmin) return;
    setTenantLoading(true);
    try {
      const res = await fetch("/api/tenant");
      if (res.ok) {
        const data = await res.json();
        setTenant(data);
        setTenantForm({
          name: data.name || "",
          address: data.address || "",
          phone: data.phone || "",
          waveNumber: data.waveNumber || "",
          omNumber: data.omNumber || "",
          logoUrl: data.logoUrl || "",
          brandPrimaryColor: data.brandPrimaryColor || "#0f766e",
          brandAccentColor: data.brandAccentColor || "#ecfeff",
        });
        writeOfflineCache(TENANT_CACHE_KEY, data);
      }
    } catch {
      const cached = readOfflineCache<TenantInfo>(TENANT_CACHE_KEY);
      if (cached) {
        const data = cached.data;
        setTenant(data);
        setTenantForm({
          name: data.name || "",
          address: data.address || "",
          phone: data.phone || "",
          waveNumber: data.waveNumber || "",
          omNumber: data.omNumber || "",
          logoUrl: data.logoUrl || "",
          brandPrimaryColor: data.brandPrimaryColor || "#0f766e",
          brandAccentColor: data.brandAccentColor || "#ecfeff",
        });
      }
    }
    setTenantLoading(false);
  }, [isAdmin]);

  useEffect(() => {
    fetchServices();
    fetchUsers();
    fetchTenant();
  }, [fetchServices, fetchUsers, fetchTenant]);

  const createService = async () => {
    setServiceError("");
    try {
      const res = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newService),
      });
      const data = await res.json();
      if (!res.ok) { setServiceError(data.error || "Erreur lors de la création"); return; }
      setShowNewService(false);
      setNewService({ name: "", price: 0, category: "", isQuickItem: false, pricingType: "PER_ITEM" });
      fetchServices();
    } catch {
      setServiceError("Erreur réseau");
    }
  };

  const updateService = async () => {
    if (!editingService) return;
    setServiceError("");
    try {
      const res = await fetch(`/api/services/${editingService.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) { setServiceError(data.error || "Erreur lors de la modification"); return; }
      setEditingService(null);
      fetchServices();
    } catch {
      setServiceError("Erreur réseau");
    }
  };

  const startEditing = (s: Service) => {
    setEditingService(s);
    setEditForm({
      name: s.name,
      price: s.price,
      category: s.category || "",
      isQuickItem: s.isQuickItem,
      pricingType: s.pricingType,
    });
    setShowNewService(false);
  };

  const saveTenant = async () => {
    setTenantError("");
    setTenantSyncMessage("");
    setTenantSaving(true);
    setTenantSuccess(false);

    const optimisticTenant: TenantInfo | null = tenant
      ? {
          ...tenant,
          ...tenantForm,
          address: tenantForm.address || null,
          phone: tenantForm.phone || null,
          waveNumber: tenantForm.waveNumber || null,
          omNumber: tenantForm.omNumber || null,
          logoUrl: tenantForm.logoUrl || null,
          brandPrimaryColor: tenantForm.brandPrimaryColor || null,
          brandAccentColor: tenantForm.brandAccentColor || null,
        }
      : null;

    if (!navigator.onLine && optimisticTenant) {
      enqueueOfflineAction({
        type: "UPDATE_TENANT",
        request: {
          url: "/api/tenant",
          method: "PUT",
          body: tenantForm,
        },
      });
      setTenant(optimisticTenant);
      writeOfflineCache(TENANT_CACHE_KEY, optimisticTenant);
      setTenantSuccess(true);
      setTenantSyncMessage("Personnalisation enregistree hors ligne. Elle sera synchronisee automatiquement.");
      setTenantSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/tenant", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tenantForm),
      });
      const data = await res.json();
      if (!res.ok) { setTenantError(data.error || "Erreur lors de la sauvegarde"); return; }
      setTenant(data);
      writeOfflineCache(TENANT_CACHE_KEY, data);
      setTenantSuccess(true);
      setTimeout(() => setTenantSuccess(false), 3000);
    } catch {
      if (optimisticTenant) {
        enqueueOfflineAction({
          type: "UPDATE_TENANT",
          request: {
            url: "/api/tenant",
            method: "PUT",
            body: tenantForm,
          },
        });
        setTenant(optimisticTenant);
        writeOfflineCache(TENANT_CACHE_KEY, optimisticTenant);
        setTenantSuccess(true);
        setTenantSyncMessage("Personnalisation enregistree hors ligne. Elle sera synchronisee automatiquement.");
      } else {
        setTenantError("Erreur réseau");
      }
    } finally {
      setTenantSaving(false);
    }
  };

  const deleteService = async (id: string) => {
    setServiceError("");
    try {
      const res = await fetch(`/api/services/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setServiceError(data.error || "Erreur lors de la suppression");
        return;
      }
      fetchServices();
    } catch {
      setServiceError("Erreur réseau");
    }
  };

  const createUser = async () => {
    setUserError("");
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });
      const data = await res.json();
      if (!res.ok) { setUserError(data.error || "Erreur lors de la création"); return; }
      setShowNewUser(false);
      setNewUser({ name: "", email: "", password: "", role: "AGENT" });
      fetchUsers();
    } catch {
      setUserError("Erreur réseau");
    }
  };

  const toggleUserActive = async (userId: string, active: boolean) => {
    setUserActionLoading(userId);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !active }),
      });
      if (res.ok) fetchUsers();
      else {
        const data = await res.json();
        setUserError(data.error || "Erreur");
      }
    } catch {
      setUserError("Erreur réseau");
    }
    setUserActionLoading(null);
  };

  const changeUserRole = async (userId: string, newRole: string) => {
    setUserActionLoading(userId);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) fetchUsers();
      else {
        const data = await res.json();
        setUserError(data.error || "Erreur");
      }
    } catch {
      setUserError("Erreur réseau");
    }
    setUserActionLoading(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Paramètres</h1>
        <p className="text-sm text-gray-500 mt-0.5">Gérez vos services et utilisateurs</p>
      </div>

      {/* Tabs */}
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-1 bg-gray-100/80 p-1 rounded-xl w-fit min-w-max">
        {isAdmin && (
          <button
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${tab === "pressing" ? "bg-white text-primary-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            onClick={() => setTab("pressing")}
          >
            <Store className="w-4 h-4" /> Mon Pressing
          </button>
        )}
        <button
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${tab === "services" ? "bg-white text-primary-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          onClick={() => setTab("services")}
        >
          <Package className="w-4 h-4" /> Services & Articles
        </button>
        {isAdmin && (
          <button
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${tab === "users" ? "bg-white text-primary-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            onClick={() => setTab("users")}
          >
            <Users className="w-4 h-4" /> Utilisateurs
          </button>
        )}
        </div>
      </div>

      {/* Mon Pressing Tab */}
      {tab === "pressing" && isAdmin && (
        <div className="max-w-xl space-y-4">
          {tenantLoading ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
          ) : (
            <div className="card space-y-5">
              <div>
                <h2 className="font-semibold text-lg flex items-center gap-2"><Store className="w-5 h-5 text-primary-600" /> Informations du pressing</h2>
                <p className="text-sm text-gray-500 mt-0.5">Ces informations apparaîtront sur vos reçus et factures</p>
              </div>

              {tenantError && <p className="text-red-500 text-sm">{tenantError}</p>}
              {tenantSyncMessage && <p className="text-sky-700 text-sm bg-sky-50 p-3 rounded-lg">{tenantSyncMessage}</p>}
              {tenantSuccess && (
                <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 p-3 rounded-lg">
                  <CheckCircle className="w-4 h-4" /> Informations sauvegardées avec succès
                </div>
              )}

              {tenantForm.logoUrl ? (
                <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-3">
                  <img src={tenantForm.logoUrl} alt="Logo du pressing" className="h-16 w-16 rounded-2xl object-cover ring-1 ring-gray-200" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Aperçu du logo</p>
                    <p className="text-xs text-gray-500">Ce logo sera affiché dans l'application et sur les reçus PDF.</p>
                  </div>
                </div>
              ) : null}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom du pressing *</label>
                  <input
                    className="input-field"
                    value={tenantForm.name}
                    onChange={(e) => setTenantForm({ ...tenantForm, name: e.target.value })}
                    placeholder="Ex: Pressing Excellence"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
                  <input
                    className="input-field"
                    value={tenantForm.address}
                    onChange={(e) => setTenantForm({ ...tenantForm, address: e.target.value })}
                    placeholder="Ex: Rue 10, Rufisque"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Logo du pressing</label>
                  <input
                    className="input-field"
                    value={tenantForm.logoUrl}
                    onChange={(e) => setTenantForm({ ...tenantForm, logoUrl: e.target.value })}
                    placeholder="https://.../logo.png"
                  />
                  <p className="mt-1 text-xs text-gray-500">Utilisez une URL HTTPS publique vers votre logo PNG ou JPG.</p>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Identité visuelle du reçu</p>
                    <p className="text-xs text-gray-500 mt-1">Choisissez une couleur forte et une teinte claire pour personnaliser vos reçus sans changer leur format.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Couleur principale</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          className="h-11 w-14 rounded-xl border border-gray-200 bg-white p-1"
                          value={tenantForm.brandPrimaryColor}
                          onChange={(e) => setTenantForm({ ...tenantForm, brandPrimaryColor: e.target.value })}
                        />
                        <input
                          className="input-field font-mono"
                          value={tenantForm.brandPrimaryColor}
                          onChange={(e) => setTenantForm({ ...tenantForm, brandPrimaryColor: e.target.value })}
                          placeholder="#0f766e"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Teinte secondaire</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          className="h-11 w-14 rounded-xl border border-gray-200 bg-white p-1"
                          value={tenantForm.brandAccentColor}
                          onChange={(e) => setTenantForm({ ...tenantForm, brandAccentColor: e.target.value })}
                        />
                        <input
                          className="input-field font-mono"
                          value={tenantForm.brandAccentColor}
                          onChange={(e) => setTenantForm({ ...tenantForm, brandAccentColor: e.target.value })}
                          placeholder="#ecfeff"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                    <div className="h-3" style={{ backgroundColor: tenantForm.brandPrimaryColor }} />
                    <div className="p-4" style={{ backgroundColor: tenantForm.brandAccentColor }}>
                      <div className="flex items-center gap-3">
                        <div
                          className="h-12 w-12 rounded-2xl flex items-center justify-center text-white font-bold shadow-sm"
                          style={{ backgroundColor: tenantForm.brandPrimaryColor }}
                        >
                          {(tenantForm.name || "PP").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "PP"}
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Aperçu reçu</p>
                          <p className="text-base font-bold text-gray-900">{tenantForm.name || "Votre pressing"}</p>
                          <p className="text-xs text-gray-600">La marque du reçu reprendra ces couleurs.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> Téléphone</span>
                  </label>
                  <input
                    className="input-field"
                    value={tenantForm.phone}
                    onChange={(e) => setTenantForm({ ...tenantForm, phone: e.target.value })}
                    placeholder="+221 77 000 00 00"
                  />
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-medium text-sm text-gray-900 mb-3 flex items-center gap-2"><Smartphone className="w-4 h-4 text-orange-500" /> Paiement mobile (affiché sur reçus)</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <span className="flex items-center gap-1.5">
                          <span className="inline-block w-3 h-3 rounded-full bg-blue-500"></span> Wave
                        </span>
                      </label>
                      <input
                        className="input-field"
                        value={tenantForm.waveNumber}
                        onChange={(e) => setTenantForm({ ...tenantForm, waveNumber: e.target.value })}
                        placeholder="77 000 00 00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <span className="flex items-center gap-1.5">
                          <span className="inline-block w-3 h-3 rounded-full bg-orange-500"></span> Orange Money
                        </span>
                      </label>
                      <input
                        className="input-field"
                        value={tenantForm.omNumber}
                        onChange={(e) => setTenantForm({ ...tenantForm, omNumber: e.target.value })}
                        placeholder="77 000 00 00"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <button className="btn-primary" onClick={saveTenant} disabled={tenantSaving || !tenantForm.name}>
                <Save className="w-4 h-4" /> {tenantSaving ? "Sauvegarde..." : "Sauvegarder"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Services Tab */}
      {tab === "services" && (
        <div className="space-y-3">
          {serviceError && <p className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">{serviceError}</p>}

          {isAdmin && !editingService && (
            <button className="btn-primary text-xs" onClick={() => { setShowNewService(true); setServiceError(""); }}>
              <Plus className="w-3.5 h-3.5" /> Nouveau service
            </button>
          )}

          {showNewService && (
            <div className="card space-y-3 border-2 border-primary-200">
              <h3 className="font-semibold text-sm text-primary-700">Nouveau service</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input placeholder="Nom *" className="input-field" value={newService.name} onChange={(e) => setNewService({ ...newService, name: e.target.value })} />
                <input type="number" placeholder="Prix (FCFA) *" className="input-field" value={newService.price || ""} onChange={(e) => setNewService({ ...newService, price: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input placeholder="Catégorie" className="input-field" value={newService.category} onChange={(e) => setNewService({ ...newService, category: e.target.value })} />
                <select className="input-field" value={newService.pricingType} onChange={(e) => setNewService({ ...newService, pricingType: e.target.value })}>
                  <option value="PER_ITEM">À la pièce</option>
                  <option value="PER_KG">Au kilo</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={newService.isQuickItem} onChange={(e) => setNewService({ ...newService, isQuickItem: e.target.checked })} />
                Bouton rapide
              </label>
              <div className="flex gap-2">
                <button className="btn-primary text-xs" onClick={createService} disabled={!newService.name || newService.price <= 0}>Créer</button>
                <button className="btn-secondary text-xs" onClick={() => setShowNewService(false)}>Annuler</button>
              </div>
            </div>
          )}

          {/* Edit service form */}
          {editingService && (
            <div className="card space-y-3 border-2 border-amber-200">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-amber-700">Modifier : {editingService.name}</h3>
                <button onClick={() => setEditingService(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input placeholder="Nom *" className="input-field" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                <input type="number" placeholder="Prix (FCFA) *" className="input-field" value={editForm.price || ""} onChange={(e) => setEditForm({ ...editForm, price: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input placeholder="Catégorie" className="input-field" value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} />
                <select className="input-field" value={editForm.pricingType} onChange={(e) => setEditForm({ ...editForm, pricingType: e.target.value })}>
                  <option value="PER_ITEM">À la pièce</option>
                  <option value="PER_KG">Au kilo</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editForm.isQuickItem} onChange={(e) => setEditForm({ ...editForm, isQuickItem: e.target.checked })} />
                Bouton rapide
              </label>
              <div className="flex gap-2">
                <button className="btn-primary text-xs" onClick={updateService} disabled={!editForm.name || editForm.price <= 0}>
                  <Save className="w-3 h-3" /> Sauvegarder
                </button>
                <button className="btn-secondary text-xs" onClick={() => setEditingService(null)}>Annuler</button>
              </div>
            </div>
          )}

          {servicesLoading ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
          ) : services.length === 0 ? (
            <div className="card text-center py-8 text-gray-400">Aucun service configuré</div>
          ) : (
            <div className="grid gap-2">
              {services.map((s) => (
                <div key={s.id} className={`card flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-2 ${editingService?.id === s.id ? "ring-2 ring-amber-300" : ""}`}>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div>
                      <span className="font-medium">{s.name}</span>
                      {s.category && <span className="text-xs text-gray-400 ml-2">{s.category}</span>}
                      <div className="flex items-center gap-1 mt-0.5 sm:mt-0 sm:inline-flex sm:ml-2">
                        {s.isQuickItem && <span className="badge bg-primary-50 text-primary-700"><Zap className="w-3 h-3" /> Rapide</span>}
                        {s.pricingType === "PER_KG" && <span className="badge bg-amber-50 text-amber-700"><Weight className="w-3 h-3" /> Au kilo</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{formatFCFA(s.price)}{s.pricingType === "PER_KG" ? "/kg" : ""}</span>
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button className="text-primary-500 hover:text-primary-700 text-xs flex items-center gap-1" onClick={() => startEditing(s)}>
                          <Pencil className="w-3 h-3" /> Modifier
                        </button>
                        <button className="text-red-400 hover:text-red-600 text-xs flex items-center gap-1" onClick={() => deleteService(s.id)}>
                          <Trash2 className="w-3 h-3" /> Supprimer
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Users Tab */}
      {tab === "users" && isAdmin && (
        <div className="space-y-3">
          {userError && <p className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">{userError}</p>}

          <button className="btn-primary text-xs" onClick={() => { setShowNewUser(true); setUserError(""); }}>
            <Plus className="w-3.5 h-3.5" /> Nouvel utilisateur
          </button>

          {showNewUser && (
            <div className="card space-y-3 border-2 border-primary-200">
              <h3 className="font-semibold text-sm text-primary-700">Nouvel utilisateur</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input placeholder="Nom *" className="input-field" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} />
                <input type="email" placeholder="Email *" className="input-field" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input type="password" placeholder="Mot de passe *" className="input-field" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
                <select className="input-field" value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
                  <option value="AGENT">Agent</option>
                  <option value="ADMIN">Administrateur</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button className="btn-primary text-xs" onClick={createUser} disabled={!newUser.name || !newUser.email || !newUser.password}>Créer</button>
                <button className="btn-secondary text-xs" onClick={() => setShowNewUser(false)}>Annuler</button>
              </div>
            </div>
          )}

          {usersLoading ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
          ) : users.length === 0 ? (
            <div className="card text-center py-8 text-gray-400">Aucun utilisateur</div>
          ) : (
            <div className="grid gap-2">
              {users.map((u) => (
                <div key={u.id} className={`card flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-2 ${!u.active ? "opacity-60" : ""}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm ${u.active ? "bg-gradient-to-br from-primary-400 to-primary-600" : "bg-gray-400"}`}>
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium">{u.name}</p>
                      <p className="text-sm text-gray-500">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Role badge + change */}
                    {u.id !== user?.id ? (
                      <select
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white"
                        value={u.role}
                        onChange={(e) => changeUserRole(u.id, e.target.value)}
                        disabled={userActionLoading === u.id}
                      >
                        <option value="AGENT">Agent</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    ) : (
                      <span className={`badge ${u.role === "ADMIN" || u.role === "SUPER_ADMIN" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-700"}`}>
                        {u.role === "SUPER_ADMIN" ? "Super Admin" : u.role}
                      </span>
                    )}

                    {/* Toggle active */}
                    {u.id !== user?.id && (
                      <button
                        className={`text-xs flex items-center gap-1 px-2 py-1 rounded-lg transition-colors ${u.active ? "text-red-500 hover:bg-red-50" : "text-green-600 hover:bg-green-50"}`}
                        onClick={() => toggleUserActive(u.id, u.active)}
                        disabled={userActionLoading === u.id}
                      >
                        {u.active ? <><UserX className="w-3 h-3" /> Désactiver</> : <><UserCheck className="w-3 h-3" /> Réactiver</>}
                      </button>
                    )}

                    {!u.active && <span className="badge bg-red-100 text-red-700">Inactif</span>}
                    {u.id === user?.id && <span className="badge bg-blue-100 text-blue-700 text-xs">Vous</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
