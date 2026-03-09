import React, { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Collapse,
  Drawer,
  Dropdown,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  message,
  Divider,
  Typography,
  Grid,
  Empty,
} from "antd";
import type { MenuProps } from "antd";
import {
  FilterOutlined,
  DownloadOutlined,
  SettingOutlined,
  FilePdfOutlined,
  CheckOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import * as XLSX from "xlsx";

import { api, API_BASE } from "../api/client";
import type {
  AdminOrder,
  AdminOrderItem,
} from "../pages/admin/AdminDashboardPage";

const { Text } = Typography;
const { useBreakpoint } = Grid;

const STATUS_OPTIONS = [
  { label: "Processing", value: "PROCESSING" },
  { label: "Packed", value: "PACKED" },
  { label: "Shipping", value: "SHIPPING" },
  { label: "Delivered", value: "DELIVERED" },
];

type DeliverySchedule = {
  id: string;
  cutoffDate: string;
  deliveryDate: string;
  dropoffLocationId: string;
  dropoffLocation: { id: string; name: string };
  _count: { orders: number };
};

type ScheduleGroup = {
  scheduleId: string;
  schedule: DeliverySchedule | null;
  orders: AdminOrder[];
};

type LocationGroup = {
  locationId: string;
  locationName: string;
  schedules: Map<string, ScheduleGroup>;
  unscheduled: AdminOrder[];
};

function money(v: any) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : "—";
}

function fmtDate(dt?: string | null) {
  if (!dt) return "—";
  const d = dayjs(dt);
  return d.isValid() ? d.format("D MMM YYYY") : "—";
}

function isKgItem(it: AdminOrderItem) {
  return String((it as any).unit || "").toLowerCase() === "kg";
}

function weightsComplete(order: AdminOrder) {
  const kgItems = (order.items || []).filter(isKgItem);
  if (kgItems.length === 0) return true;
  return kgItems.every((it) => {
    const w = (it as any).weightKg;
    return w !== null && w !== undefined && w !== "";
  });
}

function recomputeOrderClient(order: AdminOrder) {
  const nextItems = (order.items || []).map((it: any) => {
    const unit = String(it.unit || "").toLowerCase();
    const unitPrice = Number(it.unitPrice || 0);
    const qty = Number(it.qty || 0);

    if (unit === "kg") {
      const w = it.weightKg;
      const weightKg =
        w === null || w === undefined || w === "" ? null : Number(w);
      const lineTotal =
        weightKg == null || !Number.isFinite(weightKg)
          ? 0
          : unitPrice * weightKg;
      return { ...it, lineTotal };
    }

    return { ...it, lineTotal: unitPrice * qty };
  });

  const subtotal = nextItems.reduce((sum: number, it: any) => {
    const lt = Number(it.lineTotal || 0);
    return sum + (Number.isFinite(lt) ? lt : 0);
  }, 0);

  return { items: nextItems, subtotal, total: subtotal };
}

// ─── Weight cell with local state + Save button ───────────────────────────────

function WeightCell({
  item,
  isMobile,
  onWeightUpdate,
}: {
  item: AdminOrderItem;
  isMobile: boolean;
  onWeightUpdate: (itemId: string, weightKg: number | null) => Promise<void>;
}) {
  const raw = (item as any).weightKg;
  const committed =
    raw === null || raw === undefined || raw === "" ? null : Number(raw);

  const [localValue, setLocalValue] = useState(
    committed === null ? undefined : committed,
  );
  const [saving, setSaving] = useState(false);

  // Keep local state in sync when the prop changes (e.g. after reload)
  useEffect(() => {
    setLocalValue(committed === null ? undefined : committed);
  }, [committed]);

  const isDirty = localValue !== (committed === null ? undefined : committed);

  async function save() {
    setSaving(true);
    try {
      await onWeightUpdate(
        item.id,
        localValue === undefined ? null : Number(localValue),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <InputNumber
        value={localValue}
        onChange={(v) => setLocalValue(v === null ? undefined : Number(v))}
        onPressEnter={isDirty ? save : undefined}
        placeholder="kg"
        min={0}
        step={0.1}
        style={{ width: isMobile ? 90 : 100 }}
        size={isMobile ? "large" : "middle"}
      />
      <Button
        type={isDirty ? "primary" : "default"}
        size={isMobile ? "large" : "small"}
        icon={<CheckOutlined />}
        loading={saving}
        disabled={!isDirty}
        onClick={save}
      >
        {isMobile ? "" : "Save"}
      </Button>
    </div>
  );
}

// ─── Inner order table ────────────────────────────────────────────────────────

function OrderTable({
  orders,
  isMobile,
  onStatusUpdate,
  onWeightUpdate,
  onDelete,
}: {
  orders: AdminOrder[];
  isMobile: boolean;
  onStatusUpdate: (orderId: string, status: string) => Promise<void>;
  onWeightUpdate: (itemId: string, weightKg: number | null) => Promise<void>;
  onDelete: (orderId: string, orderNo: string) => Promise<void>;
}) {
  const expandedColumns = useMemo(
    () =>
      [
        {
          title: "Item",
          key: "productName",
          render: (_: any, it: AdminOrderItem) => {
            const name = String((it as any).productName || "").trim() || "Item";
            const unit = String((it as any).unit || "").toLowerCase();
            const unitPrice = (it as any).unitPrice;
            const label = unit === "kg" ? "Price / kg" : "Price / pack";
            return (
              <div style={{ display: "grid", gap: 2 }}>
                <div style={{ fontWeight: 800 }}>{name}</div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {label}:{" "}
                  <span style={{ fontWeight: 800 }}>{money(unitPrice)}</span>
                </Text>
              </div>
            );
          },
        },
        {
          title: "Qty",
          dataIndex: "qty",
          key: "qty",
          width: 80,
          render: (v: any) => Number(v || 0),
        },
        {
          title: "Weight (kg)",
          key: "weightKg",
          width: isMobile ? 180 : 200,
          render: (_: any, it: AdminOrderItem) => {
            if (!isKgItem(it)) return <Tag>Pack</Tag>;
            return (
              <WeightCell
                item={it}
                isMobile={isMobile}
                onWeightUpdate={onWeightUpdate}
              />
            );
          },
        },
        {
          title: "Line",
          key: "lineTotal",
          width: 100,
          render: (_: any, it: AdminOrderItem) => {
            const lt = Number((it as any).lineTotal || 0);
            return lt ? money(lt) : "—";
          },
        },
      ] as any[],
    [isMobile, onWeightUpdate],
  );

  const columns = useMemo(
    () =>
      [
        {
          title: "Order",
          dataIndex: "orderNo",
          key: "orderNo",
          width: isMobile ? 120 : 160,
          fixed: isMobile ? "left" : undefined,
        },
        {
          title: "Customer",
          dataIndex: "customerName",
          key: "customerName",
          width: isMobile ? 160 : 180,
          render: (v: any) => (
            <span
              style={{
                display: "block",
                maxWidth: 200,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {v}
            </span>
          ),
        },
        ...(!isMobile
          ? ([
            {
              title: "Phone",
              dataIndex: "customerPhone",
              key: "customerPhone",
              width: 140,
            },
          ] as any[])
          : []),
        {
          title: "Status",
          dataIndex: "status",
          key: "status",
          width: isMobile ? 150 : 170,
          render: (_: any, row: AdminOrder) => (
            <Select
              value={row.status}
              style={{ width: "100%" }}
              onChange={(v) => onStatusUpdate(row.id, v)}
              options={STATUS_OPTIONS}
              size={isMobile ? "large" : "middle"}
            />
          ),
        },
        {
          title: "Weights",
          key: "weights",
          width: 110,
          render: (_: any, row: AdminOrder) =>
            weightsComplete(row) ? (
              <Tag color="green">Complete</Tag>
            ) : (
              <Tag color="gold">Missing</Tag>
            ),
        },
        {
          title: "Total",
          dataIndex: "total",
          key: "total",
          width: 100,
          render: (v: any) => money(v),
        },
        ...(!isMobile
          ? ([
            {
              title: "Created",
              dataIndex: "createdAt",
              key: "createdAt",
              width: 180,
              render: (v: string) => new Date(v).toLocaleString(),
            },
          ] as any[])
          : []),
        {
          title: "",
          key: "actions",
          width: isMobile ? 80 : 100,
          render: (_: any, row: AdminOrder) => (
            <Popconfirm
              title="Delete this order?"
              description="This permanently removes the order and cannot be undone."
              onConfirm={() => onDelete(row.id, row.orderNo)}
              okText="Delete"
              okButtonProps={{ danger: true }}
            >
              <Button danger size="small">
                Delete
              </Button>
            </Popconfirm>
          ),
        },
      ] as any[],
    [isMobile],
  );

  return (
    <Table
      rowKey={(r) => r.id}
      dataSource={orders}
      columns={columns}
      size={isMobile ? "small" : "middle"}
      scroll={isMobile ? { x: 700 } : undefined}
      pagination={{ pageSize: 20, showSizeChanger: false }}
      expandable={{
        expandedRowRender: (order) => {
          const stableItems = [...(order.items || [])].sort(
            (a: any, b: any) =>
              String(a.productName || "").localeCompare(
                String(b.productName || ""),
              ) || String(a.id).localeCompare(String(b.id)),
          );
          return (
            <div style={{ padding: isMobile ? 4 : 8 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr" : "auto auto",
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <Button
                  block={isMobile}
                  icon={<FilePdfOutlined />}
                  onClick={() =>
                    window.open(
                      `${API_BASE}/api/admin/orders/${order.id}/packing-slip.pdf`,
                      "_blank",
                    )
                  }
                >
                  Packing Slip PDF
                </Button>
                <Button
                  block={isMobile}
                  icon={<FilePdfOutlined />}
                  onClick={() =>
                    window.open(
                      `${API_BASE}/api/admin/orders/${order.id}/invoice.pdf`,
                      "_blank",
                    )
                  }
                >
                  Invoice PDF
                </Button>
              </div>
              <Table
                size="small"
                rowKey={(i) => i.id}
                dataSource={stableItems}
                pagination={false}
                columns={expandedColumns}
                scroll={isMobile ? { x: 580 } : undefined}
              />
            </div>
          );
        },
      }}
    />
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OrdersTab({
  loading,
  orders,
  onReload,
}: {
  loading: boolean;
  orders: AdminOrder[];
  onReload: () => void;
}) {
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [displayOrders, setDisplayOrders] = useState([] as AdminOrder[]);
  const [schedules, setSchedules] = useState([] as DeliverySchedule[]);
  const [selectedRowKeys, setSelectedRowKeys] = useState([] as React.Key[]);

  const [filterLocationId, setFilterLocationId] = useState("");
  const [filterScheduleId, setFilterScheduleId] = useState("");

  const [bulkStatus, setBulkStatus] = useState("PROCESSING");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const [packingOpen, setPackingOpen] = useState(false);
  const [packingScheduleId, setPackingScheduleId] = useState("");

  useEffect(() => {
    const normalized = (orders || []).map((o) => ({
      ...o,
      ...recomputeOrderClient(o),
    }));
    setDisplayOrders(normalized);
  }, [orders]);

  useEffect(() => {
    api
      .get("/api/admin/delivery-schedules")
      .then((res) => setSchedules(res.data?.schedules || []))
      .catch(() => { });
  }, [orders]);

  const locationOptions = useMemo(() => {
    const seen = new Map();
    for (const s of schedules) {
      seen.set(s.dropoffLocation.id, s.dropoffLocation.name);
    }
    return Array.from(seen.entries()).map(([id, name]) => ({
      value: id,
      label: name,
    }));
  }, [schedules]);

  const scheduleOptionsForFilter = useMemo(() => {
    return schedules
      .filter(
        (s) => !filterLocationId || s.dropoffLocationId === filterLocationId,
      )
      .map((s) => ({
        value: s.id,
        label: `${s.dropoffLocation.name} — Cutoff: ${fmtDate(s.cutoffDate)} → Delivery: ${fmtDate(s.deliveryDate)}`,
      }));
  }, [schedules, filterLocationId]);

  const grouped = useMemo((): LocationGroup[] => {
    const filteredOrders = displayOrders.filter((o) => {
      const anyO = o as any;
      if (filterLocationId && anyO.dropoffLocationId !== filterLocationId)
        return false;
      if (filterScheduleId && anyO.deliveryScheduleId !== filterScheduleId)
        return false;
      return true;
    });

    const byLocation = new Map();

    for (const order of filteredOrders) {
      const anyO = order as any;
      const locId = anyO.dropoffLocationId || "unknown";
      const locName = anyO.dropoffLocation?.name || "Unknown Location";
      const schedId = anyO.deliveryScheduleId || null;

      if (!byLocation.has(locId)) {
        byLocation.set(locId, {
          locationId: locId,
          locationName: locName,
          schedules: new Map(),
          unscheduled: [],
        });
      }

      const locGroup = byLocation.get(locId);

      if (!schedId) {
        locGroup.unscheduled.push(order);
      } else {
        if (!locGroup.schedules.has(schedId)) {
          const sched = schedules.find((s) => s.id === schedId) || null;
          locGroup.schedules.set(schedId, {
            scheduleId: schedId,
            schedule: sched,
            orders: [],
          });
        }
        locGroup.schedules.get(schedId).orders.push(order);
      }
    }

    return Array.from(byLocation.values()).sort(
      (a: LocationGroup, b: LocationGroup) =>
        a.locationName.localeCompare(b.locationName),
    );
  }, [displayOrders, schedules, filterLocationId, filterScheduleId]);

  async function handleDelete(orderId: string, orderNo: string) {
    try {
      await api.delete(`/api/admin/orders/${orderId}`);
      message.success(`Order ${orderNo} deleted`);
      setDisplayOrders((prev) =>
        prev.filter((o) => String(o.id) !== String(orderId)),
      );
      onReload();
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Failed to delete order");
    }
  }

  async function handleStatusUpdate(orderId: string, status: string) {
    try {
      await api.put(`/api/admin/orders/${orderId}/status`, { status });
      setDisplayOrders((prev) =>
        prev.map((o) =>
          String(o.id) === String(orderId) ? ({ ...o, status } as any) : o,
        ),
      );
      message.success("Status updated");
      onReload();
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Status update failed");
    }
  }

  async function handleWeightUpdate(itemId: string, weightKg: number | null) {
    try {
      await api.put(`/api/admin/order-items/${itemId}/weight`, { weightKg });
      setDisplayOrders((prev) =>
        prev.map((o) => {
          const items = o.items || [];
          const idx = items.findIndex(
            (it: any) => String(it.id) === String(itemId),
          );
          if (idx === -1) return o;
          const nextItems = items.map((it: any) =>
            String(it.id) === String(itemId)
              ? { ...it, weightKg: weightKg === null ? null : Number(weightKg) }
              : it,
          );
          const nextOrder = { ...o, items: nextItems } as any;
          return { ...nextOrder, ...recomputeOrderClient(nextOrder) };
        }),
      );
      message.success("Weight saved");
      onReload();
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Weight update failed");
    }
  }

  async function applyBulkStatus() {
    if (selectedRowKeys.length === 0) {
      message.warning("Select at least one order");
      return;
    }
    setBulkLoading(true);
    try {
      await Promise.all(
        selectedRowKeys.map((id) => handleStatusUpdate(String(id), bulkStatus)),
      );
      message.success(`Updated ${selectedRowKeys.length} order(s)`);
      setSelectedRowKeys([]);
      onReload();
      setBulkOpen(false);
    } finally {
      setBulkLoading(false);
    }
  }

  function exportPackingList() {
    const ordersToExport = packingScheduleId
      ? displayOrders.filter(
        (o) => (o as any).deliveryScheduleId === packingScheduleId,
      )
      : displayOrders;

    const targetSchedule = packingScheduleId
      ? schedules.find((s) => s.id === packingScheduleId)
      : null;

    if (!ordersToExport.length) {
      message.warning("No orders to export");
      return;
    }

    const productSet = new Set();
    for (const o of ordersToExport) {
      for (const it of o.items || []) {
        const name = String((it as any).productName || "").trim();
        if (name) productSet.add(name);
      }
    }
    const productNames = Array.from(productSet as Set<string>).sort((a, b) =>
      a.localeCompare(b),
    );
    const headers = ["Customer", "Phone", "Order No", ...productNames];
    const rows: any[][] = [];
    const totals: Record<string, number> = {};
    for (const p of productNames) totals[p] = 0;

    for (const o of ordersToExport) {
      const row: any[] = [
        o.customerName ?? "",
        o.customerPhone ?? "",
        o.orderNo ?? "",
      ];
      const qtyByProduct: Record<string, number> = {};
      for (const it of o.items || []) {
        const name = String((it as any).productName || "").trim();
        if (!name) continue;
        const qty = Number((it as any).qty || 0);
        qtyByProduct[name] =
          (qtyByProduct[name] || 0) + (Number.isFinite(qty) ? qty : 0);
      }
      for (const p of productNames) {
        const q = qtyByProduct[p] || 0;
        row.push(q);
        totals[p] += q;
      }
      rows.push(row);
    }

    const totalsRow = [
      "TOTALS",
      "",
      "",
      ...productNames.map((p) => totals[p] || 0),
    ];
    const aoa = [headers, ...rows, [], totalsRow];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    (ws as any)["!cols"] = [
      { wch: 22 },
      { wch: 16 },
      { wch: 18 },
      ...productNames.map((p) => ({
        wch: Math.max(12, Math.min(32, p.length + 2)),
      })),
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Packing List");

    const label = targetSchedule
      ? `${targetSchedule.dropoffLocation.name}_cutoff-${fmtDate(targetSchedule.cutoffDate)}_delivery-${fmtDate(targetSchedule.deliveryDate)}`
        .replace(/\s+/g, "-")
        .replace(/,/g, "")
      : `all_${dayjs().format("YYYY-MM-DD")}`;

    XLSX.writeFile(wb, `packing-list_${label}.xlsx`);
    message.success(`Exported ${ordersToExport.length} orders`);
    setPackingOpen(false);
  }

  const moreMenuItems: MenuProps["items"] = [
    {
      key: "bulk",
      label: "Bulk status",
      icon: <SettingOutlined />,
      onClick: () => setBulkOpen(true),
    },
    {
      key: "packing",
      label: "Packing list",
      icon: <DownloadOutlined />,
      onClick: () => setPackingOpen(true),
    },
  ];

  const collapseItems = useMemo(() => {
    return grouped.map((locGroup) => {
      const scheduleEntries = Array.from(locGroup.schedules.values()).sort(
        (a, b) => {
          const dateA = a.schedule?.cutoffDate ?? "";
          const dateB = b.schedule?.cutoffDate ?? "";
          return dateA.localeCompare(dateB);
        },
      );

      const locationChildren = [
        ...scheduleEntries.map((schedGroup) => {
          const sched = schedGroup.schedule;
          const panelLabel = sched
            ? `Cutoff: ${fmtDate(sched.cutoffDate)} → Delivery: ${fmtDate(sched.deliveryDate)}`
            : "Unknown schedule";
          const orderTotal = schedGroup.orders.reduce(
            (s, o) => s + Number((o as any).total || 0),
            0,
          );

          return {
            key: schedGroup.scheduleId,
            label: (
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  flexWrap: "wrap" as const,
                }}
              >
                <Text strong>{panelLabel}</Text>
                <Tag color="blue">{schedGroup.orders.length} orders</Tag>
                <Tag color="green">{money(orderTotal)}</Tag>
              </div>
            ),
            children: (
              <OrderTable
                orders={schedGroup.orders}
                isMobile={isMobile}
                onStatusUpdate={handleStatusUpdate}
                onWeightUpdate={handleWeightUpdate}
                onDelete={handleDelete}
              />
            ),
          };
        }),
        ...(locGroup.unscheduled.length > 0
          ? [
            {
              key: `${locGroup.locationId}__unscheduled`,
              label: (
                <div
                  style={{ display: "flex", gap: 10, alignItems: "center" }}
                >
                  <Text strong>Unscheduled</Text>
                  <Tag color="orange">
                    {locGroup.unscheduled.length} orders
                  </Tag>
                </div>
              ),
              children: (
                <OrderTable
                  orders={locGroup.unscheduled}
                  isMobile={isMobile}
                  onStatusUpdate={handleStatusUpdate}
                  onWeightUpdate={handleWeightUpdate}
                  onDelete={handleDelete}
                />
              ),
            },
          ]
          : []),
      ];

      const totalOrders =
        locGroup.unscheduled.length +
        Array.from(locGroup.schedules.values()).reduce(
          (s, g) => s + g.orders.length,
          0,
        );

      return {
        key: locGroup.locationId,
        label: (
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Text strong style={{ fontSize: 15 }}>
              {locGroup.locationName}
            </Text>
            <Tag color="blue">{totalOrders} orders</Tag>
          </div>
        ),
        children:
          locationChildren.length > 0 ? (
            <Collapse
              size="small"
              items={locationChildren}
              defaultActiveKey={locationChildren.map((c) => c.key)}
            />
          ) : (
            <Empty
              description="No orders"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ),
      };
    });
  }, [grouped, isMobile]);

  return (
    <Card
      title="Orders"
      loading={loading}
      extra={
        isMobile ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Dropdown menu={{ items: moreMenuItems }} trigger={["click"]}>
              <Button icon={<FilterOutlined />}>Actions</Button>
            </Dropdown>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              alignItems: "flex-end",
            }}
          >
            <Space wrap>
              <Select
                allowClear
                placeholder="Filter by location"
                style={{ width: 200 }}
                value={filterLocationId || undefined}
                onChange={(v) => {
                  setFilterLocationId(v || "");
                  setFilterScheduleId("");
                }}
                options={locationOptions}
              />
              <Select
                allowClear
                placeholder="Filter by schedule"
                style={{ width: 360 }}
                value={filterScheduleId || undefined}
                onChange={(v) => setFilterScheduleId(v || "")}
                options={scheduleOptionsForFilter}
              />
              <Button onClick={onReload}>Refresh</Button>
            </Space>

            <Divider style={{ margin: 0 }} />

            <Space wrap>
              <Tag color="gold">Bulk status</Tag>
              <Select
                value={bulkStatus}
                onChange={setBulkStatus}
                style={{ width: 160 }}
                options={STATUS_OPTIONS}
              />
              <Button
                type="primary"
                onClick={applyBulkStatus}
                loading={bulkLoading}
                disabled={selectedRowKeys.length === 0}
              >
                Apply to selected ({selectedRowKeys.length})
              </Button>

              <Divider type="vertical" />

              <Tag color="blue">Packing list</Tag>
              <Select
                allowClear
                placeholder="All schedules"
                style={{ width: 300 }}
                value={packingScheduleId || undefined}
                onChange={(v) => setPackingScheduleId(v || "")}
                options={schedules.map((s) => ({
                  value: s.id,
                  label: `${s.dropoffLocation.name} — ${fmtDate(s.cutoffDate)} → ${fmtDate(s.deliveryDate)}`,
                }))}
              />
              <Button
                onClick={exportPackingList}
                icon={<DownloadOutlined />}
                disabled={!displayOrders.length}
              >
                Export Excel
              </Button>
            </Space>
          </div>
        )
      }
      styles={{ body: { padding: isMobile ? 8 : 16 } }}
    >
      {grouped.length === 0 ? (
        <Empty
          description="No orders found"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <Collapse
          items={collapseItems}
          defaultActiveKey={grouped.map((g) => g.locationId)}
        />
      )}

      <Drawer
        title="Bulk status"
        placement="bottom"
        height="50vh"
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
      >
        <div style={{ display: "grid", gap: 12 }}>
          <Select
            value={bulkStatus}
            onChange={setBulkStatus}
            style={{ width: "100%" }}
            size="large"
            options={STATUS_OPTIONS}
          />
          <Button
            type="primary"
            size="large"
            onClick={applyBulkStatus}
            loading={bulkLoading}
            block
          >
            Apply to selected
          </Button>
        </div>
      </Drawer>

      <Drawer
        title="Export packing list"
        placement="bottom"
        height="60vh"
        open={packingOpen}
        onClose={() => setPackingOpen(false)}
      >
        <div style={{ display: "grid", gap: 12 }}>
          <Select
            allowClear
            placeholder="All schedules"
            style={{ width: "100%" }}
            value={packingScheduleId || undefined}
            onChange={(v) => setPackingScheduleId(v || "")}
            options={schedules.map((s) => ({
              value: s.id,
              label: `${s.dropoffLocation.name} — ${fmtDate(s.cutoffDate)} → ${fmtDate(s.deliveryDate)}`,
            }))}
            size="large"
          />
          <Button
            type="primary"
            size="large"
            onClick={exportPackingList}
            icon={<DownloadOutlined />}
            block
          >
            Export Excel
          </Button>
        </div>
      </Drawer>
    </Card>
  );
}
