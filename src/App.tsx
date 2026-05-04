// src/App.tsx

import React, { useCallback, useEffect, useState } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Layout, message } from "antd";
import { CartProvider } from "./context/CartContext";
import { api } from "./api/client";

import TopBar from "./components/TopBar";
import AdminTopBar from "./components/AdminTopBar";

import ShopPage from "./pages/public/ShopPage";
import AboutPage from "./pages/public/AboutPage";
import ContactPage from "./pages/public/ContactPage";
import CheckoutPage from "./pages/public/CheckoutPage";
import TrackOrderPage from "./pages/public/TrackOrderPage";
import WholesalePinPage from "./pages/public/WholesalePinPage";

import AdminLoginPage from "./pages/admin/AdminLoginPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";

const { Content, Footer } = Layout;

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const isAdminRoute = location.pathname.startsWith("/admin");

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

  useEffect(() => {
    if (isAdminRoute) {
      checkAdminAuth();
    }
  }, [isAdminRoute, location.pathname, checkAdminAuth]);

  const refreshAdmin = useCallback(() => {
    checkAdminAuth();
    navigate(0);
  }, [checkAdminAuth, navigate]);

  const logoutAdmin = useCallback(async () => {
    try {
      await api.post("/api/admin/auth/logout");
    } catch {
      // ignore network/logout errors
    } finally {
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
            <Route path="/" element={<AboutPage />} />
            <Route path="/about" element={<AboutPage />} />

            <Route path="/products" element={<ShopPage />} />
            <Route path="/shop" element={<ShopPage />} />

            <Route path="/contact" element={<ContactPage />} />

            <Route path="/wholesale" element={<WholesalePinPage />} />

            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/track" element={<TrackOrderPage />} />
            <Route path="/track-order" element={<TrackOrderPage />} />

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
