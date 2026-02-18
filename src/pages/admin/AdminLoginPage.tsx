// src/pages/admin/AdminLoginPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Button, Card, Form, Input, Space, Typography, message } from "antd";
import { useNavigate } from "react-router-dom";
import { api, API_BASE } from "../../api/client";

const { Title, Text } = Typography;

type LoginForm = { email: string; password: string };

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const initialValues = useMemo(
    () => ({
      email: "admin@acutabove.local",
      password: "admin123",
    }),
    [],
  );

  useEffect(() => {
    (async () => {
      try {
        // If already logged in, jump to dashboard
        await api.get("/api/admin/me");
        navigate("/admin/dashboard");
      } catch {
        // not logged in
      } finally {
        setChecking(false);
      }
    })();
  }, [navigate]);

  async function login(values: LoginForm) {
    const payload = {
      email: String(values.email || "")
        .trim()
        .toLowerCase(),
      password: String(values.password || ""),
    };

    setSubmitting(true);
    try {
      // ✅ Show which server you're actually talking to
      // (helps catch "wrong API_BASE" instantly)
      // eslint-disable-next-line no-console
      console.log("Admin login -> API_BASE:", API_BASE, "payload:", {
        ...payload,
        password: "***",
      });

      await api.post("/api/admin/auth/login", payload);

      // ✅ Immediately verify session/token really works
      await api.get("/api/admin/me");

      message.success("Logged in");
      navigate("/admin/dashboard");
    } catch (e: any) {
      // More helpful error surface
      const status = e?.response?.status;
      const serverMsg = e?.response?.data?.error || e?.response?.data?.message;

      message.error(
        serverMsg ||
          (status
            ? `Login failed (${status})`
            : "Login failed — check API_BASE / backend"),
      );

      // eslint-disable-next-line no-console
      console.error("Admin login error:", {
        status,
        data: e?.response?.data,
        base: API_BASE,
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) return null;

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Title level={2} style={{ margin: 0 }}>
        Admin Login
      </Title>

      <Card style={{ maxWidth: 420 }}>
        <Form layout="vertical" onFinish={login} initialValues={initialValues}>
          <Form.Item
            name="email"
            label="Email"
            rules={[{ required: true }, { type: "email" }]}
          >
            <Input autoComplete="username" />
          </Form.Item>

          <Form.Item
            name="password"
            label="Password"
            rules={[{ required: true }]}
          >
            <Input.Password autoComplete="current-password" />
          </Form.Item>

          <Button type="primary" htmlType="submit" block loading={submitting}>
            Log in
          </Button>
        </Form>

        <div style={{ marginTop: 12 }}>
          <Text type="secondary">
            Using API: <b>{API_BASE}</b>
          </Text>
          <br />
          <Text type="secondary">
            Default seed credentials are prefilled for local dev.
          </Text>
        </div>
      </Card>
    </Space>
  );
}
