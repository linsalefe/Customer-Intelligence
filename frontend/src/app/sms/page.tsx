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

  // Individual
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

  // Campanha
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

  useEffect(() => {
    loadHistory();
    loadProducts();
    loadCampaigns();
  }, []);

  const loadHistory = async () => {
    try {
      const res = await api.get("/api/sms/history");
      setHistory(res.data.history || []);
      setStats(res.data.stats || { total: 0, delivered: 0, failed: 0 });
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  const loadProducts = async () => {
    try {
      const res = await api.get("/api/sms/campaigns/products");
      setProducts(res.data || []);
    } catch { /* silent */ }
  };

  const loadCampaigns = async () => {
    try {
      const res = await api.get("/api/sms/campaigns");
      setCampaigns(res.data || []);
    } catch { /* silent */ }
  };

  // Individual
  const searchCustomers = async (q: string) => {
    setCustomerSearch(q);
    if (q.length < 2) { setCustomers([]); return; }
    try {
      const res = await api.get(`/api/sms/customers?search=${encodeURIComponent(q)}`);
      setCustomers(res.data || []);
    } catch { setCustomers([]); }
  };

  const selectCustomer = (c: any) => {
    setSelectedCustomer(c);
    setPhone(c.phone || "");
    setShowCustomers(false);
    setCustomerSearch("");
    setCustomers([]);
  };

  const handleSend = async () => {
    if (!phone.trim() || !message.trim()) { toast.error("Preencha telefone e mensagem"); return; }
    setSending(true);
    try {
      const res = await api.post("/api/sms/send", { phone: phone.trim(), message: message.trim(), customer_id: selectedCustomer?.customer_id || null });
      if (res.data.success) { toast.success("SMS enviado"); setMessage(""); await loadHistory(); }
      else toast.error(res.data.error || "Erro ao enviar");
    } catch (err: any) { toast.error(err.response?.data?.detail || "Erro ao enviar SMS"); }
    finally { setSending(false); }
  };

  // Campanha
  const handlePreview = async () => {
    setPreviewing(true);
    try {
      const res = await api.post("/api/sms/campaigns/preview", {
        product: filterProduct || null,
        ltv_min: filterLtvMin ? parseFloat(filterLtvMin) : null,
        ltv_max: filterLtvMax ? parseFloat(filterLtvMax) : null,
      });
      const list = res.data.customers || [];
      setPreviewList(list);
      setSelectedIds(new Set(list.map((c: Customer) => c.customer_id)));
      if (list.length === 0) toast.error("Nenhum cliente encontrado com esses filtros");
    } catch { toast.error("Erro ao buscar clientes"); }
    finally { setPreviewing(false); }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === previewList.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(previewList.map((c) => c.customer_id)));
  };

  const handleSendCampaign = async () => {
    if (!campaignName.trim()) { toast.error("Dê um nome à campanha"); return; }
    if (!campaignMsg.trim()) { toast.error("Escreva a mensagem"); return; }
    if (selectedIds.size === 0) { toast.error("Selecione ao menos 1 destinatário"); return; }
    if (!confirm(`Disparar ${selectedIds.size} SMS?\nCampanha: ${campaignName}\n\nIsso consumirá créditos da Comtele.`)) return;

    setSendingCampaign(true);
    try {
      const res = await api.post("/api/sms/campaigns/send", {
        name: campaignName.trim(),
        message: campaignMsg.trim(),
        filters: { product: filterProduct || null, ltv_min: filterLtvMin ? parseFloat(filterLtvMin) : null, ltv_max: filterLtvMax ? parseFloat(filterLtvMax) : null },
        recipient_ids: Array.from(selectedIds),
      });
      if (res.data.success) {
        toast.success(`Campanha enviada! ${res.data.total_sent} enviados, ${res.data.total_failed} falhas`);
        setCampaignName(""); setCampaignMsg(""); setPreviewList([]); setSelectedIds(new Set());
        setFilterProduct(""); setFilterLtvMin(""); setFilterLtvMax("");
        await loadHistory(); await loadCampaigns();
      }
    } catch (err: any) { toast.error(err.response?.data?.detail || "Erro ao enviar campanha"); }
    finally { setSendingCampaign(false); }
  };

  // Helpers
  const charCount = (tab === "individual" ? message : campaignMsg).length;
  const smsCount = charCount === 0 ? 0 : charCount <= 160 ? 1 : Math.ceil(charCount / 153);
  const formatPhone = (p: string) => {
    const c = p.replace(/\D/g, "");
    if (c.length === 11) return `(${c.slice(0, 2)}) ${c.slice(2, 7)}-${c.slice(7)}`;
    if (c.length === 13 && c.startsWith("55")) return `(${c.slice(2, 4)}) ${c.slice(4, 9)}-${c.slice(9)}`;
    return p;
  };
  const formatTime = (ts: string) => {
    const d = new Date(ts); const now = new Date();
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };
  const getStatusIcon = (s: string) => {
    switch (s) { case "sent": return <CheckCircle2 className="w-4 h-4 text-emerald-400" />; case "delivered": return <CheckCircle2 className="w-4 h-4 text-blue-400" />; case "failed": return <XCircle className="w-4 h-4 text-red-400" />; default: return <Clock className="w-4 h-4 text-[#8696a0]" />; }
  };
  const getStatusLabel = (s: string) => {
    switch (s) { case "sent": return "Enviado"; case "delivered": return "Entregue"; case "failed": return "Falhou"; default: return "Pendente"; }
  };
  const filteredHistory = history.filter((h) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return h.recipient.includes(q) || (h.customer_name || "").toLowerCase().includes(q) || h.content.toLowerCase().includes(q);
  });
  const filteredProducts = products.filter((p) => p.name.toLowerCase().includes(productSearch.toLowerCase()));

  return (
    <AppLayout>
      <div className="flex flex-col bg-[#111b21]" style={{ marginTop: "-24px", marginLeft: "-24px", marginRight: "-24px", marginBottom: "-24px", minHeight: "calc(100vh)", height: "calc(100vh)" }}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#2a3942]">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-[#e9edef]">SMS</h1>
              <p className="text-sm text-[#8696a0] mt-0.5">Envio de SMS via Comtele</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#202c33] rounded-xl px-4 py-2 text-center border border-[#2a3942]">
                <p className="text-[18px] font-bold text-[#e9edef]">{stats.total}</p>
                <p className="text-[10px] text-[#8696a0] uppercase">Enviados</p>
              </div>
              <div className="bg-[#202c33] rounded-xl px-4 py-2 text-center border border-[#2a3942]">
                <p className="text-[18px] font-bold text-emerald-400">{stats.delivered}</p>
                <p className="text-[10px] text-[#8696a0] uppercase">Entregues</p>
              </div>
              <div className="bg-[#202c33] rounded-xl px-4 py-2 text-center border border-[#2a3942]">
                <p className="text-[18px] font-bold text-red-400">{stats.failed}</p>
                <p className="text-[10px] text-[#8696a0] uppercase">Falhas</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4">
            {[
              { id: "individual" as Tab, label: "Envio Individual", icon: <Send className="w-4 h-4" /> },
              { id: "campanha" as Tab, label: "Campanha em Massa", icon: <Megaphone className="w-4 h-4" /> },
              { id: "historico" as Tab, label: "Histórico", icon: <Clock className="w-4 h-4" /> },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-all ${tab === t.id ? "bg-[#00a884] text-[#111b21]" : "text-[#8696a0] hover:bg-[#202c33]"}`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* INDIVIDUAL */}
        {tab === "individual" && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-lg mx-auto space-y-4">
              <div>
                <label className="text-[11px] font-semibold text-[#8696a0] uppercase tracking-wider">Destinatário</label>
                <div className="mt-1.5 relative">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8696a0]" />
                      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" className="w-full pl-10 pr-3 py-2.5 bg-[#2a3942] rounded-lg text-[14px] text-[#e9edef] placeholder:text-[#8696a0] outline-none focus:ring-1 focus:ring-[#00a884]" />
                    </div>
                    <button onClick={() => setShowCustomers(!showCustomers)} className={`px-3 py-2.5 rounded-lg transition-colors ${showCustomers ? "bg-[#00a884] text-[#111b21]" : "bg-[#2a3942] text-[#8696a0]"}`}><Users className="w-4 h-4" /></button>
                  </div>
                  {selectedCustomer && (
                    <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                      <span className="text-[12px] text-emerald-400 flex-1">{selectedCustomer.name} — LTV: R$ {selectedCustomer.total_revenue?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                      <button onClick={() => { setSelectedCustomer(null); setPhone(""); }} className="text-[#8696a0] hover:text-red-400"><XCircle className="w-4 h-4" /></button>
                    </div>
                  )}
                  {showCustomers && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-[#233138] rounded-xl border border-[#2a3942] shadow-xl z-20 max-h-[300px] overflow-hidden">
                      <div className="p-2 border-b border-[#2a3942]">
                        <input value={customerSearch} onChange={(e) => searchCustomers(e.target.value)} placeholder="Buscar cliente por nome ou telefone..." className="w-full px-3 py-2 bg-[#2a3942] rounded-lg text-[13px] text-[#e9edef] placeholder:text-[#8696a0] outline-none" autoFocus />
                      </div>
                      <div className="overflow-y-auto max-h-[240px]">
                        {customers.length === 0 ? (
                          <p className="text-[12px] text-[#8696a0] text-center py-4">{customerSearch.length < 2 ? "Digite para buscar..." : "Nenhum encontrado"}</p>
                        ) : customers.map((c: any) => (
                          <button key={c.customer_id} onClick={() => selectCustomer(c)} className="w-full text-left px-3 py-2.5 hover:bg-[#182229] transition-colors border-b border-[#2a3942]/50 last:border-0">
                            <p className="text-[13px] text-[#e9edef]">{c.name}</p>
                            <p className="text-[11px] text-[#8696a0]">{formatPhone(c.phone)} — R$ {c.total_revenue?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-[#8696a0] uppercase tracking-wider">Mensagem</label>
                  <span className={`text-[11px] ${message.length > 160 ? "text-amber-400" : "text-[#8696a0]"}`}>{message.length}/160 {message.length > 160 && `(${Math.ceil(message.length / 153)} SMS)`}</span>
                </div>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Digite a mensagem..." rows={4} className="w-full mt-1.5 px-3 py-2.5 bg-[#2a3942] rounded-lg text-[14px] text-[#e9edef] placeholder:text-[#8696a0] outline-none resize-none focus:ring-1 focus:ring-[#00a884]" />
              </div>
              <button onClick={handleSend} disabled={sending || !phone.trim() || !message.trim()} className="w-full flex items-center justify-center gap-2 py-3 bg-[#00a884] text-[#111b21] rounded-xl font-semibold text-[14px] hover:bg-[#00a884]/90 disabled:opacity-40 transition-colors">
                {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                {sending ? "Enviando..." : "Enviar SMS"}
              </button>
            </div>
          </div>
        )}

        {/* CAMPANHA */}
        {tab === "campanha" && (
          <div className="flex-1 flex overflow-hidden">
            {/* Left — Filtros */}
            <div className="w-[380px] border-r border-[#2a3942] flex flex-col flex-shrink-0 overflow-y-auto">
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-[11px] font-semibold text-[#8696a0] uppercase tracking-wider">Nome da Campanha</label>
                  <input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="Ex: Reativação Janeiro" className="w-full mt-1.5 px-3 py-2.5 bg-[#2a3942] rounded-lg text-[14px] text-[#e9edef] placeholder:text-[#8696a0] outline-none focus:ring-1 focus:ring-[#00a884]" />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#8696a0] uppercase tracking-wider flex items-center gap-1.5"><Filter className="w-3.5 h-3.5" /> Filtros</label>

                  {/* Produto */}
                  <div className="mt-2 relative">
                    <button onClick={() => setShowProductDropdown(!showProductDropdown)} className="w-full flex items-center justify-between px-3 py-2.5 bg-[#2a3942] rounded-lg text-[13px] text-left">
                      <span className={filterProduct ? "text-[#e9edef]" : "text-[#8696a0]"}>{filterProduct || "Filtrar por produto..."}</span>
                      <ChevronDown className={`w-4 h-4 text-[#8696a0] transition-transform ${showProductDropdown ? "rotate-180" : ""}`} />
                    </button>
                    {filterProduct && (
                      <button onClick={() => setFilterProduct("")} className="absolute right-10 top-1/2 -translate-y-1/2 text-[#8696a0] hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
                    )}
                    {showProductDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-[#233138] rounded-xl border border-[#2a3942] shadow-xl z-20 max-h-[250px] overflow-hidden">
                        <div className="p-2 border-b border-[#2a3942]">
                          <input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Buscar produto..." className="w-full px-3 py-2 bg-[#2a3942] rounded-lg text-[12px] text-[#e9edef] placeholder:text-[#8696a0] outline-none" autoFocus />
                        </div>
                        <div className="overflow-y-auto max-h-[200px]">
                          {filteredProducts.map((p) => (
                            <button key={p.name} onClick={() => { setFilterProduct(p.name); setShowProductDropdown(false); setProductSearch(""); }} className="w-full text-left px-3 py-2 hover:bg-[#182229] transition-colors text-[12px] text-[#e9edef] border-b border-[#2a3942]/50 last:border-0">
                              {p.name} <span className="text-[#8696a0]">({p.count})</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* LTV */}
                  <div className="flex gap-2 mt-2">
                    <div className="flex-1">
                      <input value={filterLtvMin} onChange={(e) => setFilterLtvMin(e.target.value)} placeholder="LTV mínimo" type="number" className="w-full px-3 py-2.5 bg-[#2a3942] rounded-lg text-[13px] text-[#e9edef] placeholder:text-[#8696a0] outline-none focus:ring-1 focus:ring-[#00a884]" />
                    </div>
                    <div className="flex-1">
                      <input value={filterLtvMax} onChange={(e) => setFilterLtvMax(e.target.value)} placeholder="LTV máximo" type="number" className="w-full px-3 py-2.5 bg-[#2a3942] rounded-lg text-[13px] text-[#e9edef] placeholder:text-[#8696a0] outline-none focus:ring-1 focus:ring-[#00a884]" />
                    </div>
                  </div>
                </div>

                <button onClick={handlePreview} disabled={previewing} className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#2a3942] text-[#e9edef] rounded-lg text-[13px] font-medium hover:bg-[#3b4a54] disabled:opacity-40 transition-colors">
                  {previewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Buscar Clientes
                </button>

                {/* Mensagem da campanha */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-[#8696a0] uppercase tracking-wider">Mensagem</label>
                    <span className={`text-[11px] ${campaignMsg.length > 160 ? "text-amber-400" : "text-[#8696a0]"}`}>{campaignMsg.length}/160</span>
                  </div>
                  <textarea value={campaignMsg} onChange={(e) => setCampaignMsg(e.target.value)} placeholder="Use {nome} para personalizar..." rows={4} className="w-full mt-1.5 px-3 py-2.5 bg-[#2a3942] rounded-lg text-[14px] text-[#e9edef] placeholder:text-[#8696a0] outline-none resize-none focus:ring-1 focus:ring-[#00a884]" />
                  {campaignMsg.includes("{nome}") && (
                    <p className="text-[11px] text-emerald-400 mt-1">✓ Nome do cliente será inserido automaticamente</p>
                  )}
                  {campaignMsg.length > 160 && (
                    <div className="flex items-center gap-1.5 mt-1"><AlertCircle className="w-3.5 h-3.5 text-amber-400" /><span className="text-[11px] text-amber-400">{Math.ceil(campaignMsg.length / 153)} créditos por destinatário</span></div>
                  )}
                </div>

                <button onClick={handleSendCampaign} disabled={sendingCampaign || selectedIds.size === 0 || !campaignMsg.trim() || !campaignName.trim()} className="w-full flex items-center justify-center gap-2 py-3 bg-[#00a884] text-[#111b21] rounded-xl font-semibold text-[14px] hover:bg-[#00a884]/90 disabled:opacity-40 transition-colors">
                  {sendingCampaign ? <Loader2 className="w-5 h-5 animate-spin" /> : <Megaphone className="w-5 h-5" />}
                  {sendingCampaign ? "Enviando..." : `Disparar para ${selectedIds.size} contatos`}
                </button>
              </div>

              {/* Campanhas anteriores */}
              {campaigns.length > 0 && (
                <div className="border-t border-[#2a3942] p-5">
                  <p className="text-[11px] font-semibold text-[#8696a0] uppercase tracking-wider mb-3 flex items-center gap-1.5"><BarChart3 className="w-3.5 h-3.5" /> Campanhas Anteriores</p>
                  <div className="space-y-2">
                    {campaigns.slice(0, 5).map((c) => (
                      <div key={c.id} className="bg-[#202c33] rounded-lg p-3 border border-[#2a3942]">
                        <div className="flex items-center justify-between">
                          <p className="text-[13px] font-medium text-[#e9edef]">{c.name}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${c.status === "completed" ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"}`}>{c.status === "completed" ? "Concluída" : c.status}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-[#8696a0]">
                          <span>✅ {c.total_sent} enviados</span>
                          {c.total_failed > 0 && <span className="text-red-400">❌ {c.total_failed} falhas</span>}
                          {c.sent_at && <span>{new Date(c.sent_at).toLocaleDateString("pt-BR")}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right — Lista de preview */}
            <div className="flex-1 flex flex-col min-w-0">
              {previewList.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center">
                  <Users className="w-12 h-12 text-[#3b4a54] mb-3" />
                  <p className="text-[15px] text-[#8696a0]">Use os filtros e clique em "Buscar Clientes"</p>
                  <p className="text-[12px] text-[#8696a0]/60 mt-1">Os destinatários aparecerão aqui para revisão</p>
                </div>
              ) : (
                <>
                  <div className="px-5 py-3 border-b border-[#2a3942] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button onClick={toggleSelectAll} className="text-[#8696a0] hover:text-[#e9edef]">
                        {selectedIds.size === previewList.length ? <CheckSquare className="w-5 h-5 text-[#00a884]" /> : <Square className="w-5 h-5" />}
                      </button>
                      <span className="text-[13px] text-[#e9edef] font-medium">{selectedIds.size} de {previewList.length} selecionados</span>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto divide-y divide-[#2a3942]">
                    {previewList.map((c) => (
                      <div key={c.customer_id} onClick={() => toggleSelect(c.customer_id)} className={`flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors ${selectedIds.has(c.customer_id) ? "bg-[#00a884]/5" : "hover:bg-[#202c33]/50"}`}>
                        <div className="text-[#8696a0]">
                          {selectedIds.has(c.customer_id) ? <CheckSquare className="w-5 h-5 text-[#00a884]" /> : <Square className="w-5 h-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-medium text-[#e9edef]">{c.name}</span>
                            {c.is_active ? <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">Ativo</span> : <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">Inativo</span>}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-[11px] text-[#8696a0]">
                            <span>{formatPhone(c.phone)}</span>
                            <span>{c.total_orders} pedidos</span>
                            <span>{c.recency_band}</span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-[13px] font-semibold text-[#00a884]">R$ {c.total_revenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* HISTÓRICO */}
        {tab === "historico" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-5 py-3 border-b border-[#2a3942] flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8696a0]" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar no histórico..." className="w-full pl-10 pr-3 py-2 bg-[#202c33] rounded-lg text-[13px] text-[#e9edef] placeholder:text-[#8696a0] outline-none" />
              </div>
              <span className="text-[12px] text-[#8696a0]">{filteredHistory.length} registros</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 text-[#00a884] animate-spin" /></div>
              ) : filteredHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48"><MessageSquare className="w-10 h-10 text-[#3b4a54] mb-3" /><p className="text-[14px] text-[#8696a0]">Nenhum SMS enviado ainda</p></div>
              ) : (
                <div className="divide-y divide-[#2a3942]">
                  {filteredHistory.map((sms) => (
                    <div key={sms.id} className="px-5 py-3 hover:bg-[#202c33]/50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-full bg-[#2a3942] flex items-center justify-center flex-shrink-0"><Phone className="w-4 h-4 text-[#8696a0]" /></div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] font-medium text-[#e9edef]">{formatPhone(sms.recipient)}</span>
                              {sms.customer_name && <span className="text-[11px] text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">{sms.customer_name}</span>}
                            </div>
                            <p className="text-[12px] text-[#8696a0] mt-0.5 line-clamp-2">{sms.content}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-3">
                          <span className="text-[11px] text-[#8696a0]">{formatTime(sms.sent_at)}</span>
                          <div className="flex items-center gap-1">{getStatusIcon(sms.status)}<span className={`text-[11px] ${sms.status === "failed" ? "text-red-400" : "text-[#8696a0]"}`}>{getStatusLabel(sms.status)}</span></div>
                          {sms.error_message && <span className="text-[10px] text-red-400 max-w-[150px] truncate">{sms.error_message}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}