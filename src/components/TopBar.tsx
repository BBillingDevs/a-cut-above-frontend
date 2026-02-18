import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Badge, Button, Layout, Menu, Space, Tag, message } from "antd";
import {
  ShoppingCartOutlined,
  UserOutlined,
  ShopOutlined,
} from "@ant-design/icons";
import { useCart } from "../context/CartContext";

// ✅ Put your logo file here (adjust path as needed)
import logo from "../assets/logo.png";

const { Header } = Layout;

function getTheme(): "light" | "dark" {
  const t = document.documentElement.getAttribute("data-theme");
  return t === "dark" ? "dark" : "light";
}

function setTheme(t: "light" | "dark") {
  document.documentElement.setAttribute("data-theme", t);
  localStorage.setItem("aca_theme", t);
}

export default function TopBar() {
  const { items } = useCart();
  const location = useLocation();
  const navigate = useNavigate();

  const [isWholesale, setIsWholesale] = useState<boolean>(
    Boolean(localStorage.getItem("aca_wholesale_pin")),
  );

  const [theme, setThemeState] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("aca_theme");
    return saved === "dark" ? "dark" : "light";
  });

  useEffect(() => {
    setTheme(theme);
  }, []);

  useEffect(() => {
    setIsWholesale(Boolean(localStorage.getItem("aca_wholesale_pin")));
  }, [location.pathname]);

  const menuItems = useMemo(
    () => [
      {
        key: "/products",
        label: <Link to="/products">Shop</Link>,
        icon: <ShopOutlined />,
      },
      {
        key: "/checkout",
        label: <Link to="/checkout">Checkout</Link>,
        icon: <ShoppingCartOutlined />,
      },
      {
        key: "/track",
        label: <Link to="/track">Track Order</Link>,
        icon: <UserOutlined />,
      },
    ],
    [],
  );

  const selectedKey = useMemo(() => {
    if (location.pathname.startsWith("/admin")) return "";
    if (location.pathname === "/") return "/products";
    return location.pathname;
  }, [location.pathname]);

  return (
    <Header className="aca-header">
      <div className="aca-header__inner">
        {/* Brand */}
        <div
          className="aca-brand"
          onClick={() => navigate("/products")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && navigate("/products")}
          style={{ cursor: "pointer" }}
        >
          <img src={logo} alt="A Cut Above" className="aca-brand__logo" />

          <div className="aca-brand__text">
            <div className="aca-brand__title">A CUT ABOVE</div>
            <div className="aca-brand__subtitle">PREMIUM MEATS</div>
          </div>
        </div>

        {/* Right actions */}
        <div className="aca-header__right">
          <Badge count={items.length} size="small">
            <Button
              type="primary"
              className="aca-cartBtn"
              icon={<ShoppingCartOutlined />}
              onClick={() => navigate("/checkout")}
            >
              Cart
            </Button>
          </Badge>

          {/* Wholesale: ONLY show if active */}
          {isWholesale && (
            <Space>
              <Tag color="gold">Wholesale mode</Tag>
              <Button
                danger
                onClick={() => {
                  localStorage.removeItem("aca_wholesale_pin");
                  setIsWholesale(false);
                  message.info("Exited wholesale mode.");
                  window.location.reload();
                }}
              >
                Exit wholesale
              </Button>
            </Space>
          )}
        </div>
      </div>

      {/* Nav row */}
      <div className="aca-nav">
        <Menu
          mode="horizontal"
          selectedKeys={selectedKey ? [selectedKey] : []}
          items={menuItems}
        />
      </div>
    </Header>
  );
}
