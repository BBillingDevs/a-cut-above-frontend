// src/components/AdminShell.tsx
import React from "react";
import { Space } from "antd";

/**
 * ✅ AdminShell (no heading/subheading)
 * Use `right` for top-right actions if needed.
 */
export default function AdminShell({
  children,
}: {
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      {children}
    </Space>
  );
}
