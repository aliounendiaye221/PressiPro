"use client";

import { useEffect, useState } from "react";
import { X, Printer, Download, CheckCircle2, AlertTriangle, FileText } from "lucide-react";
import { formatFCFA } from "@/lib/cash";

interface ZTicketModalProps {
  sessionId: string;
  onClose: () => void;
}

export function ZTicketModal({ sessionId, onClose }: ZTicketModalProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadReport() {
      setLoading(true);
      try {
        const res = await fetch(`/api/cash-sessions/${sessionId}/z-report`);
        if (!res.ok) throw new Error("Impossible de charger le rapport de caisse");
        const json = await res.json();
        if (isMounted) setData(json.data);
      } catch (err: any) {
        if (isMounted) setError(err.message || "Erreur de chargement");
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadReport();
    return () => {
      isMounted = false;
    };
  }, [sessionId]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in print:p-0 print:bg-white print:static">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:w-full print:max-w-none">
        {/* Header - Screen only */}
        <div className="bg-gray-900 px-4 sm:px-6 py-4 text-white flex items-center justify-between shrink-0 print:hidden">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm sm:text-base font-bold">
              {data?.reportTitle || "Ticket de Caisse"}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs flex items-center gap-1.5 transition shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimer</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 font-mono text-xs text-gray-800 space-y-4 print:p-2 print:overflow-visible">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-400 font-sans text-xs">Génération du ticket...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 text-red-700 rounded-2xl font-sans text-xs">
              {error}
            </div>
          ) : data ? (
            <div className="ticket-body max-w-[320px] mx-auto text-left leading-relaxed">
              {/* Pressing Info Header */}
              <div className="text-center border-b border-dashed border-gray-400 pb-3 mb-3">
                <h1 className="text-sm font-black uppercase tracking-wider">{data.tenant.name}</h1>
                {data.tenant.address && <p className="text-[11px] text-gray-600">{data.tenant.address}</p>}
                {data.tenant.phone && <p className="text-[11px] text-gray-600">Tél: {data.tenant.phone}</p>}
                <div className="my-2 border-t border-dotted border-gray-300" />
                <h2 className="text-xs font-black tracking-widest uppercase text-gray-900">
                  {data.reportTitle}
                </h2>
                <p className="text-[10px] text-gray-500 font-bold">{data.zReportNumber}</p>
              </div>

              {/* Session Meta */}
              <div className="space-y-1 text-[11px] border-b border-dashed border-gray-300 pb-2.5 mb-2.5">
                <div className="flex justify-between">
                  <span>Caisse :</span>
                  <span className="font-bold">{data.register.name} ({data.register.code})</span>
                </div>
                <div className="flex justify-between">
                  <span>Vacation :</span>
                  <span className="font-bold">#{data.sessionNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>Ouvert par :</span>
                  <span className="font-bold">{data.openedByName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Ouverture :</span>
                  <span>{new Date(data.openedAt).toLocaleString("fr-FR")}</span>
                </div>
                {data.closedAt && (
                  <>
                    <div className="flex justify-between">
                      <span>Fermé par :</span>
                      <span className="font-bold">{data.closedByName || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Clôture :</span>
                      <span>{new Date(data.closedAt).toLocaleString("fr-FR")}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Float & Sales Breakdown */}
              <div className="space-y-1.5 text-[11px] border-b border-dashed border-gray-300 pb-2.5 mb-2.5">
                <div className="flex justify-between font-bold">
                  <span>Fond initial :</span>
                  <span>{formatFCFA(data.financials.openingAmount)}</span>
                </div>

                <div className="pt-1.5">
                  <div className="text-[10px] uppercase font-bold text-gray-400 mb-0.5">
                    Recettes commandes ({data.financials.salesCount} paiements) :
                  </div>
                  <div className="flex justify-between pl-2">
                    <span>- Espèces :</span>
                    <span className="font-bold">{formatFCFA(data.financials.totalCashSales)}</span>
                  </div>
                  <div className="flex justify-between pl-2">
                    <span>- Wave :</span>
                    <span className="font-bold">{formatFCFA(data.financials.totalWaveSales)}</span>
                  </div>
                  <div className="flex justify-between pl-2">
                    <span>- Orange Money :</span>
                    <span className="font-bold">{formatFCFA(data.financials.totalOmSales)}</span>
                  </div>
                  {data.financials.totalOtherSales > 0 && (
                    <div className="flex justify-between pl-2">
                      <span>- Autre mode :</span>
                      <span className="font-bold">{formatFCFA(data.financials.totalOtherSales)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-black pt-1 border-t border-dotted border-gray-200">
                    <span>Total Recettes :</span>
                    <span>{formatFCFA(data.financials.totalSales)}</span>
                  </div>
                </div>
              </div>

              {/* Movements Breakdown */}
              <div className="space-y-1.5 text-[11px] border-b border-dashed border-gray-300 pb-2.5 mb-2.5">
                <div className="flex justify-between text-emerald-700">
                  <span>(+) Entrées manuelles :</span>
                  <span className="font-bold">+{formatFCFA(data.financials.manualCashIn)}</span>
                </div>
                <div className="flex justify-between text-rose-700">
                  <span>(-) Dépenses / Sorties :</span>
                  <span className="font-bold">-{formatFCFA(data.financials.manualCashOut)}</span>
                </div>

                {data.expensesByCategory?.length > 0 && (
                  <div className="pt-1 pl-2 space-y-0.5 text-[10px] text-gray-500">
                    {data.expensesByCategory.map((c: any) => (
                      <div key={c.label} className="flex justify-between">
                        <span>• {c.label} ({c.count}) :</span>
                        <span>{formatFCFA(c.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Final Reconciliation */}
              <div className="space-y-1.5 text-[12px] border-b border-dashed border-gray-400 pb-3 mb-3">
                <div className="flex justify-between font-bold">
                  <span>Espèces attendues :</span>
                  <span>{formatFCFA(data.financials.expectedCash)}</span>
                </div>
                <div className="flex justify-between font-black text-sm">
                  <span>Espèces comptées :</span>
                  <span>{formatFCFA(data.financials.actualCash)}</span>
                </div>

                <div
                  className={`flex justify-between items-center py-1 px-2 rounded font-black text-xs ${
                    data.financials.difference === 0
                      ? "bg-gray-100 text-emerald-800"
                      : data.financials.difference < 0
                      ? "bg-rose-50 text-rose-800"
                      : "bg-blue-50 text-blue-800"
                  }`}
                >
                  <span>ÉCART DE CAISSE :</span>
                  <span>
                    {data.financials.difference > 0
                      ? `+${formatFCFA(data.financials.difference)} (SURPLUS)`
                      : data.financials.difference < 0
                      ? `${formatFCFA(data.financials.difference)} (MANQUANT)`
                      : "0 FCFA (ÉQUILIBRÉ)"}
                  </span>
                </div>

                {data.closingNote && (
                  <div className="text-[10px] text-gray-600 bg-gray-50 p-2 rounded border border-gray-200 mt-2">
                    <span className="font-bold block">Observation caissier :</span>
                    <span>{data.closingNote}</span>
                  </div>
                )}
              </div>

              {/* Signature Blocks */}
              <div className="pt-4 grid grid-cols-2 gap-4 text-center text-[10px] text-gray-500">
                <div className="border-t border-gray-400 pt-1">
                  <p className="font-bold">Signature Caissier</p>
                </div>
                <div className="border-t border-gray-400 pt-1">
                  <p className="font-bold">Visa Gérant</p>
                </div>
              </div>

              {/* Footer */}
              <div className="text-center pt-6 text-[9px] text-gray-400">
                <p>PressiPro — Logiciel de Gestion de Pressing</p>
                <p>Imprimé le {new Date().toLocaleString("fr-FR")}</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
