"use client";

import { useState, useEffect } from "react";
import AppLayout from "@/components/app-layout";
import api from "@/lib/api";
import { toast } from "sonner";
import { TrendingUp, Users, ShoppingCart, DollarSign } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

interface RevenueItem {
  mes: string;
  clientes_unicos: number;
  total_pedidos: number;
  receita_total: number;
  ticket_medio: number;
  novos_clientes: number;
}

export default function ReceitaPage() {
  const [data, setData] = useState<RevenueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState(12);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/dashboard/revenue-timeseries", { params: { months } });
      setData(res.data.data);
    } catch {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [months]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const formatNumber = (value: number) =>
    new Intl.NumberFormat("pt-BR").format(value);

  const totalReceita = data.reduce((acc, d) => acc + d.receita_total, 0);
  const totalPedidos = data.reduce((acc, d) => acc + d.total_pedidos, 0);
  const totalNovos = data.reduce((acc, d) => acc + d.novos_clientes, 0);
  const avgTicket = totalPedidos > 0 ? totalReceita / totalPedidos : 0;

  const summaryCards = [
    { label: "Receita no Período", value: formatCurrency(totalReceita), icon: <DollarSign className="w-5 h-5 text-emerald-600" />, bg: "bg-emerald-50" },
    { label: "Total de Pedidos", value: formatNumber(totalPedidos), icon: <ShoppingCart className="w-5 h-5 text-[#2A658F]" />, bg: "bg-blue-50" },
    { label: "Novos Clientes", value: formatNumber(totalNovos), icon: <Users className="w-5 h-5 text-purple-600" />, bg: "bg-purple-50" },
    { label: "Ticket Médio", value: formatCurrency(avgTicket), icon: <TrendingUp className="w-5 h-5 text-orange-500" />, bg: "bg-orange-50" },
  ];

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
            <p className="text-sm font-medium text-[#2A658F] mb-1">Financeiro</p>
            <h1 className="text-2xl font-semibold text-[#27273D]">Receita</h1>
          </div>
          <select
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#2A658F] bg-white cursor-pointer"
          >
            <option value={6}>Últimos 6 meses</option>
            <option value={12}>Últimos 12 meses</option>
            <option value={24}>Últimos 24 meses</option>
            <option value={48}>Últimos 48 meses</option>
          </select>
        </div>

        {/* Summary Cards */}
        {!loading && (
          <div
            className={`grid grid-cols-2 lg:grid-cols-4 gap-4 transition-all duration-700 ${
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
            style={{ transitionDelay: "100ms" }}
          >
            {summaryCards.map((card) => (
              <div key={card.label} className="bg-white rounded-2xl p-5 border border-gray-100">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 ${card.bg} rounded-xl flex items-center justify-center`}>
                    {card.icon}
                  </div>
                </div>
                <p className="text-lg font-semibold text-[#27273D]">{card.value}</p>
                <p className="text-xs text-gray-500 mt-1">{card.label}</p>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2A658F]" />
          </div>
        ) : (
          <>
            {/* Receita Chart */}
            <div
              className={`bg-white rounded-2xl border border-gray-100 p-6 transition-all duration-700 ${
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
              style={{ transitionDelay: "200ms" }}
            >
              <h2 className="text-lg font-semibold text-[#27273D] mb-1">Receita Mensal</h2>
              <p className="text-sm text-gray-500 mb-6">Evolução da receita ao longo do tempo</p>
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2A658F" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#2A658F" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="mes" tick={{ fontSize: 12, fill: "#9ca3af" }} />
                  <YAxis tick={{ fontSize: 12, fill: "#9ca3af" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: any) => [formatCurrency(value), "Receita"]} contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb" }} />
                  <Area type="monotone" dataKey="receita_total" stroke="#2A658F" strokeWidth={2.5} fill="url(#colorReceita)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Pedidos + Novos Clientes */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div
                className={`bg-white rounded-2xl border border-gray-100 p-6 transition-all duration-700 ${
                  mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
                style={{ transitionDelay: "300ms" }}
              >
                <h2 className="text-lg font-semibold text-[#27273D] mb-1">Pedidos por Mês</h2>
                <p className="text-sm text-gray-500 mb-6">Volume de vendas mensal</p>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                    <YAxis tick={{ fontSize: 12, fill: "#9ca3af" }} />
                    <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb" }} />
                    <Bar dataKey="total_pedidos" name="Pedidos" fill="#2A658F" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div
                className={`bg-white rounded-2xl border border-gray-100 p-6 transition-all duration-700 ${
                  mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
                style={{ transitionDelay: "400ms" }}
              >
                <h2 className="text-lg font-semibold text-[#27273D] mb-1">Novos Clientes</h2>
                <p className="text-sm text-gray-500 mb-6">Primeira compra no mês</p>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                    <YAxis tick={{ fontSize: 12, fill: "#9ca3af" }} />
                    <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb" }} />
                    <Line type="monotone" dataKey="novos_clientes" name="Novos Clientes" stroke="#7c3aed" strokeWidth={2.5} dot={{ r: 4, fill: "#7c3aed" }} />
                    <Line type="monotone" dataKey="clientes_unicos" name="Clientes Únicos" stroke="#2A658F" strokeWidth={2} dot={{ r: 3, fill: "#2A658F" }} />
                    <Legend />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Table */}
            <div
              className={`bg-white rounded-2xl border border-gray-100 overflow-hidden transition-all duration-700 ${
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
              style={{ transitionDelay: "500ms" }}
            >
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-[#27273D]">Detalhamento Mensal</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Mês</th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Receita</th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Pedidos</th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Ticket Médio</th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Clientes</th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Novos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...data].reverse().map((d) => (
                      <tr key={d.mes} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-3 text-sm font-medium text-[#27273D]">{d.mes}</td>
                        <td className="px-6 py-3 text-sm text-right font-semibold text-[#27273D]">{formatCurrency(d.receita_total)}</td>
                        <td className="px-6 py-3 text-sm text-right text-gray-600">{d.total_pedidos}</td>
                        <td className="px-6 py-3 text-sm text-right text-gray-600">{formatCurrency(d.ticket_medio)}</td>
                        <td className="px-6 py-3 text-sm text-right text-gray-600">{d.clientes_unicos}</td>
                        <td className="px-6 py-3 text-sm text-right text-gray-600">{d.novos_clientes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
