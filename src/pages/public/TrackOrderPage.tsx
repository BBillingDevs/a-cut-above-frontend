import React, { useMemo, useState } from "react";
import {
  Button,
  Card,
  Form,
  Input,
  Table,
  Typography,
  message,
  Alert,
} from "antd";
import { useLocation } from "react-router-dom";
import { api } from "../../api/client";
import "../../styles/app.scss";
import type { TrackedOrder } from "../../types";
import {
  FileTextOutlined,
  InboxOutlined,
  CarOutlined,
  HomeOutlined,
  SearchOutlined,
} from "@ant-design/icons";

const { Title, Text } = Typography;

type TrackForm = {
  orderNo: string;
  contact: string;
};

function normalizeStatus(status: any) {
  const s = String(status || "")
    .toUpperCase()
    .trim();

  if (s === "OUT_FOR_DELIVERY") return "OUT_FOR_DELIVERY";
  return s;
}

function statusToStep(status: string) {
  const s = normalizeStatus(status);
  if (s === "DELIVERED") return 4;
  if (s === "OUT_FOR_DELIVERY") return 3;
  if (s === "PACKED") return 2;
  if (s === "READY_TO_PACK") return 2;
  return 1;
}

function statusLabel(status: string) {
  const s = normalizeStatus(status);
  if (s === "ORDER_PLACED") return "Order Placed";
  if (s === "READY_TO_PACK") return "Ready to Pack";
  if (s === "PACKED") return "Packed";
  if (s === "OUT_FOR_DELIVERY") return "Out on Delivery";
  if (s === "DELIVERED") return "Delivered";
  return "Order Placed";
}

function money(n: any) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return `$${x.toFixed(2)}`;
}

function formatDate(value: any) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString();
}

export default function TrackOrderPage() {
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState(null as TrackedOrder | null);
  const [form] = Form.useForm();
  const location = useLocation();

  const locationState = (location.state ?? {}) as Record<string, any>;
  const successOrderNo = locationState?.successOrderNo as string | undefined;
  const successDeliveryDate = locationState?.successDeliveryDate as
    | string
    | undefined;

  async function track(values: TrackForm) {
    setLoading(true);
    try {
      const res = await api.post("/api/public/orders/track", {
        orderNo: values.orderNo,
        contact: values.contact,
      });
      setOrder(res.data.order);
    } catch (e: any) {
      setOrder(null);
      message.error(e?.response?.data?.error || "Order not found");
    } finally {
      setLoading(false);
    }
  }

  const step = useMemo(() => (order ? statusToStep(order.status) : 1), [order]);

  const trackedDeliveryDate = useMemo(() => {
    const raw = (order as any)?.deliveryDate ?? null;
    return formatDate(raw);
  }, [order]);

  const successDeliveryDateLabel = useMemo(
    () => formatDate(successDeliveryDate),
    [successDeliveryDate],
  );

  return (
    <div className="aca-page aca-tracking">
      <div className="aca-tracking__header">
        <div>
          <Title level={2} className="aca-tracking__title">
            Track Your Order
          </Title>
          <Text className="aca-tracking__subtitle">
            Enter your order number and either your phone number or email
            address.
          </Text>
        </div>
      </div>

      {successOrderNo ? (
        <Alert
          type="success"
          showIcon
          style={{ marginBottom: 16, fontSize: 15 }}
          message={
            <span>
              Order placed successfully!{" "}
              <b style={{ fontSize: 17 }}>{successOrderNo}</b>
            </span>
          }
          description={
            <div style={{ marginTop: 4, display: "grid", gap: 6 }}>
              <Text strong style={{ color: "#237804" }}>
                Please write down your order number — you will need it to track
                your order below.
              </Text>
              {successDeliveryDateLabel ? (
                <Text>
                  Estimated delivery date: <b>{successDeliveryDateLabel}</b>
                </Text>
              ) : null}
            </div>
          }
        />
      ) : null}

      <Card className="aca-trackCard">
        <Form layout="inline" form={form} onFinish={track} style={{ gap: 12 }}>
          <Form.Item name="orderNo" rules={[{ required: true }]}>
            <Input
              prefix={<SearchOutlined />}
              placeholder="Order No (e.g. ACA-20260213-6782)"
              style={{ width: 280 }}
            />
          </Form.Item>

          <Form.Item
            name="contact"
            rules={[
              { required: true, message: "Enter your phone or email" },
              {
                validator: (_, value) => {
                  const v = String(value || "").trim();
                  if (v.length < 5) {
                    return Promise.reject(
                      "Please enter a valid phone or email",
                    );
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <Input placeholder="Phone or email" style={{ width: 240 }} />
          </Form.Item>

          <Button type="primary" htmlType="submit" loading={loading}>
            Track
          </Button>
        </Form>
      </Card>

      {order && (
        <div style={{ marginTop: 18 }}>
          <Card className="aca-trackCard">
            <div
              className="aca-steps aca-steps--lines"
              style={{ marginTop: 8 }}
            >
              <div className="aca-steps__row">
                <div
                  className={`aca-step ${step >= 1 ? "is-done" : ""} ${step === 1 ? "is-active" : ""}`}
                >
                  <div className="aca-step__dot">
                    <FileTextOutlined />
                  </div>
                  <div className="aca-step__label">Order Placed</div>
                </div>

                <div
                  className={`aca-steps__line ${step >= 2 ? "is-done" : ""}`}
                  aria-hidden
                />

                <div
                  className={`aca-step ${step >= 2 ? "is-done" : ""} ${step === 2 ? "is-active" : ""}`}
                >
                  <div className="aca-step__dot">
                    <InboxOutlined />
                  </div>
                  <div className="aca-step__label">
                    {order.status === "READY_TO_PACK"
                      ? "Ready to Pack"
                      : "Packed"}
                  </div>
                </div>

                <div
                  className={`aca-steps__line ${step >= 3 ? "is-done" : ""}`}
                  aria-hidden
                />

                <div
                  className={`aca-step ${step >= 3 ? "is-done" : ""} ${step === 3 ? "is-active" : ""}`}
                >
                  <div className="aca-step__dot">
                    <CarOutlined />
                  </div>
                  <div className="aca-step__label">Out on Delivery</div>
                </div>

                <div
                  className={`aca-steps__line ${step >= 4 ? "is-done" : ""}`}
                  aria-hidden
                />

                <div
                  className={`aca-step ${step >= 4 ? "is-done" : ""} ${step === 4 ? "is-active" : ""}`}
                >
                  <div className="aca-step__dot">
                    <HomeOutlined />
                  </div>
                  <div className="aca-step__label">Delivered</div>
                </div>
              </div>
            </div>

            <div className="aca-orderMeta">
              <div>
                <Text type="secondary">Order No</Text>
                <div className="aca-orderMeta__val">{order.orderNo}</div>
              </div>
              <div>
                <Text type="secondary">Name</Text>
                <div className="aca-orderMeta__val">{order.customerName}</div>
              </div>
              <div>
                <Text type="secondary">Status</Text>
                <div className="aca-orderMeta__val">
                  {statusLabel(order.status)}
                </div>
              </div>
              <div>
                <Text type="secondary">Created</Text>
                <div className="aca-orderMeta__val">
                  {new Date(order.createdAt).toLocaleString()}
                </div>
              </div>
              {trackedDeliveryDate ? (
                <div>
                  <Text type="secondary">Delivery Date</Text>
                  <div className="aca-orderMeta__val">
                    {trackedDeliveryDate}
                  </div>
                </div>
              ) : null}
            </div>
          </Card>

          <Card
            className="aca-trackCard"
            title="Items"
            style={{ marginTop: 14 }}
          >
            <Table
              rowKey={(r: any) => `${r.productName}-${String(r.id || "")}`}
              dataSource={order.items as any[]}
              pagination={false}
              columns={[
                {
                  title: "Product",
                  dataIndex: "productName",
                  key: "productName",
                },
                {
                  title: "Qty (packs)",
                  dataIndex: "qty",
                  key: "qty",
                  width: 120,
                  render: (v: any) => Number(v ?? 0),
                },
                {
                  title: "Cost",
                  key: "cost",
                  width: 140,
                  align: "right" as const,
                  render: (_: any, row: any) =>
                    money(row.lineTotal ?? row.total ?? row.cost),
                },
              ]}
            />
          </Card>
        </div>
      )}
    </div>
  );
}
