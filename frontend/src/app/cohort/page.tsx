"use client";

import { useState, useEffect } from "react";
import AppLayout from "@/components/app-layout";
import api from "@/lib/api";
import { toast } from "sonner";

interface CohortItem {
  cohort_month: string;
  months_since: number;
  customers: number;
  revenue: number;
}

export default function CohortPage() {
  const [data, setData] = useState<CohortItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState(12);
  const [viewMode, setViewMode] = useState<"retention" | "revenue">("retention");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/dashboard/cohort", { params: { months } });
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

  // Build cohort matrix
  const cohorts = [...new Set(data.map((d) => d.cohort_month))].sort();
  const maxMonthsSince = Math.min(
    Math.max(...data.map((d) => d.months_since), 0),
    12
  );

  const cohortMap: Record<string, Record<number, { customers: number; revenue: number }>> = {};
  const cohortBase: Record<string, number> = {};

  data.forEach((d) => {
    if (!cohortMap[d.cohort_month]) cohortMap[d.cohort_month] = {};
    cohortMap[d.cohort_month][d.months_since] = {
      customers: d.customers,
      revenue: d.revenue,
    };
    if (d.months_since === 0) {
      cohortBase[d.cohort_month] = d.customers;
    }
  });

  const getRetentionRate = (cohort: string, month: number) => {
    const base = cohortBase[cohort];
    const current = cohortMap[cohort]?.[month]?.customers;
    if (!base || !current) return null;
    return ((current / base) * 100).toFixed(1);
  };

  const getRevenue = (cohort: string, month: number) => {
    return cohortMap[cohort]?.[month]?.revenue || null;
  };

  const getCellColor = (value: number | null, isBase: boolean) => {
    if (isBase) return "bg-[#27273D] text-white";
    if (value === null) return "bg-gray-50 text-gray-300";

    if (viewMode === "retention") {
      const v = Number(value);
      if (v >= 20) return "bg-emerald-600 text-white";
      if (v >= 15) return "bg-emerald-500 text-white";
      if (v >= 10) return "bg-emerald-400 text-white";
      if (v >= 5) return "bg-emerald-300 text-emerald-900";
      if (v > 0) return "bg-emerald-100 text-emerald-800";
      return "bg-gray-50 text-gray-300";
    } else {
      const v = Number(value);
      if (v >= 5000) return "bg-[#2A658F] text-white";
      if (v >= 2000) return "bg-[#3d7ba8] text-white";
      if (v >= 1000) return "bg-blue-300 text-blue-900";
      if (v >= 500) return "bg-blue-200 text-blue-800";
      if (v > 0) return "bg-blue-100 text-blue-700";
      return "bg-gray-50 text-gray-300";
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);

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
            <p className="text-sm font-medium text-[#2A658F] mb-1">Análise</p>
            <h1 className="text-2xl font-semibold text-[#27273D]">Análise de Cohort</h1>
            <p className="text-sm text-gray-500 mt-1">Retenção e receita por mês de primeira compra</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-white border border-gray-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setViewMode("retention")}
                className={`px-4 py-2 text-sm font-medium transition-all ${
                  viewMode === "retention"
                    ? "bg-[#2A658F] text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                Retenção %
              </button>
              <button
                onClick={() => setViewMode("revenue")}
                className={`px-4 py-2 text-sm font-medium transition-all ${
                  viewMode === "revenue"
                    ? "bg-[#2A658F] text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                Receita
              </button>
            </div>
            <select
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
              className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#2A658F] bg-white cursor-pointer"
            >
              <option value={6}>6 meses</option>
              <option value={12}>12 meses</option>
              <option value={24}>24 meses</option>
            </select>
          </div>
        </div>

        {/* Cohort Table */}
        <div
          className={`bg-white rounded-2xl border border-gray-100 overflow-hidden transition-all duration-700 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
          style={{ transitionDelay: "100ms" }}
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
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider sticky left-0 bg-white z-10 min-w-[100px]">
                      Cohort
                    </th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[70px]">
                      Base
                    </th>
                    {Array.from({ length: maxMonthsSince }, (_, i) => i + 1).map((m) => (
                      <th key={m} className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[70px]">
                        M{m}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cohorts.map((cohort) => {
                    const base = cohortBase[cohort] || 0;
                    return (
                      <tr key={cohort} className="border-b border-gray-50">
                        <td className="px-4 py-2.5 text-sm font-medium text-[#27273D] sticky left-0 bg-white z-10">
                          {cohort}
                        </td>
                        <td className="px-1 py-1 text-center">
                          <div className={`rounded-lg py-2 text-xs font-semibold ${getCellColor(100, true)}`}>
                            {base}
                          </div>
                        </td>
                        {Array.from({ length: maxMonthsSince }, (_, i) => i + 1).map((m) => {
                          const retention = getRetentionRate(cohort, m);
                          const revenue = getRevenue(cohort, m);
                          const displayValue = viewMode === "retention" ? retention : revenue;
                          const formattedValue =
                            viewMode === "retention"
                              ? displayValue !== null ? `${displayValue}%` : "—"
                              : displayValue !== null ? formatCurrency(Number(displayValue)) : "—";

                          return (
                            <td key={m} className="px-1 py-1 text-center">
                              <div
                                className={`rounded-lg py-2 text-xs font-medium transition-all duration-200 ${getCellColor(
                                  displayValue !== null ? Number(displayValue) : null,
                                  false
                                )}`}
                              >
                                {formattedValue}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Legend */}
        <div
          className={`bg-white rounded-2xl border border-gray-100 p-6 transition-all duration-700 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
          style={{ transitionDelay: "200ms" }}
        >
          <h3 className="text-sm font-semibold text-[#27273D] mb-3">Como ler esta tabela</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
            <div>
              <p><span className="font-medium text-[#27273D]">Cohort:</span> Mês da primeira compra do cliente</p>
              <p><span className="font-medium text-[#27273D]">Base:</span> Quantos clientes compraram pela primeira vez naquele mês</p>
            </div>
            <div>
              <p><span className="font-medium text-[#27273D]">M1, M2...:</span> Meses após a primeira compra</p>
              <p><span className="font-medium text-[#27273D]">Retenção %:</span> Percentual de clientes que voltaram a comprar</p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
