// src/components/AdminTopBar.tsx
import React from "react";
import { Button, Space } from "antd";
import { ReloadOutlined, LogoutOutlined } from "@ant-design/icons";
import logo from "../assets/logo.png";

export default function AdminTopBar({
  onRefresh,
  isAuthed,
  onLogout,
  onBrandClick,
  refreshLoading,
}: {
  onRefresh: () => void;
  isAuthed: boolean;
  onLogout: () => void;
  onBrandClick?: () => void;
  refreshLoading?: boolean;
}) {
  return (
    <div className="aca-header">
      <div className="aca-header__inner">
        {/* Brand */}
        <div
          className="aca-brand"
          onClick={onBrandClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && onBrandClick?.()}
          style={{ cursor: "pointer" }}
        >
          <img src={logo} alt="A Cut Above" className="aca-brand__logo" />
          <div className="aca-brand__text">
            <div className="aca-brand__title">A CUT ABOVE</div>
            <div className="aca-brand__subtitle">ADMIN</div>
          </div>
        </div>

        {/* Actions */}
        <div className="aca-header__right">
          <Space>
            <Button
              className="aca-iconBtn"
              icon={<ReloadOutlined />}
              onClick={onRefresh}
              loading={refreshLoading}
            >
              Refresh
            </Button>

            {/* ✅ Only show if logged in */}
            {isAuthed ? (
              <Button
                danger
                className="aca-iconBtn"
                icon={<LogoutOutlined />}
                onClick={onLogout}
              >
                Logout
              </Button>
            ) : null}
          </Space>
        </div>
      </div>
    </div>
  );
}
