import express from "express";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

async function startServer() {
  const app = express();
  const PORT = 3001;

  app.use(express.json({ limit: '10mb' }));

  /**
   * Cria um client Supabase autenticado com o token JWT do request.
   * Isso faz com que o RLS seja aplicado automaticamente para o usuário.
   */
  const getAuthClient = async (req: express.Request) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return null;

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return null;

    return { db: authClient, user };
  };

  // ─── Customers ───────────────────────────────────────────────────────────────

  app.get("/api/customers", async (req, res) => {
    const auth = await getAuthClient(req);
    if (!auth) return res.status(401).json({ error: "Não autorizado" });

    const { data, error } = await auth.db
      .from('customers')
      .select('*')
      .order('name', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.post("/api/customers", async (req, res) => {
    const auth = await getAuthClient(req);
    if (!auth) return res.status(401).json({ error: "Não autorizado" });

    const { name, phone, email, company } = req.body;

    // Check for duplicate
    const { data: existing } = await auth.db
      .from('customers')
      .select('id')
      .eq('name', name)
      .eq('phone', phone)
      .maybeSingle();

    if (existing) return res.status(400).json({ error: "Cliente já cadastrado com este nome e telefone." });

    const { data, error } = await auth.db
      .from('customers')
      .insert({ name, phone, email, company, user_id: auth.user.id })
      .select('id')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ id: data.id });
  });

  app.delete("/api/customers/:id", async (req, res) => {
    const auth = await getAuthClient(req);
    if (!auth) return res.status(401).json({ error: "Não autorizado" });

    const { error } = await auth.db
      .from('customers')
      .delete()
      .eq('id', req.params.id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  // ─── Orders ──────────────────────────────────────────────────────────────────

  app.get("/api/orders", async (req, res) => {
    const auth = await getAuthClient(req);
    if (!auth) return res.status(401).json({ error: "Não autorizado" });

    const { data, error } = await auth.db
      .from('orders')
      .select('*, customers(name, phone)')
      .order('order_date', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    const orders = data.map((o: any) => ({
      ...o,
      customer_name: o.customers?.name,
      customer_phone: o.customers?.phone,
    }));
    res.json(orders);
  });

  app.get("/api/orders/:id", async (req, res) => {
    const auth = await getAuthClient(req);
    if (!auth) return res.status(401).json({ error: "Não autorizado" });

    const { data: orderData, error } = await auth.db
      .from('orders')
      .select('*, customers(name, phone), order_images(image_data)')
      .eq('id', req.params.id)
      .single();

    if (error) return res.status(404).json({ error: "Pedido não encontrado" });

    let batchItems = null;
    if (orderData.batch_id) {
      const { data: batchData } = await auth.db
        .from('orders')
        .select('*')
        .eq('batch_id', orderData.batch_id);
      batchItems = batchData;
    }

    res.json({
      ...orderData,
      customer_name: orderData.customers?.name,
      customer_phone: orderData.customers?.phone,
      images: orderData.order_images?.map((img: any) => img.image_data) || [],
      batch_items: batchItems,
    });
  });

  app.post("/api/orders", async (req, res) => {
    const auth = await getAuthClient(req);
    if (!auth) return res.status(401).json({ error: "Não autorizado" });

    const ordersData = Array.isArray(req.body) ? req.body : [req.body];
    const batchId = ordersData.length > 1 ? `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` : null;

    try {
      const orderIds: number[] = [];

      for (const data of ordersData) {
        const { customer_id, service_type, description, quantity, unit_price, total_price, order_date, delivery_date, status, notes, images } = data;

        const { data: insertedOrder, error: orderError } = await auth.db
          .from('orders')
          .insert({
            customer_id, service_type, description, quantity, unit_price, total_price,
            order_date, delivery_date, status, notes, batch_id: batchId, user_id: auth.user.id
          })
          .select('id')
          .single();

        if (orderError) throw orderError;

        const orderId = insertedOrder.id;
        orderIds.push(orderId);

        if (images && Array.isArray(images) && images.length > 0) {
          const imageRows = images.map((img: string) => ({ order_id: orderId, image_data: img }));
          await auth.db.from('order_images').insert(imageRows);
        }
      }

      res.json({ ids: orderIds });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: "Erro ao salvar pedidos." });
    }
  });

  app.patch("/api/orders/:id/status", async (req, res) => {
    const auth = await getAuthClient(req);
    if (!auth) return res.status(401).json({ error: "Não autorizado" });

    const { status } = req.body;

    const { data: order } = await auth.db
      .from('orders')
      .select('batch_id')
      .eq('id', req.params.id)
      .single();

    if (order?.batch_id) {
      await auth.db.from('orders').update({ status }).eq('batch_id', order.batch_id);
    } else {
      await auth.db.from('orders').update({ status }).eq('id', req.params.id);
    }

    res.json({ success: true });
  });

  app.delete("/api/orders/:id", async (req, res) => {
    const auth = await getAuthClient(req);
    if (!auth) return res.status(401).json({ error: "Não autorizado" });

    const { data: order } = await auth.db
      .from('orders')
      .select('batch_id')
      .eq('id', req.params.id)
      .single();

    if (order?.batch_id) {
      await auth.db.from('orders').delete().eq('batch_id', order.batch_id);
    } else {
      await auth.db.from('orders').delete().eq('id', req.params.id);
    }

    res.json({ success: true });
  });

  // ─── Stats ───────────────────────────────────────────────────────────────────

  app.get("/api/stats", async (req, res) => {
    const auth = await getAuthClient(req);
    if (!auth) return res.status(401).json({ error: "Não autorizado" });

    const { count: totalOrders } = await auth.db
      .from('orders').select('*', { count: 'exact', head: true });

    const { count: ongoingOrders } = await auth.db
      .from('orders').select('*', { count: 'exact', head: true })
      .in('status', ['Orçamento', 'Em Produção']);

    const { count: totalCustomers } = await auth.db
      .from('customers').select('*', { count: 'exact', head: true });

    const { count: pendingOrders } = await auth.db
      .from('orders').select('*', { count: 'exact', head: true })
      .eq('status', 'Orçamento');

    const currentMonth = new Date().toISOString().slice(0, 7);
    const startOfMonth = `${currentMonth}-01`;
    const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10);

    const { data: revenueData } = await auth.db
      .from('orders')
      .select('total_price')
      .gte('order_date', startOfMonth)
      .lte('order_date', endOfMonth);

    const monthlyRevenue = revenueData?.reduce((sum: number, o: any) => sum + parseFloat(o.total_price), 0) || 0;

    res.json({ totalOrders, ongoingOrders, monthlyRevenue, totalCustomers, pendingOrders });
  });

  app.get("/api/billing/trends", async (req, res) => {
    const auth = await getAuthClient(req);
    if (!auth) return res.status(401).json({ error: "Não autorizado" });

    const trends = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const year = d.getFullYear();
      const month = d.getMonth();
      const startDate = new Date(year, month, 1).toISOString().slice(0, 10);
      const endDate = new Date(year, month + 1, 0).toISOString().slice(0, 10);
      const monthName = d.toLocaleString('pt-BR', { month: 'short' });

      const { data } = await auth.db
        .from('orders')
        .select('total_price')
        .gte('order_date', startDate)
        .lte('order_date', endDate);

      const revenue = data?.reduce((sum: number, o: any) => sum + parseFloat(o.total_price), 0) || 0;
      trends.push({ name: monthName, revenue });
    }
    res.json(trends);
  });

  app.get("/api/billing/distribution", async (req, res) => {
    const auth = await getAuthClient(req);
    if (!auth) return res.status(401).json({ error: "Não autorizado" });

    const { count: completed } = await auth.db
      .from('orders').select('*', { count: 'exact', head: true })
      .eq('status', 'Entregue');

    const { count: pending } = await auth.db
      .from('orders').select('*', { count: 'exact', head: true })
      .in('status', ['Orçamento', 'Em Produção', 'Finalizado']);

    res.json([
      { name: 'Finalizados', value: completed || 0, color: '#3b82f6' },
      { name: 'Em Aberto', value: pending || 0, color: '#10b981' }
    ]);
  });

  // ─── Vite (Dev) / Static (Prod) ──────────────────────────────────────────────

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
    console.log(`🔗 Supabase: ${supabaseUrl}`);
  });
}

startServer();
