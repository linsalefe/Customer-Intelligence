"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import {
  BarChart3,
  Users,
  RefreshCw,
  Trophy,
  TrendingUp,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  LayoutGrid,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles: string[];
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: <BarChart3 className="w-5 h-5" />, roles: ["admin", "operacional", "viewer"] },
  { label: "Clientes", href: "/clientes", icon: <Users className="w-5 h-5" />, roles: ["admin", "operacional", "viewer"] },
  { label: "Reativação", href: "/reativacao", icon: <RefreshCw className="w-5 h-5" />, roles: ["admin", "operacional"] },
  { label: "Top Clientes", href: "/top-clientes", icon: <Trophy className="w-5 h-5" />, roles: ["admin", "operacional", "viewer"] },
  { label: "Receita", href: "/receita", icon: <TrendingUp className="w-5 h-5" />, roles: ["admin", "operacional", "viewer"] },
  { label: "Cohort", href: "/cohort", icon: <LayoutGrid className="w-5 h-5" />, roles: ["admin", "operacional"] },
  { label: "Usuários", href: "/usuarios", icon: <Settings className="w-5 h-5" />, roles: ["admin"] },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f7fa]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const filteredNav = navItems.filter((item) => item.roles.includes(user.role));

  const roleLabel = { admin: "Administrador", operacional: "Operacional", viewer: "Visualizador" };

  return (
    <div className="min-h-screen bg-[#f5f7fa] flex">
      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full bg-[#27273D] text-white z-50 flex flex-col transition-all duration-300
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0
          ${collapsed ? "lg:w-20" : "lg:w-64"}
        `}
      >
        {/* Logo */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          {!collapsed && (
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-[#2A658F] to-[#3d7ba8] p-2 rounded-lg">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-semibold text-sm">Customer 360</h2>
                <p className="text-[11px] text-gray-400">CENAT</p>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="mx-auto bg-gradient-to-br from-[#2A658F] to-[#3d7ba8] p-2 rounded-lg">
              <BarChart3 className="w-5 h-5" />
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-1">
          {filteredNav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <button
                key={item.href}
                onClick={() => {
                  router.push(item.href);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200
                  ${isActive
                    ? "bg-gradient-to-r from-[#2A658F] to-[#3d7ba8] text-white font-semibold"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                  }
                  ${collapsed ? "justify-center" : ""}
                `}
                title={collapsed ? item.label : undefined}
              >
                {item.icon}
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Collapse toggle (desktop) */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex items-center justify-center py-3 border-t border-white/10 text-gray-400 hover:text-white transition-all duration-200"
        >
          <ChevronLeft className={`w-4 h-4 transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`} />
        </button>

        {/* User */}
        <div className="p-4 border-t border-white/10">
          <div className={`flex items-center ${collapsed ? "justify-center" : "gap-3"}`}>
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-xs font-semibold shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{user.name}</p>
                <p className="text-[11px] text-gray-400">{roleLabel[user.role]}</p>
              </div>
            )}
            <button
              onClick={logout}
              className="text-gray-400 hover:text-red-400 transition-all duration-200"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className={`flex-1 transition-all duration-300 ${collapsed ? "lg:ml-20" : "lg:ml-64"}`}>
        {/* Header mobile */}
        <header className="lg:hidden flex items-center justify-between p-4 bg-white border-b border-gray-100">
          <button onClick={() => setSidebarOpen(true)}>
            <Menu className="w-6 h-6 text-dark" />
          </button>
          <h1 className="font-semibold text-dark">Customer 360</h1>
          <div className="w-6" />
        </header>

        {/* Content */}
        <main
          className={`p-6 transition-all duration-500 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
