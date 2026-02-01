"use client";

import { useState, useEffect } from "react";
import AppLayout from "@/components/app-layout";
import api from "@/lib/api";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, UserPlus, Shield, Eye, Briefcase } from "lucide-react";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  operacional: "Operacional",
  viewer: "Visualizador",
};

const roleIcons: Record<string, React.ReactNode> = {
  admin: <Shield className="w-4 h-4" />,
  operacional: <Briefcase className="w-4 h-4" />,
  viewer: <Eye className="w-4 h-4" />,
};

const roleBadge: Record<string, string> = {
  admin: "bg-purple-50 text-purple-700",
  operacional: "bg-blue-50 text-blue-700",
  viewer: "bg-gray-100 text-gray-600",
};

export default function UsuariosPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState("viewer");
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => setMounted(true), []);

  const loadUsers = async () => {
    try {
      const res = await api.get("/api/users");
      setUsers(res.data.data);
    } catch {
      toast.error("Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const openCreate = () => {
    setEditingUser(null);
    setFormName("");
    setFormEmail("");
    setFormPassword("");
    setFormRole("viewer");
    setFormActive(true);
    setShowModal(true);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setFormName(user.name);
    setFormEmail(user.email);
    setFormPassword("");
    setFormRole(user.role);
    setFormActive(user.is_active);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formName || !formEmail) {
      toast.error("Preencha nome e email");
      return;
    }
    if (!editingUser && !formPassword) {
      toast.error("Defina uma senha");
      return;
    }

    setSaving(true);
    try {
      if (editingUser) {
        const payload: Record<string, string | boolean> = {
          name: formName,
          role: formRole,
          is_active: formActive,
        };
        if (formPassword) payload.password = formPassword;
        await api.put(`/api/users/${editingUser.id}`, payload);
        toast.success("Usuário atualizado");
      } else {
        await api.post("/api/users", {
          name: formName,
          email: formEmail,
          password: formPassword,
          role: formRole,
        });
        toast.success("Usuário criado");
      }
      setShowModal(false);
      loadUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user: User) => {
    if (!confirm(`Deletar ${user.name}?`)) return;
    try {
      await api.delete(`/api/users/${user.id}`);
      toast.success("Usuário removido");
      loadUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Erro ao deletar");
    }
  };

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
            <p className="text-sm font-medium text-[#2A658F] mb-1">Administração</p>
            <h1 className="text-2xl font-semibold text-[#27273D]">Usuários</h1>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-[#2A658F] to-[#3d7ba8] rounded-xl hover:opacity-90 transition-all duration-200"
          >
            <UserPlus className="w-4 h-4" />
            Novo Usuário
          </button>
        </div>

        {/* Users Grid */}
        <div
          className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 transition-all duration-700 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
          style={{ transitionDelay: "100ms" }}
        >
          {loading
            ? [...Array(3)].map((_, i) => (
                <div key={i} className="h-48 bg-gray-200 rounded-2xl animate-pulse" />
              ))
            : users.map((user) => (
                <div
                  key={user.id}
                  className={`bg-white rounded-2xl border p-6 transition-all duration-300 hover:shadow-lg hover:shadow-gray-100/50 ${
                    user.is_active ? "border-gray-100" : "border-orange-200 opacity-70"
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 bg-gradient-to-br from-[#2A658F] to-[#3d7ba8] rounded-xl flex items-center justify-center text-white font-semibold text-sm">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#27273D]">{user.name}</p>
                        <p className="text-xs text-gray-400">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(user)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-[#2A658F] hover:bg-blue-50 transition-all"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(user)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${roleBadge[user.role]}`}>
                      {roleIcons[user.role]}
                      {roleLabels[user.role]}
                    </span>
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${
                        user.is_active ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
                      }`}
                    >
                      {user.is_active ? "Ativo" : "Inativo"}
                    </span>
                  </div>

                  <p className="text-xs text-gray-400">
                    Criado em {new Date(user.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              ))}
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-[#27273D]">
                  {editingUser ? "Editar Usuário" : "Novo Usuário"}
                </h2>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-[#27273D] block mb-1.5">Nome</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#2A658F] focus:ring-1 focus:ring-[#2A658F] bg-white"
                    placeholder="Nome completo"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-[#27273D] block mb-1.5">Email</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    disabled={!!editingUser}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#2A658F] bg-white disabled:bg-gray-50 disabled:text-gray-400"
                    placeholder="email@cenat.com"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-[#27273D] block mb-1.5">
                    {editingUser ? "Nova Senha (deixe em branco para manter)" : "Senha"}
                  </label>
                  <input
                    type="password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#2A658F] bg-white"
                    placeholder="••••••••"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-[#27273D] block mb-1.5">Perfil</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#2A658F] bg-white cursor-pointer"
                  >
                    <option value="viewer">Visualizador — só consulta</option>
                    <option value="operacional">Operacional — consulta + reativação</option>
                    <option value="admin">Administrador — acesso total</option>
                  </select>
                </div>

                {editingUser && (
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-[#27273D]">Ativo</label>
                    <button
                      onClick={() => setFormActive(!formActive)}
                      className={`relative w-11 h-6 rounded-full transition-all duration-200 ${
                        formActive ? "bg-emerald-500" : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                          formActive ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 mt-6">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-[#2A658F] to-[#3d7ba8] rounded-xl hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {saving ? "Salvando..." : editingUser ? "Atualizar" : "Criar"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
