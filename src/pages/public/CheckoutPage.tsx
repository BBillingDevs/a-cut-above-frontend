// src/pages/public/CheckoutPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  Divider,
  Form,
  Input,
  InputNumber,
  Space,
  Typography,
  message,
  Select,
  Tag,
} from "antd";
import {
  LockOutlined,
  ArrowRightOutlined,
  ShoppingCartOutlined,
  MinusOutlined,
  PlusOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
} from "@ant-design/icons";
import { api } from "../../api/client";
import { useCart } from "../../context/CartContext";

const { Title, Text } = Typography;

type WindowState = {
  open: boolean;
  name?: string;
  endsAt?: string;
  message?: string;
  isPermanent?: boolean;
};

type DropoffLocation = {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  sortOrder: number;
  deliveryCutoffAt?: string | null;
  nextDeliveryAt?: string | null;
};

type CheckoutForm = {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  dropoffLocationId: string;
};

type StockIssue = {
  productId: string;
  name?: string;
  requested: number;
  available: number;
  reason: "NOT_FOUND" | "INACTIVE" | "INSUFFICIENT";
};

function asInt(v: any, fallback: number) {
  if (v === null || v === undefined || v === "") return fallback;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.floor(n));
}

export default function CheckoutPage() {
  // ✅ include setQty/remove so user can adjust quantities + delete here
  const { items, clear, setQty, remove } = useCart();
  const navigate = useNavigate();

  const [windowState, setWindowState] = useState<WindowState>({ open: false });
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<CheckoutForm>();

  const [dropoffs, setDropoffs] = useState<DropoffLocation[]>([]);
  const [dropoffsLoading, setDropoffsLoading] = useState(false);

  // ✅ Stock issues shown INLINE under each item (no toast)
  const [stockIssuesById, setStockIssuesById] = useState<
    Record<string, StockIssue>
  >({});
  const [stockChecking, setStockChecking] = useState(false);

  async function loadWindow() {
    try {
      const wRes = await api.get("/api/public/order-window");
      setWindowState(wRes.data);
    } catch {
      setWindowState({ open: false, message: "Unable to check order window" });
    }
  }

  async function loadDropoffs() {
    setDropoffsLoading(true);
    try {
      const res = await api.get("/api/public/dropoff-locations");
      const list = (res.data?.locations || []) as any[];

      const parsed: DropoffLocation[] = list.map((x) => ({
        id: String(x.id),
        name: String(x.name),
        description: x.description ?? null,
        isActive: Boolean(x.isActive),
        sortOrder: Number(x.sortOrder ?? 0),
        deliveryCutoffAt: x.deliveryCutoffAt ?? null,
        nextDeliveryAt: x.nextDeliveryAt ?? null,
      }));

      setDropoffs(parsed);

      const current = form.getFieldValue("dropoffLocationId");
      const firstActive = parsed
        .filter((d) => d.isActive)
        .sort(
          (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
        )[0];

      if (!current && firstActive) {
        form.setFieldsValue({ dropoffLocationId: firstActive.id });
      }
    } catch (e: any) {
      console.error(e);
      message.error(
        e?.response?.data?.error ||
        e?.message ||
        "Failed to load drop-off locations",
      );
      setDropoffs([]);
    } finally {
      setDropoffsLoading(false);
    }
  }

  useEffect(() => {
    loadWindow();
    loadDropoffs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedDropoffId = Form.useWatch("dropoffLocationId", form);

  const selectedDropoff = useMemo(() => {
    return dropoffs.find((d) => d.id === selectedDropoffId) ?? null;
  }, [dropoffs, selectedDropoffId]);

  const deliveryInfo = useMemo(() => {
    const cutoff = selectedDropoff?.deliveryCutoffAt
      ? new Date(selectedDropoff.deliveryCutoffAt)
      : null;
    const nextDelivery = selectedDropoff?.nextDeliveryAt
      ? new Date(selectedDropoff.nextDeliveryAt)
      : null;

    return { has: Boolean(cutoff && nextDelivery), cutoff, nextDelivery };
  }, [selectedDropoff]);

  // ✅ Call stock-check and STORE issues (no toast)
  async function runStockCheck() {
    if (!items.length) {
      setStockIssuesById({});
      return { ok: true as const, issues: [] as StockIssue[] };
    }

    setStockChecking(true);
    try {
      await api.post("/api/public/orders/stock-check", {
        items: items.map((i) => ({
          productId: i.product.id,
          qty: Number(i.qty || 0),
        })),
      });

      setStockIssuesById({});
      return { ok: true as const, issues: [] as StockIssue[] };
    } catch (e: any) {
      if (e?.response?.status === 409) {
        const issues = (e?.response?.data?.issues || []) as StockIssue[];
        const map: Record<string, StockIssue> = {};
        for (const it of issues) map[String(it.productId)] = it;
        setStockIssuesById(map);
        return { ok: false as const, issues };
      }

      // If anything else goes wrong, don't block UI with toasts
      console.error("Stock check error:", e);
      return { ok: true as const, issues: [] as StockIssue[] };
    } finally {
      setStockChecking(false);
    }
  }

  // ✅ Keep the summary warnings up-to-date as cart changes
  useEffect(() => {
    let t: any = null;
    t = setTimeout(() => {
      runStockCheck();
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map((i) => `${i.product.id}:${Number(i.qty || 0)}`).join("|")]);

  function issueUi(issue?: StockIssue | null) {
    if (!issue) return null;

    // Red icon ONLY if completely unavailable / not purchasable
    const hardOut =
      issue.available <= 0 ||
      issue.reason === "INACTIVE" ||
      issue.reason === "NOT_FOUND";

    if (hardOut) {
      return {
        icon: <CloseCircleOutlined />,
        color: "#cf1322",
        title: "Sold out",
        subtitle:
          issue.reason === "INACTIVE"
            ? "This item is currently unavailable."
            : issue.reason === "NOT_FOUND"
              ? "This item no longer exists."
              : "No stock available.",
      };
    }

    // Warning icon if requested > available
    return {
      icon: <ExclamationCircleOutlined />,
      color: "#d48806",
      title: "Low stock",
      subtitle: `Only ${issue.available} available — please reduce quantity.`,
    };
  }

  const hasBlockingIssues = useMemo(() => {
    return Object.keys(stockIssuesById).length > 0;
  }, [stockIssuesById]);

  async function submit(values: CheckoutForm) {
    if (items.length === 0) return;

    if (!windowState.open) {
      message.error("Ordering is currently closed");
      return;
    }

    setSubmitting(true);
    try {
      // ✅ 1) Pre-check stock (store issues for INLINE display)
      const check = await runStockCheck();
      if (!check.ok) {
        // No toast – the UI shows it under items
        return;
      }

      // ✅ 2) Place order (backend should re-check stock atomically)
      const payload = {
        customerName: values.customerName,
        customerPhone: values.customerPhone,
        customerEmail: values.customerEmail || "",
        dropoffLocationId: values.dropoffLocationId,
        notes: "",
        items: items.map((i) => ({ productId: i.product.id, qty: i.qty })),
      };

      const res = await api.post("/api/public/orders", payload);

      clear();
      message.success(`Order placed! Your order number is ${res.data.orderNo}`);
      form.resetFields();
      navigate("/track");
    } catch (e: any) {
      // ✅ If backend rejects for stock, show inline issues (no toast)
      if (e?.response?.status === 409) {
        const issues = (e?.response?.data?.issues || []) as StockIssue[];
        const map: Record<string, StockIssue> = {};
        for (const it of issues) map[String(it.productId)] = it;
        setStockIssuesById(map);
        return;
      }

      message.error(e?.response?.data?.error || "Failed to place order");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="aca-page">
      <div className="aca-page__top" style={{ alignItems: "center" }}>
        <div>
          <Title
            level={2}
            className="aca-displayTitle"
            style={{ marginBottom: 4 }}
          >
            Secure Checkout
          </Title>
          <Text className="aca-subtitle">
            Enter your details to receive your premium cuts.
          </Text>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <LockOutlined style={{ opacity: 0.65 }} />
          <Text type="secondary" style={{ letterSpacing: 1, fontWeight: 600 }}>
            SECURE
          </Text>
        </div>
      </div>

      {!windowState.open ? (
        <Alert
          type="warning"
          message={windowState.message || "Ordering is closed."}
          showIcon
          className="aca-alert"
          style={{ marginTop: 14 }}
        />
      ) : null}

      <div className="aca-checkoutGrid">
        {/* LEFT */}
        <div style={{ display: "grid", gap: 16 }}>
          <Card className="aca-card">
            <Title level={3} style={{ marginTop: 0 }}>
              Your Details
            </Title>
            <Text type="secondary">
              Choose where you’d like your order dropped.
            </Text>

            <Divider />

            <Form layout="vertical" form={form} onFinish={submit}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <Form.Item
                  name="customerName"
                  label={
                    <span style={{ letterSpacing: 1, fontWeight: 800 }}>
                      FULL NAME
                    </span>
                  }
                  rules={[
                    { required: true, message: "Please enter your name" },
                  ]}
                >
                  <Input placeholder="e.g. James Sterling" />
                </Form.Item>

                <Form.Item
                  name="customerPhone"
                  label={
                    <span style={{ letterSpacing: 1, fontWeight: 800 }}>
                      PHONE
                    </span>
                  }
                  rules={[
                    {
                      required: true,
                      message: "Please enter your phone number",
                    },
                  ]}
                >
                  <Input placeholder="WhatsApp/phone number" />
                </Form.Item>
              </div>

              <Form.Item
                name="customerEmail"
                label={
                  <span style={{ letterSpacing: 1, fontWeight: 800 }}>
                    EMAIL (OPTIONAL)
                  </span>
                }
                rules={[{ type: "email", warningOnly: true }]}
              >
                <Input placeholder="name@example.com" />
              </Form.Item>

              <Form.Item
                name="dropoffLocationId"
                label={
                  <span style={{ letterSpacing: 1, fontWeight: 800 }}>
                    DROP-OFF LOCATION
                  </span>
                }
                rules={[
                  {
                    required: true,
                    message: "Please choose a drop-off location",
                  },
                ]}
              >
                <Select
                  loading={dropoffsLoading}
                  placeholder="Select a drop-off location"
                  options={dropoffs
                    .filter((d) => d.isActive)
                    .sort(
                      (a, b) =>
                        a.sortOrder - b.sortOrder ||
                        a.name.localeCompare(b.name),
                    )
                    .map((d) => ({
                      value: d.id,
                      label: d.description
                        ? `${d.name} — ${d.description}`
                        : d.name,
                    }))}
                />
              </Form.Item>

              {selectedDropoff ? (
                deliveryInfo.has ? (
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginTop: 8 }}
                    message="Delivery schedule"
                    description={
                      <div style={{ display: "grid", gap: 4 }}>
                        <div>
                          Cut-off:{" "}
                          <b>{deliveryInfo.cutoff!.toLocaleDateString()}</b>
                        </div>
                        <div>
                          Next delivery:{" "}
                          <b>
                            {deliveryInfo.nextDelivery!.toLocaleDateString()}
                          </b>
                        </div>
                        <div style={{ opacity: 0.8 }}>
                          Orders placed after the cut-off will go on the
                          following delivery date.
                        </div>
                      </div>
                    }
                  />
                ) : (
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginTop: 8 }}
                    message="Delivery schedule not set"
                    description="Please contact support if you need a delivery date for this location."
                  />
                )
              ) : null}

              <Divider />

              <Space style={{ width: "100%", justifyContent: "space-between" }}>
                <Button
                  onClick={() => navigate("/products")}
                  icon={<ShoppingCartOutlined />}
                >
                  Back to shop
                </Button>

                <Button
                  type="primary"
                  htmlType="submit"
                  loading={submitting}
                  disabled={
                    !windowState.open || items.length === 0 || hasBlockingIssues
                  }
                  icon={<LockOutlined />}
                  className="aca-cartBtn"
                >
                  Place order <ArrowRightOutlined />
                </Button>
              </Space>

              {hasBlockingIssues ? (
                <div style={{ marginTop: 10 }}>
                  <Text strong style={{ color: "#cf1322" }}>
                    Fix your cart items on the right before placing the order.
                  </Text>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--aca-muted)",
                      marginTop: 2,
                    }}
                  >
                    Items marked in red/orange need quantity changes or removal.
                  </div>
                </div>
              ) : null}
            </Form>
          </Card>
        </div>

        {/* RIGHT */}
        <aside>
          <div style={{ position: "sticky", top: 120 }}>
            <Card className="aca-card">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <Title level={4} style={{ marginTop: 0, marginBottom: 0 }}>
                  Quick Summary
                </Title>
                <Tag
                  color={
                    stockChecking ? "gold" : hasBlockingIssues ? "red" : "green"
                  }
                >
                  {stockChecking
                    ? "Checking stock…"
                    : hasBlockingIssues
                      ? "Action needed"
                      : "OK"}
                </Tag>
              </div>

              <Divider style={{ margin: "12px 0" }} />

              {items.length === 0 ? (
                <Text type="secondary">No items yet.</Text>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {items.map((it) => {
                    const pid = it.product.id;
                    const qty = asInt(it.qty, 1);

                    const issue = stockIssuesById[pid] || null;
                    const ui = issueUi(issue);

                    const maxIfKnown =
                      issue &&
                        issue.reason === "INSUFFICIENT" &&
                        Number(issue.available) > 0
                        ? Number(issue.available)
                        : undefined;

                    const disablePlus =
                      typeof maxIfKnown === "number"
                        ? qty >= maxIfKnown
                        : false;

                    return (
                      <div
                        key={pid}
                        style={{
                          padding: 12,
                          borderRadius: 14,
                          border: `1px solid ${ui
                              ? ui.color === "#cf1322"
                                ? "rgba(207,19,34,0.35)"
                                : "rgba(212,136,6,0.35)"
                              : "var(--aca-border)"
                            }`,
                          background: ui
                            ? "rgba(0,0,0,0.02)"
                            : "var(--aca-bg2)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            alignItems: "flex-start",
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <Text
                              strong
                              style={{
                                display: "block",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                fontSize: "18px",
                              }}
                            >
                              {it.product.name}
                            </Text>

                            {/* ✅ inline warning/error UNDER item name (no toast) */}
                            {ui ? (
                              <div
                                style={{
                                  marginTop: 4,
                                  display: "flex",
                                  gap: 8,
                                  alignItems: "flex-start",
                                  color: ui.color,
                                }}
                              >
                                <span style={{ marginTop: 2 }}>{ui.icon}</span>
                                <div style={{ lineHeight: 1.2 }}>
                                  <div style={{ fontWeight: 800 }}>
                                    {ui.title}
                                  </div>
                                  <div style={{ fontSize: 12, opacity: 0.9 }}>
                                    {ui.subtitle}
                                  </div>
                                </div>
                              </div>
                            ) : null}
                          </div>

                          <Button
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => remove(pid)}
                          />
                        </div>

                        {/* ✅ Subheading exactly where you said you want it */}
                        {ui ? (
                          <div style={{ marginTop: 10 }}>
                            <Text style={{ fontWeight: 800, color: ui.color }}>
                              Please fix this item before placing the order
                            </Text>
                            <div
                              style={{
                                fontSize: 12,
                                color: "var(--aca-muted)",
                                marginTop: 2,
                              }}
                            >
                              Reduce qty to available stock or remove it.
                            </div>
                          </div>
                        ) : null}

                        <div
                          style={{
                            marginTop: ui ? 8 : 10,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <Text type="secondary">Qty (packs)</Text>

                          <div
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              border: "1px solid var(--aca-border)",
                              background: "var(--aca-card)",
                              borderRadius: 999,
                              padding: "4px 6px",
                            }}
                          >
                            <Button
                              size="small"
                              type="text"
                              icon={<MinusOutlined />}
                              disabled={qty <= 1}
                              onClick={() => setQty(pid, Math.max(1, qty - 1))}
                              style={{
                                width: 26,
                                height: 26,
                                borderRadius: 999,
                                padding: 0,
                              }}
                            />

                            <InputNumber
                              value={qty}
                              min={1}
                              max={maxIfKnown}
                              controls={false}
                              onChange={(v) => setQty(pid, asInt(v, 1))}
                              style={{ width: 52 }} // ✅ smaller width
                            />

                            <Button
                              size="small"
                              type="text"
                              icon={<PlusOutlined />}
                              disabled={disablePlus}
                              onClick={() => setQty(pid, qty + 1)}
                              style={{
                                width: 26,
                                height: 26,
                                borderRadius: 999,
                                padding: 0,
                              }}
                            />
                          </div>
                        </div>

                        {typeof maxIfKnown === "number" ? (
                          <div style={{ marginTop: 6 }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              Max available right now: <b>{maxIfKnown}</b>
                            </Text>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </aside>
      </div>
    </div>
  );
}
