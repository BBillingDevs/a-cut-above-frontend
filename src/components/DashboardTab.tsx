// src/components/DashboardTab.tsx
import React, { useMemo, useState } from "react";
import {
  Card,
  Col,
  DatePicker,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs, { Dayjs } from "dayjs";
import {
  BarChart,
  Bar,
  CartesianGrid,
  Legend,
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type {
  AdminOrder,
  AdminProduct,
  AdminWindow,
  AdminOrderItem,
} from "../pages/admin/AdminDashboardPage";

const { RangePicker } = DatePicker;
const { Text } = Typography;

function n(v: any): number {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

function money(v: number) {
  return `$${v.toFixed(2)}`;
}

function statusColor(s: string) {
  const k = String(s || "").toUpperCase();
  if (k === "DELIVERED") return "green";
  if (k === "SHIPPING") return "blue";
  if (k === "PACKED") return "gold";
  return "default";
}

function isKgItem(it: AdminOrderItem) {
  return String((it as any).unit || "").toLowerCase() === "kg";
}

/**
 * ✅ Same rule as OrdersTab:
 * Only treat totals as valid once ALL kg items have weightKg.
 */
function weightsComplete(order: AdminOrder) {
  const kgItems = (order.items || []).filter(isKgItem);
  if (kgItems.length === 0) return true;
  return kgItems.every((it) => {
    const w = (it as any).weightKg;
    return w !== null && w !== undefined && w !== "";
  });
}

/**
 * ✅ Money is ONLY trusted if weights are complete.
 * We DO NOT compute unitPrice * qty OR unitPrice * weightKg here.
 * We trust the backend's computed totals (order.total, item.lineTotal)
 * ONLY after weights are complete.
 */
function moneyReady(order: AdminOrder) {
  return weightsComplete(order);
}

type TopProductRow = {
  key: string;
  productName: string;
  qty: number;
  revenue: number; // ✅ only from backend (lineTotal), only when moneyReady(order)
};

type TopCustomerRow = {
  key: string;
  customerName: string;
  customerPhone: string;
  orders: number;
  spend: number; // ✅ only from backend (order.total), only when moneyReady(order)
};

export default function DashboardTab({
  loading,
  orders,
  products,
  windows,
}: {
  loading: boolean;
  orders: AdminOrder[];
  products: AdminProduct[];
  windows: AdminWindow[];
}) {
  // Filters
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>([
    dayjs().subtract(30, "day").startOf("day"),
    dayjs().endOf("day"),
  ]);
  const [windowId, setWindowId] = useState<string | undefined>(undefined);

  const windowOptions = useMemo(
    () => [
      { label: "All windows", value: "" },
      ...windows.map((w) => ({ label: w.name, value: w.id })),
    ],
    [windows],
  );

  const filteredOrders = useMemo(() => {
    let list = [...(orders || [])];

    // Window filter
    if (windowId) {
      list = list.filter((o) => String(o.windowId || "") === String(windowId));
    }

    // Date range filter (createdAt)
    if (range && (range[0] || range[1])) {
      const start = range[0]?.startOf("day") ?? null;
      const end = range[1]?.endOf("day") ?? null;

      list = list.filter((o) => {
        const t = dayjs(o.createdAt);
        if (start && t.isBefore(start)) return false;
        if (end && t.isAfter(end)) return false;
        return true;
      });
    }

    return list;
  }, [orders, range, windowId]);

  // ✅ Money-ready subset
  const moneyReadyOrders = useMemo(
    () => filteredOrders.filter((o) => moneyReady(o)),
    [filteredOrders],
  );

  // Basic KPIs (✅ revenue uses ONLY backend totals AND ONLY when moneyReady)
  const kpis = useMemo(() => {
    const totalOrders = filteredOrders.length;
    const moneyOrders = moneyReadyOrders.length;

    const revenue = moneyReadyOrders.reduce((acc, o) => acc + n(o.total), 0);
    const avgOrder = moneyOrders ? revenue / moneyOrders : 0;

    const itemsSold = filteredOrders.reduce((acc, o) => {
      const sum = (o.items || []).reduce((a, it) => a + n((it as any).qty), 0);
      return acc + sum;
    }, 0);

    const statusCounts: Record<string, number> = {};
    for (const o of filteredOrders) {
      const s = String(o.status || "PROCESSING").toUpperCase();
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    }

    const delivered = statusCounts["DELIVERED"] || 0;
    const deliveredPct = totalOrders ? (delivered / totalOrders) * 100 : 0;

    const activeProducts = (products || []).filter(
      (p) => !!(p as any).isActive,
    ).length;
    const totalProducts = (products || []).length;

    const pendingWeights = totalOrders - moneyOrders;

    return {
      totalOrders,
      revenue, // ✅ only finalized
      avgOrder, // ✅ avg over finalized orders only
      itemsSold,
      statusCounts,
      deliveredPct,
      activeProducts,
      totalProducts,
      moneyOrders,
      pendingWeights,
    };
  }, [filteredOrders, moneyReadyOrders, products]);

  // Sales over time (daily) ✅ revenue = sum(order.total) but ONLY for moneyReady orders
  const salesSeries = useMemo(() => {
    const byDay: Record<
      string,
      { day: string; revenue: number; orders: number }
    > = {};

    for (const o of filteredOrders) {
      const day = dayjs(o.createdAt).format("YYYY-MM-DD");
      if (!byDay[day]) byDay[day] = { day, revenue: 0, orders: 0 };

      // chart "orders" count can still reflect all orders
      byDay[day].orders += 1;

      // revenue only if ready
      if (moneyReady(o)) byDay[day].revenue += n(o.total);
    }

    return Object.values(byDay).sort((a, b) => a.day.localeCompare(b.day));
  }, [filteredOrders]);

  // Orders by status for chart
  const statusSeries = useMemo(() => {
    const keys = ["PROCESSING", "PACKED", "SHIPPING", "DELIVERED"];
    return keys.map((k) => ({ status: k, count: kpis.statusCounts[k] || 0 }));
  }, [kpis.statusCounts]);

  // Best sellers (qty + revenue)
  // ✅ revenue only uses backend lineTotal AND ONLY when moneyReady(order)
  const topProducts = useMemo(() => {
    const map = new Map<
      string,
      { productName: string; qty: number; revenue: number }
    >();

    for (const o of filteredOrders) {
      const canCountMoney = moneyReady(o);

      for (const it of (o.items || []) as any[]) {
        const name = String(it.productName || "").trim() || "Unknown";
        const qty = n(it.qty);

        const cur = map.get(name) || { productName: name, qty: 0, revenue: 0 };
        cur.qty += qty;

        // ✅ only trust backend-computed lineTotal when order is money-ready
        if (canCountMoney) cur.revenue += n(it.lineTotal);

        map.set(name, cur);
      }
    }

    return Array.from(map.values())
      .map((x) => ({
        key: x.productName,
        productName: x.productName,
        qty: x.qty,
        revenue: x.revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filteredOrders]);

  const topProductsByQty = useMemo(
    () => [...topProducts].sort((a, b) => b.qty - a.qty).slice(0, 10),
    [topProducts],
  );
  const topProductsByRevenue = useMemo(
    () => [...topProducts].slice(0, 10),
    [topProducts],
  );

  // Top customers ✅ spend only from backend totals, only when moneyReady(order)
  const topCustomers = useMemo(() => {
    const map = new Map<
      string,
      {
        customerName: string;
        customerPhone: string;
        orders: number;
        spend: number;
      }
    >();

    for (const o of filteredOrders) {
      const key = `${String(o.customerName || "").trim()}|${String(
        o.customerPhone || "",
      ).trim()}`;

      const cur = map.get(key) || {
        customerName: String(o.customerName || "Unknown"),
        customerPhone: String(o.customerPhone || ""),
        orders: 0,
        spend: 0,
      };

      cur.orders += 1;

      // ✅ only count spend if order is money-ready
      if (moneyReady(o)) cur.spend += n(o.total);

      map.set(key, cur);
    }

    return Array.from(map.values())
      .map((x) => ({
        key: `${x.customerName}|${x.customerPhone}`,
        customerName: x.customerName,
        customerPhone: x.customerPhone,
        orders: x.orders,
        spend: x.spend,
      }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 10);
  }, [filteredOrders]);

  const topProductCols: ColumnsType<TopProductRow> = [
    { title: "Product", dataIndex: "productName", key: "productName" },
    {
      title: "Qty sold",
      dataIndex: "qty",
      key: "qty",
      width: 120,
      render: (v) => Number(v || 0).toFixed(0),
    },
    {
      title: "Revenue (finalized)",
      dataIndex: "revenue",
      key: "revenue",
      width: 170,
      render: (v) => money(n(v)),
    },
  ];

  const topCustomerCols: ColumnsType<TopCustomerRow> = [
    { title: "Customer", dataIndex: "customerName", key: "customerName" },
    {
      title: "Phone",
      dataIndex: "customerPhone",
      key: "customerPhone",
      width: 140,
    },
    { title: "Orders", dataIndex: "orders", key: "orders", width: 100 },
    {
      title: "Spend (finalized)",
      dataIndex: "spend",
      key: "spend",
      width: 170,
      render: (v) => money(n(v)),
    },
  ];

  // Quick range presets
  function setPreset(preset: "7" | "30" | "this_month" | "all") {
    if (preset === "all") {
      setRange([null, null]);
      return;
    }
    if (preset === "7")
      setRange([
        dayjs().subtract(7, "day").startOf("day"),
        dayjs().endOf("day"),
      ]);
    if (preset === "30")
      setRange([
        dayjs().subtract(30, "day").startOf("day"),
        dayjs().endOf("day"),
      ]);
    if (preset === "this_month")
      setRange([dayjs().startOf("month"), dayjs().endOf("day")]);
  }

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      {/* Filters */}
      <Card className="aca-card">
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} md={10}>
            <Space wrap>
              <Text type="secondary">Date range:</Text>
              <RangePicker
                value={range as any}
                onChange={(v) => setRange(v as any)}
                allowEmpty={[true, true]}
                placeholder={["Start", "End"]}
              />
            </Space>
          </Col>

          <Col xs={24} md={8}>
            <Space wrap>
              <Text type="secondary">Window:</Text>
              <Select
                style={{ width: 260 }}
                value={windowId ?? ""}
                onChange={(v) => setWindowId(v || undefined)}
                options={windowOptions}
              />
            </Space>
          </Col>

          <Col
            xs={24}
            md={6}
            style={{ display: "flex", justifyContent: "flex-end" }}
          >
            <Space wrap>
              <Tag onClick={() => setPreset("7")} style={{ cursor: "pointer" }}>
                Last 7 days
              </Tag>
              <Tag
                onClick={() => setPreset("30")}
                style={{ cursor: "pointer" }}
              >
                Last 30 days
              </Tag>
              <Tag
                onClick={() => setPreset("this_month")}
                style={{ cursor: "pointer" }}
              >
                This month
              </Tag>
              <Tag
                onClick={() => setPreset("all")}
                style={{ cursor: "pointer" }}
              >
                All time
              </Tag>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* KPI Row */}
      <Row gutter={[12, 12]}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="aca-card" loading={loading}>
            <Statistic
              title="Revenue (finalized)"
              value={money(kpis.revenue)}
            />
            <div style={{ marginTop: 6, opacity: 0.75, fontSize: 12 }}>
              Uses backend totals only after kg weights are complete
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card className="aca-card" loading={loading}>
            <Statistic title="Orders" value={kpis.totalOrders} />
            <div style={{ marginTop: 6, opacity: 0.75, fontSize: 12 }}>
              Finalized: <b>{kpis.moneyOrders}</b> · Pending weights:{" "}
              <b>{kpis.pendingWeights}</b>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card className="aca-card" loading={loading}>
            <Statistic
              title="Avg order value (finalized)"
              value={money(kpis.avgOrder)}
            />
            <div style={{ marginTop: 6, opacity: 0.75, fontSize: 12 }}>
              Average over finalized orders only
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card className="aca-card" loading={loading}>
            <Statistic
              title="Items sold (packs)"
              value={Math.round(kpis.itemsSold)}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[12, 12]}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="aca-card" loading={loading}>
            <Statistic
              title="Delivered %"
              value={kpis.deliveredPct}
              precision={1}
              suffix="%"
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card className="aca-card" loading={loading}>
            <Statistic
              title="Active products"
              value={kpis.activeProducts}
              suffix={` / ${kpis.totalProducts}`}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={12}>
          <Card className="aca-card" loading={loading}>
            <Space wrap>
              {["PROCESSING", "PACKED", "SHIPPING", "DELIVERED"].map((s) => (
                <Tag key={s} color={statusColor(s)}>
                  {s}: {kpis.statusCounts[s] || 0}
                </Tag>
              ))}
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Charts */}
      <Row gutter={[12, 12]}>
        <Col xs={24} lg={14}>
          <Card
            className="aca-card"
            title="Revenue over time (finalized only)"
            loading={loading}
          >
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <LineChart data={salesSeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="day"
                    tickFormatter={(v) => String(v).slice(5)}
                  />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue (finalized)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="orders"
                    name="Orders"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card className="aca-card" title="Orders by status" loading={loading}>
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={statusSeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="status" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="Orders" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Best sellers + customers */}
      <Row gutter={[12, 12]}>
        <Col xs={24} lg={12}>
          <Card
            className="aca-card"
            title="Best sellers (by finalized revenue)"
            loading={loading}
          >
            <Table
              size="small"
              rowKey="key"
              pagination={false}
              columns={topProductCols}
              dataSource={topProductsByRevenue}
            />
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            className="aca-card"
            title="Best sellers (by qty)"
            loading={loading}
          >
            <Table
              size="small"
              rowKey="key"
              pagination={false}
              columns={topProductCols}
              dataSource={topProductsByQty}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[12, 12]}>
        <Col xs={24}>
          <Card
            className="aca-card"
            title="Top customers (finalized spend)"
            loading={loading}
          >
            <Table
              size="small"
              rowKey="key"
              pagination={false}
              columns={topCustomerCols}
              dataSource={topCustomers}
            />
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
