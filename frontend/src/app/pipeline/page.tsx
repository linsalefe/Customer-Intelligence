"use client";

import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import {
  Plus,
  GripVertical,
  Trash2,
  Edit3,
  X,
  Check,
  MessageCircle,
  Phone,
  User,
  Settings,
  ChevronDown,
} from "lucide-react";
import AppLayout from "@/components/app-layout";
import api from "@/lib/api";

interface Stage {
  id: number;
  name: string;
  color: string;
  position: number;
}

interface Contact {
  wa_id: string;
  name: string;
  phone: string;
  customer_id: number | null;
  lead_status: string;
  last_message: string | null;
  last_message_time: string | null;
  unread: number;
  notes: string | null;
}

export default function PipelinePage() {
  const [stages, setStages] = useState<Stage[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedContact, setDraggedContact] = useState<Contact | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [editingStage, setEditingStage] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [showAddStage, setShowAddStage] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [newStageColor, setNewStageColor] = useState("#8696a0");
  const [showSettings, setShowSettings] = useState(false);

  const colors = ["#3b82f6", "#f59e0b", "#a855f7", "#06b6d4", "#10b981", "#ef4444", "#ec4899", "#f97316", "#84cc16", "#8696a0"];

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [stagesRes, contactsRes] = await Promise.all([
        api.get("/api/pipeline/stages"),
        api.get("/api/pipeline/contacts"),
      ]);
      setStages(stagesRes.data);
      setContacts(contactsRes.data);
    } catch {
      toast.error("Erro ao carregar pipeline");
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (contact: Contact) => {
    setDraggedContact(contact);
  };

  const handleDragOver = (e: React.DragEvent, stageName: string) => {
    e.preventDefault();
    setDragOverStage(stageName);
  };

  const handleDragLeave = () => {
    setDragOverStage(null);
  };

  const handleDrop = async (stageName: string) => {
    setDragOverStage(null);
    if (!draggedContact || draggedContact.lead_status === stageName) {
      setDraggedContact(null);
      return;
    }
    const prev = draggedContact.lead_status;
    setContacts((cs) =>
      cs.map((c) => (c.wa_id === draggedContact.wa_id ? { ...c, lead_status: stageName } : c))
    );
    setDraggedContact(null);
    try {
      await api.patch(`/api/pipeline/contacts/${draggedContact.wa_id}/move`, { lead_status: stageName });
    } catch {
      setContacts((cs) =>
        cs.map((c) => (c.wa_id === draggedContact.wa_id ? { ...c, lead_status: prev } : c))
      );
      toast.error("Erro ao mover contato");
    }
  };

  const addStage = async () => {
    if (!newStageName.trim()) return;
    try {
      await api.post("/api/pipeline/stages", { name: newStageName.trim(), color: newStageColor });
      setNewStageName("");
      setNewStageColor("#8696a0");
      setShowAddStage(false);
      await loadData();
      toast.success("Etapa criada");
    } catch {
      toast.error("Erro ao criar etapa");
    }
  };

  const startEditStage = (stage: Stage) => {
    setEditingStage(stage.id);
    setEditName(stage.name);
    setEditColor(stage.color);
  };

  const saveEditStage = async () => {
    if (!editingStage || !editName.trim()) return;
    try {
      await api.put(`/api/pipeline/stages/${editingStage}`, { name: editName.trim(), color: editColor });
      setEditingStage(null);
      await loadData();
      toast.success("Etapa atualizada");
    } catch {
      toast.error("Erro ao atualizar");
    }
  };

  const deleteStage = async (stageId: number, stageName: string) => {
    const stageContacts = contacts.filter((c) => c.lead_status === stageName);
    if (stageContacts.length > 0) {
      toast.error(`Mova os ${stageContacts.length} contatos antes de excluir`);
      return;
    }
    if (!confirm("Excluir esta etapa?")) return;
    try {
      await api.delete(`/api/pipeline/stages/${stageId}`);
      await loadData();
      toast.success("Etapa excluída");
    } catch {
      toast.error("Erro ao excluir");
    }
  };

  const formatTime = (ts: string | null) => {
    if (!ts) return "";
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return "Ontem";
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  };

  const getInitials = (n: string) => n.split(" ").map((x) => x[0]).join("").toUpperCase().slice(0, 2);

  const stageNameMap = new Map<string, string>();
  stages.forEach((s) => {
    const key = s.name.toLowerCase().replace(/\s+/g, "_");
    stageNameMap.set(key, s.name);
  });

  const getStageKey = (stage: Stage) => stage.name.toLowerCase().replace(/\s+/g, "_");

  const getContactsByStage = (stage: Stage) => {
    const key = getStageKey(stage);
    return contacts.filter((c) => {
      const cs = (c.lead_status || "novo").toLowerCase().replace(/\s+/g, "_");
      return cs === key;
    });
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full bg-[#111b21]">
          <div className="w-8 h-8 border-2 border-[#00a884] border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="h-full flex flex-col bg-[#111b21]" style={{ marginTop: "-24px", marginLeft: "-24px", marginRight: "-24px", marginBottom: "-24px" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a3942]">
          <div>
            <h1 className="text-xl font-semibold text-[#e9edef]">Pipeline de Vendas</h1>
            <p className="text-sm text-[#8696a0] mt-0.5">{contacts.length} contatos no pipeline</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddStage(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#00a884] text-[#111b21] rounded-lg text-sm font-medium hover:bg-[#00a884]/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nova Etapa
            </button>
          </div>
        </div>

        {/* Add Stage Modal */}
        {showAddStage && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowAddStage(false)}>
            <div className="bg-[#233138] rounded-2xl p-6 w-[380px] border border-[#2a3942]" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-[#e9edef] mb-4">Nova Etapa</h3>
              <input
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                placeholder="Nome da etapa"
                className="w-full px-3 py-2.5 bg-[#2a3942] rounded-lg text-[#e9edef] text-sm placeholder:text-[#8696a0] outline-none focus:ring-1 focus:ring-[#00a884] mb-3"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && addStage()}
              />
              <p className="text-xs text-[#8696a0] mb-2">Cor da etapa</p>
              <div className="flex gap-2 mb-5">
                {colors.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewStageColor(c)}
                    className={`w-7 h-7 rounded-full transition-all ${newStageColor === c ? "ring-2 ring-white ring-offset-2 ring-offset-[#233138] scale-110" : "hover:scale-110"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowAddStage(false)} className="px-4 py-2 text-[#8696a0] text-sm rounded-lg hover:bg-[#2a3942]">Cancelar</button>
                <button onClick={addStage} className="px-4 py-2 bg-[#00a884] text-[#111b21] text-sm font-medium rounded-lg hover:bg-[#00a884]/90">Criar</button>
              </div>
            </div>
          </div>
        )}

        {/* Kanban Board */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex gap-3 p-4 h-full min-w-max">
            {stages.map((stage) => {
              const stageContacts = getContactsByStage(stage);
              const key = getStageKey(stage);
              const isOver = dragOverStage === key;
              return (
                <div
                  key={stage.id}
                  className={`w-[300px] flex-shrink-0 flex flex-col rounded-xl transition-all ${isOver ? "bg-[#2a3942]/80 ring-2 ring-[#00a884]" : "bg-[#202c33]"}`}
                  onDragOver={(e) => handleDragOver(e, key)}
                  onDragLeave={handleDragLeave}
                  onDrop={() => handleDrop(key)}
                >
                  {/* Stage Header */}
                  <div className="px-3 py-3 flex items-center justify-between flex-shrink-0">
                    {editingStage === stage.id ? (
                      <div className="flex-1 flex items-center gap-2">
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1 px-2 py-1 bg-[#2a3942] rounded text-sm text-[#e9edef] outline-none focus:ring-1 focus:ring-[#00a884]"
                          autoFocus
                          onKeyDown={(e) => e.key === "Enter" && saveEditStage()}
                        />
                        <div className="flex gap-1">
                          {colors.map((c) => (
                            <button
                              key={c}
                              onClick={() => setEditColor(c)}
                              className={`w-4 h-4 rounded-full ${editColor === c ? "ring-1 ring-white" : ""}`}
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                        <button onClick={saveEditStage} className="p-1 text-[#00a884] hover:bg-[#2a3942] rounded"><Check className="w-4 h-4" /></button>
                        <button onClick={() => setEditingStage(null)} className="p-1 text-[#8696a0] hover:bg-[#2a3942] rounded"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                          <span className="text-[14px] font-medium text-[#e9edef]">{stage.name}</span>
                          <span className="text-[12px] text-[#8696a0] bg-[#111b21] px-2 py-0.5 rounded-full">{stageContacts.length}</span>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <button onClick={() => startEditStage(stage)} className="p-1.5 text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942] rounded-lg transition-colors">
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => deleteStage(stage.id, stage.name)} className="p-1.5 text-[#8696a0] hover:text-red-400 hover:bg-[#2a3942] rounded-lg transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
                    {stageContacts.length === 0 ? (
                      <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${isOver ? "border-[#00a884] bg-[#00a884]/10" : "border-[#2a3942]"}`}>
                        <p className="text-[12px] text-[#8696a0]">Arraste contatos aqui</p>
                      </div>
                    ) : (
                      stageContacts.map((contact) => (
                        <div
                          key={contact.wa_id}
                          draggable
                          onDragStart={() => handleDragStart(contact)}
                          onDragEnd={() => setDraggedContact(null)}
                          className={`bg-[#111b21] rounded-xl p-3 cursor-grab active:cursor-grabbing border border-[#2a3942] hover:border-[#3b4a54] transition-all group ${
                            draggedContact?.wa_id === contact.wa_id ? "opacity-40 scale-95" : ""
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#00a884] to-[#00a884]/60 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                              {getInitials(contact.name || contact.wa_id)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <p className="text-[13px] font-medium text-[#e9edef] truncate">{contact.name || contact.wa_id}</p>
                                {contact.unread > 0 && (
                                  <span className="w-5 h-5 bg-[#00a884] rounded-full text-[10px] text-[#111b21] flex items-center justify-center font-bold">{contact.unread}</span>
                                )}
                              </div>
                              {contact.last_message && (
                                <p className="text-[11px] text-[#8696a0] truncate mt-0.5">{contact.last_message}</p>
                              )}
                              <div className="flex items-center gap-2 mt-1.5">
                                {contact.last_message_time && (
                                  <span className="text-[10px] text-[#8696a0]">{formatTime(contact.last_message_time)}</span>
                                )}
                                {contact.customer_id && (
                                  <span className="text-[10px] text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">C360</span>
                                )}
                              </div>
                            </div>
                            <GripVertical className="w-4 h-4 text-[#3b4a54] group-hover:text-[#8696a0] flex-shrink-0 mt-1" />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}