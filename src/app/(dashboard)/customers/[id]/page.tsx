"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Edit3, Save, X, Package } from "lucide-react";

interface CustomerDetail {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  notes?: string;
  orders: {
    id: string;
    code: string;
    status: string;
    totalAmount: number;
    paidAmount: number;
    createdAt: string;
  }[];
}

function formatFCFA(n: number) {
  return new Intl.NumberFormat("fr-SN").format(n) + " F";
}

const STATUS_LABELS: Record<string, string> = {
  RECU: "Reçu", TRAITEMENT: "En traitement", PRET: "Prêt", LIVRE: "Livré",
};

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", notes: "" });
  const [error, setError] = useState("");

  const fetchCustomer = useCallback(async () => {
    const res = await fetch(`/api/customers/${id}`);
    if (res.ok) {
      const data = await res.json();
      setCustomer(data);
      setForm({
        name: data.name || "",
        phone: data.phone || "",
        email: data.email || "",
        address: data.address || "",
        notes: data.notes || "",
      });
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchCustomer(); }, [fetchCustomer]);

  const saveEdit = async () => {
    setError("");
    const res = await fetch(`/api/customers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    setEditing(false);
    fetchCustomer();
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>;
  }
  if (!customer) {
    return <div className="card text-center py-12 text-gray-500">Client introuvable</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/customers")} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-all">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
      </div>

      <div className="card">
        {editing ? (
          <div className="space-y-3">
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nom" />
            <input className="input-field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Téléphone" />
            <input className="input-field" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" />
            <input className="input-field" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Adresse" />
            <textarea className="input-field" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes" rows={2} />
            <div className="flex gap-2">
              <button className="btn-primary text-xs" onClick={saveEdit}><Save className="w-3.5 h-3.5" /> Sauvegarder</button>
              <button className="btn-secondary text-xs" onClick={() => setEditing(false)}><X className="w-3.5 h-3.5" /> Annuler</button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-lg font-medium">{customer.name}</p>
                <p className="text-gray-600">{customer.phone}</p>
                {customer.email && <p className="text-gray-500 text-sm">{customer.email}</p>}
                {customer.address && <p className="text-gray-500 text-sm">{customer.address}</p>}
                {customer.notes && <p className="text-gray-400 text-sm mt-2">{customer.notes}</p>}
              </div>
              <button className="btn-secondary text-xs" onClick={() => setEditing(true)}><Edit3 className="w-3.5 h-3.5" /> Modifier</button>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="font-semibold mb-3">Commandes récentes</h2>
        {customer.orders.length === 0 ? (
          <p className="text-sm text-gray-400">Aucune commande</p>
        ) : (
          <div className="space-y-2">
            {customer.orders.map((o) => (
              <Link key={o.id} href={`/orders/${o.id}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div>
                  <span className="font-mono font-bold">{o.code}</span>
                  <span className="text-sm text-gray-500 ml-2">{STATUS_LABELS[o.status]}</span>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatFCFA(o.totalAmount)}</p>
                  <p className="text-xs text-gray-400">{new Date(o.createdAt).toLocaleDateString("fr-SN")}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
