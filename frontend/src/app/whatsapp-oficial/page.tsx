"use client";

import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import {
  Send, Search, BadgeCheck, Check, CheckCheck, Clock, XCircle, ArrowLeft, X,
  User, Phone, ChevronDown, Loader2, Paperclip, Mic, Image as ImageIcon,
  FileText, Hash, UserPlus,
} from "lucide-react";
import AppLayout from "@/components/app-layout";
import api from "@/lib/api";

interface Tag { id: number; name: string; color: string; }
interface Contact {
  wa_id: string; name: string; customer_id: number | null; lead_status: string;
  notes: string | null; last_message: string; last_message_time: string | null;
  last_direction: string | null; unread: number; assigned_to: number | null;
  assigned_to_name?: string | null; provider?: string | null; tags?: Tag[];
}
interface Message {
  id: number; wa_message_id: string; direction: string; type: string;
  content: string; timestamp: string; status: string; provider?: string | null;
  message_type?: string;
}
interface Atendente { id: number; name: string; }

const leadStatuses = [
  { value: "novo", label: "Novo", color: "bg-blue-500", bg: "bg-blue-500/20", text: "text-blue-400" },
  { value: "em_contato", label: "Em contato", color: "bg-amber-500", bg: "bg-amber-500/20", text: "text-amber-400" },
  { value: "qualificado", label: "Qualificado", color: "bg-purple-500", bg: "bg-purple-500/20", text: "text-purple-400" },
  { value: "negociando", label: "Negociando", color: "bg-cyan-500", bg: "bg-cyan-500/20", text: "text-cyan-400" },
  { value: "convertido", label: "Convertido", color: "bg-emerald-500", bg: "bg-emerald-500/20", text: "text-emerald-400" },
  { value: "perdido", label: "Perdido", color: "bg-red-500", bg: "bg-red-500/20", text: "text-red-400" },
];

export default function WhatsAppOficialPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [assignFilter, setAssignFilter] = useState<"todos" | "atribuidos" | "sem">("todos");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [customerData, setCustomerData] = useState<any>(null);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [atendentes, setAtendentes] = useState<Atendente[]>([]);
  const [showAssign, setShowAssign] = useState(false);
  const [quickTemplates, setQuickTemplates] = useState<any[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const loadContacts = async () => {
    try {
      const res = await api.get("/api/whatsapp/contacts");
      const official: Contact[] = (res.data || []).filter((c: Contact) => c.provider === "official");
      setContacts(official);
      if (selected) {
        const u = official.find((c) => c.wa_id === selected.wa_id);
        if (u) setSelected(u);
      }
    } catch { /* silent */ } finally { setLoading(false); }
  };
  const loadMessages = async (wa: string) => {
    try { const res = await api.get(`/api/whatsapp/contacts/${wa}/messages`); setMessages(res.data); }
    catch { /* */ } finally { setLoadingMsgs(false); }
  };
  const loadTags = () => api.get("/api/whatsapp/tags").then((r) => setAllTags(r.data)).catch(() => {});
  const loadAtendentes = () => api.get("/api/users").then((r) => setAtendentes((r.data.data || []).filter((u: any) => u.is_active !== false))).catch(() => {});
  const loadQuickTemplates = () => api.get("/api/whatsapp/templates").then((r) => setQuickTemplates(r.data)).catch(() => {});

  useEffect(() => {
    loadContacts(); loadTags(); loadAtendentes(); loadQuickTemplates();
    const t = setInterval(loadContacts, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selected) {
      setLoadingMsgs(true); setMessages([]);
      loadMessages(selected.wa_id);
      api.post(`/api/whatsapp/contacts/${selected.wa_id}/read`).catch(() => {});
      setNotesValue(selected.notes || "");
      api.get(`/api/whatsapp/contacts/${selected.wa_id}/customer`).then((r) => setCustomerData(r.data)).catch(() => setCustomerData(null));
      const t = setInterval(() => loadMessages(selected.wa_id), 3000);
      return () => clearInterval(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.wa_id]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const lastInbound = [...messages].reverse().find((m) => m.direction === "inbound");
  const outOf24h = (lastInbound ? (Date.now() - new Date(lastInbound.timestamp).getTime()) / 3.6e6 : Infinity) > 24;

  const handleSend = async () => {
    if (!newMessage.trim() || !selected || sending) return;
    setSending(true);
    try {
      await api.post("/api/whatsapp/send/text", { to: selected.wa_id, text: newMessage, provider: "official" });
      setNewMessage("");
      await loadMessages(selected.wa_id); await loadContacts();
    } catch (e: any) { toast.error(e?.response?.data?.detail || "Erro ao enviar"); }
    finally { setSending(false); }
  };

  const sendMedia = async (file: File, type: "image" | "document") => {
    if (!selected) return;
    setSending(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      try {
        await api.post("/api/whatsapp/send/media", {
          to: selected.wa_id, media_type: type, base64_data: base64,
          filename: file.name, mimetype: file.type, provider: "official",
        });
        await loadMessages(selected.wa_id);
      } catch (e: any) { toast.error(e?.response?.data?.detail || "Erro ao enviar mídia"); }
      finally { setSending(false); }
    };
    reader.readAsDataURL(file);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream); recorderRef.current = rec; chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/ogg; codecs=opus" });
        if (blob.size > 0 && selected) {
          const reader = new FileReader();
          reader.onload = async () => {
            const base64 = (reader.result as string).split(",")[1];
            try {
              await api.post("/api/whatsapp/send/media", {
                to: selected.wa_id, media_type: "audio", base64_data: base64,
                filename: "audio.ogg", mimetype: "audio/ogg", provider: "official",
              });
              await loadMessages(selected.wa_id);
            } catch (e: any) { toast.error(e?.response?.data?.detail || "Erro ao enviar áudio"); }
          };
          reader.readAsDataURL(blob);
        }
      };
      rec.start(); setIsRecording(true); setRecordingTime(0);
      recIntervalRef.current = setInterval(() => setRecordingTime((p) => p + 1), 1000);
    } catch { toast.error("Erro ao acessar microfone"); }
  };
  const stopRecording = (cancel = false) => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      if (cancel) recorderRef.current.ondataavailable = null;
      recorderRef.current.stop();
    }
    setIsRecording(false);
    if (recIntervalRef.current) clearInterval(recIntervalRef.current);
    setRecordingTime(0);
  };

  const setLead = async (status: string) => {
    if (!selected) return;
    await api.patch(`/api/whatsapp/contacts/${selected.wa_id}`, { lead_status: status }).catch(() => {});
    setShowStatusMenu(false); loadContacts();
  };
  const saveNotes = async () => {
    if (!selected) return;
    await api.patch(`/api/whatsapp/contacts/${selected.wa_id}`, { notes: notesValue }).catch(() => {});
    setEditingNotes(false); toast.success("Notas salvas"); loadContacts();
  };
  const toggleTag = async (tag: Tag) => {
    if (!selected) return;
    const has = (selected.tags || []).some((t) => t.id === tag.id);
    try {
      if (has) await api.delete(`/api/whatsapp/contacts/${selected.wa_id}/tags/${tag.id}`);
      else await api.post(`/api/whatsapp/contacts/${selected.wa_id}/tags/${tag.id}`);
      await loadContacts();
    } catch { toast.error("Erro na tag"); }
  };
  const createTag = async () => {
    if (!newTagName.trim()) return;
    try {
      const r = await api.post("/api/whatsapp/tags", { name: newTagName.trim() });
      setNewTagName(""); await loadTags();
      if (selected) { await api.post(`/api/whatsapp/contacts/${selected.wa_id}/tags/${r.data.id}`); await loadContacts(); }
    } catch { toast.error("Erro ao criar tag"); }
  };
  const assign = async (id: number | null) => {
    if (!selected) return;
    await api.patch(`/api/whatsapp/contacts/${selected.wa_id}/assign`, { assigned_to: id }).catch(() => {});
    setShowAssign(false); loadContacts();
  };

  const initials = (n: string) => n.split(" ").map((x) => x[0]).join("").toUpperCase().slice(0, 2);
  const avatarColor = (n: string) => ["from-blue-500 to-blue-600", "from-purple-500 to-purple-600", "from-emerald-500 to-emerald-600", "from-cyan-500 to-cyan-600"][(n.charCodeAt(0) || 0) % 4];
  const fmtTime = (ts: string) => new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const fmtDate = (ts: string) => {
    const d = new Date(ts), t = new Date();
    if (d.toDateString() === t.toDateString()) return "Hoje";
    const y = new Date(t); y.setDate(y.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return "Ontem";
    return d.toLocaleDateString("pt-BR");
  };
  const statusIcon = (s: string) => {
    if (s === "failed") return <XCircle className="w-3.5 h-3.5 text-red-400" />;
    if (s === "sent") return <Check className="w-3.5 h-3.5 text-[#b3d1cb]" />;
    if (s === "delivered") return <CheckCheck className="w-3.5 h-3.5 text-[#b3d1cb]" />;
    if (s === "read") return <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />;
    return <Clock className="w-3.5 h-3.5 text-[#b3d1cb]" />;
  };
  const stConf = (s: string) => leadStatuses.find((x) => x.value === s) || leadStatuses[0];

  const filtered = contacts.filter((c) => {
    const ms = (c.name || "").toLowerCase().includes(search.toLowerCase()) || c.wa_id.includes(search);
    const mst = statusFilter === "todos" || c.lead_status === statusFilter;
    const ma = assignFilter === "todos" || (assignFilter === "atribuidos" ? !!c.assigned_to : !c.assigned_to);
    return ms && mst && ma;
  });

  const grouped: { date: string; msgs: Message[] }[] = [];
  messages.forEach((m) => {
    const date = fmtDate(m.timestamp);
    const last = grouped[grouped.length - 1];
    if (last && last.date === date) last.msgs.push(m); else grouped.push({ date, msgs: [m] });
  });

  const renderMedia = (m: Message) => {
    const isMediaContent = m.content?.startsWith("media:");
    const mtype = m.message_type || m.type || "";
    const isMedia = isMediaContent || ["image", "audio", "video", "document", "sticker", "ptt"].includes(mtype);
    if (!isMedia) return <p className="text-[14.2px] whitespace-pre-wrap break-words leading-[19px]">{m.content}</p>;
    let url = "";
    if (isMediaContent) {
      const eid = m.content.split("|")[0].replace("media:", "");
      if (eid && eid !== "sent") url = `https://cenatdata.online/api/whatsapp/media/${eid}`;
    }
    const fname = isMediaContent ? (m.content.split("|")[2] || "Arquivo") : "Arquivo";
    if (!url) return <p className="text-[13px] italic text-[#8696a0]">📎 {fname} (enviado)</p>;
    if (mtype === "image" || mtype === "sticker") return <img src={url} alt="" className="max-w-[260px] rounded-md cursor-pointer" onClick={() => window.open(url, "_blank")} />;
    if (mtype === "audio" || mtype === "ptt") return <audio controls className="max-w-[260px]"><source src={url} /></audio>;
    return <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[#53bdeb] underline text-sm">📄 {fname}</a>;
  };

  return (
    <AppLayout>
      <div className="flex" style={{ height: "calc(100vh - 48px)", marginTop: "-24px", marginLeft: "-24px", marginRight: "-24px", marginBottom: "-24px" }}>
        {/* LISTA */}
        <div className={`${selected ? "hidden lg:flex" : "flex"} w-full lg:w-[350px] flex-col border-r border-[#2a3942] bg-[#111b21] flex-shrink-0`}>
          <div className="px-4 py-3 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 bg-[#53bdeb] rounded-full flex items-center justify-center flex-shrink-0"><BadgeCheck className="w-5 h-5 text-white" /></div>
              <div><p className="text-[15px] font-medium text-[#e9edef]">WhatsApp Oficial</p><p className="text-[12px] text-[#53bdeb]">● Oficial: ativo</p></div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8696a0]" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar conversa..." className="w-full pl-10 pr-4 py-2 bg-[#202c33] rounded-lg text-[13px] text-[#e9edef] placeholder:text-[#8696a0] focus:outline-none" />
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {(["todos", "atribuidos", "sem"] as const).map((f) => (
                <button key={f} onClick={() => setAssignFilter(f)} className={`px-3 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap ${assignFilter === f ? "bg-[#53bdeb] text-[#111b21]" : "bg-[#202c33] text-[#8696a0] hover:bg-[#2a3942]"}`}>
                  {f === "todos" ? "Todos" : f === "atribuidos" ? "Atribuídos" : "Sem atendente"}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              <button onClick={() => setStatusFilter("todos")} className={`px-3 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap ${statusFilter === "todos" ? "bg-[#00a884] text-[#111b21]" : "bg-[#202c33] text-[#8696a0]"}`}>Status</button>
              {leadStatuses.map((s) => {
                const n = contacts.filter((c) => c.lead_status === s.value).length;
                if (!n) return null;
                return <button key={s.value} onClick={() => setStatusFilter(s.value)} className={`px-3 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap ${statusFilter === s.value ? `${s.bg} ${s.text}` : "bg-[#202c33] text-[#8696a0]"}`}>{s.label} ({n})</button>;
              })}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto border-t border-[#2a3942]">
            {loading ? (
              <div className="p-1">{[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-3" style={{ opacity: 1 - i * 0.1 }}>
                  <div className="w-[49px] h-[49px] bg-[#2a3942] rounded-full animate-pulse" />
                  <div className="flex-1 space-y-2.5"><div className="h-3.5 bg-[#2a3942] rounded-md animate-pulse" style={{ width: "70%" }} /><div className="h-3 bg-[#2a3942]/60 rounded-md animate-pulse" style={{ width: "90%" }} /></div>
                </div>))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 px-6 text-center">
                <BadgeCheck className="w-9 h-9 mb-2 text-[#3b4a54]" />
                <p className="text-sm text-[#8696a0]">Nenhuma conversa oficial</p>
                <p className="text-xs text-[#5a6b75] mt-1">Mensagens do número oficial aparecem aqui.</p>
              </div>
            ) : filtered.map((c) => {
              const isSel = selected?.wa_id === c.wa_id;
              return (
                <button key={c.wa_id} onClick={() => setSelected(c)} className={`w-full flex items-center gap-3 px-3 py-3 text-left ${isSel ? "bg-[#2a3942]" : "hover:bg-[#202c33]"}`}>
                  <div className={`w-[49px] h-[49px] rounded-full bg-gradient-to-br ${avatarColor(c.name || c.wa_id)} flex items-center justify-center text-white font-semibold text-sm flex-shrink-0`}>{initials(c.name || c.wa_id)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-normal text-[15px] text-[#e9edef] truncate">{c.name || c.wa_id}</p>
                      {c.last_message_time && <span className={`text-[11px] ${c.unread > 0 ? "text-[#53bdeb]" : "text-[#8696a0]"}`}>{fmtTime(c.last_message_time)}</span>}
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-[13px] text-[#8696a0] truncate">{c.last_direction === "outbound" && "✓✓ "}{c.last_message || "Sem mensagens"}</p>
                      {c.unread > 0 && <span className="min-w-[20px] h-5 px-1.5 bg-[#53bdeb] text-[#111b21] text-[11px] font-bold rounded-full flex items-center justify-center ml-1">{c.unread}</span>}
                    </div>
                    {((c.tags && c.tags.length > 0) || c.assigned_to_name) && (
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        {(c.tags || []).map((t) => <span key={t.id} className="px-1.5 py-0.5 rounded text-[9px] font-medium text-white" style={{ backgroundColor: t.color }}>{t.name}</span>)}
                        {c.assigned_to_name && <span className="px-1.5 py-0.5 rounded text-[9px] bg-[#2a3942] text-[#8696a0]">@{c.assigned_to_name.split(" ")[0]}</span>}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* THREAD */}
        <div className={`${selected ? "flex" : "hidden lg:flex"} flex-1 flex-col min-w-0`}>
          {selected ? (
            <>
              <div className="px-4 py-2.5 border-b border-[#2a3942] bg-[#202c33] flex items-center gap-3">
                <button onClick={() => setSelected(null)} className="lg:hidden p-1.5 hover:bg-[#2a3942] rounded-lg"><ArrowLeft className="w-5 h-5 text-[#8696a0]" /></button>
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarColor(selected.name || selected.wa_id)} flex items-center justify-center text-white font-semibold text-xs`}>{initials(selected.name || selected.wa_id)}</div>
                <div className="min-w-0">
                  <p className="font-normal text-[15px] text-[#e9edef] truncate">{selected.name || selected.wa_id}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-[#8696a0]">+{selected.wa_id}</span>
                    <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-md bg-[#53bdeb]/20 text-[#53bdeb]">Oficial</span>
                    {selected.customer_id && <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-md bg-emerald-500/20 text-emerald-400">Cliente #{selected.customer_id}</span>}
                  </div>
                </div>
              </div>

              <div className="flex flex-1 overflow-hidden">
                <div className="flex-1 flex flex-col min-w-0">
                  <div className="flex-1 overflow-y-auto px-[4%] py-4 space-y-1 bg-[#0b141a]">
                    {loadingMsgs ? (
                      <div className="space-y-3 py-4">{[{ d: "in", w: "55%" }, { d: "out", w: "45%" }, { d: "in", w: "60%" }].map((s, i) => (
                        <div key={i} className={`flex ${s.d === "out" ? "justify-end" : "justify-start"}`}><div className={`rounded-xl animate-pulse ${s.d === "out" ? "bg-[#005c4b]/40" : "bg-[#202c33]/80"}`} style={{ width: s.w, height: "34px" }} /></div>))}
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="flex items-center justify-center h-full"><p className="text-sm text-[#8696a0]">Nenhuma mensagem nesta conversa.</p></div>
                    ) : (
                      <>{grouped.map((g) => (
                        <div key={g.date}>
                          <div className="flex justify-center my-3"><span className="px-3 py-1.5 bg-[#182229] rounded-lg text-[12px] text-[#8696a0]">{g.date}</span></div>
                          {g.msgs.map((m) => (
                            <div key={m.id} className={`flex mb-1 ${m.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                              <div className={`max-w-[65%] px-2.5 py-1.5 shadow-sm ${m.direction === "outbound" ? "bg-[#005c4b] text-[#e9edef] rounded-lg rounded-tr-none" : "bg-[#202c33] text-[#e9edef] rounded-lg rounded-tl-none"}`}>
                                {renderMedia(m)}
                                <div className="flex items-center justify-end gap-1 mt-0.5">
                                  <span className={`text-[11px] ${m.direction === "outbound" ? "text-[#ffffff99]" : "text-[#8696a0]"}`}>{fmtTime(m.timestamp)}</span>
                                  {m.direction === "outbound" && statusIcon(m.status)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>))}
                        <div ref={endRef} />
                      </>
                    )}
                  </div>

                  {/* Composer */}
                  <div className="px-3 py-2 bg-[#202c33]">
                    {outOf24h && (
                      <div className="mb-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300">
                        Última resposta há mais de 24h — texto livre pode ser rejeitado pelo Meta. Reabra com um <a href="/disparo" className="font-medium underline">template (Disparo)</a>.
                      </div>
                    )}
                    {isRecording ? (
                      <div className="flex items-center gap-3">
                        <button onClick={() => stopRecording(true)} className="p-2 rounded-full hover:bg-[#2a3942] text-red-400"><X className="w-5 h-5" /></button>
                        <div className="flex-1 flex items-center gap-3 px-4 py-2.5 bg-[#2a3942] rounded-lg">
                          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                          <span className="text-[14px] text-[#e9edef] tabular-nums font-mono">{Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, "0")}</span>
                        </div>
                        <button onClick={() => stopRecording(false)} className="w-[42px] h-[42px] bg-[#53bdeb] rounded-full text-white flex items-center justify-center"><Send className="w-5 h-5" /></button>
                      </div>
                    ) : (
                      <div className="flex items-end gap-1">
                        <div className="relative flex items-center">
                          <button onClick={() => { const m = document.getElementById("attach-of"); m?.classList.toggle("hidden"); }} className="p-2 rounded-full text-[#8696a0] hover:text-[#e9edef]"><Paperclip className="w-5 h-5" /></button>
                          <div id="attach-of" className="hidden absolute bottom-12 left-0 z-50 bg-[#233138] rounded-xl border border-[#2a3942] shadow-xl min-w-[180px] overflow-hidden">
                            <button onClick={() => { imgRef.current?.click(); document.getElementById("attach-of")?.classList.add("hidden"); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#182229] text-left"><div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center"><ImageIcon className="w-4 h-4 text-white" /></div><span className="text-[14px] text-[#e9edef]">Foto / Vídeo</span></button>
                            <button onClick={() => { fileRef.current?.click(); document.getElementById("attach-of")?.classList.add("hidden"); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#182229] text-left"><div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center"><FileText className="w-4 h-4 text-white" /></div><span className="text-[14px] text-[#e9edef]">Documento</span></button>
                          </div>
                          <button onClick={() => setShowTemplates(!showTemplates)} className={`p-2 rounded-full ${showTemplates ? "text-[#53bdeb]" : "text-[#8696a0] hover:text-[#e9edef]"}`} title="Respostas rápidas"><FileText className="w-5 h-5" /></button>
                          {showTemplates && quickTemplates.length > 0 && (
                            <div className="absolute bottom-12 left-8 z-50 bg-[#233138] rounded-xl border border-[#2a3942] shadow-xl min-w-[260px] max-h-[300px] overflow-y-auto">
                              {quickTemplates.map((tpl: any) => (
                                <button key={tpl.id} onClick={() => { setNewMessage((tpl.body || "").replace("{nome}", selected.name || "")); setShowTemplates(false); }} className="w-full text-left px-3 py-2.5 hover:bg-[#182229] border-b border-[#2a3942]/50 last:border-0">
                                  <p className="text-[13px] text-[#e9edef] font-medium">{tpl.name}</p><p className="text-[11px] text-[#8696a0] truncate">{tpl.body}</p>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <input ref={imgRef} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) sendMedia(f, "image"); e.target.value = ""; }} />
                        <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.csv,.zip" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) sendMedia(f, "document"); e.target.value = ""; }} />
                        <textarea value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }} placeholder="Digite uma mensagem" rows={1} className="flex-1 px-3 py-2.5 bg-[#2a3942] rounded-lg text-[14px] text-white placeholder:text-[#8696a0] resize-none focus:outline-none" />
                        {newMessage.trim() ? (
                          <button onClick={handleSend} disabled={sending} className="w-[42px] h-[42px] bg-[#53bdeb] rounded-full text-white flex items-center justify-center disabled:opacity-40">{sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}</button>
                        ) : (
                          <button onClick={startRecording} className="w-[42px] h-[42px] rounded-full text-[#8696a0] hover:text-[#e9edef] flex items-center justify-center"><Mic className="w-6 h-6" /></button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* PAINEL */}
                <div className="w-[300px] border-l border-[#2a3942] bg-[#111b21] overflow-y-auto flex-shrink-0 hidden xl:block">
                  <div className="p-5 space-y-5">
                    <div className="text-center pb-5 border-b border-[#2a3942]">
                      <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${avatarColor(selected.name || selected.wa_id)} flex items-center justify-center text-white font-bold text-xl mx-auto`}>{initials(selected.name || selected.wa_id)}</div>
                      <p className="font-semibold text-[#e9edef] mt-3 text-[15px]">{selected.name || selected.wa_id}</p>
                      <div className="flex items-center justify-center gap-1.5 mt-1.5 text-[#8696a0]"><Phone className="w-3.5 h-3.5" /><span className="text-[12px]">+{selected.wa_id}</span></div>
                      {selected.customer_id && <a href={`/clientes?id=${selected.customer_id}`} className="inline-flex items-center gap-1 mt-2 px-2.5 py-1 bg-emerald-500/20 text-emerald-400 text-[11px] font-medium rounded-lg hover:bg-emerald-500/30">Ver no Customer 360 →</a>}
                      {customerData && customerData.linked && (
                        <div className="mt-3 bg-[#202c33] rounded-xl p-3 border border-[#2a3942] text-left">
                          <div className="grid grid-cols-2 gap-2">
                            <div><p className="text-[10px] text-[#8696a0] uppercase">Pedidos</p><p className="text-[15px] font-semibold text-[#e9edef]">{customerData.total_orders}</p></div>
                            <div><p className="text-[10px] text-[#8696a0] uppercase">LTV</p><p className="text-[15px] font-semibold text-[#53bdeb]">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(customerData.total_revenue || 0)}</p></div>
                            <div><p className="text-[10px] text-[#8696a0] uppercase">Ticket</p><p className="text-[13px] text-[#e9edef]">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(customerData.avg_ticket || 0)}</p></div>
                            <div><p className="text-[10px] text-[#8696a0] uppercase">Status</p><p className={"text-[13px] font-medium " + (customerData.is_active ? "text-[#00a884]" : "text-red-400")}>{customerData.is_active ? "Ativo" : "Inativo"}</p></div>
                          </div>
                        </div>
                      )}
                      {customerData && !customerData.linked && !selected.customer_id && (
                        <div className="mt-3 bg-[#202c33] rounded-xl p-3 border border-[#2a3942] flex items-center justify-center gap-2"><User className="w-3.5 h-3.5 text-[#8696a0]" /><p className="text-[12px] text-[#8696a0]">Não vinculado a cliente</p></div>
                      )}
                    </div>

                    {/* Atribuir */}
                    <div>
                      <p className="text-[11px] font-semibold text-[#8696a0] uppercase tracking-wider mb-2">Atendente</p>
                      <div className="relative">
                        <button onClick={() => setShowAssign(!showAssign)} className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-[#2a3942] bg-[#202c33]">
                          <span className="flex items-center gap-2 text-[13px] text-[#e9edef]"><UserPlus className="w-4 h-4 text-[#8696a0]" />{selected.assigned_to_name || "Sem atendente"}</span>
                          <ChevronDown className={`w-4 h-4 text-[#8696a0] ${showAssign ? "rotate-180" : ""}`} />
                        </button>
                        {showAssign && (
                          <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#233138] rounded-xl border border-[#2a3942] shadow-lg z-10 overflow-hidden max-h-[200px] overflow-y-auto">
                            <button onClick={() => assign(null)} className="w-full text-left px-3 py-2 text-[13px] text-[#8696a0] hover:bg-[#182229]">Sem atendente</button>
                            {atendentes.map((a) => <button key={a.id} onClick={() => assign(a.id)} className="w-full text-left px-3 py-2 text-[13px] text-[#e9edef] hover:bg-[#182229]">{a.name}</button>)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Tags */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[11px] font-semibold text-[#8696a0] uppercase tracking-wider">Tags</p>
                        <button onClick={() => setShowTagMenu(!showTagMenu)} className="text-[#53bdeb]"><Hash className="w-4 h-4" /></button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(selected.tags || []).map((t) => (
                          <button key={t.id} onClick={() => toggleTag(t)} className="px-2 py-0.5 rounded-md text-[11px] font-medium text-white flex items-center gap-1" style={{ backgroundColor: t.color }}>{t.name}<X className="w-3 h-3" /></button>
                        ))}
                        {(selected.tags || []).length === 0 && <span className="text-[12px] text-[#8696a0]">Sem tags</span>}
                      </div>
                      {showTagMenu && (
                        <div className="mt-2 bg-[#202c33] rounded-xl border border-[#2a3942] p-2 space-y-1">
                          {allTags.filter((t) => !(selected.tags || []).some((x) => x.id === t.id)).map((t) => (
                            <button key={t.id} onClick={() => toggleTag(t)} className="w-full text-left px-2 py-1 text-[12px] text-[#e9edef] hover:bg-[#182229] rounded flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />{t.name}</button>
                          ))}
                          <div className="flex gap-1 pt-1 border-t border-[#2a3942]">
                            <input value={newTagName} onChange={(e) => setNewTagName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createTag()} placeholder="Nova tag..." className="flex-1 px-2 py-1 bg-[#2a3942] rounded text-[12px] text-white outline-none" />
                            <button onClick={createTag} className="px-2 py-1 bg-[#53bdeb] text-[#111b21] rounded text-[12px] font-medium">+</button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Status do lead */}
                    <div>
                      <p className="text-[11px] font-semibold text-[#8696a0] uppercase tracking-wider mb-2">Status do Lead</p>
                      <div className="relative">
                        <button onClick={() => setShowStatusMenu(!showStatusMenu)} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border ${stConf(selected.lead_status).bg}`}>
                          <span className="flex items-center gap-2"><span className={`w-2.5 h-2.5 rounded-full ${stConf(selected.lead_status).color}`} /><span className={`text-[13px] font-medium ${stConf(selected.lead_status).text}`}>{stConf(selected.lead_status).label}</span></span>
                          <ChevronDown className={`w-4 h-4 text-[#8696a0] ${showStatusMenu ? "rotate-180" : ""}`} />
                        </button>
                        {showStatusMenu && (
                          <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#233138] rounded-xl border border-[#2a3942] shadow-lg z-10 overflow-hidden">
                            {leadStatuses.map((s) => <button key={s.value} onClick={() => setLead(s.value)} className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-[#182229] text-left"><span className={`w-2.5 h-2.5 rounded-full ${s.color}`} /><span className="text-[13px] text-[#e9edef]">{s.label}</span></button>)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Notas */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[11px] font-semibold text-[#8696a0] uppercase tracking-wider">Notas</p>
                        {!editingNotes && <button onClick={() => setEditingNotes(true)} className="text-[12px] text-[#53bdeb] font-medium">Editar</button>}
                      </div>
                      {editingNotes ? (
                        <div>
                          <textarea value={notesValue} onChange={(e) => setNotesValue(e.target.value)} rows={4} className="w-full px-3 py-2.5 text-[13px] text-[#e9edef] bg-[#2a3942] border border-[#3b4a54] rounded-xl outline-none resize-none" />
                          <div className="flex gap-2 mt-2"><button onClick={saveNotes} className="px-3.5 py-1.5 bg-[#53bdeb] text-[#111b21] text-[11px] font-medium rounded-lg">Salvar</button><button onClick={() => { setEditingNotes(false); setNotesValue(selected.notes || ""); }} className="px-3.5 py-1.5 text-[#8696a0] text-[11px] rounded-lg hover:bg-[#202c33]">Cancelar</button></div>
                        </div>
                      ) : (
                        <div className="bg-[#202c33] rounded-xl p-3 min-h-[60px] border border-[#2a3942]"><p className="text-[13px] text-[#8696a0] whitespace-pre-wrap">{selected.notes || "Sem notas"}</p></div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center bg-[#222e35]">
              <div className="w-20 h-20 bg-[#2a3942] rounded-full flex items-center justify-center mb-5"><BadgeCheck className="w-9 h-9 text-[#53bdeb]" /></div>
              <p className="text-[28px] font-light text-[#e9edef]">WhatsApp Oficial</p>
              <p className="text-sm mt-2 text-[#8696a0]">Selecione uma conversa para começar</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
