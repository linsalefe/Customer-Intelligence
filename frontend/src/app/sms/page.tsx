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

export default function SmsPage() {
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<SmsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState<any[]>([]);
  const [showCustomers, setShowCustomers] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [stats, setStats] = useState({ total: 0, delivered: 0, failed: 0 });

  useEffect(() => {
    loadHistory();
    const interval = setInterval(loadHistory, 15000);
    return () => clearInterval(interval);
  }, []);

  const loadHistory = async () => {
    try {
      const res = await api.get("/api/sms/history");
      setHistory(res.data.history || []);
      setStats(res.data.stats || { total: 0, delivered: 0, failed: 0 });
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

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
    if (!phone.trim() || !message.trim()) {
      toast.error("Preencha telefone e mensagem");
      return;
    }
    setSending(true);
    try {
      const res = await api.post("/api/sms/send", {
        phone: phone.trim(),
        message: message.trim(),
        customer_id: selectedCustomer?.customer_id || null,
      });
      if (res.data.success) {
        toast.success("SMS enviado com sucesso");
        setMessage("");
        await loadHistory();
      } else {
        toast.error(res.data.error || "Erro ao enviar");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Erro ao enviar SMS");
    } finally {
      setSending(false);
    }
  };

  const charCount = message.length;
  const smsCount = charCount === 0 ? 0 : charCount <= 160 ? 1 : Math.ceil(charCount / 153);

  const formatPhone = (p: string) => {
    const clean = p.replace(/\D/g, "");
    if (clean.length === 11) return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
    if (clean.length === 13 && clean.startsWith("55")) return `(${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
    return p;
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const getStatusIcon = (s: string) => {
    switch (s) {
      case "sent": return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case "delivered": return <CheckCircle2 className="w-4 h-4 text-blue-400" />;
      case "failed": return <XCircle className="w-4 h-4 text-red-400" />;
      default: return <Clock className="w-4 h-4 text-[#8696a0]" />;
    }
  };

  const getStatusLabel = (s: string) => {
    switch (s) {
      case "sent": return "Enviado";
      case "delivered": return "Entregue";
      case "failed": return "Falhou";
      default: return "Pendente";
    }
  };

  const filteredHistory = history.filter((h) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return h.recipient.includes(q) || (h.customer_name || "").toLowerCase().includes(q) || h.content.toLowerCase().includes(q);
  });

  return (
    <AppLayout>
      <div className="flex flex-col bg-[#111b21]" style={{ marginTop: "-24px", marginLeft: "-24px", marginRight: "-24px", marginBottom: "-24px", minHeight: "calc(100vh)", height: "calc(100vh)" }}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#2a3942]">
          <h1 className="text-xl font-semibold text-[#e9edef]">SMS</h1>
          <p className="text-sm text-[#8696a0] mt-0.5">Envio de SMS via Comtele</p>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* LEFT — Compose */}
          <div className="w-[420px] border-r border-[#2a3942] flex flex-col flex-shrink-0">
            <div className="p-5 space-y-4 flex-shrink-0">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#202c33] rounded-xl p-3 text-center border border-[#2a3942]">
                  <p className="text-[20px] font-bold text-[#e9edef]">{stats.total}</p>
                  <p className="text-[10px] text-[#8696a0] uppercase mt-0.5">Enviados</p>
                </div>
                <div className="bg-[#202c33] rounded-xl p-3 text-center border border-[#2a3942]">
                  <p className="text-[20px] font-bold text-emerald-400">{stats.delivered}</p>
                  <p className="text-[10px] text-[#8696a0] uppercase mt-0.5">Entregues</p>
                </div>
                <div className="bg-[#202c33] rounded-xl p-3 text-center border border-[#2a3942]">
                  <p className="text-[20px] font-bold text-red-400">{stats.failed}</p>
                  <p className="text-[10px] text-[#8696a0] uppercase mt-0.5">Falhas</p>
                </div>
              </div>

              {/* Destinatário */}
              <div>
                <label className="text-[11px] font-semibold text-[#8696a0] uppercase tracking-wider">Destinatário</label>
                <div className="mt-1.5 relative">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8696a0]" />
                      <input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="(11) 99999-9999"
                        className="w-full pl-10 pr-3 py-2.5 bg-[#2a3942] rounded-lg text-[14px] text-[#e9edef] placeholder:text-[#8696a0] outline-none focus:ring-1 focus:ring-[#00a884]"
                      />
                    </div>
                    <button
                      onClick={() => setShowCustomers(!showCustomers)}
                      className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${showCustomers ? "bg-[#00a884] text-[#111b21]" : "bg-[#2a3942] text-[#8696a0] hover:text-[#e9edef]"}`}
                    >
                      <Users className="w-4 h-4" />
                    </button>
                  </div>

                  {selectedCustomer && (
                    <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                      <span className="text-[12px] text-emerald-400 flex-1">
                        {selectedCustomer.name} — LTV: R$ {selectedCustomer.total_revenue?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                      <button onClick={() => { setSelectedCustomer(null); setPhone(""); }} className="text-[#8696a0] hover:text-red-400">
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {showCustomers && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-[#233138] rounded-xl border border-[#2a3942] shadow-xl z-20 max-h-[300px] overflow-hidden">
                      <div className="p-2 border-b border-[#2a3942]">
                        <input
                          value={customerSearch}
                          onChange={(e) => searchCustomers(e.target.value)}
                          placeholder="Buscar cliente por nome ou telefone..."
                          className="w-full px-3 py-2 bg-[#2a3942] rounded-lg text-[13px] text-[#e9edef] placeholder:text-[#8696a0] outline-none"
                          autoFocus
                        />
                      </div>
                      <div className="overflow-y-auto max-h-[240px]">
                        {customers.length === 0 ? (
                          <p className="text-[12px] text-[#8696a0] text-center py-4">
                            {customerSearch.length < 2 ? "Digite para buscar..." : "Nenhum cliente encontrado"}
                          </p>
                        ) : (
                          customers.map((c: any) => (
                            <button
                              key={c.customer_id}
                              onClick={() => selectCustomer(c)}
                              className="w-full text-left px-3 py-2.5 hover:bg-[#182229] transition-colors border-b border-[#2a3942]/50 last:border-0"
                            >
                              <p className="text-[13px] text-[#e9edef]">{c.name}</p>
                              <p className="text-[11px] text-[#8696a0]">{formatPhone(c.phone)} — R$ {c.total_revenue?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Mensagem */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-[#8696a0] uppercase tracking-wider">Mensagem</label>
                  <span className={`text-[11px] ${charCount > 160 ? "text-amber-400" : "text-[#8696a0]"}`}>
                    {charCount}/160 {smsCount > 1 && `(${smsCount} SMS)`}
                  </span>
                </div>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Digite a mensagem..."
                  rows={4}
                  className="w-full mt-1.5 px-3 py-2.5 bg-[#2a3942] rounded-lg text-[14px] text-[#e9edef] placeholder:text-[#8696a0] outline-none resize-none focus:ring-1 focus:ring-[#00a884]"
                />
                {charCount > 160 && (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[11px] text-amber-400">Mensagem longa: serão cobrados {smsCount} créditos</span>
                  </div>
                )}
              </div>

              {/* Botão Enviar */}
              <button
                onClick={handleSend}
                disabled={sending || !phone.trim() || !message.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 bg-[#00a884] text-[#111b21] rounded-xl font-semibold text-[14px] hover:bg-[#00a884]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                {sending ? "Enviando..." : "Enviar SMS"}
              </button>
            </div>
          </div>

          {/* RIGHT — History */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="px-5 py-3 border-b border-[#2a3942] flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8696a0]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar no histórico..."
                  className="w-full pl-10 pr-3 py-2 bg-[#202c33] rounded-lg text-[13px] text-[#e9edef] placeholder:text-[#8696a0] outline-none"
                />
              </div>
              <span className="text-[12px] text-[#8696a0]">{filteredHistory.length} registros</span>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-6 h-6 text-[#00a884] animate-spin" />
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48">
                  <MessageSquare className="w-10 h-10 text-[#3b4a54] mb-3" />
                  <p className="text-[14px] text-[#8696a0]">Nenhum SMS enviado ainda</p>
                </div>
              ) : (
                <div className="divide-y divide-[#2a3942]">
                  {filteredHistory.map((sms) => (
                    <div key={sms.id} className="px-5 py-3 hover:bg-[#202c33]/50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-full bg-[#2a3942] flex items-center justify-center flex-shrink-0">
                            <Phone className="w-4 h-4 text-[#8696a0]" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] font-medium text-[#e9edef]">{formatPhone(sms.recipient)}</span>
                              {sms.customer_name && (
                                <span className="text-[11px] text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">{sms.customer_name}</span>
                              )}
                            </div>
                            <p className="text-[12px] text-[#8696a0] mt-0.5 line-clamp-2">{sms.content}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-3">
                          <span className="text-[11px] text-[#8696a0]">{formatTime(sms.sent_at)}</span>
                          <div className="flex items-center gap-1">
                            {getStatusIcon(sms.status)}
                            <span className={`text-[11px] ${sms.status === "failed" ? "text-red-400" : "text-[#8696a0]"}`}>{getStatusLabel(sms.status)}</span>
                          </div>
                          {sms.error_message && (
                            <span className="text-[10px] text-red-400 max-w-[150px] truncate">{sms.error_message}</span>
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
      </div>
    </AppLayout>
  );
}