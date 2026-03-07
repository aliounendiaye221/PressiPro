"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/auth-provider";
import { Package, Users, Plus, Trash2, Zap, Store, Phone, Smartphone, Save, CheckCircle, Weight } from "lucide-react";

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
}

function formatFCFA(n: number) {
  return new Intl.NumberFormat("fr-SN").format(n) + " F";
}

export default function SettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const [tab, setTab] = useState<"pressing" | "services" | "users">(isAdmin ? "pressing" : "services");

  // Tenant info
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [tenantLoading, setTenantLoading] = useState(true);
  const [tenantForm, setTenantForm] = useState({ name: "", address: "", phone: "", waveNumber: "", omNumber: "" });
  const [tenantSaving, setTenantSaving] = useState(false);
  const [tenantSuccess, setTenantSuccess] = useState(false);
  const [tenantError, setTenantError] = useState("");

  // Services
  const [services, setServices] = useState<Service[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [showNewService, setShowNewService] = useState(false);
  const [newService, setNewService] = useState({ name: "", price: 0, category: "", isQuickItem: false, pricingType: "PER_ITEM" });
  const [serviceError, setServiceError] = useState("");

  // Users
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [showNewUser, setShowNewUser] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "AGENT" });
  const [userError, setUserError] = useState("");

  const fetchServices = useCallback(async () => {
    setServicesLoading(true);
    const res = await fetch("/api/services");
    const data = await res.json();
    setServices(data);
    setServicesLoading(false);
  }, []);

  const fetchUsers = useCallback(async () => {
    if (!isAdmin) return;
    setUsersLoading(true);
    const res = await fetch("/api/users");
    if (res.ok) {
      setUsers(await res.json());
    }
    setUsersLoading(false);
  }, [isAdmin]);

  const fetchTenant = useCallback(async () => {
    if (!isAdmin) return;
    setTenantLoading(true);
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
      });
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
    const res = await fetch("/api/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newService),
    });
    const data = await res.json();
    if (!res.ok) { setServiceError(data.error); return; }
    setShowNewService(false);
    setNewService({ name: "", price: 0, category: "", isQuickItem: false, pricingType: "PER_ITEM" });
    fetchServices();
  };

  const saveTenant = async () => {
    setTenantError("");
    setTenantSaving(true);
    setTenantSuccess(false);
    try {
      const res = await fetch("/api/tenant", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tenantForm),
      });
      const data = await res.json();
      if (!res.ok) { setTenantError(data.error); return; }
      setTenant(data);
      setTenantSuccess(true);
      setTimeout(() => setTenantSuccess(false), 3000);
    } finally {
      setTenantSaving(false);
    }
  };

  const deleteService = async (id: string) => {
    await fetch(`/api/services/${id}`, { method: "DELETE" });
    fetchServices();
  };

  const createUser = async () => {
    setUserError("");
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newUser),
    });
    const data = await res.json();
    if (!res.ok) { setUserError(data.error); return; }
    setShowNewUser(false);
    setNewUser({ name: "", email: "", password: "", role: "AGENT" });
    fetchUsers();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
        <p className="text-sm text-gray-500 mt-0.5">Gérez vos services et utilisateurs</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100/80 p-1 rounded-xl w-fit">
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
              {tenantSuccess && (
                <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 p-3 rounded-lg">
                  <CheckCircle className="w-4 h-4" /> Informations sauvegardées avec succès
                </div>
              )}

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
          {isAdmin && (
            <button className="btn-primary text-xs" onClick={() => setShowNewService(true)}>
              <Plus className="w-3.5 h-3.5" /> Nouveau service
            </button>
          )}

          {showNewService && (
            <div className="card space-y-3">
              {serviceError && <p className="text-red-500 text-sm">{serviceError}</p>}
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Nom *" className="input-field" value={newService.name} onChange={(e) => setNewService({ ...newService, name: e.target.value })} />
                <input type="number" placeholder="Prix (FCFA) *" className="input-field" value={newService.price || ""} onChange={(e) => setNewService({ ...newService, price: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
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
                <button className="btn-primary text-xs" onClick={createService}>Créer</button>
                <button className="btn-secondary text-xs" onClick={() => setShowNewService(false)}>Annuler</button>
              </div>
            </div>
          )}

          {servicesLoading ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
          ) : (
            <div className="grid gap-2">
              {services.map((s) => (
                <div key={s.id} className="card flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div>
                      <span className="font-medium">{s.name}</span>
                      {s.category && <span className="text-xs text-gray-400 ml-2">{s.category}</span>}
                      {s.isQuickItem && <span className="badge bg-primary-50 text-primary-700 ml-2"><Zap className="w-3 h-3" /> Rapide</span>}
                      {s.pricingType === "PER_KG" && <span className="badge bg-amber-50 text-amber-700 ml-2"><Weight className="w-3 h-3" /> Au kilo</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{formatFCFA(s.price)}{s.pricingType === "PER_KG" ? "/kg" : ""}</span>
                    {isAdmin && (
                      <button className="text-red-400 hover:text-red-600 text-xs flex items-center gap-1" onClick={() => deleteService(s.id)}>
                        <Trash2 className="w-3 h-3" /> Supprimer
                      </button>
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
          <button className="btn-primary text-xs" onClick={() => setShowNewUser(true)}>
            <Plus className="w-3.5 h-3.5" /> Nouvel utilisateur
          </button>

          {showNewUser && (
            <div className="card space-y-3">
              {userError && <p className="text-red-500 text-sm">{userError}</p>}
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Nom *" className="input-field" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} />
                <input type="email" placeholder="Email *" className="input-field" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="password" placeholder="Mot de passe *" className="input-field" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
                <select className="input-field" value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
                  <option value="AGENT">Agent</option>
                  <option value="ADMIN">Administrateur</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button className="btn-primary text-xs" onClick={createUser}>Créer</button>
                <button className="btn-secondary text-xs" onClick={() => setShowNewUser(false)}>Annuler</button>
              </div>
            </div>
          )}

          {usersLoading ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
          ) : (
            <div className="grid gap-2">
              {users.map((u) => (
                <div key={u.id} className="card flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-gradient-to-br from-primary-400 to-primary-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium">{u.name}</p>
                      <p className="text-sm text-gray-500">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`badge ${u.role === "ADMIN" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-700"}`}>
                      {u.role}
                    </span>
                    {!u.active && <span className="badge bg-red-100 text-red-700">Inactif</span>}
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
