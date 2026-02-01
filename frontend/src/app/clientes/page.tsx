"use client";

import { useState, useEffect, useCallback } from "react";
import AppLayout from "@/components/app-layout";
import api from "@/lib/api";
import { toast } from "sonner";
import {
  Search, Filter, ChevronLeft, ChevronRight, X,
  ShoppingCart, Calendar, CreditCard, Package, User,
  Phone, Mail, MapPin,
} from "lucide-react";

interface Client {
  customer_id: number;
  email_master: string;
  name_master: string;
  phone_master: string;
  city: string;
  state: string;
  total_orders: number;
  total_revenue: number;
  avg_ticket: number;
  is_active: boolean;
  recency_band: string;
  customer_segment: string;
}

interface Order {
  order_id: number;
  product_name: string;
  sale_date: string;
  total_price: number;
  original_price: number;
  original_currency: string;
  payment_type: string;
  source: string;
}

interface CustomerDetail {
  customer: Client & {
    first_purchase_date: string;
    last_purchase_date: string;
    days_since_last_purchase: number;
  };
  orders: Order[];
}

export default function ClientesPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState("");
  const [offset, setOffset] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 50;

  // Drawer state
  const [selectedClient, setSelectedClient] = useState<CustomerDetail | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);

  useEffect(() => setMounted(true), []);

  const loadData = async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { limit, offset };
      if (segment) params.segment = segment;
      const res = await api.get("/api/dashboard/active-inactive", { params });
      setClients(res.data.data);
    } catch {
      toast.error("Erro ao carregar clientes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [segment, offset]);

  const openDrawer = async (customerId: number) => {
    setDrawerOpen(true);
    setDrawerLoading(true);
    try {
      const res = await api.get(`/api/dashboard/customer/${customerId}/orders`);
      setSelectedClient(res.data);
    } catch {
      toast.error("Erro ao carregar histórico");
      setDrawerOpen(false);
    } finally {
      setDrawerLoading(false);
    }
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedClient(null);
  };

  const filtered = search
    ? clients.filter(
        (c) =>
          c.name_master?.toLowerCase().includes(search.toLowerCase()) ||
          c.email_master?.toLowerCase().includes(search.toLowerCase())
      )
    : clients;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const segmentBadge = (seg: string) => {
    const styles: Record<string, string> = {
      Ativo: "bg-emerald-50 text-emerald-700",
      Inativo: "bg-orange-50 text-orange-700",
      Lead: "bg-gray-100 text-gray-600",
    };
    return styles[seg] || "bg-gray-100 text-gray-600";
  };

  const sourceBadge = (source: string) => {
    const styles: Record<string, string> = {
      hotmart: "bg-orange-50 text-orange-700",
      doity: "bg-blue-50 text-blue-700",
    };
    return styles[source] || "bg-gray-100 text-gray-600";
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div
          className={`transition-all duration-700 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
          }`}
        >
          <p className="text-sm font-medium text-[#2A658F] mb-1">Gestão</p>
          <h1 className="text-2xl font-semibold text-[#27273D]">Clientes</h1>
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
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={segment}
              onChange={(e) => {
                setSegment(e.target.value);
                setOffset(0);
              }}
              className="pl-10 pr-8 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#2A658F] bg-white appearance-none cursor-pointer"
            >
              <option value="">Todos os segmentos</option>
              <option value="Ativo">Ativos</option>
              <option value="Inativo">Inativos</option>
              
            </select>
          </div>
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
                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Local</th>
                    <th className="text-right px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Pedidos</th>
                    <th className="text-right px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Receita</th>
                    <th className="text-center px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="text-center px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Recência</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr
                      key={c.customer_id}
                      onClick={() => openDrawer(c.customer_id)}
                      className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-[#27273D]">{c.name_master || "—"}</p>
                        <p className="text-xs text-gray-400">{c.email_master}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{c.phone_master || "—"}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {c.city && c.state ? `${c.city}, ${c.state}` : c.state || "—"}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-[#27273D] font-medium">{c.total_orders}</td>
                      <td className="px-6 py-4 text-sm text-right text-[#27273D] font-medium">
                        {formatCurrency(c.total_revenue || 0)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${segmentBadge(c.customer_segment)}`}>
                          {c.customer_segment}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-xs text-gray-500">{c.recency_band}</td>
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

      {/* Drawer Overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end" onClick={closeDrawer}>
          <div
            className="bg-white w-full max-w-lg h-full overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {drawerLoading ? (
              <div className="h-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2A658F]" />
              </div>
            ) : selectedClient ? (
              <div>
                {/* Drawer Header */}
                <div className="sticky top-0 bg-gradient-to-r from-[#27273D] to-[#2A658F] p-6 text-white z-10">
                  <button
                    onClick={closeDrawer}
                    className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center text-xl font-semibold">
                      {selectedClient.customer.name_master?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold">{selectedClient.customer.name_master || "Sem nome"}</h2>
                      <p className="text-white/70 text-sm">{selectedClient.customer.email_master}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white/10 rounded-xl p-3 text-center">
                      <p className="text-white/60 text-xs">Pedidos</p>
                      <p className="text-lg font-semibold">{selectedClient.customer.total_orders || 0}</p>
                    </div>
                    <div className="bg-white/10 rounded-xl p-3 text-center">
                      <p className="text-white/60 text-xs">LTV</p>
                      <p className="text-lg font-semibold">{formatCurrency(selectedClient.customer.total_revenue || 0)}</p>
                    </div>
                    <div className="bg-white/10 rounded-xl p-3 text-center">
                      <p className="text-white/60 text-xs">Ticket Médio</p>
                      <p className="text-lg font-semibold">{formatCurrency(selectedClient.customer.avg_ticket || 0)}</p>
                    </div>
                  </div>
                </div>

                {/* Client Info */}
                <div className="p-6 space-y-6">
                  <div>
                    <h3 className="text-sm font-semibold text-[#27273D] mb-3">Informações</h3>
                    <div className="space-y-2.5">
                      {selectedClient.customer.phone_master && (
                        <div className="flex items-center gap-3 text-sm text-gray-600">
                          <Phone className="w-4 h-4 text-gray-400" />
                          {selectedClient.customer.phone_master}
                        </div>
                      )}
                      <div className="flex items-center gap-3 text-sm text-gray-600">
                        <Mail className="w-4 h-4 text-gray-400" />
                        {selectedClient.customer.email_master}
                      </div>
                      {(selectedClient.customer.city || selectedClient.customer.state) && (
                        <div className="flex items-center gap-3 text-sm text-gray-600">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          {[selectedClient.customer.city, selectedClient.customer.state].filter(Boolean).join(", ")}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${
                        selectedClient.customer.is_active
                          ? "bg-emerald-50 text-emerald-700"
                          : selectedClient.customer.total_orders > 0
                          ? "bg-orange-50 text-orange-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {selectedClient.customer.is_active ? "Ativo" : selectedClient.customer.total_orders > 0 ? "Inativo" : "Lead"}
                    </span>
                    <span className="text-xs text-gray-400">{selectedClient.customer.recency_band}</span>
                    {selectedClient.customer.last_purchase_date && (
                      <span className="text-xs text-gray-400">
                        · Última compra: {new Date(selectedClient.customer.last_purchase_date).toLocaleDateString("pt-BR")}
                      </span>
                    )}
                  </div>

                  {/* Orders History */}
                  <div>
                    <h3 className="text-sm font-semibold text-[#27273D] mb-3">
                      Histórico de Compras ({selectedClient.orders.length})
                    </h3>

                    {selectedClient.orders.length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Nenhuma compra registrada</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedClient.orders.map((order) => (
                          <div
                            key={order.order_id}
                            className="border border-gray-100 rounded-xl p-4 hover:border-gray-200 transition-all"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Package className="w-4 h-4 text-[#2A658F]" />
                                <p className="text-sm font-medium text-[#27273D] leading-tight">
                                  {order.product_name}
                                </p>
                              </div>
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${sourceBadge(order.source)}`}>
                                {order.source}
                              </span>
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4 text-xs text-gray-500">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5" />
                                  {new Date(order.sale_date).toLocaleDateString("pt-BR")}
                                </span>
                                {order.payment_type && (
                                  <span className="flex items-center gap-1">
                                    <CreditCard className="w-3.5 h-3.5" />
                                    {order.payment_type}
                                  </span>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-semibold text-[#27273D]">
                                  {formatCurrency(order.total_price)}
                                </p>
                                {order.original_currency && order.original_currency !== "BRL" && (
                                  <p className="text-[10px] text-gray-400">
                                    Original: {order.original_price} {order.original_currency}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
