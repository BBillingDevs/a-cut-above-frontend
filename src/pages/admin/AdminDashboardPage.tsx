// src/pages/admin/AdminDashboardPage.tsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Tabs, message } from "antd";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";

import AdminShell from "../../components/AdminShell";
import OrdersTab from "../../components/OrdersTab";
import ProductsTab from "../../components/ProductsTab";
import CategoriesTab from "../../components/CategoriesTab";
import WindowsTab from "../../components/WindowsTab";
import ReportsTab from "../../components/ReportsTab";
import DropoffLocationsTab from "../../components/DropoffLocationsTab";
import DashboardTab from "../../components/DashboardTab";

export type AdminCategory = {
  id: string;
  name: string;
  key: string;
  iconKey: string;
  sortOrder: number;
  isActive: boolean;
};

export type AdminProduct = {
  id: string;
  name: string;
  description: string | null;
  unit: string;
  retailPrice: string | number;
  wholesalePrice: string | number;
  stockQty: number;
  isActive: boolean;

  imageUrl?: string | null;
  sortOrder?: number | null;
  categoryId?: string | null;

  category?: AdminCategory | null;
};

export type AdminOrderItem = {
  id: string;
  productName: string;
  unit: string;
  qty: string | number;

  // ✅ Fix: your OrdersTab expects weightKg (single field).
  // Keep old fields optional if backend still returns them.
  weightKg?: string | number | null;
  wetWeightKg?: string | number | null;
  dryWeightKg?: string | number | null;
};

export type AdminOrder = {
  id: string;
  orderNo: string;
  customerName: string;
  customerPhone: string;
  pricingTier: string;
  status: string;
  total: string | number;
  createdAt: string;
  windowId: string | null;
  items: AdminOrderItem[];

  // optional (if you later add this on backend)
  deliveryWindow?: string | null;
};

export type AdminWindow = {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
};

export default function AdminDashboardPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [windows, setWindows] = useState<AdminWindow[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [report, setReport] = useState<any>(null);

  // ✅ This controls whether topbar should show Logout
  const [isAuthed, setIsAuthed] = useState(false);

  const ensureAuth = useCallback(async () => {
    try {
      await api.get("/api/admin/me");
      setIsAuthed(true);
      return true;
    } catch {
      setIsAuthed(false);
      navigate("/admin");
      return false;
    }
  }, [navigate]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const ok = await ensureAuth();
      if (!ok) return;

      const [pRes, oRes, wRes, cRes] = await Promise.all([
        api.get("/api/admin/products"),
        api.get("/api/admin/orders"),
        api.get("/api/admin/windows"),
        api.get("/api/admin/categories"),
      ]);

      setProducts(pRes.data.products || []);
      setOrders(oRes.data.orders || []);
      setWindows(wRes.data.windows || []);
      setCategories(cRes.data.categories || []);
    } catch (e: any) {
      message.error("Failed to load admin data");
    } finally {
      setLoading(false);
    }
  }, [ensureAuth]);

  const loadReport = useCallback(async (windowId?: string) => {
    try {
      const res = await api.get("/api/admin/reports/summary", {
        params: windowId ? { windowId } : {},
      });
      setReport(res.data);
    } catch {
      setReport(null);
    }
  }, []);

  useEffect(() => {
    loadAll();
    loadReport();
  }, [loadAll, loadReport]);

  const windowOptions = useMemo(
    () => windows.map((w) => ({ label: w.name, value: w.id })),
    [windows],
  );

  // ✅ Logout handler (clears local token too if you use one)
  const logout = useCallback(async () => {
    try {
      await api.post("/api/admin/auth/logout");
    } catch {
      // ignore
    } finally {
      // If you store tokens locally, clear them here (adjust keys!)
      localStorage.removeItem("adminToken");
      localStorage.removeItem("aca_admin_token");
      localStorage.removeItem("token");
      localStorage.removeItem("access_token");

      setIsAuthed(false);
      navigate("/admin");
    }
  }, [navigate]);

  /**
   * ✅ Expose auth state + logout to the AdminTopBar
   * Easiest way: fire a custom event the App/AdminTopBar can listen to
   * (no extra state library needed).
   */
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("aca_admin_auth", {
        detail: { isAuthed, logout },
      }),
    );
  }, [isAuthed, logout]);

  return (
    <AdminShell>
      <Tabs
        defaultActiveKey="orders"
        items={[
          {
            key: "dashboard",
            label: "Dashboard",
            children: (
              <DashboardTab
                loading={loading}
                orders={orders}
                products={products}
                windows={windows}
              />
            ),
          },
          {
            key: "orders",
            label: "Orders",
            children: (
              <OrdersTab loading={loading} orders={orders} onReload={loadAll} />
            ),
          },
          {
            key: "categories",
            label: "Categories",
            children: (
              <CategoriesTab
                loading={loading}
                categories={categories}
                onReload={loadAll}
              />
            ),
          },
          {
            key: "products",
            label: "Products",
            children: (
              <ProductsTab
                loading={loading}
                products={products}
                categories={categories}
                onReload={loadAll}
              />
            ),
          },
          {
            key: "dropoffs",
            label: "Drop-offs",
            children: (
              <DropoffLocationsTab loading={loading} onReload={loadAll} />
            ),
          },
          {
            key: "windows",
            label: "Order Windows",
            children: (
              <WindowsTab
                loading={loading}
                windows={windows}
                onReload={loadAll}
              />
            ),
          },
          {
            key: "reports",
            label: "Reports",
            children: (
              <ReportsTab
                report={report}
                windowOptions={windowOptions}
                onLoadReport={loadReport}
              />
            ),
          },
        ]}
      />
    </AdminShell>
  );
}
