// src/pages/public/TrackOrderPage.tsx
import React, { useMemo, useState } from "react";
import { Button, Card, Form, Input, Table, Typography, message } from "antd";
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

type TrackForm = { orderNo: string; phone: string };

function normalizeStatus(status: any) {
  const s = String(status || "")
    .toUpperCase()
    .trim();
  if (s === "OUT_FOR_DELIVERY") return "SHIPPING";
  return s;
}

function statusToStep(status: string) {
  const s = normalizeStatus(status);
  if (s === "DELIVERED") return 4;
  if (s === "SHIPPING") return 3;
  if (s === "PACKED") return 2;
  return 1; // PROCESSING
}

function money(n: any) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return `$${x.toFixed(2)}`;
}

export default function TrackOrderPage() {
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [form] = Form.useForm<TrackForm>();

  async function track(values: TrackForm) {
    setLoading(true);
    try {
      const res = await api.post("/api/public/orders/track", values);
      setOrder(res.data.order);
    } catch (e: any) {
      setOrder(null);
      message.error(e?.response?.data?.error || "Order not found");
    } finally {
      setLoading(false);
    }
  }

  const step = useMemo(() => (order ? statusToStep(order.status) : 1), [order]);

  return (
    <div className="aca-page aca-tracking">
      <div className="aca-tracking__header">
        <div>
          <Title level={2} className="aca-tracking__title">
            Track Your Order
          </Title>
          <Text className="aca-tracking__subtitle">
            Enter your order number and phone to view status.
          </Text>
        </div>
      </div>

      <Card className="aca-trackCard">
        <Form layout="inline" form={form} onFinish={track} style={{ gap: 12 }}>
          <Form.Item name="orderNo" rules={[{ required: true }]}>
            <Input
              prefix={<SearchOutlined />}
              placeholder="Order No (e.g. ACA-20260213-6782)"
              style={{ width: 280 }}
            />
          </Form.Item>
          <Form.Item name="phone" rules={[{ required: true }]}>
            <Input placeholder="Phone" style={{ width: 200 }} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            Track
          </Button>
        </Form>
      </Card>

      {order && (
        <div style={{ marginTop: 18 }}>
          <Card className="aca-trackCard">
            {/* ✅ NO “Status: Delivered” bar */}

            {/* ✅ Lines between circles */}
            <div
              className="aca-steps aca-steps--lines"
              style={{ marginTop: 8 }}
            >
              <div className="aca-steps__row">
                <div
                  className={`aca-step ${step >= 1 ? "is-done" : ""} ${
                    step === 1 ? "is-active" : ""
                  }`}
                >
                  <div className="aca-step__dot">
                    <FileTextOutlined />
                  </div>
                  <div className="aca-step__label">Processing</div>
                </div>

                <div
                  className={`aca-steps__line ${step >= 2 ? "is-done" : ""}`}
                  aria-hidden
                />

                <div
                  className={`aca-step ${step >= 2 ? "is-done" : ""} ${
                    step === 2 ? "is-active" : ""
                  }`}
                >
                  <div className="aca-step__dot">
                    <InboxOutlined />
                  </div>
                  <div className="aca-step__label">Packed</div>
                </div>

                <div
                  className={`aca-steps__line ${step >= 3 ? "is-done" : ""}`}
                  aria-hidden
                />

                <div
                  className={`aca-step ${step >= 3 ? "is-done" : ""} ${
                    step === 3 ? "is-active" : ""
                  }`}
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
                  className={`aca-step ${step >= 4 ? "is-done" : ""} ${
                    step === 4 ? "is-active" : ""
                  }`}
                >
                  <div className="aca-step__dot">
                    <HomeOutlined />
                  </div>
                  <div className="aca-step__label">Delivered</div>
                </div>
              </div>
            </div>

            {/* ✅ One row, NO pricing */}
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
                <Text type="secondary">Phone</Text>
                <div className="aca-orderMeta__val">{order.customerPhone}</div>
              </div>
              <div>
                <Text type="secondary">Created</Text>
                <div className="aca-orderMeta__val">
                  {new Date(order.createdAt).toLocaleString()}
                </div>
              </div>
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
