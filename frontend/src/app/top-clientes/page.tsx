"use client";

import { useState, useEffect } from "react";
import AppLayout from "@/components/app-layout";
import api from "@/lib/api";
import { toast } from "sonner";
import { Trophy, Medal, Crown } from "lucide-react";

interface TopClient {
  customer_id: number;
  email_master: string;
  name_master: string;
  phone_master: string;
  city: string;
  state: string;
  total_orders: number;
  total_revenue: number;
  avg_ticket: number;
  first_purchase_date: string;
  last_purchase_date: string;
  is_active: boolean;
  rank_revenue: number;
  rank_frequency: number;
}

export default function TopClientesPage() {
  const [clients, setClients] = useState<TopClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(30);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/dashboard/top-customers", { params: { limit } });
      setClients(res.data.data);
    } catch {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [limit]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const rankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="w-5 h-5 text-amber-500" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />;
    if (rank === 3) return <Medal className="w-5 h-5 text-amber-700" />;
    return <span className="text-sm font-semibold text-gray-400 w-5 text-center">{rank}</span>;
  };

  // Top 3 cards
  const top3 = clients.slice(0, 3);
  const rest = clients.slice(3);

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
            <p className="text-sm font-medium text-[#2A658F] mb-1">Ranking</p>
            <h1 className="text-2xl font-semibold text-[#27273D]">Top Clientes</h1>
          </div>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#2A658F] bg-white cursor-pointer"
          >
            <option value={10}>Top 10</option>
            <option value={30}>Top 30</option>
            <option value={50}>Top 50</option>
            <option value={100}>Top 100</option>
          </select>
        </div>

        {/* Top 3 Cards */}
        {!loading && top3.length > 0 && (
          <div
            className={`grid grid-cols-1 md:grid-cols-3 gap-6 transition-all duration-700 ${
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
            style={{ transitionDelay: "100ms" }}
          >
            {top3.map((c, i) => {
              const gradients = [
                "from-amber-500 to-amber-600",
                "from-gray-400 to-gray-500",
                "from-amber-700 to-amber-800",
              ];
              const icons = [
                <Crown key="1" className="w-8 h-8 text-white/90" />,
                <Medal key="2" className="w-8 h-8 text-white/90" />,
                <Medal key="3" className="w-8 h-8 text-white/90" />,
              ];
              return (
                <div
                  key={c.customer_id}
                  className={`bg-gradient-to-br ${gradients[i]} rounded-2xl p-6 text-white`}
                >
                  <div className="flex items-center justify-between mb-4">
                    {icons[i]}
                    <span className="text-white/70 text-sm font-medium">#{c.rank_revenue}</span>
                  </div>
                  <p className="font-semibold text-lg mb-1 truncate">{c.name_master || "—"}</p>
                  <p className="text-white/70 text-xs mb-4 truncate">{c.email_master}</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-white/60 text-xs">LTV</p>
                      <p className="font-semibold">{formatCurrency(c.total_revenue)}</p>
                    </div>
                    <div>
                      <p className="text-white/60 text-xs">Pedidos</p>
                      <p className="font-semibold">{c.total_orders}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

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
                    <th className="text-center px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">#</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cliente</th>
                    <th className="text-right px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">LTV</th>
                    <th className="text-right px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Pedidos</th>
                    <th className="text-right px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ticket Médio</th>
                    <th className="text-center px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="text-center px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Última Compra</th>
                  </tr>
                </thead>
                <tbody>
                  {rest.map((c) => (
                    <tr key={c.customer_id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-4 text-center">
                        <div className="flex justify-center">{rankIcon(c.rank_revenue)}</div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-[#27273D]">{c.name_master || "—"}</p>
                        <p className="text-xs text-gray-400">{c.email_master}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-[#27273D] font-semibold">
                        {formatCurrency(c.total_revenue)}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-[#27273D] font-medium">{c.total_orders}</td>
                      <td className="px-6 py-4 text-sm text-right text-gray-600">{formatCurrency(c.avg_ticket)}</td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${
                            c.is_active ? "bg-emerald-50 text-emerald-700" : "bg-orange-50 text-orange-700"
                          }`}
                        >
                          {c.is_active ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-xs text-gray-500">
                        {c.last_purchase_date ? new Date(c.last_purchase_date).toLocaleDateString("pt-BR") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
