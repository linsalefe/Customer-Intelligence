"use client";

import { useState, useEffect } from "react";
import AppLayout from "@/components/app-layout";
import api from "@/lib/api";
import { toast } from "sonner";
import { RefreshCw, Download, Search, ChevronLeft, ChevronRight } from "lucide-react";

interface ReactivationClient {
  customer_id: number;
  email_master: string;
  name_master: string;
  phone_master: string;
  city: string;
  state: string;
  total_orders: number;
  ltv: number;
  last_purchase_date: string;
  days_since_last_purchase: number;
  recency_band: string;
  reactivation_score: number;
}

export default function ReativacaoPage() {
  const [clients, setClients] = useState<ReactivationClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [minScore, setMinScore] = useState(0);
  const [offset, setOffset] = useState(0);
  const [mounted, setMounted] = useState(false);
  const limit = 20;

  useEffect(() => setMounted(true), []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/dashboard/reactivation", {
        params: { min_score: minScore, limit, offset },
      });
      setClients(res.data.data);
    } catch {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [minScore, offset]);

  const filtered = search
    ? clients.filter(
        (c) =>
          c.name_master?.toLowerCase().includes(search.toLowerCase()) ||
          c.email_master?.toLowerCase().includes(search.toLowerCase())
      )
    : clients;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const scoreBadge = (score: number) => {
    if (score >= 180) return "bg-red-50 text-red-700";
    if (score >= 140) return "bg-orange-50 text-orange-700";
    if (score >= 100) return "bg-amber-50 text-amber-700";
    return "bg-gray-100 text-gray-600";
  };

  const handleExportCSV = () => {
    const headers = "Nome,Email,Telefone,Pedidos,LTV,Dias sem comprar,Score\n";
    const rows = filtered
      .map(
        (c) =>
          `"${c.name_master || ""}","${c.email_master}","${c.phone_master || ""}",${c.total_orders},${c.ltv},${c.days_since_last_purchase},${c.reactivation_score}`
      )
      .join("\n");

    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `reativacao_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado com sucesso!");
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div
          className={`flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 transition-all duration-700 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
          }`}
        >
          <div>
            <p className="text-sm font-medium text-[#2A658F] mb-1">Campanhas</p>
            <h1 className="text-2xl font-semibold text-[#27273D]">Lista de Reativação</h1>
          </div>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-[#2A658F] to-[#3d7ba8] rounded-xl hover:opacity-90 transition-all duration-200"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
        </div>

        {/* Filters */}
        <div
          className={`flex flex-col sm:flex-row gap-4 transition-all duration-700 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
          style={{ transitionDelay: "100ms" }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou email..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#2A658F] focus:ring-1 focus:ring-[#2A658F] transition-all duration-200 bg-white"
            />
          </div>
          <select
            value={minScore}
            onChange={(e) => {
              setMinScore(Number(e.target.value));
              setOffset(0);
            }}
            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#2A658F] bg-white appearance-none cursor-pointer"
          >
            <option value={0}>Todos os scores</option>
            <option value={100}>Score ≥ 100</option>
            <option value={140}>Score ≥ 140</option>
            <option value={180}>Score ≥ 180</option>
          </select>
        </div>

        {/* Table */}
        <div
          className={`bg-white rounded-2xl border border-gray-100 overflow-hidden transition-all duration-700 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
          style={{ transitionDelay: "200ms" }}
        >
          {loading ? (
            <div className="p-12 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2A658F]" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cliente</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Contato</th>
                    <th className="text-right px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Pedidos</th>
                    <th className="text-right px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">LTV</th>
                    <th className="text-center px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Dias sem comprar</th>
                    <th className="text-center px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Recência</th>
                    <th className="text-center px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.customer_id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-[#27273D]">{c.name_master || "—"}</p>
                        <p className="text-xs text-gray-400">{c.email_master}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{c.phone_master || "—"}</td>
                      <td className="px-6 py-4 text-sm text-right text-[#27273D] font-medium">{c.total_orders}</td>
                      <td className="px-6 py-4 text-sm text-right text-[#27273D] font-medium">{formatCurrency(c.ltv || 0)}</td>
                      <td className="px-6 py-4 text-sm text-center text-gray-600">{c.days_since_last_purchase}</td>
                      <td className="px-6 py-4 text-center text-xs text-gray-500">{c.recency_band}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${scoreBadge(c.reactivation_score)}`}>
                          {c.reactivation_score}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Mostrando {offset + 1} a {offset + filtered.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setOffset(offset + limit)}
                disabled={clients.length < limit}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
