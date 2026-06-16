"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Megaphone,
  Send,
  Users,
  Target,
  Calendar,
  Loader2,
  Rocket,
  X,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import AppLayout from "@/components/app-layout";
import api from "@/lib/api";

interface Job {
  id: number;
  mensage_job_id: number | null;
  channel: string;
  status: string;
  total_targets: number | null;
  sent_count: number | null;
  error_count: number | null;
  scheduled_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
const fmtDate = (s: string | null) =>
  s ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(s)) : "—";

const statusStyle: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600",
  running: "bg-blue-50 text-blue-700",
  completed: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-orange-50 text-orange-700",
  failed: "bg-red-50 text-red-700",
};

export default function DisparoPage() {
  // Segmento
  const [segment, setSegment] = useState("");
  const [product, setProduct] = useState("");
  const [minRevenue, setMinRevenue] = useState("");
  const [maxRevenue, setMaxRevenue] = useState("");
  const [products, setProducts] = useState<string[]>([]);
  const [preview, setPreview] = useState<{ count: number; sample: { customer_id: number; name: string }[] } | null>(null);
  const [previewing, setPreviewing] = useState(false);

  // Canal + mensagem
  const [channel, setChannel] = useState<"official" | "unofficial">("official");
  const [templates, setTemplates] = useState<any[]>([]);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [templateParams, setTemplateParams] = useState<Record<string, string>>({});
  const [freeText, setFreeText] = useState("");

  // Agendamento
  const [scheduledAt, setScheduledAt] = useState("");
  const [intervalSeconds, setIntervalSeconds] = useState(2);
  const [creating, setCreating] = useState(false);

  // Histórico
  const [jobs, setJobs] = useState<Job[]>([]);

  const filters = useCallback(() => {
    const f: any = {};
    if (segment) f.segment = segment;
    if (product) f.product = product;
    if (minRevenue) f.min_revenue = parseFloat(minRevenue);
    if (maxRevenue) f.max_revenue = parseFloat(maxRevenue);
    return f;
  }, [segment, product, minRevenue, maxRevenue]);

  useEffect(() => {
    api.get("/api/dashboard/products").then((r) => setProducts(r.data.products || [])).catch(() => {});
  }, []);

  const loadJobs = useCallback(() => {
    api.get("/api/disparo").then((r) => setJobs(r.data.data || [])).catch(() => {});
  }, []);

  // Polling do progresso (relay atualiza comm.broadcast_jobs)
  useEffect(() => {
    loadJobs();
    const t = setInterval(loadJobs, 5000);
    return () => clearInterval(t);
  }, [loadJobs]);

  // Templates oficiais (proxy -> Mensage)
  useEffect(() => {
    if (channel !== "official") return;
    setTemplatesError(null);
    api
      .get("/api/disparo/templates")
      .then((r) => {
        const list = Array.isArray(r.data) ? r.data : r.data?.templates || r.data?.data || [];
        setTemplates(list);
      })
      .catch((e) => setTemplatesError(e?.response?.data?.detail || "Não foi possível listar templates"));
  }, [channel]);

  const doPreview = async () => {
    setPreviewing(true);
    setPreview(null);
    try {
      const r = await api.post("/api/disparo/preview", filters());
      setPreview(r.data);
    } catch {
      toast.error("Erro ao gerar preview do segmento");
    } finally {
      setPreviewing(false);
    }
  };

  const selectedTemplate = templates.find((t: any) => (t.id ?? t.template_id) === templateId);
  const templateVarCount = (() => {
    if (!selectedTemplate) return 0;
    const body =
      selectedTemplate.body ||
      (selectedTemplate.components || []).find((c: any) => c.type === "BODY")?.text ||
      "";
    const matches = String(body).match(/\{\{\s*\d+\s*\}\}/g);
    return matches ? new Set(matches).size : 0;
  })();

  const create = async () => {
    if (!preview || preview.count === 0) {
      toast.error("Gere um preview com pelo menos 1 contato antes de disparar");
      return;
    }
    let message: any;
    if (channel === "official") {
      if (!templateId) {
        toast.error("Escolha um template aprovado");
        return;
      }
      message = { template_id: templateId, template_params: templateParams };
    } else {
      if (!freeText.trim()) {
        toast.error("Escreva a mensagem");
        return;
      }
      message = { text: freeText };
    }
    setCreating(true);
    try {
      const body = {
        filters: filters(),
        channel,
        message,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        interval_seconds: intervalSeconds,
      };
      const r = await api.post("/api/disparo/create", body);
      toast.success(`Disparo criado (job #${r.data.mensage_job_id ?? r.data.id}) — ${r.data.total_targets} contatos`);
      loadJobs();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Erro ao criar disparo");
    } finally {
      setCreating(false);
    }
  };

  const cancelJob = async (id: number) => {
    try {
      await api.post(`/api/disparo/${id}/cancel`);
      toast.success("Disparo cancelado");
      loadJobs();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Erro ao cancelar");
    }
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-[#2A658F] to-[#3d7ba8] p-2.5 rounded-xl text-white">
            <Megaphone className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-dark">Disparo em massa</h1>
            <p className="text-sm text-gray-500">Segmento do 360 → canal → progresso ao vivo</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* COLUNA 1 — Segmento + mensagem */}
          <div className="space-y-6">
            {/* Segmento */}
            <section className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
              <div className="flex items-center gap-2 text-dark font-semibold">
                <Target className="w-4.5 h-4.5 text-[#2A658F]" /> 1. Segmento
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select value={segment} onChange={(e) => setSegment(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-dark">
                  <option value="">Status (todos)</option>
                  <option value="Ativo">Ativos</option>
                  <option value="Inativo">Inativos</option>
                </select>
                <select value={product} onChange={(e) => setProduct(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-dark">
                  <option value="">Todos os produtos</option>
                  {products.map((p) => (
                    <option key={p} value={p}>{p.length > 40 ? p.slice(0, 40) + "…" : p}</option>
                  ))}
                </select>
                <input type="number" value={minRevenue} onChange={(e) => setMinRevenue(e.target.value)} placeholder="Receita mín. (R$)" className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-dark" />
                <input type="number" value={maxRevenue} onChange={(e) => setMaxRevenue(e.target.value)} placeholder="Receita máx. (R$)" className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-dark" />
              </div>
              <button onClick={doPreview} disabled={previewing} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#2A658F] text-white text-sm font-medium rounded-lg hover:bg-[#235578] disabled:opacity-50">
                {previewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                Gerar preview do segmento
              </button>
              {preview && (
                <div className="bg-[#f5f7fa] rounded-xl p-4">
                  <p className="text-2xl font-bold text-[#2A658F]">{preview.count.toLocaleString("pt-BR")}</p>
                  <p className="text-xs text-gray-500 mb-2">contatos com telefone válido</p>
                  {preview.sample.length > 0 && (
                    <p className="text-xs text-gray-600 truncate">ex.: {preview.sample.map((s) => s.name).filter(Boolean).join(", ")}</p>
                  )}
                  {preview.count === 0 && <p className="text-xs text-orange-600">Nenhum contato — ajuste os filtros.</p>}
                </div>
              )}
            </section>

            {/* Mensagem */}
            <section className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
              <div className="flex items-center gap-2 text-dark font-semibold">
                <Send className="w-4.5 h-4.5 text-[#2A658F]" /> 2. Canal e mensagem
              </div>
              <div className="flex rounded-lg overflow-hidden border border-gray-200 w-fit">
                <button onClick={() => setChannel("official")} className={`px-4 py-1.5 text-sm font-medium ${channel === "official" ? "bg-[#2A658F] text-white" : "text-gray-500"}`}>Oficial (template)</button>
                <button onClick={() => setChannel("unofficial")} className={`px-4 py-1.5 text-sm font-medium ${channel === "unofficial" ? "bg-amber-500 text-white" : "text-gray-500"}`}>Não-oficial (Farmer)</button>
              </div>

              {channel === "official" ? (
                <div className="space-y-3">
                  {templatesError ? (
                    <div className="flex items-start gap-2 bg-red-50 text-red-700 text-xs rounded-lg p-3">
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {templatesError}
                    </div>
                  ) : (
                    <select
                      value={templateId ?? ""}
                      onChange={(e) => { setTemplateId(e.target.value ? Number(e.target.value) : null); setTemplateParams({}); }}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-dark"
                    >
                      <option value="">Escolha um template aprovado…</option>
                      {templates.map((t: any) => (
                        <option key={t.id ?? t.template_id} value={t.id ?? t.template_id}>
                          {t.name} ({t.language || t.language_code || "pt_BR"})
                        </option>
                      ))}
                    </select>
                  )}
                  {templateVarCount > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500">Variáveis do template (use {"{nome}"} para personalizar por contato):</p>
                      {Array.from({ length: templateVarCount }, (_, i) => String(i + 1)).map((k) => (
                        <input
                          key={k}
                          value={templateParams[k] || ""}
                          onChange={(e) => setTemplateParams((p) => ({ ...p, [k]: e.target.value }))}
                          placeholder={`Variável {{${k}}}`}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-dark"
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-start gap-2 bg-amber-50 text-amber-700 text-xs rounded-lg p-3">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    Disparo não-oficial em massa pode estar indisponível se o canal Farmer não estiver configurado no Mensage — nesse caso o envio retorna erro claro.
                  </div>
                  <textarea value={freeText} onChange={(e) => setFreeText(e.target.value)} rows={4} placeholder="Olá {nome}, ..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-dark resize-none" />
                </div>
              )}
            </section>
          </div>

          {/* COLUNA 2 — Agendar + criar + histórico */}
          <div className="space-y-6">
            <section className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
              <div className="flex items-center gap-2 text-dark font-semibold">
                <Calendar className="w-4.5 h-4.5 text-[#2A658F]" /> 3. Agendamento
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Quando (vazio = agora)</label>
                  <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-dark" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Intervalo (s)</label>
                  <input type="number" min={1} value={intervalSeconds} onChange={(e) => setIntervalSeconds(Math.max(1, Number(e.target.value)))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-dark" />
                </div>
              </div>
              <button onClick={create} disabled={creating} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#2A658F] to-[#3d7ba8] text-white text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-50">
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                Disparar {preview ? `para ${preview.count.toLocaleString("pt-BR")} contatos` : ""}
              </button>
            </section>

            {/* Histórico + progresso */}
            <section className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-dark font-semibold">
                  <Megaphone className="w-4.5 h-4.5 text-[#2A658F]" /> Disparos
                </div>
                <button onClick={loadJobs} className="text-gray-400 hover:text-[#2A658F]" title="Atualizar"><RefreshCw className="w-4 h-4" /></button>
              </div>
              {jobs.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-400">Nenhum disparo ainda.</div>
              ) : (
                <div className="space-y-3 max-h-[420px] overflow-y-auto">
                  {jobs.map((j) => {
                    const total = j.total_targets || 0;
                    const sent = j.sent_count || 0;
                    const pct = total > 0 ? Math.min(100, Math.round((sent / total) * 100)) : 0;
                    const active = j.status === "pending" || j.status === "running";
                    return (
                      <div key={j.id} className="border border-gray-100 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${statusStyle[j.status] || "bg-gray-100 text-gray-600"}`}>{j.status}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${j.channel === "official" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>{j.channel === "official" ? "Oficial" : "Farmer"}</span>
                          </div>
                          {active && j.mensage_job_id && (
                            <button onClick={() => cancelJob(j.id)} className="text-gray-400 hover:text-red-500" title="Cancelar"><X className="w-4 h-4" /></button>
                          )}
                          {j.status === "completed" && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full ${j.status === "completed" ? "bg-emerald-500" : "bg-[#2A658F]"} transition-all`} style={{ width: `${pct}%` }} />
                        </div>
                        <div className="flex items-center justify-between mt-1.5 text-[11px] text-gray-500">
                          <span>{sent}/{total} enviados{j.error_count ? ` · ${j.error_count} erros` : ""}</span>
                          <span>{j.scheduled_at ? `agendado ${fmtDate(j.scheduled_at)}` : fmtDate(j.created_at)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
