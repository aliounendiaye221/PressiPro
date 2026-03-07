"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Search, UserPlus, Users, ChevronLeft, ChevronRight } from "lucide-react";

interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  createdAt: string;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  // New customer form
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newError, setNewError] = useState("");

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    params.set("page", String(page));

    const res = await fetch(`/api/customers?${params}`);
    const data = await res.json();
    setCustomers(data.customers || []);
    setTotal(data.total || 0);
    setLoading(false);
  }, [search, page]);

  useEffect(() => {
    const t = setTimeout(fetchCustomers, 300);
    return () => clearTimeout(t);
  }, [fetchCustomers]);

  const createCustomer = async () => {
    setNewError("");
    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, phone: newPhone }),
    });
    const data = await res.json();
    if (!res.ok) { setNewError(data.error); return; }
    setShowNew(false);
    setNewName("");
    setNewPhone("");
    fetchCustomers();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} client{total > 1 ? "s" : ""} enregistré{total > 1 ? "s" : ""}</p>
        </div>
        <button className="btn-primary" onClick={() => setShowNew(true)}>
          <UserPlus className="w-4 h-4" /> Nouveau client
        </button>
      </div>

      {showNew && (
        <div className="card space-y-3">
          <h2 className="font-semibold">Nouveau client</h2>
          {newError && <p className="text-red-500 text-sm">{newError}</p>}
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Nom *" className="input-field" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <input placeholder="+221 7X XXX XX XX *" className="input-field" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button className="btn-primary text-xs" onClick={createCustomer}>Créer</button>
            <button className="btn-secondary text-xs" onClick={() => setShowNew(false)}>Annuler</button>
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="search"
          placeholder="Rechercher par nom ou téléphone..."
          className="input-field pl-10"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : customers.length === 0 ? (
        <div className="card text-center py-16">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Aucun client trouvé</p>
          <p className="text-sm text-gray-400 mt-1">Ajoutez votre premier client</p>
        </div>
      ) : (
        <>
          <div className="grid gap-2">
            {customers.map((c) => (
              <Link key={c.id} href={`/customers/${c.id}`} className="group card hover:shadow-lg hover:border-primary-100 transition-all duration-200 flex items-center gap-4">
                <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-primary-600 rounded-xl flex items-center justify-center text-white font-bold shadow-sm">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{c.name}</p>
                  <p className="text-sm text-gray-500">{c.phone}</p>
                </div>
                <span className="text-gray-400 text-xs">
                  {new Date(c.createdAt).toLocaleDateString("fr-SN")}
                </span>
              </Link>
            ))}
          </div>

          {total > 20 && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <button className="btn-secondary text-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="w-4 h-4" /> Précédent</button>
              <span className="text-sm text-gray-500 px-3">Page {page} / {Math.ceil(total / 20)}</span>
              <button className="btn-secondary text-sm" disabled={page * 20 >= total} onClick={() => setPage((p) => p + 1)}>Suivant <ChevronRight className="w-4 h-4" /></button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
