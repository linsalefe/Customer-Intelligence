"use client";

import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import {
  Send,
  Search,
  MessageCircle,
  Check,
  CheckCheck,
  Clock,
  ArrowLeft,
  X,
  User,
  Phone,
  ChevronDown,
  Loader2,
  Smile,
  Paperclip,
  Mic,
  Image as ImageIcon,
  FileText,
  QrCode,
  Wifi,
  WifiOff,
} from "lucide-react";
import AppLayout from "@/components/app-layout";
import api from "@/lib/api";

interface Contact {
  wa_id: string;
  name: string;
  customer_id: number | null;
  lead_status: string;
  notes: string | null;
  last_message: string;
  last_message_time: string | null;
  last_direction: string | null;
  unread: number;
  created_at: string | null;
  assigned_to: number | null;
}

interface Message {
  id: number;
  wa_message_id: string;
  direction: string;
  type: string;
  content: string;
  timestamp: string;
  status: string;
  sent_by_ai: boolean;
}

const leadStatuses = [
  { value: "novo", label: "Novo", color: "bg-blue-500", bg: "bg-blue-500/20", text: "text-blue-400" },
  { value: "em_contato", label: "Em contato", color: "bg-amber-500", bg: "bg-amber-500/20", text: "text-amber-400" },
  { value: "qualificado", label: "Qualificado", color: "bg-purple-500", bg: "bg-purple-500/20", text: "text-purple-400" },
  { value: "negociando", label: "Negociando", color: "bg-cyan-500", bg: "bg-cyan-500/20", text: "text-cyan-400" },
  { value: "convertido", label: "Convertido", color: "bg-emerald-500", bg: "bg-emerald-500/20", text: "text-emerald-400" },
  { value: "perdido", label: "Perdido", color: "bg-red-500", bg: "bg-red-500/20", text: "text-red-400" },
];

export default function WhatsAppPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showCRM, setShowCRM] = useState(true);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const [instanceConnected, setInstanceConnected] = useState<boolean | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [checkingConnection, setCheckingConnection] = useState(true);
  const [profilePics, setProfilePics] = useState<Record<string, string | null>>({});
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMsgCountRef = useRef<number>(0);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const loadedPicsRef = useRef<Set<string>>(new Set());
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setMounted(true); }, []);

  // Check instance connection
  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 5000);
    return () => clearInterval(interval);
  }, []);

  // Load contacts when connected
  useEffect(() => {
    if (instanceConnected) {
      loadContacts();
      const interval = setInterval(loadContacts, 5000);
      return () => clearInterval(interval);
    }
  }, [instanceConnected]);

  // Load messages when contact selected
  useEffect(() => {
    if (selectedContact) {
      prevMsgCountRef.current = 0;
      setLoadingMessages(true);
      setMessages([]);
      loadMessages(selectedContact.wa_id);
      api.post(`/api/whatsapp/contacts/${selectedContact.wa_id}/read`).catch(() => {});
      setNotesValue(selectedContact.notes || "");
      const interval = setInterval(() => loadMessages(selectedContact.wa_id), 3000);
      return () => clearInterval(interval);
    }
  }, [selectedContact]);

  // Auto-scroll
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
    if (isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      setShowScrollDown(false);
    } else if (messages.length > 0) {
      setShowScrollDown(true);
    }
  }, [messages]);

  const checkConnection = async () => {
    try {
      const res = await api.get("/api/whatsapp/instance/status");
      const connected = res.data.is_connected;
      setInstanceConnected(connected);
      if (!connected) {
        try {
          const qrRes = await api.get("/api/whatsapp/instance/qrcode");
          const base64 = qrRes.data?.base64 || qrRes.data?.qrcode?.base64 || null;
          setQrCode(base64);
        } catch { setQrCode(null); }
      }
    } catch {
      setInstanceConnected(false);
    } finally {
      setCheckingConnection(false);
    }
  };

  const loadContacts = async () => {
    try {
      const res = await api.get("/api/whatsapp/contacts");
      setContacts(res.data);
      if (selectedContact) {
        const updated = res.data.find((c: Contact) => c.wa_id === selectedContact.wa_id);
        if (updated) setSelectedContact(updated);
      }
      // Load profile pics
      res.data.forEach((c: Contact) => {
        if (!loadedPicsRef.current.has(c.wa_id)) {
          loadedPicsRef.current.add(c.wa_id);
          loadProfilePic(c.wa_id);
        }
      });
    } catch { /* silent */ } finally { setLoading(false); }
  };

  const loadProfilePic = async (waId: string) => {
    try {
      const res = await api.get(`/api/whatsapp/contacts/${waId}/picture`);
      setProfilePics(prev => ({ ...prev, [waId]: res.data.profilePictureUrl || null }));
    } catch {
      setProfilePics(prev => ({ ...prev, [waId]: null }));
    }
  };

  const loadMessages = async (waId: string) => {
    try {
      const res = await api.get(`/api/whatsapp/contacts/${waId}/messages`);
      const newMsgs: Message[] = res.data;
      prevMsgCountRef.current = newMsgs.length;
      setMessages(newMsgs);
      setLoadingMessages(false);
    } catch { setLoadingMessages(false); }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedContact || sending) return;
    setSending(true);
    try {
      await api.post("/api/whatsapp/send/text", { to: selectedContact.wa_id, text: newMessage });
      setNewMessage("");
      await loadMessages(selectedContact.wa_id);
      await loadContacts();
    } catch { toast.error("Erro ao enviar mensagem"); }
    finally { setSending(false); }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const updateLeadStatus = async (status: string) => {
    if (!selectedContact) return;
    try {
      await api.patch(`/api/whatsapp/contacts/${selectedContact.wa_id}`, { lead_status: status });
      setShowStatusMenu(false);
      toast.success("Status atualizado");
      await loadContacts();
    } catch { toast.error("Erro ao atualizar"); }
  };

  const saveNotes = async () => {
    if (!selectedContact) return;
    try {
      await api.patch(`/api/whatsapp/contacts/${selectedContact.wa_id}`, { notes: notesValue });
      toast.success("Notas salvas");
      setEditingNotes(false);
      await loadContacts();
    } catch { toast.error("Erro ao salvar"); }
  };

  const handleFileUpload = async (file: File, type: "image" | "document") => {
    if (!selectedContact) return;
    setSending(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        await api.post("/api/whatsapp/send/media", {
          to: selectedContact.wa_id,
          media_type: type,
          base64_data: base64,
          filename: file.name,
          mimetype: file.type,
        });
        await loadMessages(selectedContact.wa_id);
        await loadContacts();
        setSending(false);
      };
      reader.readAsDataURL(file);
    } catch { toast.error("Erro ao enviar"); setSending(false); }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/ogg; codecs=opus" });
        if (blob.size > 0 && selectedContact) {
          const reader = new FileReader();
          reader.onload = async () => {
            const base64 = (reader.result as string).split(",")[1];
            try {
              await api.post("/api/whatsapp/send/media", {
                to: selectedContact.wa_id, media_type: "audio",
                base64_data: base64, filename: "audio.ogg", mimetype: "audio/ogg",
              });
              await loadMessages(selectedContact.wa_id);
            } catch { toast.error("Erro ao enviar áudio"); }
          };
          reader.readAsDataURL(blob);
        }
      };
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => setRecordingTime(p => p + 1), 1000);
    } catch { toast.error("Erro ao acessar microfone"); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state !== "inactive") mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    setRecordingTime(0);
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current?.state !== "inactive") {
      mediaRecorderRef.current!.ondataavailable = null;
      mediaRecorderRef.current!.onstop = () => { mediaRecorderRef.current?.stream?.getTracks().forEach(t => t.stop()); };
      mediaRecorderRef.current!.stop();
    }
    setIsRecording(false);
    if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    setRecordingTime(0);
  };

  // Helpers
  const getInitials = (n: string) => n.split(" ").map(x => x[0]).join("").toUpperCase().slice(0, 2);
  const getAvatarColor = (n: string) => {
    const c = ["from-blue-500 to-blue-600","from-purple-500 to-purple-600","from-emerald-500 to-emerald-600","from-orange-500 to-orange-600","from-pink-500 to-pink-600","from-cyan-500 to-cyan-600"];
    return c[n.charCodeAt(0) % c.length];
  };
  const formatTime = (ts: string) => new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const formatDate = (ts: string) => {
    const d = new Date(ts); const t = new Date();
    if (d.toDateString() === t.toDateString()) return "Hoje";
    const y = new Date(t); y.setDate(y.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return "Ontem";
    return d.toLocaleDateString("pt-BR");
  };
  const getStatusIcon = (s: string) => {
    switch (s) {
      case "sent": return <Check className="w-3.5 h-3.5 text-[#b3d1cb]" />;
      case "delivered": return <CheckCheck className="w-3.5 h-3.5 text-[#b3d1cb]" />;
      case "read": return <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />;
      default: return <Clock className="w-3.5 h-3.5 text-[#b3d1cb]" />;
    }
  };
  const getStatusConfig = (s: string) => leadStatuses.find(x => x.value === s) || leadStatuses[0];

  const filteredContacts = contacts.filter(c => {
    const ms = (c.name || "").toLowerCase().includes(search.toLowerCase()) || c.wa_id.includes(search);
    const mst = statusFilter === "todos" || c.lead_status === statusFilter;
    return ms && mst;
  });

  // Group messages by date
  const groupedMessages: { date: string; msgs: Message[] }[] = [];
  messages.forEach((msg) => {
    const date = formatDate(msg.timestamp);
    const last = groupedMessages[groupedMessages.length - 1];
    if (last && last.date === date) last.msgs.push(msg);
    else groupedMessages.push({ date, msgs: [msg] });
  });

  // === QR CODE SCREEN ===
  if (checkingConnection) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full bg-[#111b21]">
          <Loader2 className="w-8 h-8 text-[#00a884] animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!instanceConnected) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full bg-[#111b21]">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 bg-[#2a3942] rounded-full flex items-center justify-center mx-auto mb-6">
              <QrCode className="w-10 h-10 text-[#00a884]" />
            </div>
            <h2 className="text-2xl font-light text-[#e9edef] mb-2">Conectar WhatsApp</h2>
            <p className="text-sm text-[#8696a0] mb-6">Escaneie o QR Code abaixo com o WhatsApp do Farmer</p>

            {qrCode ? (
              <div className="bg-white p-4 rounded-2xl inline-block mb-4">
                <img src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`} alt="QR Code" className="w-64 h-64" />
              </div>
            ) : (
              <div className="bg-[#2a3942] p-8 rounded-2xl inline-block mb-4">
                <WifiOff className="w-16 h-16 text-[#8696a0] mx-auto mb-3" />
                <p className="text-sm text-[#8696a0]">Aguardando QR Code...</p>
              </div>
            )}

            <p className="text-xs text-[#8696a0] mt-4">Atualizando automaticamente a cada 5 segundos</p>
            <div className="flex items-center justify-center gap-2 mt-2">
              <Loader2 className="w-3 h-3 text-[#00a884] animate-spin" />
              <span className="text-xs text-[#8696a0]">Aguardando conexão...</span>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // === MAIN CHAT ===
  return (
    <AppLayout>
      <div className="flex" style={{ height: "calc(100vh - 48px)", marginTop: "-24px", marginLeft: "-24px", marginRight: "-24px", marginBottom: "-24px" }}>

        {/* SIDEBAR CONTATOS */}
        <div className={`${selectedContact ? "hidden lg:flex" : "flex"} w-full lg:w-[350px] flex-col border-r border-[#2a3942] bg-[#111b21] flex-shrink-0`}>
          <div className="px-4 py-3 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 bg-[#00a884] rounded-full flex items-center justify-center">
                  <Wifi className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-[15px] font-medium text-[#e9edef]">WhatsApp Farmer</p>
                  <p className="text-[12px] text-[#00a884]">● Conectado</p>
                </div>
              </div>
            </div>

            {/* Search */}
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

            {/* Status Filter */}
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              <button onClick={() => setStatusFilter("todos")} className={`px-3 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-all ${statusFilter === "todos" ? "bg-[#00a884] text-[#111b21]" : "bg-[#202c33] text-[#8696a0] hover:bg-[#2a3942]"}`}>
                Todos ({contacts.length})
              </button>
              {leadStatuses.map(s => {
                const count = contacts.filter(c => c.lead_status === s.value).length;
                if (count === 0) return null;
                return (
                  <button key={s.value} onClick={() => setStatusFilter(s.value)} className={`px-3 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-all ${statusFilter === s.value ? `${s.bg} ${s.text}` : "bg-[#202c33] text-[#8696a0] hover:bg-[#2a3942]"}`}>
                    {s.label} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Contacts List */}
          <div className="flex-1 overflow-y-auto border-t border-[#2a3942]">
            {loading ? (
              <div className="p-1">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-3" style={{ opacity: 1 - i * 0.08 }}>
                    <div className="w-[49px] h-[49px] bg-[#2a3942] rounded-full flex-shrink-0 animate-pulse" />
                    <div className="flex-1 space-y-2.5">
                      <div className="h-3.5 bg-[#2a3942] rounded-md animate-pulse" style={{ width: `${70 + (i % 3) * 20}px` }} />
                      <div className="h-3 bg-[#2a3942]/60 rounded-md animate-pulse" style={{ width: `${100 + (i % 4) * 25}px` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48">
                <MessageCircle className="w-8 h-8 mb-2 text-[#3b4a54]" />
                <p className="text-sm text-[#8696a0]">Nenhuma conversa</p>
              </div>
            ) : (
              filteredContacts.map((contact) => {
                const st = getStatusConfig(contact.lead_status);
                const isSelected = selectedContact?.wa_id === contact.wa_id;
                return (
                  <button
                    key={contact.wa_id}
                    onClick={() => setSelectedContact(contact)}
                    className={`w-full flex items-center gap-3 px-3 py-3 text-left transition-all ${isSelected ? "bg-[#2a3942]" : "hover:bg-[#202c33]"}`}
                  >
                    <div className="relative flex-shrink-0">
                      {profilePics[contact.wa_id] ? (
                        <img src={profilePics[contact.wa_id]!} alt="" className="w-[49px] h-[49px] rounded-full object-cover" />
                      ) : (
                        <div className={`w-[49px] h-[49px] rounded-full bg-gradient-to-br ${getAvatarColor(contact.name || contact.wa_id)} flex items-center justify-center text-white font-semibold text-sm`}>
                          {getInitials(contact.name || contact.wa_id)}
                        </div>
                      )}
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 ${st.color} rounded-full border-2 border-[#111b21]`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-normal text-[15px] text-[#e9edef] truncate">{contact.name || contact.wa_id}</p>
                        {contact.last_message_time && (
                          <span className={`text-[11px] ${contact.unread > 0 ? "text-[#00a884]" : "text-[#8696a0]"}`}>
                            {formatTime(contact.last_message_time)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <p className="text-[13px] text-[#8696a0] truncate">
                          {contact.last_direction === "outbound" && "✓✓ "}
                          {contact.last_message || "Sem mensagens"}
                        </p>
                        {contact.unread > 0 && (
                          <span className="min-w-[20px] h-5 px-1.5 bg-[#00a884] text-[#111b21] text-[11px] font-bold rounded-full flex items-center justify-center ml-1">
                            {contact.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* CHAT AREA */}
        <div className={`${selectedContact ? "flex" : "hidden lg:flex"} flex-1 flex-col min-w-0`}>
          {selectedContact ? (
            <>
              {/* Chat Header */}
              <div className="px-4 py-2.5 border-b border-[#2a3942] bg-[#202c33] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button onClick={() => setSelectedContact(null)} className="lg:hidden p-1.5 hover:bg-[#2a3942] rounded-lg">
                    <ArrowLeft className="w-5 h-5 text-[#8696a0]" />
                  </button>
                  {profilePics[selectedContact.wa_id] ? (
                    <img src={profilePics[selectedContact.wa_id]!} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getAvatarColor(selectedContact.name || selectedContact.wa_id)} flex items-center justify-center text-white font-semibold text-xs`}>
                      {getInitials(selectedContact.name || selectedContact.wa_id)}
                    </div>
                  )}
                  <div>
                    <p className="font-normal text-[15px] text-[#e9edef]">{selectedContact.name || selectedContact.wa_id}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] text-[#8696a0]">+{selectedContact.wa_id}</span>
                      <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-md ${getStatusConfig(selectedContact.lead_status).bg} ${getStatusConfig(selectedContact.lead_status).text}`}>
                        {getStatusConfig(selectedContact.lead_status).label}
                      </span>
                      {selectedContact.customer_id && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-md bg-emerald-500/20 text-emerald-400">
                          Cliente #{selectedContact.customer_id}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button onClick={() => setShowCRM(!showCRM)} className={`p-2 rounded-full transition-all ${showCRM ? "bg-[#2a3942] text-[#00a884]" : "hover:bg-[#2a3942] text-[#8696a0]"}`}>
                  <User className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-1 overflow-hidden">
                {/* Messages */}
                <div className="flex-1 flex flex-col min-w-0">
                  <div
                    ref={chatContainerRef}
                    onScroll={() => {
                      const c = chatContainerRef.current;
                      if (c) setShowScrollDown(c.scrollHeight - c.scrollTop - c.clientHeight > 150);
                    }}
                    className="flex-1 overflow-y-auto px-[4%] py-4 space-y-1 bg-[#0b141a]"
                  >
                    {loadingMessages ? (
                      <div className="space-y-3 py-4">
                        {[{d:"in",w:"55%"},{d:"in",w:"35%"},{d:"out",w:"45%"},{d:"in",w:"60%"},{d:"out",w:"40%"}].map((s, i) => (
                          <div key={i} className={`flex ${s.d === "out" ? "justify-end" : "justify-start"}`}>
                            <div className={`rounded-xl animate-pulse ${s.d === "out" ? "bg-[#005c4b]/40" : "bg-[#202c33]/80"}`} style={{ width: s.w, height: `${32 + (i % 3) * 12}px` }} />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <>
                        {groupedMessages.map((group) => (
                          <div key={group.date}>
                            <div className="flex justify-center my-3">
                              <span className="px-3 py-1.5 bg-[#182229] rounded-lg text-[12px] text-[#8696a0]">{group.date}</span>
                            </div>
                            {group.msgs.map((msg) => (
                              <div key={msg.id} className={`flex mb-1 ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[65%] px-2.5 py-1.5 shadow-sm relative ${
                                  msg.direction === "outbound"
                                    ? "bg-[#005c4b] text-[#e9edef] rounded-lg rounded-tr-none"
                                    : "bg-[#202c33] text-[#e9edef] rounded-lg rounded-tl-none"
                                }`}>
                                  {msg.direction === "outbound" ? (
                                    <span className="absolute -right-2 top-0 w-0 h-0 border-t-[8px] border-t-[#005c4b] border-r-[8px] border-r-transparent" />
                                  ) : (
                                    <span className="absolute -left-2 top-0 w-0 h-0 border-t-[8px] border-t-[#202c33] border-l-[8px] border-l-transparent" />
                                  )}
                                  <p className="text-[14.2px] whitespace-pre-wrap break-words leading-[19px]">{msg.content}</p>
                                  <div className="flex items-center justify-end gap-1 mt-0.5">
                                    <span className={`text-[11px] ${msg.direction === "outbound" ? "text-[#ffffff99]" : "text-[#8696a0]"}`}>{formatTime(msg.timestamp)}</span>
                                    {msg.direction === "outbound" && getStatusIcon(msg.status)}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ))}
                        <div ref={messagesEndRef} />
                      </>
                    )}
                    {showScrollDown && (
                      <button onClick={() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); setShowScrollDown(false); }} className="sticky bottom-4 left-1/2 -translate-x-1/2 w-10 h-10 bg-[#202c33] border border-[#2a3942] rounded-full flex items-center justify-center shadow-lg z-10">
                        <ChevronDown className="w-5 h-5 text-[#8696a0]" />
                      </button>
                    )}
                  </div>

                  {/* Input */}
                  <div className="px-3 py-2 bg-[#202c33]">
                    {isRecording ? (
                      <div className="flex items-center gap-3">
                        <button onClick={cancelRecording} className="p-2 rounded-full hover:bg-[#2a3942] text-red-400"><X className="w-5 h-5" /></button>
                        <div className="flex-1 flex items-center gap-3 px-4 py-2.5 bg-[#2a3942] rounded-lg">
                          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                          <span className="text-[14px] text-[#e9edef] tabular-nums font-mono">{Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, "0")}</span>
                          <div className="flex-1 flex items-center gap-0.5">
                            {[...Array(20)].map((_, i) => (
                              <div key={i} className="w-1 bg-[#00a884] rounded-full animate-pulse" style={{ height: `${Math.random() * 16 + 4}px`, animationDelay: `${i * 0.05}s` }} />
                            ))}
                          </div>
                        </div>
                        <button onClick={stopRecording} className="w-[42px] h-[42px] bg-[#00a884] rounded-full text-white flex items-center justify-center"><Send className="w-5 h-5" /></button>
                      </div>
                    ) : (
                      <div className="flex items-end gap-2">
                        <div className="relative">
                          <button onClick={() => imageInputRef.current?.click()} className="p-2 rounded-full text-[#8696a0] hover:text-[#e9edef]"><Paperclip className="w-6 h-6" /></button>
                          <input ref={imageInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, "image"); e.target.value = ""; }} />
                        </div>
                        <textarea
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          onKeyDown={handleKeyPress}
                          placeholder="Digite uma mensagem"
                          rows={1}
                          className="flex-1 px-3 py-2.5 bg-[#2a3942] rounded-lg text-[14px] text-[#e9edef] placeholder:text-[#8696a0] resize-none focus:outline-none"
                        />
                        {newMessage.trim() ? (
                          <button onClick={handleSend} disabled={sending} className="w-[42px] h-[42px] bg-[#00a884] rounded-full text-white flex items-center justify-center disabled:opacity-40">
                            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                          </button>
                        ) : (
                          <button onClick={startRecording} className="w-[42px] h-[42px] rounded-full text-[#8696a0] hover:text-[#e9edef] flex items-center justify-center">
                            <Mic className="w-6 h-6" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* CRM PANEL */}
                {showCRM && (
                  <div className="w-[300px] border-l border-[#2a3942] bg-[#111b21] overflow-y-auto flex-shrink-0 hidden xl:block">
                    <div className="p-5 space-y-6">
                      {/* Profile */}
                      <div className="text-center pb-5 border-b border-[#2a3942]">
                        {profilePics[selectedContact.wa_id] ? (
                          <img src={profilePics[selectedContact.wa_id]!} alt="" className="w-16 h-16 rounded-full object-cover shadow-md mx-auto" />
                        ) : (
                          <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${getAvatarColor(selectedContact.name || selectedContact.wa_id)} flex items-center justify-center text-white font-bold text-xl shadow-md mx-auto`}>
                            {getInitials(selectedContact.name || selectedContact.wa_id)}
                          </div>
                        )}
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
                      </div>

                      {/* Lead Status */}
                      <div>
                        <p className="text-[11px] font-semibold text-[#8696a0] uppercase tracking-wider mb-2">Status do Lead</p>
                        <div className="relative">
                          <button
                            onClick={() => setShowStatusMenu(!showStatusMenu)}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border ${getStatusConfig(selectedContact.lead_status).bg} transition-all`}
                          >
                            <div className="flex items-center gap-2">
                              <div className={`w-2.5 h-2.5 rounded-full ${getStatusConfig(selectedContact.lead_status).color}`} />
                              <span className={`text-[13px] font-medium ${getStatusConfig(selectedContact.lead_status).text}`}>
                                {getStatusConfig(selectedContact.lead_status).label}
                              </span>
                            </div>
                            <ChevronDown className={`w-4 h-4 text-[#8696a0] transition-transform ${showStatusMenu ? "rotate-180" : ""}`} />
                          </button>
                          {showStatusMenu && (
                            <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#233138] rounded-xl border border-[#2a3942] shadow-lg z-10 overflow-hidden">
                              {leadStatuses.map(s => (
                                <button key={s.value} onClick={() => updateLeadStatus(s.value)} className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-[#182229] transition-colors text-left">
                                  <div className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
                                  <span className="text-[13px] text-[#e9edef]">{s.label}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Notes */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[11px] font-semibold text-[#8696a0] uppercase tracking-wider">Notas</p>
                          {!editingNotes && (
                            <button onClick={() => setEditingNotes(true)} className="text-[12px] text-[#00a884] font-medium">Editar</button>
                          )}
                        </div>
                        {editingNotes ? (
                          <div>
                            <textarea value={notesValue} onChange={(e) => setNotesValue(e.target.value)} rows={4} className="w-full px-3 py-2.5 text-[13px] text-[#e9edef] bg-[#2a3942] border border-[#3b4a54] rounded-xl outline-none focus:border-[#00a884] resize-none" placeholder="Notas sobre o lead..." />
                            <div className="flex gap-2 mt-2">
                              <button onClick={saveNotes} className="px-3.5 py-1.5 bg-[#00a884] text-[#111b21] text-[11px] font-medium rounded-lg">Salvar</button>
                              <button onClick={() => { setEditingNotes(false); setNotesValue(selectedContact.notes || ""); }} className="px-3.5 py-1.5 text-[#8696a0] text-[11px] rounded-lg hover:bg-[#202c33]">Cancelar</button>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-[#202c33] rounded-xl p-3 min-h-[60px] border border-[#2a3942]">
                            <p className="text-[13px] text-[#8696a0] whitespace-pre-wrap">{selectedContact.notes || "Sem notas"}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center bg-[#222e35]">
              <div className="w-20 h-20 bg-[#2a3942] rounded-full flex items-center justify-center mb-5">
                <MessageCircle className="w-9 h-9 text-[#8696a0]" />
              </div>
              <p className="text-[28px] font-light text-[#e9edef]">Customer 360 WhatsApp</p>
              <p className="text-sm mt-2 text-[#8696a0]">Selecione uma conversa para começar</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
