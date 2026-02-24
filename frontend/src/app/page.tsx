"use client";

import { useState, useEffect } from "react";
import AppLayout from "@/components/app-layout";
import api from "@/lib/api";
import { toast } from "sonner";
import {
  Users,
  UserCheck,
  UserX,
  DollarSign,
  ShoppingCart,
  TrendingUp,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

interface KPIs {
  total_compradores: number;
  clientes_ativos: number;
  clientes_inativos: number;
  receita_total: number;
  ticket_medio: number;
  ltv_medio: number;
  total_pedidos: number;
  pedidos_ultimos_30_dias: number;
  pedidos_ultimos_90_dias: number;
  primeira_venda: string;
  ultima_venda: string;
}

interface RevenueItem {
  mes: string;
  clientes_unicos: number;
  total_pedidos: number;
  receita_total: number;
  ticket_medio: number;
  novos_clientes: number;
}

export default function DashboardPage() {
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [revenue, setRevenue] = useState<RevenueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const loadData = async () => {
    try {
      const [kpiRes, revRes] = await Promise.all([
        api.get("/api/dashboard/kpis"),
        api.get("/api/dashboard/revenue-timeseries?months=12"),
      ]);
      setKpis(kpiRes.data);
      setRevenue(revRes.data.data);
    } catch {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
    toast.success("Dados atualizados");
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const formatNumber = (value: number) =>
    new Intl.NumberFormat("pt-BR").format(value);

  if (loading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="h-8 bg-gray-200 rounded-lg w-64 animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-2xl animate-pulse" />
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  const kpiCards = [
    {
      label: "Compradores",
      value: formatNumber(kpis?.total_compradores || 0),
      icon: <Users className="w-6 h-6 text-[#2A658F]" />,
      bg: "bg-blue-50",
    },
    {
      label: "Ativos",
      value: formatNumber(kpis?.clientes_ativos || 0),
      icon: <UserCheck className="w-6 h-6 text-emerald-600" />,
      bg: "bg-emerald-50",
    },
    {
      label: "Inativos",
      value: formatNumber(kpis?.clientes_inativos || 0),
      icon: <UserX className="w-6 h-6 text-orange-500" />,
      bg: "bg-orange-50",
    },
    {
      label: "Total Pedidos",
      value: formatNumber(kpis?.total_pedidos || 0),
      icon: <ShoppingCart className="w-6 h-6 text-purple-600" />,
      bg: "bg-purple-50",
    },
  ];

  const financeCards = [
    { label: "Receita Total", value: formatCurrency(kpis?.receita_total || 0) },
    { label: "Ticket Médio", value: formatCurrency(kpis?.ticket_medio || 0) },
    { label: "LTV Médio", value: formatCurrency(kpis?.ltv_medio || 0) },
    { label: "Pedidos (30d)", value: formatNumber(kpis?.pedidos_ultimos_30_dias || 0) },
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
            <p className="text-sm font-medium text-[#2A658F] mb-1">Dashboard</p>
            <h1 className="text-2xl font-semibold text-[#27273D]">Visão Geral</h1>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all duration-200 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </div>

        {/* KPI Cards */}
        <div
          className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 transition-all duration-700 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
          style={{ transitionDelay: "100ms" }}
        >
          {kpiCards.map((card) => (
            <div
              key={card.label}
              className="bg-white rounded-2xl p-6 border border-gray-100 hover:border-gray-200 hover:shadow-lg hover:shadow-gray-100/50 transition-all duration-300"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 ${card.bg} rounded-xl flex items-center justify-center`}>
                  {card.icon}
                </div>
              </div>
              <p className="text-2xl font-semibold text-[#27273D] mb-1">{card.value}</p>
              <p className="text-sm text-gray-500">{card.label}</p>
            </div>
          ))}
        </div>

        {/* Finance Cards */}
        <div
          className={`grid grid-cols-2 lg:grid-cols-4 gap-4 transition-all duration-700 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
          style={{ transitionDelay: "200ms" }}
        >
          {financeCards.map((card) => (
            <div
              key={card.label}
              className="bg-gradient-to-br from-[#27273D] to-[#2A658F] rounded-2xl p-5 text-white"
            >
              <p className="text-xs text-white/60 mb-2">{card.label}</p>
              <p className="text-lg font-semibold">{card.value}</p>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div
          className={`grid grid-cols-1 lg:grid-cols-2 gap-6 transition-all duration-700 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
          style={{ transitionDelay: "300ms" }}
        >
          {/* Receita */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-[#27273D] mb-1">Receita Mensal</h2>
            <p className="text-sm text-gray-500 mb-6">Últimos 12 meses</p>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={revenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="mes" tick={{ fontSize: 12, fill: "#9ca3af" }} />
                <YAxis tick={{ fontSize: 12, fill: "#9ca3af" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value: any) => [formatCurrency(Number(value)), "Receita"]}
                  contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb" }}
                />
                <Line type="monotone" dataKey="receita_total" stroke="#2A658F" strokeWidth={2.5} dot={{ r: 4, fill: "#2A658F" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Pedidos */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-[#27273D] mb-1">Pedidos por Mês</h2>
            <p className="text-sm text-gray-500 mb-6">Últimos 12 meses</p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={revenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="mes" tick={{ fontSize: 12, fill: "#9ca3af" }} />
                <YAxis tick={{ fontSize: 12, fill: "#9ca3af" }} />
                <Tooltip
                  formatter={(value: any) => [formatNumber(Number(value)), "Pedidos"]}
                  contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb" }}
                />
                <Bar dataKey="total_pedidos" fill="#2A658F" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
