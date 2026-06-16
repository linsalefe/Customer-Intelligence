"use client";

import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import {
  Send,
  Search,
  MessageSquare,
  Check,
  CheckCheck,
  Clock,
  ArrowLeft,
  User,
  Phone,
  Loader2,
  BadgeCheck,
} from "lucide-react";
import AppLayout from "@/components/app-layout";
import api from "@/lib/api";

interface Contact {
  wa_id: string;
  name: string;
  customer_id: number | null;
  last_message: string;
  last_message_time: string | null;
  last_direction: string | null;
  unread: number;
  provider?: string | null;
}

interface Message {
  id: number;
  wa_message_id: string;
  direction: string;
  type: string;
  content: string;
  timestamp: string;
  status: string;
  provider?: string | null;
}

export default function WhatsAppOficialPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [customerData, setCustomerData] = useState<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadContacts = async () => {
    try {
      const res = await api.get("/api/whatsapp/contacts");
      const official: Contact[] = (res.data || []).filter((c: Contact) => c.provider === "official");
      setContacts(official);
      if (selectedContact) {
        const updated = official.find((c) => c.wa_id === selectedContact.wa_id);
        if (updated) setSelectedContact(updated);
      }
    } catch { /* silent */ } finally { setLoading(false); }
  };

  const loadMessages = async (waId: string) => {
    try {
      const res = await api.get(`/api/whatsapp/contacts/${waId}/messages`);
      setMessages(res.data);
      setLoadingMessages(false);
    } catch { setLoadingMessages(false); }
  };

  useEffect(() => {
    loadContacts();
    const t = setInterval(loadContacts, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedContact) {
      setLoadingMessages(true);
      setMessages([]);
      loadMessages(selectedContact.wa_id);
      api.post(`/api/whatsapp/contacts/${selectedContact.wa_id}/read`).catch(() => {});
      api.get(`/api/whatsapp/contacts/${selectedContact.wa_id}/customer`)
        .then((res) => setCustomerData(res.data)).catch(() => setCustomerData(null));
      const t = setInterval(() => loadMessages(selectedContact.wa_id), 3000);
      return () => clearInterval(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedContact]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Janela de 24h: ultima inbound > 24h => texto livre pode falhar no Meta
  const lastInbound = [...messages].reverse().find((m) => m.direction === "inbound");
  const hoursSinceInbound = lastInbound
    ? (Date.now() - new Date(lastInbound.timestamp).getTime()) / 3.6e6
    : Infinity;
  const outOf24h = hoursSinceInbound > 24;

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedContact || sending) return;
    setSending(true);
    try {
      await api.post("/api/whatsapp/send/text", {
        to: selectedContact.wa_id,
        text: newMessage,
        provider: "official",
      });
      setNewMessage("");
      await loadMessages(selectedContact.wa_id);
      await loadContacts();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  };

  const getInitials = (n: string) => n.split(" ").map((x) => x[0]).join("").toUpperCase().slice(0, 2);
  const getAvatarColor = (n: string) => {
    const c = ["from-blue-500 to-blue-600", "from-purple-500 to-purple-600", "from-emerald-500 to-emerald-600", "from-cyan-500 to-cyan-600"];
    return c[(n.charCodeAt(0) || 0) % c.length];
  };
  const formatTime = (ts: string) => new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const formatDate = (ts: string) => {
    const d = new Date(ts), t = new Date();
    if (d.toDateString() === t.toDateString()) return "Hoje";
    const y = new Date(t); y.setDate(y.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return "Ontem";
    return d.toLocaleDateString("pt-BR");
  };
  const statusIcon = (s: string) => {
    if (s === "sent") return <Check className="w-3.5 h-3.5 text-[#b3d1cb]" />;
    if (s === "delivered") return <CheckCheck className="w-3.5 h-3.5 text-[#b3d1cb]" />;
    if (s === "read") return <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />;
    return <Clock className="w-3.5 h-3.5 text-[#b3d1cb]" />;
  };

  const filtered = contacts.filter(
    (c) => (c.name || "").toLowerCase().includes(search.toLowerCase()) || c.wa_id.includes(search)
  );

  const grouped: { date: string; msgs: Message[] }[] = [];
  messages.forEach((m) => {
    const date = formatDate(m.timestamp);
    const last = grouped[grouped.length - 1];
    if (last && last.date === date) last.msgs.push(m);
    else grouped.push({ date, msgs: [m] });
  });

  return (
    <AppLayout>
      <div className="flex" style={{ height: "calc(100vh - 48px)", marginTop: "-24px", marginLeft: "-24px", marginRight: "-24px", marginBottom: "-24px" }}>
        {/* LISTA */}
        <div className={`${selectedContact ? "hidden lg:flex" : "flex"} w-full lg:w-[350px] flex-col border-r border-[#2a3942] bg-[#111b21] flex-shrink-0`}>
          <div className="px-4 py-3 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 bg-[#53bdeb] rounded-full flex items-center justify-center flex-shrink-0">
                <BadgeCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-[15px] font-medium text-[#e9edef]">WhatsApp Oficial</p>
                <p className="text-[12px] text-[#53bdeb]">● Oficial: ativo</p>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8696a0]" />
              <input
                type="text"
                placeholder="Pesquisar conversa..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[#202c33] rounded-lg text-[13px] text-[#e9edef] placeholder:text-[#8696a0] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto border-t border-[#2a3942]">
            {loading ? (
              <div className="p-1">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-3" style={{ opacity: 1 - i * 0.1 }}>
                    <div className="w-[49px] h-[49px] bg-[#2a3942] rounded-full flex-shrink-0 animate-pulse" />
                    <div className="flex-1 space-y-2.5">
                      <div className="h-3.5 bg-[#2a3942] rounded-md animate-pulse" style={{ width: `${70 + (i % 3) * 20}px` }} />
                      <div className="h-3 bg-[#2a3942]/60 rounded-md animate-pulse" style={{ width: `${100 + (i % 4) * 25}px` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 px-6 text-center">
                <BadgeCheck className="w-9 h-9 mb-2 text-[#3b4a54]" />
                <p className="text-sm text-[#8696a0]">Nenhuma conversa oficial ainda</p>
                <p className="text-xs text-[#5a6b75] mt-1">Mensagens recebidas pelo número oficial aparecem aqui.</p>
              </div>
            ) : (
              filtered.map((c) => {
                const isSel = selectedContact?.wa_id === c.wa_id;
                return (
                  <button key={c.wa_id} onClick={() => setSelectedContact(c)} className={`w-full flex items-center gap-3 px-3 py-3 text-left transition-all ${isSel ? "bg-[#2a3942]" : "hover:bg-[#202c33]"}`}>
                    <div className={`w-[49px] h-[49px] rounded-full bg-gradient-to-br ${getAvatarColor(c.name || c.wa_id)} flex items-center justify-center text-white font-semibold text-sm flex-shrink-0`}>
                      {getInitials(c.name || c.wa_id)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-normal text-[15px] text-[#e9edef] truncate">{c.name || c.wa_id}</p>
                        {c.last_message_time && (
                          <span className={`text-[11px] ${c.unread > 0 ? "text-[#53bdeb]" : "text-[#8696a0]"}`}>{formatTime(c.last_message_time)}</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <p className="text-[13px] text-[#8696a0] truncate">{c.last_direction === "outbound" && "✓✓ "}{c.last_message || "Sem mensagens"}</p>
                        {c.unread > 0 && (
                          <span className="min-w-[20px] h-5 px-1.5 bg-[#53bdeb] text-[#111b21] text-[11px] font-bold rounded-full flex items-center justify-center ml-1">{c.unread}</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* THREAD */}
        <div className={`${selectedContact ? "flex" : "hidden lg:flex"} flex-1 flex-col min-w-0`}>
          {selectedContact ? (
            <>
              <div className="px-4 py-2.5 border-b border-[#2a3942] bg-[#202c33] flex items-center gap-3">
                <button onClick={() => setSelectedContact(null)} className="lg:hidden p-1.5 hover:bg-[#2a3942] rounded-lg">
                  <ArrowLeft className="w-5 h-5 text-[#8696a0]" />
                </button>
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getAvatarColor(selectedContact.name || selectedContact.wa_id)} flex items-center justify-center text-white font-semibold text-xs`}>
                  {getInitials(selectedContact.name || selectedContact.wa_id)}
                </div>
                <div>
                  <p className="font-normal text-[15px] text-[#e9edef]">{selectedContact.name || selectedContact.wa_id}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-[#8696a0]">+{selectedContact.wa_id}</span>
                    <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-md bg-[#53bdeb]/20 text-[#53bdeb]">Oficial</span>
                    {selectedContact.customer_id && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-md bg-emerald-500/20 text-emerald-400">Cliente #{selectedContact.customer_id}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-1 overflow-hidden">
                <div className="flex-1 flex flex-col min-w-0">
                  <div className="flex-1 overflow-y-auto px-[4%] py-4 space-y-1 bg-[#0b141a]">
                    {loadingMessages ? (
                      <div className="space-y-3 py-4">
                        {[{ d: "in", w: "55%" }, { d: "out", w: "45%" }, { d: "in", w: "60%" }].map((s, i) => (
                          <div key={i} className={`flex ${s.d === "out" ? "justify-end" : "justify-start"}`}>
                            <div className={`rounded-xl animate-pulse ${s.d === "out" ? "bg-[#005c4b]/40" : "bg-[#202c33]/80"}`} style={{ width: s.w, height: "34px" }} />
                          </div>
                        ))}
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-sm text-[#8696a0]">Nenhuma mensagem nesta conversa.</p>
                      </div>
                    ) : (
                      <>
                        {grouped.map((g) => (
                          <div key={g.date}>
                            <div className="flex justify-center my-3">
                              <span className="px-3 py-1.5 bg-[#182229] rounded-lg text-[12px] text-[#8696a0]">{g.date}</span>
                            </div>
                            {g.msgs.map((m) => (
                              <div key={m.id} className={`flex mb-1 ${m.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[65%] px-2.5 py-1.5 shadow-sm ${m.direction === "outbound" ? "bg-[#005c4b] text-[#e9edef] rounded-lg rounded-tr-none" : "bg-[#202c33] text-[#e9edef] rounded-lg rounded-tl-none"}`}>
                                  <p className="text-[14.2px] whitespace-pre-wrap break-words leading-[19px]">{m.content}</p>
                                  <div className="flex items-center justify-end gap-1 mt-0.5">
                                    <span className={`text-[11px] ${m.direction === "outbound" ? "text-[#ffffff99]" : "text-[#8696a0]"}`}>{formatTime(m.timestamp)}</span>
                                    {m.direction === "outbound" && statusIcon(m.status)}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ))}
                        <div ref={messagesEndRef} />
                      </>
                    )}
                  </div>

                  {/* Input */}
                  <div className="px-3 py-2 bg-[#202c33]">
                    {outOf24h && (
                      <div className="mb-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300">
                        Última resposta há mais de 24h. No canal oficial, texto livre pode ser rejeitado pelo Meta — para reabrir a conversa use um <a href="/disparo" className="font-medium underline">template (Disparo)</a>.
                      </div>
                    )}
                    <div className="flex items-end gap-2">
                      <textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                        placeholder="Digite uma mensagem"
                        rows={1}
                        className="flex-1 px-3 py-2.5 bg-[#2a3942] rounded-lg text-[14px] text-white placeholder:text-[#8696a0] resize-none focus:outline-none"
                      />
                      <button onClick={handleSend} disabled={sending || !newMessage.trim()} className="w-[42px] h-[42px] bg-[#53bdeb] rounded-full text-white flex items-center justify-center disabled:opacity-40">
                        {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* PAINEL 360 */}
                <div className="w-[300px] border-l border-[#2a3942] bg-[#111b21] overflow-y-auto flex-shrink-0 hidden xl:block">
                  <div className="p-5 space-y-5">
                    <div className="text-center pb-5 border-b border-[#2a3942]">
                      <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${getAvatarColor(selectedContact.name || selectedContact.wa_id)} flex items-center justify-center text-white font-bold text-xl shadow-md mx-auto`}>
                        {getInitials(selectedContact.name || selectedContact.wa_id)}
                      </div>
                      <p className="font-semibold text-[#e9edef] mt-3 text-[15px]">{selectedContact.name || selectedContact.wa_id}</p>
                      <div className="flex items-center justify-center gap-1.5 mt-1.5 text-[#8696a0]">
                        <Phone className="w-3.5 h-3.5" />
                        <span className="text-[12px]">+{selectedContact.wa_id}</span>
                      </div>
                      {selectedContact.customer_id && (
                        <a href={`/clientes?id=${selectedContact.customer_id}`} className="inline-flex items-center gap-1 mt-2 px-2.5 py-1 bg-emerald-500/20 text-emerald-400 text-[11px] font-medium rounded-lg hover:bg-emerald-500/30 transition-colors">
                          Ver no Customer 360 →
                        </a>
                      )}
                      {customerData && customerData.linked && (
                        <div className="mt-3 bg-[#202c33] rounded-xl p-3 border border-[#2a3942] text-left">
                          <div className="grid grid-cols-2 gap-2">
                            <div><p className="text-[10px] text-[#8696a0] uppercase">Pedidos</p><p className="text-[15px] font-semibold text-[#e9edef]">{customerData.total_orders}</p></div>
                            <div><p className="text-[10px] text-[#8696a0] uppercase">LTV</p><p className="text-[15px] font-semibold text-[#53bdeb]">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(customerData.total_revenue || 0)}</p></div>
                            <div><p className="text-[10px] text-[#8696a0] uppercase">Ticket Médio</p><p className="text-[13px] text-[#e9edef]">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(customerData.avg_ticket || 0)}</p></div>
                            <div><p className="text-[10px] text-[#8696a0] uppercase">Status</p><p className={"text-[13px] font-medium " + (customerData.is_active ? "text-[#00a884]" : "text-red-400")}>{customerData.is_active ? "Ativo" : "Inativo"}</p></div>
                            {customerData.recency_band && <div className="col-span-2"><p className="text-[10px] text-[#8696a0] uppercase">Recência</p><p className="text-[12px] text-[#e9edef]">{customerData.recency_band}</p></div>}
                          </div>
                        </div>
                      )}
                      {customerData && !customerData.linked && !selectedContact.customer_id && (
                        <div className="mt-3 bg-[#202c33] rounded-xl p-3 border border-[#2a3942] flex items-center justify-center gap-2">
                          <User className="w-3.5 h-3.5 text-[#8696a0]" />
                          <p className="text-[12px] text-[#8696a0]">Não vinculado a cliente</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center bg-[#222e35]">
              <div className="w-20 h-20 bg-[#2a3942] rounded-full flex items-center justify-center mb-5">
                <BadgeCheck className="w-9 h-9 text-[#53bdeb]" />
              </div>
              <p className="text-[28px] font-light text-[#e9edef]">WhatsApp Oficial</p>
              <p className="text-sm mt-2 text-[#8696a0]">Selecione uma conversa para começar</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
