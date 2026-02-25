import React, { useState, useEffect } from 'react';
import { supabase, supabaseConfigured } from './lib/supabase';
import { authFetch } from './lib/authFetch';
import type { Session } from '@supabase/supabase-js';
import {
  LayoutDashboard,
  Users,
  Package,
  PlusCircle,
  TrendingUp,
  Clock,
  Search,
  Filter,
  Download,
  Share2,
  Image as ImageIcon,
  X,
  ChevronRight,
  Trash2,
  LogOut,
  BarChart3,
  Settings,
  Bell,
  Moon,
  Sun,
  MoreHorizontal,
  Mail,
  Lock,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useDropzone } from 'react-dropzone';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Stats, Order, Customer, formatCurrency, formatDate, maskPhone } from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Auth Component ---

function Login({ onLogin }: { onLogin: (session: Session) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(signInError.message === 'Invalid login credentials'
          ? 'Email ou senha inválidos'
          : signInError.message);
      } else if (data.session) {
        onLogin(data.session);
      }
    } catch (e) {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-dark p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid z-0"></div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 bg-primary-accent rounded-2xl flex items-center justify-center shadow-2xl shadow-primary-accent/20">
            <Package className="text-white w-8 h-8" />
          </div>
        </div>

        <div className="glass-card p-8 space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-black text-white tracking-tight">Bem-vindo</h1>
            <p className="text-slate-400">Acesse seu painel administrativo</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-300 flex items-center gap-2">
                  <Mail size={16} /> Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                  placeholder="seu@email.com"
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-300 flex items-center gap-2">
                  <Lock size={16} /> Senha
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            {error && <p className="text-red-400 text-sm font-bold text-center bg-red-500/10 px-4 py-3 rounded-xl">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-4 text-lg"
            >
              {loading ? 'Entrando...' : (
                <>Entrar no Painel <ArrowRight size={20} /></>
              )}
            </button>
          </form>

          <div className="pt-4 text-center border-t border-slate-800">
            <p className="text-slate-500 text-sm">
              Acesso restrito. Contate o administrador para obter credenciais.
            </p>
          </div>
        </div>

        <div className="mt-8 flex justify-center gap-6 text-slate-500 text-xs font-bold uppercase tracking-widest">
          <span>Alleson Gráfica</span>
          <span>Privacidade</span>
          <span>Termos</span>
        </div>
      </motion.div>
    </div>
  );
}

// --- Main App ---


export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'customers' | 'billing'>('dashboard');
  const [stats, setStats] = useState<any>({ totalOrders: 0, ongoingOrders: 0, monthlyRevenue: 0, totalCustomers: 0, pendingOrders: 0 });
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [billingTrends, setBillingTrends] = useState([]);
  const [billingDist, setBillingDist] = useState([]);

  // Supabase Auth: restaura sessão e escuta mudanças
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      fetchStats();
      fetchOrders();
      fetchCustomers();
      fetchBillingData();
    }
  }, [session]);

  const onLogin = (newSession: Session) => {
    setSession(newSession);
  };

  const onLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setOrders([]);
    setCustomers([]);
    setStats({ totalOrders: 0, ongoingOrders: 0, monthlyRevenue: 0, totalCustomers: 0, pendingOrders: 0 });
  };

  const fetchStats = async () => {
    try {
      const res = await authFetch('/api/stats');
      const data = await res.json();
      setStats(data);
    } catch (e) { console.error(e); }
  };

  const fetchOrders = async () => {
    try {
      const res = await authFetch('/api/orders');
      const data = await res.json();
      setOrders(data);
    } catch (e) { console.error(e); }
  };

  const fetchCustomers = async () => {
    try {
      const res = await authFetch('/api/customers');
      const data = await res.json();
      setCustomers(data);
    } catch (e) { console.error(e); }
  };

  const fetchBillingData = async () => {
    try {
      const trendsRes = await authFetch('/api/billing/trends');
      const distRes = await authFetch('/api/billing/distribution');
      setBillingTrends(await trendsRes.json());
      setBillingDist(await distRes.json());
    } catch (e) { console.error(e); }
  };

  const handleCreateCustomer = async (data: any): Promise<string | null> => {
    try {
      const res = await authFetch('/api/customers', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      const result = await res.json();
      if (!res.ok) {
        return result.error || 'Erro ao criar cliente';
      }
      setIsCustomerModalOpen(false);
      fetchCustomers();
      fetchStats();
      return null;
    } catch (e) {
      console.error(e);
      return 'Erro de conexão. Tente novamente.';
    }
  };

  const handleCreateOrder = async (data: any) => {
    const ordersToCreate = data.items.map((item: any) => ({
      customer_id: data.customer_id,
      service_type: item.service_type,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.quantity * item.unit_price,
      order_date: data.order_date,
      delivery_date: data.delivery_date,
      status: data.status,
      notes: data.notes,
      images: uploadedImages,
    }));

    try {
      const res = await authFetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify(ordersToCreate),
      });

      if (!res.ok) {
        const result = await res.json();
        alert(result.error || "Erro ao criar pedidos");
        return;
      }

      setIsOrderModalOpen(false);
      setUploadedImages([]);
      fetchOrders();
      fetchStats();
      fetchBillingData();
    } catch (e) { console.error(e); }
  };

  const updateOrderStatus = async (id: number, status: Order['status']) => {
    await authFetch(`/api/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    fetchOrders();
    fetchStats();
    fetchBillingData();
  };

  const handleDeleteOrder = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este pedido?')) return;
    await authFetch(`/api/orders/${id}`, { method: 'DELETE' });
    fetchOrders();
    fetchStats();
    fetchBillingData();
    if (selectedOrder?.id === id) setSelectedOrder(null);
  };

  const handleDeleteCustomer = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este cliente? Todos os seus pedidos também serão excluídos.')) return;
    await authFetch(`/api/customers/${id}`, { method: 'DELETE' });
    fetchCustomers();
    fetchOrders();
    fetchStats();
    fetchBillingData();
  };

  const generatePDF = (order: Order) => {
    const doc = new jsPDF();
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text("Alleson Gráfica CRM", 20, 25);
    doc.setFontSize(10);
    doc.text("Sua Gráfica de Confiança", 20, 32);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(16);
    doc.text(`Pedido #${order.id}`, 20, 55);
    doc.setFontSize(10);
    doc.text(`Data: ${formatDate(order.order_date)}`, 150, 55);

    doc.setFontSize(12);
    doc.text("CLIENTE", 20, 70);
    doc.line(20, 72, 190, 72);
    doc.setFontSize(10);
    doc.text(`Nome: ${order.customer_name}`, 20, 80);
    doc.text(`Telefone: ${order.customer_phone}`, 20, 87);

    doc.setFontSize(12);
    doc.text("DETALHES DO SERVIÇO", 20, 105);
    doc.line(20, 107, 190, 107);

    const tableBody = order.batch_items
      ? order.batch_items.map(item => [item.service_type, item.description || '-', item.quantity, formatCurrency(item.unit_price), formatCurrency(item.total_price)])
      : [[order.service_type, order.description || '-', order.quantity, formatCurrency(order.unit_price), formatCurrency(order.total_price)]];

    autoTable(doc, {
      startY: 115,
      head: [['Serviço', 'Descrição', 'Qtd', 'Vlr Unit', 'Total']],
      body: tableBody,
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42] },
      foot: [['', '', '', 'TOTAL GERAL', formatCurrency(order.total_price)]],
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.text(`Observações: ${order.notes || 'N/A'}`, 20, finalY);
    doc.text("__________________________", 130, 250);
    doc.text("Assinatura do Cliente", 135, 255);
    doc.save(`pedido_${order.id}.pdf`);
  };

  const shareWhatsApp = (order: Order) => {
    const serviceText = order.batch_items ? `${order.batch_items.length} itens (Diversos)` : order.service_type;
    const text = `Olá ${order.customer_name}! Seu pedido #${order.id} (${serviceText}) está com status: ${order.status}. Valor total: ${formatCurrency(order.total_price)}.`;
    let phone = order.customer_phone.replace(/\D/g, '');
    if (phone.length > 0 && !phone.startsWith('55')) phone = '55' + phone;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const groupedOrders = React.useMemo(() => {
    const groups: Record<string, Order[]> = {};
    const singleOrders: Order[] = [];
    orders.forEach(order => {
      if (order.batch_id) {
        if (!groups[order.batch_id]) groups[order.batch_id] = [];
        groups[order.batch_id].push(order);
      } else {
        singleOrders.push(order);
      }
    });
    const processedGroups = Object.entries(groups).map(([batchId, items]) => {
      const first = items[0];
      return { ...first, service_type: 'DIVERSOS', total_price: items.reduce((sum, item) => sum + item.total_price, 0), is_group: true, batch_items: items };
    });
    return [...singleOrders, ...processedGroups].sort((a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime());
  }, [orders]);

  const filteredOrders = groupedOrders.filter(order =>
    order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.customer_phone.includes(searchTerm) ||
    order.service_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone.includes(searchTerm) ||
    (customer.company && customer.company.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Derivar user do session
  const user = session?.user;
  const userName = user?.email?.split('@')[0] || 'Usuário';

  // Tela de erro: variáveis de ambiente ausentes
  if (!supabaseConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-dark p-4">
        <div className="glass-card p-10 max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto">
            <Package className="text-red-400 w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white mb-2">⚠️ Configuração Pendente</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              As variáveis de ambiente do Supabase não estão configuradas.
              Acesse o painel do Vercel e adicione:
            </p>
          </div>
          <div className="bg-slate-900 rounded-2xl p-4 text-left space-y-2 border border-slate-800">
            <p className="text-xs font-mono text-emerald-400">VITE_SUPABASE_URL</p>
            <p className="text-xs font-mono text-emerald-400">VITE_SUPABASE_ANON_KEY</p>
          </div>
          <p className="text-slate-500 text-xs">
            Vercel Dashboard → Settings → Environment Variables → Redeploy
          </p>
        </div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-dark">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-primary-accent/20 rounded-2xl flex items-center justify-center animate-pulse">
            <Package className="text-primary-accent w-8 h-8" />
          </div>
          <p className="text-slate-500 font-bold animate-pulse">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!session) return <Login onLogin={onLogin} />;

  return (
    <div className="min-h-screen flex bg-bg-dark overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 bg-sidebar-dark border-r border-slate-800 p-8 hidden lg:flex flex-col gap-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary-accent rounded-2xl flex items-center justify-center shadow-xl shadow-primary-accent/20">
            <Package className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">Alleson Gráfica CRM</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Enterprise Admin</p>
          </div>
        </div>

        <nav className="flex flex-col gap-3 flex-1">
          <button onClick={() => setActiveTab('dashboard')} className={cn("sidebar-item", activeTab === 'dashboard' && "sidebar-item-active")}>
            <LayoutDashboard size={20} /> Dashboard
          </button>
          <button onClick={() => setActiveTab('orders')} className={cn("sidebar-item", activeTab === 'orders' && "sidebar-item-active")}>
            <Package size={20} /> Pedidos
          </button>
          <button onClick={() => setActiveTab('customers')} className={cn("sidebar-item", activeTab === 'customers' && "sidebar-item-active")}>
            <Users size={20} /> Clientes
          </button>
          <button onClick={() => setActiveTab('billing')} className={cn("sidebar-item", activeTab === 'billing' && "sidebar-item-active")}>
            <BarChart3 size={20} /> Faturamento
          </button>
          <div className="mt-auto pt-6 border-t border-slate-800 space-y-3">
            <button className="sidebar-item"><Settings size={20} /> Configurações</button>
            <button onClick={onLogout} className="sidebar-item text-red-400 hover:text-red-300 hover:bg-red-500/10"><LogOut size={20} /> Sair</button>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Header */}
        <header className="h-20 border-b border-slate-800 flex items-center justify-between px-8 bg-bg-dark/50 backdrop-blur-xl z-20">
          <div className="relative w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input
              type="text"
              placeholder="Pesquisar pedidos, clientes ou relatórios..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-2xl text-sm focus:ring-2 focus:ring-primary-accent/20 outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <button className="p-2.5 text-slate-400 hover:bg-slate-800 rounded-xl transition-all relative">
                <Bell size={20} />
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-bg-dark"></span>
              </button>
              <button className="p-2.5 text-slate-400 hover:bg-slate-800 rounded-xl transition-all"><Moon size={20} /></button>
            </div>
            <div className="h-8 w-[1px] bg-slate-800"></div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-white leading-none">{user?.email}</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">Super Admin</p>
              </div>
              <div className="w-10 h-10 bg-slate-800 rounded-xl border border-slate-700 flex items-center justify-center overflow-hidden">
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`} alt="avatar" />
              </div>
            </div>
          </div>
        </header>

        {/* Viewport */}
        <div className="flex-1 overflow-y-auto p-8 space-y-10">
          <div className="flex justify-between items-end">
            <div>
              <h2 className="text-3xl font-black text-white tracking-tight">
                {activeTab === 'dashboard' && 'Dashboard Overview'}
                {activeTab === 'orders' && 'Gerenciamento de Pedidos'}
                {activeTab === 'customers' && 'Diretório de Clientes'}
                {activeTab === 'billing' && 'Análise de Faturamento'}
              </h2>
              <p className="text-slate-500 mt-1">Monitore o desempenho e métricas da sua empresa em tempo real.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setIsOrderModalOpen(true)} className="btn-primary"><PlusCircle size={20} /> Novo Pedido</button>
              <button className="btn-secondary"><Download size={20} /> Exportar Relatório</button>
            </div>
          </div>

          {activeTab === 'dashboard' && (
            <div className="space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="stat-card">
                  <div className="flex justify-between items-start">
                    <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-500"><Package size={24} /></div>
                    <span className="text-emerald-400 text-xs font-bold">+12.5% ↗</span>
                  </div>
                  <p className="text-slate-500 text-sm font-bold uppercase tracking-wider mt-4">Total de Pedidos</p>
                  <h3 className="text-3xl font-black text-white">{stats.totalOrders.toLocaleString()}</h3>
                </div>
                <div className="stat-card">
                  <div className="flex justify-between items-start">
                    <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-500"><Users size={24} /></div>
                    <span className="text-emerald-400 text-xs font-bold">+8.2% ↗</span>
                  </div>
                  <p className="text-slate-500 text-sm font-bold uppercase tracking-wider mt-4">Total de Clientes</p>
                  <h3 className="text-3xl font-black text-white">{stats.totalCustomers.toLocaleString()}</h3>
                </div>
                <div className="stat-card">
                  <div className="flex justify-between items-start">
                    <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-500"><TrendingUp size={24} /></div>
                    <span className="text-emerald-400 text-xs font-bold">+15.3% ↗</span>
                  </div>
                  <p className="text-slate-500 text-sm font-bold uppercase tracking-wider mt-4">Receita Mensal</p>
                  <h3 className="text-3xl font-black text-white">{formatCurrency(stats.monthlyRevenue)}</h3>
                </div>
                <div className="stat-card">
                  <div className="flex justify-between items-start">
                    <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-500"><Clock size={24} /></div>
                    <span className="text-red-400 text-xs font-bold">-2.4% ↘</span>
                  </div>
                  <p className="text-slate-500 text-sm font-bold uppercase tracking-wider mt-4">Pedidos Pendentes</p>
                  <h3 className="text-3xl font-black text-white">{stats.pendingOrders.toLocaleString()}</h3>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 glass-card p-8">
                  <div className="flex justify-between items-center mb-8">
                    <div>
                      <h3 className="text-xl font-black text-white">Tendências de Receita</h3>
                      <p className="text-slate-500 text-sm">Visualização de renda semanal</p>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-primary-accent"></span> <span className="text-xs text-slate-400 font-bold">Atual</span></div>
                      <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-slate-700"></span> <span className="text-xs text-slate-400 font-bold">Meta</span></div>
                    </div>
                  </div>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={billingTrends}>
                        <defs>
                          <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v / 1000}k`} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                          itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                        />
                        <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorRev)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="glass-card p-8">
                  <div className="flex justify-between items-center mb-8">
                    <h3 className="text-xl font-black text-white">Clientes Recentes</h3>
                    <button onClick={() => setActiveTab('customers')} className="text-primary-accent text-xs font-bold hover:underline">Ver Todos</button>
                  </div>
                  <div className="space-y-6">
                    {customers.slice(0, 5).map((c) => (
                      <div key={c.id} className="flex items-center justify-between group cursor-pointer">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 font-bold group-hover:bg-primary-accent group-hover:text-white transition-all">
                            {c.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white">{c.name}</p>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{c.company || 'Pessoa Física'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-white">Ativo</p>
                          <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Pago</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'orders' && (
            <div className="glass-card overflow-hidden">
              <div className="p-6 border-b border-slate-800 flex flex-wrap gap-4 items-center justify-between">
                <div className="flex gap-2">
                  <button className="px-4 py-2 bg-primary-accent text-white rounded-xl text-xs font-bold">Todos</button>
                  <button className="px-4 py-2 bg-slate-800 text-slate-400 rounded-xl text-xs font-bold hover:text-white transition-all">Pendentes</button>
                  <button className="px-4 py-2 bg-slate-800 text-slate-400 rounded-xl text-xs font-bold hover:text-white transition-all">Arquivados</button>
                </div>
                <div className="flex gap-3">
                  <button className="p-2.5 bg-slate-800 text-slate-400 rounded-xl hover:text-white transition-all border border-slate-700"><Filter size={18} /></button>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest ml-4">
                    Exportar como:
                    <button className="p-2 bg-slate-800 rounded-lg hover:text-white"><Download size={14} /></button>
                    <button className="p-2 bg-slate-800 rounded-lg hover:text-white"><Share2 size={14} /></button>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-slate-500 text-[10px] uppercase tracking-[0.2em] font-black border-b border-slate-800 bg-slate-900/30">
                      <th className="px-8 py-5">ID Pedido</th>
                      <th className="px-8 py-5">Cliente</th>
                      <th className="px-8 py-5">Data</th>
                      <th className="px-8 py-5">Status</th>
                      <th className="px-8 py-5 text-right">Valor</th>
                      <th className="px-8 py-5 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredOrders.map((order) => (
                      <tr key={order.id} className="table-row group">
                        <td className="px-8 py-5 text-slate-400 font-mono text-xs">#ORD-{order.id}</td>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-500">{order.customer_name.charAt(0)}</div>
                            <p className="font-bold text-white text-sm">{order.customer_name}</p>
                          </div>
                        </td>
                        <td className="px-8 py-5 text-slate-400 text-xs font-bold">{formatDate(order.order_date)}</td>
                        <td className="px-8 py-5">
                          <StatusBadge status={order.status} />
                        </td>
                        <td className="px-8 py-5 text-right font-black text-white text-sm">{formatCurrency(order.total_price)}</td>
                        <td className="px-8 py-5">
                          <div className="flex justify-center gap-2">
                            <button onClick={() => setSelectedOrder(order)} className="p-2 text-slate-500 hover:text-white transition-all"><MoreHorizontal size={20} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'customers' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredCustomers.map((c) => (
                <div key={c.id} className="glass-card p-8 group relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary-accent/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-primary-accent/10 transition-all"></div>
                  <div className="flex justify-between items-start mb-6 relative">
                    <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center text-xl font-black text-slate-500 group-hover:bg-primary-accent group-hover:text-white transition-all shadow-xl">
                      {c.name.charAt(0)}
                    </div>
                    <button onClick={() => handleDeleteCustomer(c.id)} className="p-2 text-slate-600 hover:text-red-400 transition-all"><Trash2 size={20} /></button>
                  </div>
                  <h3 className="text-xl font-black text-white tracking-tight">{c.name}</h3>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">{c.company || 'Pessoa Física'}</p>

                  <div className="mt-8 space-y-4">
                    <div className="flex items-center gap-3 text-slate-400">
                      <Mail size={16} className="text-primary-accent" />
                      <span className="text-sm font-medium">{c.email || 'Nenhum email'}</span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-400">
                      <Clock size={16} className="text-emerald-400" />
                      <span className="text-sm font-medium">{c.phone}</span>
                    </div>
                  </div>

                  <div className="mt-8 pt-6 border-t border-slate-800 flex justify-between items-center">
                    <span className="badge bg-emerald-500/10 text-emerald-400">Ativo</span>
                    <button className="text-primary-accent text-xs font-bold flex items-center gap-1 hover:underline">Perfil Completo <ChevronRight size={14} /></button>
                  </div>
                </div>
              ))}
              <button
                onClick={() => setIsCustomerModalOpen(true)}
                className="glass-card p-8 border-dashed border-2 border-slate-800 flex flex-col items-center justify-center gap-4 text-slate-500 hover:border-primary-accent hover:text-primary-accent transition-all group"
              >
                <div className="w-16 h-16 rounded-2xl bg-slate-900 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <PlusCircle size={32} />
                </div>
                <span className="font-black uppercase tracking-widest text-xs">Adicionar Novo Cliente</span>
              </button>
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="space-y-10">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 glass-card p-8">
                  <h3 className="text-xl font-black text-white mb-8">Receita Financeira</h3>
                  <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={billingTrends}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                          itemStyle={{ color: '#fff' }}
                        />
                        <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} strokeWidth={3} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="glass-card p-8 flex flex-col items-center justify-center">
                  <h3 className="text-xl font-black text-white mb-8 self-start">Distribuição de Status</h3>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={billingDist}
                          cx="50%"
                          cy="50%"
                          innerRadius={80}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {billingDist.map((entry: any, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-8 space-y-4 w-full">
                    {billingDist.map((d: any) => (
                      <div key={d.name} className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }}></span>
                          <span className="text-sm font-bold text-slate-400">{d.name}</span>
                        </div>
                        <span className="text-sm font-black text-white">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {isCustomerModalOpen && (
          <Modal title="Novo Cliente" onClose={() => setIsCustomerModalOpen(false)}>
            <CustomerForm onSubmit={handleCreateCustomer as any} onCancel={() => setIsCustomerModalOpen(false)} />
          </Modal>
        )}

        {isOrderModalOpen && (
          <Modal title="Novo Pedido" onClose={() => setIsOrderModalOpen(false)}>
            <OrderForm
              customers={customers}
              onSubmit={handleCreateOrder}
              onCancel={() => setIsOrderModalOpen(false)}
              uploadedImages={uploadedImages}
              setUploadedImages={setUploadedImages}
            />
          </Modal>
        )}

        {selectedOrder && (
          <Modal title={`Detalhes do Pedido #ORD-${selectedOrder.id}`} onClose={() => setSelectedOrder(null)}>
            <OrderDetails
              order={selectedOrder}
              onUpdateStatus={updateOrderStatus}
              onGeneratePDF={generatePDF}
              onShareWhatsApp={shareWhatsApp}
              onDelete={handleDeleteOrder}
            />
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Sub-components ---

function Modal({ title, children, onClose }: { title: string, children: React.ReactNode, onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-bg-dark/80 backdrop-blur-md"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="glass-card w-full max-w-3xl relative z-10 overflow-hidden border-slate-700"
      >
        <div className="px-8 py-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
          <h3 className="text-2xl font-black text-white tracking-tight">{title}</h3>
          <button onClick={onClose} className="p-2.5 hover:bg-slate-800 rounded-xl transition-all text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>
        <div className="p-8 max-h-[85vh] overflow-y-auto">
          {children}
        </div>
      </motion.div>
    </div>
  );
}

function StatusBadge({ status }: { status: Order['status'] }) {
  const styles = {
    'Orçamento': 'bg-amber-500/10 text-amber-500',
    'Em Produção': 'bg-blue-500/10 text-blue-500',
    'Finalizado': 'bg-indigo-500/10 text-indigo-500',
    'Entregue': 'bg-emerald-500/10 text-emerald-500',
  };
  return (
    <span className={cn("badge", styles[status])}>
      {status}
    </span>
  );
}

function CustomerForm({ onSubmit, onCancel }: { onSubmit: (data: any) => Promise<string | null>, onCancel: () => void }) {
  const { register, handleSubmit, setValue, formState: { errors } } = useForm();
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskPhone(e.target.value);
    setValue('phone', masked, { shouldValidate: true });
  };

  const onFormSubmit = async (data: any) => {
    setLoading(true);
    setServerError('');
    const error = await onSubmit(data);
    if (error) {
      setServerError(error);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-400 uppercase tracking-widest">Nome Completo *</label>
          <input
            {...register('name', { required: 'Nome é obrigatório' })}
            className={`input-field ${errors.name ? 'border-red-500 ring-1 ring-red-500' : ''}`}
            placeholder="Ex: João Silva"
          />
          {errors.name && <p className="text-red-400 text-xs font-bold">{errors.name.message as string}</p>}
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-400 uppercase tracking-widest">Telefone *</label>
          <input
            {...register('phone', { required: 'Telefone é obrigatório' })}
            onChange={handlePhoneChange}
            placeholder="(00) 00000-0000"
            maxLength={15}
            className={`input-field ${errors.phone ? 'border-red-500 ring-1 ring-red-500' : ''}`}
          />
          {errors.phone && <p className="text-red-400 text-xs font-bold">{errors.phone.message as string}</p>}
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-400 uppercase tracking-widest">Email</label>
          <input {...register('email')} type="email" className="input-field" placeholder="contato@exemplo.com" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-400 uppercase tracking-widest">Empresa</label>
          <input {...register('company')} className="input-field" placeholder="Nome da Empresa (Opcional)" />
        </div>
      </div>

      {serverError && (
        <p className="text-red-400 text-sm font-bold text-center bg-red-500/10 px-4 py-3 rounded-xl">
          {serverError}
        </p>
      )}

      <div className="flex justify-end gap-4 pt-6 border-t border-slate-800">
        <button type="button" onClick={onCancel} className="btn-secondary" disabled={loading}>Cancelar</button>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Salvando...' : 'Salvar Cliente'}
        </button>
      </div>
    </form>
  );
}

function OrderForm({ customers, onSubmit, onCancel, uploadedImages, setUploadedImages }: any) {
  const { register, control, handleSubmit, watch } = useForm({
    defaultValues: {
      customer_id: '',
      order_date: new Date().toISOString().split('T')[0],
      delivery_date: '',
      status: 'Orçamento',
      notes: '',
      items: [{ service_type: '', description: '', quantity: 1, unit_price: 0 }]
    }
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const items = watch('items');
  const totalOrderPrice = items.reduce((acc: number, item: any) => acc + (item.quantity * item.unit_price), 0);
  const onDrop = (acceptedFiles: File[]) => {
    acceptedFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => setUploadedImages((prev: any) => [...prev, reader.result as string]);
      reader.readAsDataURL(file);
    });
  };
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'image/*': [] } } as any);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-10">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2 col-span-2">
          <label className="text-sm font-bold text-slate-400 uppercase tracking-widest">Cliente *</label>
          <select {...register('customer_id', { required: true })} className="input-field appearance-none">
            <option value="">Selecione um cliente</option>
            {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-400 uppercase tracking-widest">Data do Pedido</label>
          <input {...register('order_date')} type="date" className="input-field" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-400 uppercase tracking-widest">Previsão de Entrega</label>
          <input {...register('delivery_date')} type="date" className="input-field" />
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h4 className="text-sm font-black text-white uppercase tracking-[0.2em]">Itens do Pedido</h4>
          <button type="button" onClick={() => append({ service_type: '', description: '', quantity: 1, unit_price: 0 })} className="text-primary-accent text-xs font-black flex items-center gap-2 hover:bg-primary-accent/10 px-4 py-2 rounded-xl transition-all">
            <PlusCircle size={16} /> ADICIONAR ITEM
          </button>
        </div>
        <div className="space-y-6">
          {fields.map((field, index) => (
            <div key={field.id} className="p-6 bg-slate-900/50 rounded-3xl border border-slate-800 space-y-6 relative group">
              {fields.length > 1 && (
                <button type="button" onClick={() => remove(index)} className="absolute top-4 right-4 text-slate-600 hover:text-red-400 transition-all">
                  <Trash2 size={20} />
                </button>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Serviço *</label>
                  <input {...register(`items.${index}.service_type` as const, { required: true })} placeholder="Ex: Cartão de Visita" className="input-field" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Qtd</label>
                    <input {...register(`items.${index}.quantity` as const, { valueAsNumber: true })} type="number" className="input-field" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Vlr Unit</label>
                    <input {...register(`items.${index}.unit_price` as const, { valueAsNumber: true })} type="number" step="0.01" className="input-field" />
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Descrição</label>
                  <input {...register(`items.${index}.description` as const)} placeholder="Detalhes do serviço..." className="input-field" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-8 bg-primary-accent/5 rounded-3xl border border-primary-accent/20 flex justify-between items-center">
        <span className="text-slate-400 font-bold uppercase tracking-widest">Total do Pedido</span>
        <span className="text-4xl font-black text-primary-accent">{formatCurrency(totalOrderPrice)}</span>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-bold text-slate-400 uppercase tracking-widest">Observações Gerais</label>
        <textarea {...register('notes')} rows={3} className="input-field resize-none" placeholder="Instruções adicionais..." />
      </div>

      <div className="space-y-4">
        <label className="text-sm font-bold text-slate-400 uppercase tracking-widest">Imagens de Referência</label>
        <div {...getRootProps()} className={cn("border-2 border-dashed rounded-3xl p-10 text-center transition-all cursor-pointer", isDragActive ? "border-primary-accent bg-primary-accent/5" : "border-slate-800 hover:border-primary-accent/50")}>
          <input {...getInputProps()} />
          <ImageIcon className="mx-auto text-slate-700 mb-4" size={48} />
          <p className="text-slate-400 font-bold">Arraste imagens aqui ou clique para selecionar</p>
        </div>
        {uploadedImages.length > 0 && (
          <div className="flex gap-4 flex-wrap mt-4">
            {uploadedImages.map((img: string, i: number) => (
              <div key={i} className="relative w-24 h-24 rounded-2xl overflow-hidden border border-slate-800 shadow-xl group">
                <img src={img} className="w-full h-full object-cover" />
                <button type="button" onClick={() => setUploadedImages((prev: any) => prev.filter((_: any, idx: number) => idx !== i))} className="absolute top-2 right-2 bg-red-500 text-white rounded-lg p-1 opacity-0 group-hover:opacity-100 transition-all"><X size={12} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-4 pt-8 border-t border-slate-800">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancelar</button>
        <button type="submit" className="btn-primary px-10">Criar Pedido(s)</button>
      </div>
    </form>
  );
}

function OrderDetails({ order, onUpdateStatus, onGeneratePDF, onShareWhatsApp, onDelete }: any) {
  const [fullOrder, setFullOrder] = useState<Order | null>(null);
  useEffect(() => {
    // Buscar detalhes completos do pedido incluindo imagens
    const fetchOrderDetails = async () => {
      const { data: orderData } = await supabase
        .from('orders')
        .select(`*, customers(name, phone), order_images(image_data)`)
        .eq('id', order.id)
        .single();

      if (orderData) {
        // Buscar itens do batch se tiver
        let batchItems = null;
        if (orderData.batch_id) {
          const { data: batchData } = await supabase
            .from('orders')
            .select('*')
            .eq('batch_id', orderData.batch_id);
          batchItems = batchData;
        }
        setFullOrder({
          ...orderData,
          customer_name: orderData.customers?.name || order.customer_name,
          customer_phone: orderData.customers?.phone || order.customer_phone,
          images: orderData.order_images?.map((img: any) => img.image_data) || [],
          batch_items: batchItems,
        });
      }
    };
    fetchOrderDetails();
  }, [order.id]);
  if (!fullOrder) return <div className="p-12 text-center text-slate-500 font-bold animate-pulse">Carregando detalhes...</div>;

  return (
    <div className="space-y-10">
      <div className="flex justify-between items-start">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 w-full">
          <div className="space-y-8">
            <div>
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Informações do Cliente</h4>
              <div className="p-6 bg-slate-900/50 rounded-3xl border border-slate-800">
                <p className="text-xl font-black text-white">{fullOrder.customer_name}</p>
                <p className="text-slate-400 font-bold mt-1">{fullOrder.customer_phone}</p>
              </div>
            </div>
            <div>
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Detalhes do Serviço</h4>
              <div className="space-y-4">
                {fullOrder.batch_items ? (
                  fullOrder.batch_items.map((item, idx) => (
                    <div key={idx} className="p-4 bg-slate-900/50 rounded-2xl border border-slate-800 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-bold text-xs uppercase tracking-wider">{item.service_type}</span>
                        <span className="font-black text-white">{formatCurrency(item.total_price)}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 font-bold">{item.quantity} unidades x {formatCurrency(item.unit_price)}</p>
                      {item.description && <p className="text-xs text-slate-500 italic">"{item.description}"</p>}
                    </div>
                  ))
                ) : (
                  <div className="p-4 bg-slate-900/50 rounded-2xl border border-slate-800 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-bold text-xs uppercase tracking-wider">{fullOrder.service_type}</span>
                      <span className="font-black text-white">{formatCurrency(fullOrder.total_price)}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-bold">{fullOrder.quantity} unidades x {formatCurrency(fullOrder.unit_price)}</p>
                  </div>
                )}
                <div className="flex justify-between items-center pt-4 border-t border-slate-800">
                  <span className="text-slate-400 font-black uppercase tracking-widest">Total Geral</span>
                  <span className="text-3xl font-black text-primary-accent">{formatCurrency(fullOrder.total_price)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div>
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Status do Pedido</h4>
              <div className="grid grid-cols-2 gap-3">
                {(['Orçamento', 'Em Produção', 'Finalizado', 'Entregue'] as Order['status'][]).map(s => (
                  <button key={s} onClick={() => onUpdateStatus(fullOrder.id, s)} className={cn("px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all", fullOrder.status === s ? "bg-primary-accent text-white border-primary-accent shadow-lg shadow-primary-accent/20" : "bg-slate-900 text-slate-500 border-slate-800 hover:border-slate-700")}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Cronograma</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-900/50 rounded-2xl border border-slate-800">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Pedido</p>
                  <p className="text-sm font-black text-white">{formatDate(fullOrder.order_date)}</p>
                </div>
                <div className="p-4 bg-slate-900/50 rounded-2xl border border-slate-800">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Entrega</p>
                  <p className="text-sm font-black text-white">{formatDate(fullOrder.delivery_date)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {fullOrder.notes && (
        <div>
          <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Observações</h4>
          <p className="text-sm text-slate-400 bg-slate-900/50 p-6 rounded-3xl border border-slate-800 italic leading-relaxed">"{fullOrder.notes}"</p>
        </div>
      )}

      {fullOrder.images && fullOrder.images.length > 0 && (
        <div>
          <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Referências Visuais</h4>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {fullOrder.images.map((img, i) => (
              <img key={i} src={img} className="w-40 h-40 object-cover rounded-3xl border border-slate-800 shadow-2xl flex-shrink-0" />
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-4 pt-8 border-t border-slate-800">
        <button onClick={() => onGeneratePDF(fullOrder)} className="btn-secondary flex-1"><Download size={20} /> Exportar PDF</button>
        <button onClick={() => onShareWhatsApp(fullOrder)} className="btn-primary flex-1 bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20"><Share2 size={20} /> WhatsApp</button>
        <button onClick={() => onDelete(fullOrder.id)} className="p-4 text-slate-600 hover:text-red-400 transition-all border border-slate-800 rounded-2xl"><Trash2 size={24} /></button>
      </div>
    </div>
  );
}
