// src/pages/public/CheckoutPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Space,
  Typography,
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
import { api, RAILWAY_BASE } from "../../api/client";
import { useCart } from "../../context/CartContext";

const { Title, Text } = Typography;
const MUTARE_MINIMUM = 50;

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
  nextSchedule?: {
    cutoffDate: string;
    deliveryDate: string;
  } | null;
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

function asMoney(v: any) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function resolveImageUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("/uploads/")) return `${RAILWAY_BASE}${url}`;
  return null;
}

function getItemUnitPrice(item: any): number {
  return asMoney(
    item?.price ??
    item?.unitPrice ??
    item?.product?.price ??
    item?.product?.unitPrice ??
    item?.product?.pricePerPack ??
    0,
  );
}

export default function CheckoutPage() {
  const { items, clear, setQty, remove } = useCart();
  const navigate = useNavigate();

  const [windowState, setWindowState] = useState({
    open: false,
  } as WindowState);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const [dropoffs, setDropoffs] = useState([] as DropoffLocation[]);
  const [dropoffsLoading, setDropoffsLoading] = useState(false);
  const [stockIssuesById, setStockIssuesById] = useState(
    {} as Record<string, StockIssue>,
  );
  const [stockChecking, setStockChecking] = useState(false);

  const [ackOpen, setAckOpen] = useState(false);
  const [ackChecked, setAckChecked] = useState(false);
  const [pendingValues, setPendingValues] = useState<any | null>(null);

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
        nextSchedule: x.nextSchedule ?? null,
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

  const isMutare = useMemo(() => {
    return /mutare/i.test(selectedDropoff?.name || "");
  }, [selectedDropoff]);

  const cartSubtotal = useMemo(() => {
    return items.reduce((sum, it) => {
      const qty = asInt(it.qty, 1);
      const unitPrice = getItemUnitPrice(it);
      return sum + qty * unitPrice;
    }, 0);
  }, [items]);

  const deliveryInfo = useMemo(() => {
    const schedule = selectedDropoff?.nextSchedule ?? null;
    const cutoff = schedule?.cutoffDate ? new Date(schedule.cutoffDate) : null;
    const nextDelivery = schedule?.deliveryDate
      ? new Date(schedule.deliveryDate)
      : null;
    return { has: Boolean(cutoff && nextDelivery), cutoff, nextDelivery };
  }, [selectedDropoff]);

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
      console.error("Stock check error:", e);
      return { ok: true as const, issues: [] as StockIssue[] };
    } finally {
      setStockChecking(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => {
      runStockCheck();
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map((i) => `${i.product.id}:${Number(i.qty || 0)}`).join("|")]);

  function issueUi(issue?: StockIssue | null) {
    if (!issue) return null;
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

  const mutareMinimumMet = !isMutare || cartSubtotal >= MUTARE_MINIMUM;

  async function doSubmit(values: any) {
    const customerName = String(values.customerName || "").trim();
    const customerPhone = String(values.customerPhone || "").trim();
    const customerEmail = String(values.customerEmail || "").trim();
    const dropoffLocationId = String(values.dropoffLocationId || "").trim();
    const personalAddress = String(values.personalAddress || "").trim();

    if (items.length === 0) return;
    if (!windowState.open) return;

    setSubmitting(true);
    try {
      const check = await runStockCheck();
      if (!check.ok) return;

      const payload = {
        customerName,
        customerPhone,
        customerEmail,
        dropoffLocationId,
        personalAddress: isMutare ? personalAddress : "",
        notes: "",
        items: items.map((i) => ({ productId: i.product.id, qty: i.qty })),
      };

      const res = await api.post("/api/public/orders", payload);

      clear();
      form.resetFields();
      setAckChecked(false);
      setPendingValues(null);

      navigate("/track", {
        replace: true,
        state: {
          successOrderNo: res.data?.orderNo,
          successDeliveryDate:
            res.data?.deliverySchedule?.deliveryDate ??
            res.data?.deliveryDate ??
            deliveryInfo.nextDelivery?.toISOString() ??
            null,
        },
      });
    } catch (e: any) {
      if (e?.response?.status === 409) {
        const issues = (e?.response?.data?.issues || []) as StockIssue[];
        const map: Record<string, StockIssue> = {};
        for (const it of issues) map[String(it.productId)] = it;
        setStockIssuesById(map);
        return;
      }
      console.error("Order failed:", e?.response?.data || e);
    } finally {
      setSubmitting(false);
    }
  }

  async function submit(values: any) {
    if (items.length === 0) return;
    if (!windowState.open) return;

    if (isMutare && cartSubtotal < MUTARE_MINIMUM) {
      form.setFields([
        {
          name: "dropoffLocationId",
          errors: [
            `Mutare orders must be at least $${MUTARE_MINIMUM.toFixed(2)}.`,
          ],
        },
      ]);
      return;
    }

    setPendingValues(values);
    setAckChecked(false);
    setAckOpen(true);
  }

  async function handleAckOk() {
    if (!ackChecked) return;
    setAckOpen(false);
    if (pendingValues) {
      await doSubmit(pendingValues);
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
        <div style={{ display: "grid", gap: 16 }}>
          <Card className="aca-card">
            <Title level={3} style={{ marginTop: 0 }}>
              Your Details
            </Title>
            <Text type="secondary">
              Choose where you'd like your order dropped.
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
                    {
                      validator: (_, value) => {
                        if (String(value || "").trim().length >= 2) {
                          return Promise.resolve();
                        }
                        return Promise.reject(
                          "Name must be at least 2 characters",
                        );
                      },
                    },
                  ]}
                  normalize={(v) => String(v || "")}
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
                    {
                      validator: (_, value) => {
                        if (String(value || "").trim().length >= 5) {
                          return Promise.resolve();
                        }
                        return Promise.reject(
                          "Please enter a valid phone number",
                        );
                      },
                    },
                  ]}
                  normalize={(v) => String(v || "")}
                >
                  <Input placeholder="WhatsApp/phone number" />
                </Form.Item>
              </div>

              <Form.Item
                name="customerEmail"
                label={
                  <span style={{ letterSpacing: 1, fontWeight: 800 }}>
                    EMAIL ADDRESS
                  </span>
                }
                rules={[
                  {
                    required: true,
                    message: "Please enter your email address",
                  },
                  { type: "email", message: "Please enter a valid email" },
                ]}
                normalize={(v) => String(v || "")}
              >
                <Input placeholder="name@example.com" />
              </Form.Item>

              {isMutare ? (
                <Alert
                  type={mutareMinimumMet ? "info" : "error"}
                  showIcon
                  message="Mutare delivery requirements"
                  description={
                    <div style={{ display: "grid", gap: 4 }}>
                      <div>
                        Minimum order value: <b>${MUTARE_MINIMUM.toFixed(2)}</b>
                      </div>
                      <div>
                        Current cart total: <b>${cartSubtotal.toFixed(2)}</b>
                      </div>
                      <div>
                        A personal delivery address is required for Mutare
                        orders.
                      </div>
                    </div>
                  }
                />
              ) : null}

              <Form.Item
                name="dropoffLocationId"
                label={
                  <span style={{ letterSpacing: 1, fontWeight: 800 }}>
                    DELIVERY LOCATION
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
                <div style={{ display: "grid", gap: 10 }}>
                  {deliveryInfo.has ? (
                    <Alert
                      type="info"
                      showIcon
                      style={{ marginTop: 8 }}
                      message="Next delivery schedule"
                      description={
                        <div style={{ display: "grid", gap: 4 }}>
                          <div>
                            Order cut-off:{" "}
                            <b>{deliveryInfo.cutoff!.toLocaleDateString()}</b>
                          </div>
                          <div>
                            Delivery date:{" "}
                            <b>
                              {deliveryInfo.nextDelivery!.toLocaleDateString()}
                            </b>
                          </div>
                          <div style={{ opacity: 0.8 }}>
                            Orders placed after the cut-off will go on the next
                            delivery run.
                          </div>
                        </div>
                      }
                    />
                  ) : (
                    <Alert
                      type="warning"
                      showIcon
                      style={{ marginTop: 8 }}
                      message="No upcoming delivery scheduled"
                      description="Please contact us if you need a delivery date for this location."
                    />
                  )}
                </div>
              ) : null}

              {isMutare ? (
                <Form.Item
                  name="personalAddress"
                  label={
                    <span style={{ letterSpacing: 1, fontWeight: 800 }}>
                      PERSONAL ADDRESS
                    </span>
                  }
                  rules={[
                    {
                      required: true,
                      message: "Please enter your personal address for Mutare",
                    },
                    {
                      validator: (_, value) => {
                        if (String(value || "").trim().length >= 6) {
                          return Promise.resolve();
                        }
                        return Promise.reject(
                          "Address must be at least 6 characters",
                        );
                      },
                    },
                  ]}
                  normalize={(v) => String(v || "")}
                >
                  <Input.TextArea
                    rows={3}
                    placeholder="Enter your full personal address"
                  />
                </Form.Item>
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
                    !windowState.open ||
                    items.length === 0 ||
                    hasBlockingIssues ||
                    !mutareMinimumMet
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

              {!mutareMinimumMet ? (
                <div style={{ marginTop: 10 }}>
                  <Text strong style={{ color: "#d48806" }}>
                    Mutare orders must be at least ${MUTARE_MINIMUM.toFixed(2)}.
                  </Text>
                </div>
              ) : null}
            </Form>
          </Card>
        </div>

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

              <div style={{ marginBottom: 12 }}>
                <Text type="secondary">Subtotal</Text>
                <div style={{ fontSize: 24, fontWeight: 800 }}>
                  ${cartSubtotal.toFixed(2)}
                </div>
              </div>

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
                    const imgSrc = resolveImageUrl(
                      (it.product as any).imageUrl,
                    );
                    const unitPrice = getItemUnitPrice(it);
                    const lineTotal = unitPrice * qty;

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
                          <div
                            style={{
                              display: "flex",
                              gap: 10,
                              alignItems: "center",
                              minWidth: 0,
                              flex: 1,
                            }}
                          >
                            <div
                              style={{
                                width: 44,
                                height: 44,
                                borderRadius: 10,
                                overflow: "hidden",
                                background: "var(--aca-card)",
                                border: "1px solid var(--aca-border)",
                                flexShrink: 0,
                              }}
                            >
                              {imgSrc ? (
                                <img
                                  src={imgSrc}
                                  alt={it.product.name}
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                  }}
                                  onError={(e) => {
                                    (
                                      e.currentTarget as HTMLImageElement
                                    ).style.display = "none";
                                  }}
                                />
                              ) : null}
                            </div>

                            <div style={{ minWidth: 0 }}>
                              <Text
                                strong
                                style={{
                                  display: "block",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  fontSize: "16px",
                                }}
                              >
                                {it.product.name}
                              </Text>

                              {unitPrice > 0 ? (
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  ${unitPrice.toFixed(2)} each · $
                                  {lineTotal.toFixed(2)}
                                </Text>
                              ) : null}

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
                                  <span style={{ marginTop: 2 }}>
                                    {ui.icon}
                                  </span>
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
                          </div>

                          <Button
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => remove(pid)}
                          />
                        </div>

                        {ui ? (
                          <div style={{ marginTop: 10 }}>
                            <Text strong style={{ color: ui.color }}>
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
                              style={{ width: 52 }}
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

      <Modal
        open={ackOpen}
        title="Acknowledgement required"
        onCancel={() => {
          setAckOpen(false);
          setPendingValues(null);
          setAckChecked(false);
        }}
        onOk={handleAckOk}
        okText="Confirm and place order"
        confirmLoading={submitting}
        okButtonProps={{
          disabled: !ackChecked,
        }}
      >
        <div style={{ display: "grid", gap: 12 }}>
          <Alert
            type="warning"
            showIcon
            message="Please read before placing your order"
            description={
              <div style={{ display: "grid", gap: 6 }}>
                <div>
                  By placing this order, you confirm that your details and
                  delivery information are correct.
                </div>
                <div>
                  You also understand that stock is subject to availability at
                  the time your order is processed.
                </div>
                {isMutare ? (
                  <div>
                    Mutare orders require a minimum basket value of $
                    {MUTARE_MINIMUM.toFixed(2)} and a valid personal address.
                  </div>
                ) : null}
                {deliveryInfo.nextDelivery ? (
                  <div>
                    Your estimated delivery date is{" "}
                    <b>{deliveryInfo.nextDelivery.toLocaleDateString()}</b>.
                  </div>
                ) : null}
              </div>
            }
          />

          <Checkbox
            checked={ackChecked}
            onChange={(e) => setAckChecked(e.target.checked)}
          >
            I acknowledge the above
          </Checkbox>
        </div>
      </Modal>
    </div>
  );
}
