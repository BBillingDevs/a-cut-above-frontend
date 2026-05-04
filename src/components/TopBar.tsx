// src/components/TopBar.tsx

import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Badge,
  Button,
  Drawer,
  Layout,
  Menu,
  Space,
  Tag,
  message,
  Grid,
} from "antd";
import {
  ShoppingCartOutlined,
  UserOutlined,
  ShopOutlined,
  InfoCircleOutlined,
  MailOutlined,
  MenuOutlined,
} from "@ant-design/icons";
import { useCart } from "../context/CartContext";

// ✅ Put your logo file here (adjust path as needed)
import logo from "../assets/logo.png";

const { Header } = Layout;
const { useBreakpoint } = Grid;

function setTheme(t: "light" | "dark") {
  document.documentElement.setAttribute("data-theme", t);
  localStorage.setItem("aca_theme", t);
}

export default function TopBar() {
  const { items } = useCart();
  const location = useLocation();
  const navigate = useNavigate();
  const screens = useBreakpoint();

  const isMobile = !screens.md;

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [isWholesale, setIsWholesale] = useState<boolean>(
    Boolean(localStorage.getItem("aca_wholesale_pin")),
  );

  const [theme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("aca_theme");
    return saved === "dark" ? "dark" : "light";
  });

  useEffect(() => {
    setTheme(theme);
  }, [theme]);

  useEffect(() => {
    setIsWholesale(Boolean(localStorage.getItem("aca_wholesale_pin")));
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const menuItems = useMemo(
    () => [
      {
        key: "/about",
        label: <Link to="/about">About Us</Link>,
        icon: <InfoCircleOutlined />,
      },
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
      {
        key: "/contact",
        label: <Link to="/contact">Contact Us</Link>,
        icon: <MailOutlined />,
      },
    ],
    [],
  );

  const selectedKey = useMemo(() => {
    if (location.pathname.startsWith("/admin")) return "";

    if (location.pathname === "/" || location.pathname.startsWith("/about")) {
      return "/about";
    }

    if (
      location.pathname === "/products" ||
      location.pathname.startsWith("/products") ||
      location.pathname === "/shop"
    ) {
      return "/products";
    }

    if (location.pathname.startsWith("/checkout")) return "/checkout";

    if (
      location.pathname.startsWith("/track") ||
      location.pathname.startsWith("/track-order")
    ) {
      return "/track";
    }

    if (location.pathname.startsWith("/contact")) return "/contact";

    return location.pathname;
  }, [location.pathname]);

  function exitWholesaleMode() {
    localStorage.removeItem("aca_wholesale_pin");
    setIsWholesale(false);
    message.info("Exited wholesale mode.");
    window.location.reload();
  }

  return (
    <Header className="aca-header">
      <div className="aca-header__inner">
        {/* Brand */}
        <div
          className="aca-brand"
          onClick={() => navigate("/")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && navigate("/")}
          style={{ cursor: "pointer" }}
        >
          <img src={logo} alt="A Cut Above" className="aca-brand__logo" />

          <div className="aca-brand__text">
            <div className="aca-brand__title">A CUT ABOVE</div>
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
              {!isMobile ? "Cart" : null}
            </Button>
          </Badge>

          {!isMobile && isWholesale ? (
            <Space>
              <Tag color="gold">Wholesale mode</Tag>

              <Button danger onClick={exitWholesaleMode}>
                Exit wholesale
              </Button>
            </Space>
          ) : null}

          {isMobile ? (
            <Button
              icon={<MenuOutlined />}
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
            />
          ) : null}
        </div>
      </div>

      {/* Desktop nav row */}
      {!isMobile ? (
        <div className="aca-nav">
          <Menu
            mode="horizontal"
            selectedKeys={selectedKey ? [selectedKey] : []}
            items={menuItems}
          />
        </div>
      ) : null}

      {/* Mobile hamburger drawer */}
      <Drawer
        title="Menu"
        placement="right"
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        width={300}
      >
        {isWholesale ? (
          <div
            style={{
              display: "grid",
              gap: 10,
              marginBottom: 16,
              paddingBottom: 16,
              borderBottom: "1px solid var(--aca-border)",
            }}
          >
            <Tag color="gold" style={{ width: "fit-content" }}>
              Wholesale mode
            </Tag>

            <Button danger onClick={exitWholesaleMode}>
              Exit wholesale
            </Button>
          </div>
        ) : null}

        <Menu
          mode="vertical"
          selectedKeys={selectedKey ? [selectedKey] : []}
          items={menuItems}
          onClick={() => setMobileMenuOpen(false)}
        />
      </Drawer>
    </Header>
  );
}
