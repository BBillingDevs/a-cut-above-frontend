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
import DropoffLocationsTab from "../../components/DropoffLocationsTab";
import DashboardTab from "../../components/DashboardTab";
import UsersTab from "../../components/UsersTab";
import CarcassWeightsTab from "../../components/CarcassWeightsTab";

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
  costPrice: string | number;
  stockQty: number;
  isActive: boolean;
  imageUrl?: string | null;
  sortOrder?: number | null;
  categoryId?: string | null;
  cutType?: string | null;
  avgWeightG?: number | null;
  category?: AdminCategory | null;
  _count?: { orderItems: number };
};

export type AdminOrderItem = {
  id: string;
  productId?: string;
  productName: string;
  unit: string;
  qty: string | number;
  unitPrice?: string | number;
  lineTotal?: string | number;
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
  deliveryWindow?: string | null;

  dropoffLocationId?: string | null;
  deliveryScheduleId?: string | null;
  dropoffLocation?: {
    id: string;
    name: string;
  } | null;
};

export type AdminWindow = {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
};

export type AdminPermission =
  | "admin.full"
  | "dashboard.view"
  | "orders.view"
  | "orders.status.update"
  | "orders.weights.update"
  | "orders.delete"
  | "packinglists.export"
  | "packinglists.pdf"
  | "products.view"
  | "products.manage"
  | "categories.view"
  | "categories.manage"
  | "windows.view"
  | "windows.manage"
  | "dropoffs.view"
  | "dropoffs.manage"
  | "users.view"
  | "users.manage"
  | "carcassweights.view"
  | "carcassweights.manage";

export type CarcassWeightRecord = {
  id: string;
  animalId: string;
  weighedAt: string;
  wetWeightKg: string | number;
  dryWeightKg?: string | number | null;
  dryWeighedAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminUserRecord = {
  id: string;
  email: string;
  name?: string | null;
  isActive: boolean;
  permissions: AdminPermission[];
  createdAt: string;
};

function hasPermission(
  permissions: AdminPermission[],
  needed: AdminPermission,
) {
  return permissions.includes("admin.full") || permissions.includes(needed);
}

export default function AdminDashboardPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [windows, setWindows] = useState<AdminWindow[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [report, setReport] = useState<any>(null);

  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [carcassWeights, setCarcassWeights] = useState<CarcassWeightRecord[]>(
    [],
  );
  const [myPermissions, setMyPermissions] = useState<AdminPermission[]>([]);

  const [isAuthed, setIsAuthed] = useState(false);

  const ensureAuth = useCallback(async () => {
    try {
      const res = await api.get("/api/admin/me");
      console.log("/api/admin/me ->", res.data);
      setIsAuthed(true);
      setMyPermissions(res.data?.user?.permissions || []);
      return true;
    } catch {
      setIsAuthed(false);
      setMyPermissions([]);
      navigate("/admin");
      return false;
    }
  }, [navigate]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const ok = await ensureAuth();
      if (!ok) return;

      const [pRes, oRes, wRes, cRes, uRes, cwRes] = await Promise.all([
        api.get("/api/admin/products"),
        api.get("/api/admin/orders"),
        api.get("/api/admin/windows"),
        api.get("/api/admin/categories"),
        api.get("/api/admin/users").catch(() => ({ data: { users: [] } })),
        api
          .get("/api/admin/carcass-weights")
          .catch(() => ({ data: { records: [] } })),
      ]);

      setProducts(pRes.data.products || []);
      setOrders(oRes.data.orders || []);
      setWindows(wRes.data.windows || []);
      setCategories(cRes.data.categories || []);
      setUsers(uRes.data.users || []);
      setCarcassWeights(cwRes.data.records || []);
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

  const logout = useCallback(async () => {
    try {
      await api.post("/api/admin/auth/logout");
    } catch {
      // ignore
    } finally {
      localStorage.removeItem("adminToken");
      localStorage.removeItem("aca_admin_token");
      localStorage.removeItem("token");
      localStorage.removeItem("access_token");

      setIsAuthed(false);
      setMyPermissions([]);
      navigate("/admin");
    }
  }, [navigate]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("aca_admin_auth", {
        detail: { isAuthed, logout },
      }),
    );
  }, [isAuthed, logout]);

  const canViewDashboard = hasPermission(myPermissions, "dashboard.view");
  const canViewOrders = hasPermission(myPermissions, "orders.view");
  const canViewCategories = hasPermission(myPermissions, "categories.view");
  const canViewProducts = hasPermission(myPermissions, "products.view");
  const canViewDropoffs = hasPermission(myPermissions, "dropoffs.view");
  const canViewWindows = hasPermission(myPermissions, "windows.view");
  const canViewUsers = hasPermission(myPermissions, "users.view");
  const canViewCarcassWeights = hasPermission(
    myPermissions,
    "carcassweights.view",
  );

  return (
    <AdminShell>
      <Tabs
        defaultActiveKey={
          canViewOrders
            ? "orders"
            : canViewDashboard
              ? "dashboard"
              : canViewProducts
                ? "products"
                : canViewUsers
                  ? "users"
                  : canViewCarcassWeights
                    ? "carcass-weights"
                    : "dashboard"
        }
        items={[
          ...(canViewDashboard
            ? [
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
            ]
            : []),

          ...(canViewOrders
            ? [
              {
                key: "orders",
                label: "Orders",
                children: (
                  <OrdersTab
                    loading={loading}
                    orders={orders}
                    onReload={loadAll}
                    permissions={myPermissions}
                  />
                ),
              },
            ]
            : []),

          ...(canViewCategories
            ? [
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
            ]
            : []),

          ...(canViewProducts
            ? [
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
            ]
            : []),

          ...(canViewDropoffs
            ? [
              {
                key: "dropoffs",
                label: "Deliveries",
                children: (
                  <DropoffLocationsTab loading={loading} onReload={loadAll} />
                ),
              },
            ]
            : []),

          ...(canViewWindows
            ? [
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
            ]
            : []),

          ...(canViewCarcassWeights
            ? [
              {
                key: "carcass-weights",
                label: "Carcass Weights",
                children: (
                  <CarcassWeightsTab
                    loading={loading}
                    records={carcassWeights}
                    permissions={myPermissions}
                    onReload={loadAll}
                  />
                ),
              },
            ]
            : []),

          ...(canViewUsers
            ? [
              {
                key: "users",
                label: "Users",
                children: (
                  <UsersTab
                    loading={loading}
                    users={users}
                    currentPermissions={myPermissions}
                    onReload={loadAll}
                  />
                ),
              },
            ]
            : []),
        ]}
      />
    </AdminShell>
  );
}
