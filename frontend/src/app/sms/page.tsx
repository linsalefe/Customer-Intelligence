"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Send,
  Search,
  Phone,
  MessageSquare,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Users,
  AlertCircle,
  Megaphone,
  Filter,
  ChevronDown,
  X,
  CheckSquare,
  Square,
  BarChart3,
} from "lucide-react";
import AppLayout from "@/components/app-layout";
import api from "@/lib/api";

interface SmsRecord {
  id: number;
  recipient: string;
  customer_name: string | null;
  content: string;
  status: string;
  sent_at: string;
  error_message: string | null;
}

interface Customer {
  customer_id: number;
  name: string;
  phone: string;
  email: string;
  total_revenue: number;
  total_orders: number;
  is_active: boolean;
  recency_band: string;
}

interface Campaign {
  id: number;
  name: string;
  message: string;
  total_recipients: number;
  total_sent: number;
  total_failed: number;
  status: string;
  sent_at: string | null;
}

type Tab = "individual" | "campanha" | "historico";

export default function SmsPage() {
  const [tab, setTab] = useState<Tab>("individual");
  const [mounted, setMounted] = useState(false);

  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<SmsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showCustomers, setShowCustomers] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [stats, setStats] = useState({ total: 0, delivered: 0, failed: 0 });

  const [campaignName, setCampaignName] = useState("");
  const [campaignMsg, setCampaignMsg] = useState("");
  const [filterProduct, setFilterProduct] = useState("");
  const [filterLtvMin, setFilterLtvMin] = useState("");
  const [filterLtvMax, setFilterLtvMax] = useState("");
  const [products, setProducts] = useState<{ name: string; count: number }[]>([]);
  const [previewList, setPreviewList] = useState<Customer[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [previewing, setPreviewing] = useState(false);
  const [sendingCampaign, setSendingCampaign] = useState(false);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  useEffect(() => { setMounted(true); loadHistory(); loadProducts(); loadCampaigns(); }, []);

  const loadHistory = async () => {
    try {
      const res = await api.get("/api/sms/history");
      setHistory(res.data.history || []);
      setStats(res.data.stats || { total: 0, delivered: 0, failed: 0 });
    } catch {} finally { setLoading(false); }
  };
  const loadProducts = async () => { try { const res = await api.get("/api/sms/campaigns/products"); setProducts(res.data || []); } catch {} };
  const loadCampaigns = async () => { try { const res = await api.get("/api/sms/campaigns"); setCampaigns(res.data || []); } catch {} };

  const searchCustomers = async (q: string) => {
    setCustomerSearch(q);
    if (q.length < 2) { setCustomers([]); return; }
    try { const res = await api.get(`/api/sms/customers?search=${encodeURIComponent(q)}`); setCustomers(res.data || []); } catch { setCustomers([]); }
  };
  const selectCustomer = (c: any) => { setSelectedCustomer(c); setPhone(c.phone || ""); setShowCustomers(false); setCustomerSearch(""); setCustomers([]); };

  const handleSend = async () => {
    if (!phone.trim() || !message.trim()) { toast.error("Preencha telefone e mensagem"); return; }
    setSending(true);
    try {
      const res = await api.post("/api/sms/send", { phone: phone.trim(), message: message.trim(), customer_id: selectedCustomer?.customer_id || null });
      if (res.data.success) { toast.success("SMS enviado"); setMessage(""); await loadHistory(); } else toast.error(res.data.error || "Erro ao enviar");
    } catch (err: any) { toast.error(err.response?.data?.detail || "Erro ao enviar SMS"); } finally { setSending(false); }
  };

  const handlePreview = async () => {
    setPreviewing(true);
    try {
      const res = await api.post("/api/sms/campaigns/preview", { product: filterProduct || null, ltv_min: filterLtvMin ? parseFloat(filterLtvMin) : null, ltv_max: filterLtvMax ? parseFloat(filterLtvMax) : null });
      const list = res.data.customers || [];
      setPreviewList(list);
      setSelectedIds(new Set(list.map((c: Customer) => c.customer_id)));
      if (list.length === 0) toast.error("Nenhum cliente encontrado");
    } catch { toast.error("Erro ao buscar"); } finally { setPreviewing(false); }
  };

  const toggleSelect = (id: number) => { setSelectedIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }); };
  const toggleSelectAll = () => { if (selectedIds.size === previewList.length) setSelectedIds(new Set()); else setSelectedIds(new Set(previewList.map((c) => c.customer_id))); };

  const handleSendCampaign = async () => {
    if (!campaignName.trim()) { toast.error("Dê um nome à campanha"); return; }
    if (!campaignMsg.trim()) { toast.error("Escreva a mensagem"); return; }
    if (selectedIds.size === 0) { toast.error("Selecione destinatários"); return; }
    if (!confirm(`Disparar ${selectedIds.size} SMS?\nCampanha: ${campaignName}\n\nIsso consumirá créditos.`)) return;
    setSendingCampaign(true);
    try {
      const res = await api.post("/api/sms/campaigns/send", { name: campaignName.trim(), message: campaignMsg.trim(), filters: { product: filterProduct || null, ltv_min: filterLtvMin ? parseFloat(filterLtvMin) : null, ltv_max: filterLtvMax ? parseFloat(filterLtvMax) : null }, recipient_ids: Array.from(selectedIds) });
      if (res.data.success) { toast.success(`${res.data.total_sent} enviados, ${res.data.total_failed} falhas`); setCampaignName(""); setCampaignMsg(""); setPreviewList([]); setSelectedIds(new Set()); setFilterProduct(""); setFilterLtvMin(""); setFilterLtvMax(""); await loadHistory(); await loadCampaigns(); }
    } catch (err: any) { toast.error(err.response?.data?.detail || "Erro"); } finally { setSendingCampaign(false); }
  };

  const charCount = (tab === "individual" ? message : campaignMsg).length;
  const formatPhone = (p: string) => { const c = p.replace(/\D/g, ""); if (c.length === 11) return `(${c.slice(0, 2)}) ${c.slice(2, 7)}-${c.slice(7)}`; if (c.length === 13 && c.startsWith("55")) return `(${c.slice(2, 4)}) ${c.slice(4, 9)}-${c.slice(9)}`; return p; };
  const formatTime = (ts: string) => { const d = new Date(ts); const now = new Date(); if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); };
  const filteredHistory = history.filter((h) => { if (!search) return true; const q = search.toLowerCase(); return h.recipient.includes(q) || (h.customer_name || "").toLowerCase().includes(q) || h.content.toLowerCase().includes(q); });
  const filteredProducts = products.filter((p) => p.name.toLowerCase().includes(productSearch.toLowerCase()));

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className={`transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <p className="text-sm font-medium text-[#2A658F] mb-1">Comunicação</p>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-[#27273D]">SMS</h1>
            <div className="flex gap-3">
              <div className="bg-white rounded-xl border border-gray-100 px-4 py-2 text-center">
                <p className="text-lg font-bold text-[#27273D]">{stats.total}</p>
                <p className="text-[10px] text-gray-400 uppercase">Enviados</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 px-4 py-2 text-center">
                <p className="text-lg font-bold text-emerald-600">{stats.delivered}</p>
                <p className="text-[10px] text-gray-400 uppercase">Entregues</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 px-4 py-2 text-center">
                <p className="text-lg font-bold text-red-500">{stats.failed}</p>
                <p className="text-[10px] text-gray-400 uppercase">Falhas</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className={`flex gap-2 transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`} style={{ transitionDelay: "50ms" }}>
          {[
            { id: "individual" as Tab, label: "Envio Individual", icon: <Send className="w-4 h-4" /> },
            { id: "campanha" as Tab, label: "Campanha em Massa", icon: <Megaphone className="w-4 h-4" /> },
            { id: "historico" as Tab, label: "Histórico", icon: <Clock className="w-4 h-4" /> },
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${tab === t.id ? "bg-[#2A658F] text-white shadow-sm" : "bg-white text-gray-500 border border-gray-100 hover:border-[#2A658F]/30"}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* INDIVIDUAL */}
        {tab === "individual" && (
          <div className={`bg-white rounded-2xl border border-gray-100 p-6 max-w-lg transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`} style={{ transitionDelay: "100ms" }}>
            <div className="space-y-5">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Destinatário</label>
                <div className="mt-2 relative">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm text-[#27273D] placeholder:text-gray-400 focus:outline-none focus:border-[#2A658F] focus:ring-1 focus:ring-[#2A658F] bg-white" />
                    </div>
                    <button onClick={() => setShowCustomers(!showCustomers)} className={`px-3 py-2.5 rounded-xl border transition-all ${showCustomers ? "bg-[#2A658F] text-white border-[#2A658F]" : "bg-white text-gray-400 border-gray-200 hover:border-[#2A658F]"}`}><Users className="w-4 h-4" /></button>
                  </div>
                  {selectedCustomer && (
                    <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <span className="text-xs text-emerald-700 flex-1">{selectedCustomer.name} — LTV: R$ {selectedCustomer.total_revenue?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                      <button onClick={() => { setSelectedCustomer(null); setPhone(""); }} className="text-gray-400 hover:text-red-500"><XCircle className="w-4 h-4" /></button>
                    </div>
                  )}
                  {showCustomers && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-gray-200 shadow-lg z-20 max-h-[300px] overflow-hidden">
                      <div className="p-2 border-b border-gray-100">
                        <input value={customerSearch} onChange={(e) => searchCustomers(e.target.value)} placeholder="Buscar cliente..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-[#27273D] placeholder:text-gray-400 outline-none focus:border-[#2A658F]" autoFocus />
                      </div>
                      <div className="overflow-y-auto max-h-[240px]">
                        {customers.length === 0 ? (
                          <p className="text-xs text-gray-400 text-center py-4">{customerSearch.length < 2 ? "Digite para buscar..." : "Nenhum encontrado"}</p>
                        ) : customers.map((c: any) => (
                          <button key={c.customer_id} onClick={() => selectCustomer(c)} className="w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                            <p className="text-sm text-[#27273D]">{c.name}</p>
                            <p className="text-xs text-gray-400">{formatPhone(c.phone)} — R$ {c.total_revenue?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Mensagem</label>
                  <span className={`text-xs ${message.length > 160 ? "text-amber-500 font-medium" : "text-gray-400"}`}>{message.length}/160 {message.length > 160 && `(${Math.ceil(message.length / 153)} SMS)`}</span>
                </div>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Digite a mensagem..." rows={4} className="w-full mt-2 px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-[#27273D] placeholder:text-gray-400 focus:outline-none focus:border-[#2A658F] focus:ring-1 focus:ring-[#2A658F] resize-none bg-white" />
                {message.length > 160 && (
                  <div className="flex items-center gap-1.5 mt-1.5"><AlertCircle className="w-3.5 h-3.5 text-amber-500" /><span className="text-xs text-amber-500">{Math.ceil(message.length / 153)} créditos por mensagem</span></div>
                )}
              </div>

              <button onClick={handleSend} disabled={sending || !phone.trim() || !message.trim()} className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 disabled:opacity-40 transition-all">
                {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                {sending ? "Enviando..." : "Enviar SMS"}
              </button>
            </div>
          </div>
        )}

        {/* CAMPANHA */}
        {tab === "campanha" && (
          <div className={`flex gap-6 transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`} style={{ transitionDelay: "100ms" }}>
            {/* Left — Filtros */}
            <div className="w-[380px] flex-shrink-0 space-y-5">
              <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Nome da Campanha</label>
                  <input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="Ex: Reativação Janeiro" className="w-full mt-2 px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-[#27273D] placeholder:text-gray-400 focus:outline-none focus:border-[#2A658F] focus:ring-1 focus:ring-[#2A658F] bg-white" />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5"><Filter className="w-3.5 h-3.5" /> Filtros</label>
                  <div className="mt-2 relative">
                    <button onClick={() => setShowProductDropdown(!showProductDropdown)} className="w-full flex items-center justify-between px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white">
                      <span className={filterProduct ? "text-[#27273D]" : "text-gray-400"}>{filterProduct || "Filtrar por produto..."}</span>
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showProductDropdown ? "rotate-180" : ""}`} />
                    </button>
                    {filterProduct && <button onClick={() => setFilterProduct("")} className="absolute right-10 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>}
                    {showProductDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-lg z-20 max-h-[250px] overflow-hidden">
                        <div className="p-2 border-b border-gray-100">
                          <input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Buscar produto..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs text-[#27273D] placeholder:text-gray-400 outline-none" autoFocus />
                        </div>
                        <div className="overflow-y-auto max-h-[200px]">
                          {filteredProducts.map((p) => (
                            <button key={p.name} onClick={() => { setFilterProduct(p.name); setShowProductDropdown(false); setProductSearch(""); }} className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors text-xs text-[#27273D] border-b border-gray-50 last:border-0">
                              {p.name} <span className="text-gray-400">({p.count})</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <input value={filterLtvMin} onChange={(e) => setFilterLtvMin(e.target.value)} placeholder="LTV mínimo" type="number" className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-[#27273D] placeholder:text-gray-400 focus:outline-none focus:border-[#2A658F] bg-white" />
                    <input value={filterLtvMax} onChange={(e) => setFilterLtvMax(e.target.value)} placeholder="LTV máximo" type="number" className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-[#27273D] placeholder:text-gray-400 focus:outline-none focus:border-[#2A658F] bg-white" />
                  </div>
                </div>

                <button onClick={handlePreview} disabled={previewing} className="w-full flex items-center justify-center gap-2 py-2.5 border border-gray-200 text-[#27273D] rounded-xl text-sm font-medium hover:bg-gray-50 disabled:opacity-40 transition-all">
                  {previewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Buscar Clientes
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Mensagem</label>
                    <span className={`text-xs ${campaignMsg.length > 160 ? "text-amber-500 font-medium" : "text-gray-400"}`}>{campaignMsg.length}/160</span>
                  </div>
                  <textarea value={campaignMsg} onChange={(e) => setCampaignMsg(e.target.value)} placeholder="Use {nome} para personalizar..." rows={4} className="w-full mt-2 px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-[#27273D] placeholder:text-gray-400 focus:outline-none focus:border-[#2A658F] focus:ring-1 focus:ring-[#2A658F] resize-none bg-white" />
                  {campaignMsg.includes("{nome}") && <p className="text-xs text-emerald-600 mt-1">✓ Nome personalizado</p>}
                  {campaignMsg.length > 160 && <div className="flex items-center gap-1.5 mt-1"><AlertCircle className="w-3.5 h-3.5 text-amber-500" /><span className="text-xs text-amber-500">{Math.ceil(campaignMsg.length / 153)} créditos/destinatário</span></div>}
                </div>
                <button onClick={handleSendCampaign} disabled={sendingCampaign || selectedIds.size === 0 || !campaignMsg.trim() || !campaignName.trim()} className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 disabled:opacity-40 transition-all">
                  {sendingCampaign ? <Loader2 className="w-5 h-5 animate-spin" /> : <Megaphone className="w-5 h-5" />}
                  {sendingCampaign ? "Enviando..." : `Disparar para ${selectedIds.size} contatos`}
                </button>
              </div>

              {campaigns.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5"><BarChart3 className="w-3.5 h-3.5" /> Campanhas Anteriores</p>
                  <div className="space-y-2">
                    {campaigns.slice(0, 5).map((c) => (
                      <div key={c.id} className="bg-gray-50 rounded-xl p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-[#27273D]">{c.name}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${c.status === "completed" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{c.status === "completed" ? "Concluída" : c.status}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                          <span>✅ {c.total_sent} enviados</span>
                          {c.total_failed > 0 && <span className="text-red-500">❌ {c.total_failed}</span>}
                          {c.sent_at && <span>{new Date(c.sent_at).toLocaleDateString("pt-BR")}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right — Preview */}
            <div className="flex-1 min-w-0">
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden" style={{ minHeight: "500px" }}>
                {previewList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[500px]">
                    <Users className="w-12 h-12 text-gray-200 mb-3" />
                    <p className="text-sm text-gray-400">Use os filtros e clique em "Buscar Clientes"</p>
                    <p className="text-xs text-gray-300 mt-1">Os destinatários aparecerão aqui</p>
                  </div>
                ) : (
                  <>
                    <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                      <div className="flex items-center gap-3">
                        <button onClick={toggleSelectAll} className="text-gray-400 hover:text-[#2A658F]">
                          {selectedIds.size === previewList.length ? <CheckSquare className="w-5 h-5 text-[#2A658F]" /> : <Square className="w-5 h-5" />}
                        </button>
                        <span className="text-sm font-medium text-[#27273D]">{selectedIds.size} de {previewList.length} selecionados</span>
                      </div>
                    </div>
                    <div className="overflow-y-auto" style={{ maxHeight: "460px" }}>
                      {previewList.map((c) => (
                        <div key={c.customer_id} onClick={() => toggleSelect(c.customer_id)} className={`flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors border-b border-gray-50 ${selectedIds.has(c.customer_id) ? "bg-blue-50/30" : "hover:bg-gray-50/50"}`}>
                          <div>{selectedIds.has(c.customer_id) ? <CheckSquare className="w-5 h-5 text-[#2A658F]" /> : <Square className="w-5 h-5 text-gray-300" />}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-[#27273D]">{c.name}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${c.is_active ? "bg-emerald-50 text-emerald-700" : "bg-orange-50 text-orange-700"}`}>{c.is_active ? "Ativo" : "Inativo"}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                              <span>{formatPhone(c.phone)}</span>
                              <span>{c.total_orders} pedidos</span>
                              <span>{c.recency_band}</span>
                            </div>
                          </div>
                          <p className="text-sm font-semibold text-emerald-600">R$ {c.total_revenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* HISTÓRICO */}
        {tab === "historico" && (
          <div className={`bg-white rounded-2xl border border-gray-100 overflow-hidden transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`} style={{ transitionDelay: "100ms" }}>
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar no histórico..." className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm text-[#27273D] placeholder:text-gray-400 focus:outline-none focus:border-[#2A658F] bg-white" />
              </div>
              <span className="text-xs text-gray-400">{filteredHistory.length} registros</span>
            </div>
            <div style={{ maxHeight: "600px" }} className="overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2A658F]" /></div>
              ) : filteredHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48"><MessageSquare className="w-10 h-10 text-gray-200 mb-3" /><p className="text-sm text-gray-400">Nenhum SMS enviado ainda</p></div>
              ) : (
                <table className="w-full">
                  <thead><tr className="border-b border-gray-100"><th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Destinatário</th><th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Mensagem</th><th className="px-5 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Data</th><th className="px-5 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Status</th></tr></thead>
                  <tbody>
                    {filteredHistory.map((sms) => (
                      <tr key={sms.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-3">
                          <p className="text-sm font-medium text-[#27273D]">{formatPhone(sms.recipient)}</p>
                          {sms.customer_name && <span className="text-xs text-emerald-600">{sms.customer_name}</span>}
                        </td>
                        <td className="px-5 py-3 text-sm text-gray-500 max-w-[300px] truncate">{sms.content}</td>
                        <td className="px-5 py-3 text-sm text-gray-400 text-right whitespace-nowrap">{formatTime(sms.sent_at)}</td>
                        <td className="px-5 py-3 text-right">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium ${sms.status === "failed" ? "text-red-500" : sms.status === "sent" ? "text-emerald-600" : "text-gray-400"}`}>
                            {sms.status === "sent" && <CheckCircle2 className="w-3.5 h-3.5" />}
                            {sms.status === "failed" && <XCircle className="w-3.5 h-3.5" />}
                            {sms.status === "sent" ? "Enviado" : sms.status === "failed" ? "Falhou" : sms.status}
                          </span>
                          {sms.error_message && <p className="text-[10px] text-red-400 mt-0.5 truncate max-w-[150px] ml-auto">{sms.error_message}</p>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}