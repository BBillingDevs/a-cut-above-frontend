// src/App.tsx
import React, { useCallback, useEffect, useState } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Layout, message } from "antd";
import { CartProvider } from "./context/CartContext";
import { api } from "./api/client";

import TopBar from "./components/TopBar";
import AdminTopBar from "./components/AdminTopBar";

import ShopPage from "./pages/public/ShopPage";
import CheckoutPage from "./pages/public/CheckoutPage";
import TrackOrderPage from "./pages/public/TrackOrderPage";

import AdminLoginPage from "./pages/admin/AdminLoginPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";

const { Content, Footer } = Layout;

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const isAdminRoute = location.pathname.startsWith("/admin");

  // ✅ Real admin auth state (don’t guess localStorage)
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [checkingAdminAuth, setCheckingAdminAuth] = useState(false);

  const checkAdminAuth = useCallback(async () => {
    setCheckingAdminAuth(true);
    try {
      await api.get("/api/admin/me");
      setAdminAuthed(true);
    } catch {
      setAdminAuthed(false);
    } finally {
      setCheckingAdminAuth(false);
    }
  }, []);

  // ✅ Re-check auth when entering admin routes (or route changes within admin)
  useEffect(() => {
    if (isAdminRoute) checkAdminAuth();
  }, [isAdminRoute, location.pathname, checkAdminAuth]);

  // ✅ Refresh (simple: reload current route)
  const refreshAdmin = useCallback(() => {
    // Optionally re-check first (keeps logout button accurate)
    checkAdminAuth();
    navigate(0);
  }, [checkAdminAuth, navigate]);

  // ✅ Logout
  const logoutAdmin = useCallback(async () => {
    try {
      await api.post("/api/admin/auth/logout");
    } catch {
      // ignore network/logout errors
    } finally {
      // Clear likely token keys (adjust/remove if you only use cookies)
      localStorage.removeItem("adminToken");
      localStorage.removeItem("aca_admin_token");
      localStorage.removeItem("token");
      localStorage.removeItem("access_token");

      setAdminAuthed(false);
      message.success("Logged out");
      navigate("/admin");
    }
  }, [navigate]);

  return (
    <CartProvider>
      <Layout style={{ minHeight: "100vh" }}>
        {isAdminRoute ? (
          <AdminTopBar
            onRefresh={refreshAdmin}
            isAuthed={adminAuthed}
            onLogout={logoutAdmin}
            onBrandClick={() => navigate("/admin/dashboard")}
            refreshLoading={checkingAdminAuth}
          />
        ) : (
          <TopBar />
        )}

        <Content
          style={{
            padding: 24,
            maxWidth: 1280,
            margin: "0 auto",
            width: "100%",
          }}
        >
          <Routes>
            <Route path="/" element={<ShopPage />} />
            <Route path="/products" element={<ShopPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/track" element={<TrackOrderPage />} />

            <Route path="/admin" element={<AdminLoginPage />} />
            <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
          </Routes>
        </Content>

        <Footer style={{ textAlign: "center" }}>
          A Cut Above © {new Date().getFullYear()}
        </Footer>
      </Layout>
    </CartProvider>
  );
}
