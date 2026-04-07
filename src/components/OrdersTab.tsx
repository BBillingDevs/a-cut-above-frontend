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
  Switch,
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

const { Text, Title } = Typography;
const { useBreakpoint } = Grid;

const STATUS_OPTIONS = [
  { label: "Order Placed", value: "ORDER_PLACED" },
  { label: "Ready to Pack", value: "READY_TO_PACK" },
  { label: "Packed", value: "PACKED" },
  { label: "Out for Delivery", value: "OUT_FOR_DELIVERY" },
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

function WeightCell({
  item,
  isMobile,
  onWeightUpdate,
}: {
  item: AdminOrderItem;
  isMobile: boolean;
  onWeightUpdate: (
    itemId: string,
    weightValue: number | null,
    weightUnit: "kg" | "g",
  ) => Promise<void>;
}) {
  const raw = (item as any).weightKg;
  const committedKg =
    raw === null || raw === undefined || raw === "" ? null : Number(raw);

  const [localValue, setLocalValue] = useState<number | undefined>(
    committedKg === null ? undefined : committedKg,
  );
  const [localUnit, setLocalUnit] = useState<"kg" | "g">("kg");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocalValue(committedKg === null ? undefined : committedKg);
    setLocalUnit("kg");
  }, [committedKg]);

  const normalizedLocalKg =
    localValue === undefined
      ? undefined
      : localUnit === "g"
        ? Number(localValue) / 1000
        : Number(localValue);

  const normalizedCommittedKg = committedKg === null ? undefined : committedKg;

  const isDirty =
    normalizedLocalKg !== normalizedCommittedKg || localUnit !== "kg";

  async function save() {
    setSaving(true);
    try {
      await onWeightUpdate(
        item.id,
        localValue === undefined ? null : Number(localValue),
        localUnit,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <InputNumber
        value={localValue}
        onChange={(v) => setLocalValue(v === null ? undefined : Number(v))}
        onPressEnter={isDirty ? save : undefined}
        placeholder={localUnit}
        min={0}
        step={localUnit === "g" ? 1 : 0.1}
        style={{ width: isMobile ? 90 : 100 }}
        size={isMobile ? "large" : "middle"}
      />

      <Select
        value={localUnit}
        onChange={(v) => setLocalUnit(v)}
        style={{ width: 76 }}
        size={isMobile ? "large" : "middle"}
        options={[
          { label: "kg", value: "kg" },
          { label: "g", value: "g" },
        ]}
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

function OrderTable({
  orders,
  isMobile,
  expandedRowKeys,
  onExpandedRowKeysChange,
  onStatusUpdate,
  onWeightUpdate,
  onDelete,
  selectedRowKeys,
  onSelectedRowKeysChange,
}: {
  orders: AdminOrder[];
  isMobile: boolean;
  expandedRowKeys: React.Key[];
  onExpandedRowKeysChange: (keys: React.Key[]) => void;
  onStatusUpdate: (orderId: string, status: string) => Promise<void>;
  onWeightUpdate: (
    itemId: string,
    weightValue: number | null,
    weightUnit: "kg" | "g",
  ) => Promise<void>;
  onDelete: (orderId: string, orderNo: string) => Promise<void>;
  selectedRowKeys: React.Key[];
  onSelectedRowKeysChange: (keys: React.Key[]) => void;
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
          title: "Weight",
          key: "weightKg",
          width: isMobile ? 210 : 240,
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
          width: isMobile ? 170 : 190,
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
    [isMobile, onDelete, onStatusUpdate],
  );

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => onSelectedRowKeysChange(keys),
    preserveSelectedRowKeys: true,
  };

  return (
    <Table
      rowKey={(r) => r.id}
      rowSelection={rowSelection}
      dataSource={orders}
      columns={columns}
      size={isMobile ? "small" : "middle"}
      scroll={isMobile ? { x: 760 } : undefined}
      pagination={{ pageSize: 20, showSizeChanger: false }}
      expandable={{
        expandedRowKeys,
        onExpandedRowsChange: (keys) => onExpandedRowKeysChange(keys),
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
                scroll={isMobile ? { x: 620 } : undefined}
              />
            </div>
          );
        },
      }}
    />
  );
}

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

  const [bulkStatus, setBulkStatus] = useState("ORDER_PLACED");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const [sendWhatsApp, setSendWhatsApp] = useState(true);

  const [packingOpen, setPackingOpen] = useState(false);
  const [packingScheduleId, setPackingScheduleId] = useState("");

  const [deliveryRunOpen, setDeliveryRunOpen] = useState(false);
  const [deliveryRunScheduleId, setDeliveryRunScheduleId] = useState("");
  const [deliveryRunLocationId, setDeliveryRunLocationId] = useState("");

  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);

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
    const seen = new Map<string, string>();
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

  const deliveryRunScheduleOptions = useMemo(() => {
    return schedules
      .filter(
        (s) =>
          !deliveryRunLocationId ||
          s.dropoffLocationId === deliveryRunLocationId,
      )
      .map((s) => ({
        value: s.id,
        label: `${s.dropoffLocation.name} — ${fmtDate(s.cutoffDate)} → ${fmtDate(s.deliveryDate)}`,
      }));
  }, [schedules, deliveryRunLocationId]);

  const grouped = useMemo((): LocationGroup[] => {
    const filteredOrders = displayOrders.filter((o) => {
      const anyO = o as any;
      if (filterLocationId && anyO.dropoffLocationId !== filterLocationId)
        return false;
      if (filterScheduleId && anyO.deliveryScheduleId !== filterScheduleId)
        return false;
      return true;
    });

    const byLocation = new Map<string, LocationGroup>();

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

      const locGroup = byLocation.get(locId)!;

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
        locGroup.schedules.get(schedId)!.orders.push(order);
      }
    }

    return Array.from(byLocation.values()).sort((a, b) =>
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
      setExpandedRowKeys((prev) =>
        prev.filter((k) => String(k) !== String(orderId)),
      );
      setSelectedRowKeys((prev) =>
        prev.filter((k) => String(k) !== String(orderId)),
      );
      onReload();
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Failed to delete order");
    }
  }

  async function handleStatusUpdate(orderId: string, status: string) {
    try {
      await api.put(`/api/admin/orders/${orderId}/status`, {
        status,
        sendWhatsApp,
      });

      setDisplayOrders((prev) =>
        prev.map((o) =>
          String(o.id) === String(orderId) ? ({ ...o, status } as any) : o,
        ),
      );

      message.success("Status updated");
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Status update failed");
    }
  }

  async function handleWeightUpdate(
    itemId: string,
    weightValue: number | null,
    weightUnit: "kg" | "g",
  ) {
    const affectedOrder = displayOrders.find((o) =>
      (o.items || []).some((it: any) => String(it.id) === String(itemId)),
    );
    const affectedOrderId = affectedOrder?.id;

    try {
      await api.put(`/api/admin/order-items/${itemId}/weight`, {
        weightValue,
        weightUnit,
      });

      setDisplayOrders((prev) =>
        prev.map((o) => {
          const items = o.items || [];
          const idx = items.findIndex(
            (it: any) => String(it.id) === String(itemId),
          );
          if (idx === -1) return o;

          const normalizedKg =
            weightValue === null
              ? null
              : weightUnit === "g"
                ? Number(weightValue) / 1000
                : Number(weightValue);

          const nextItems = items.map((it: any) =>
            String(it.id) === String(itemId)
              ? {
                ...it,
                weightKg: normalizedKg === null ? null : Number(normalizedKg),
              }
              : it,
          );

          const nextOrder = { ...o, items: nextItems } as any;
          return { ...nextOrder, ...recomputeOrderClient(nextOrder) };
        }),
      );

      if (affectedOrderId) {
        setExpandedRowKeys((prev) =>
          prev.includes(affectedOrderId) ? prev : [...prev, affectedOrderId],
        );
      }

      message.success("Weight saved");
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
      await api.put("/api/admin/orders/status/bulk", {
        ids: selectedRowKeys.map(String),
        status: bulkStatus,
        sendWhatsApp,
      });

      setDisplayOrders((prev) =>
        prev.map((o) =>
          selectedRowKeys.includes(o.id)
            ? ({ ...o, status: bulkStatus } as any)
            : o,
        ),
      );

      message.success(`Updated ${selectedRowKeys.length} order(s)`);
      setSelectedRowKeys([]);
      setBulkOpen(false);
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Bulk status update failed");
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

    const productSet = new Set<string>();
    for (const o of ordersToExport) {
      for (const it of o.items || []) {
        const name = String((it as any).productName || "").trim();
        if (name) productSet.add(name);
      }
    }

    const productNames = Array.from(productSet).sort((a, b) =>
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

  function exportDeliveryRunPdf() {
    const params = new URLSearchParams();
    if (deliveryRunLocationId) params.set("locationId", deliveryRunLocationId);
    if (deliveryRunScheduleId) params.set("scheduleId", deliveryRunScheduleId);

    window.open(
      `${API_BASE}/api/admin/orders/delivery-run.pdf?${params.toString()}`,
      "_blank",
    );
    setDeliveryRunOpen(false);
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
    {
      key: "delivery-run-pdf",
      label: "Delivery Run PDF",
      icon: <FilePdfOutlined />,
      onClick: () => setDeliveryRunOpen(true),
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
                expandedRowKeys={expandedRowKeys}
                onExpandedRowKeysChange={setExpandedRowKeys}
                onStatusUpdate={handleStatusUpdate}
                onWeightUpdate={handleWeightUpdate}
                onDelete={handleDelete}
                selectedRowKeys={selectedRowKeys}
                onSelectedRowKeysChange={setSelectedRowKeys}
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
                  expandedRowKeys={expandedRowKeys}
                  onExpandedRowKeysChange={setExpandedRowKeys}
                  onStatusUpdate={handleStatusUpdate}
                  onWeightUpdate={handleWeightUpdate}
                  onDelete={handleDelete}
                  selectedRowKeys={selectedRowKeys}
                  onSelectedRowKeysChange={setSelectedRowKeys}
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
  }, [grouped, isMobile, expandedRowKeys, selectedRowKeys, sendWhatsApp]);

  return (
    <Card loading={loading} styles={{ body: { padding: isMobile ? 8 : 16 } }}>
      {!isMobile ? (
        <div style={{ display: "grid", gap: 16, marginBottom: 16 }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              Orders
            </Title>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
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

            <div
              style={{
                display: "grid",
                gap: 14,
                width: "100%",
              }}
            >
              <Card size="small">
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "140px minmax(180px, 220px) auto auto",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <Tag
                    color="purple"
                    style={{ margin: 0, justifySelf: "start" }}
                  >
                    Bulk status
                  </Tag>

                  <Select
                    value={bulkStatus}
                    onChange={setBulkStatus}
                    style={{ width: "100%" }}
                    options={STATUS_OPTIONS}
                  />

                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <Text>Send WhatsApp</Text>
                    <Switch checked={sendWhatsApp} onChange={setSendWhatsApp} />
                  </div>

                  <Button
                    type="primary"
                    onClick={applyBulkStatus}
                    loading={bulkLoading}
                    disabled={selectedRowKeys.length === 0}
                    style={{ justifySelf: "start" }}
                  >
                    Apply to selected ({selectedRowKeys.length})
                  </Button>
                </div>
              </Card>

              <Card size="small">
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "140px minmax(260px, 320px) auto",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <Tag
                    color="green"
                    style={{ margin: 0, justifySelf: "start" }}
                  >
                    Packing list
                  </Tag>

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
                  />

                  <Button
                    onClick={exportPackingList}
                    icon={<DownloadOutlined />}
                    disabled={!displayOrders.length}
                    style={{ justifySelf: "start" }}
                  >
                    Export Excel
                  </Button>
                </div>
              </Card>

              <Card size="small">
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "140px minmax(180px, 220px) minmax(260px, 320px) auto",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <Tag color="blue" style={{ margin: 0, justifySelf: "start" }}>
                    Delivery run PDF
                  </Tag>

                  <Select
                    allowClear
                    placeholder="Filter by location"
                    style={{ width: "100%" }}
                    value={deliveryRunLocationId || undefined}
                    onChange={(v) => {
                      setDeliveryRunLocationId(v || "");
                      setDeliveryRunScheduleId("");
                    }}
                    options={locationOptions}
                  />

                  <Select
                    allowClear
                    placeholder="Filter by delivery slot"
                    style={{ width: "100%" }}
                    value={deliveryRunScheduleId || undefined}
                    onChange={(v) => setDeliveryRunScheduleId(v || "")}
                    options={deliveryRunScheduleOptions}
                  />

                  <Button
                    icon={<FilePdfOutlined />}
                    onClick={exportDeliveryRunPdf}
                    style={{ justifySelf: "start" }}
                  >
                    Export PDF
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <Title level={4} style={{ margin: 0, flex: 1 }}>
            Orders
          </Title>
          <Dropdown menu={{ items: moreMenuItems }} trigger={["click"]}>
            <Button icon={<FilterOutlined />}>Actions</Button>
          </Dropdown>
        </div>
      )}

      {!isMobile && (
        <div
          style={{
            marginBottom: 12,
            display: "flex",
            gap: 10,
            alignItems: "center",
          }}
        >
          <Text type="secondary">
            Selected orders: {selectedRowKeys.length}
          </Text>
        </div>
      )}

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
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Text>Send WhatsApp</Text>
            <Switch checked={sendWhatsApp} onChange={setSendWhatsApp} />
          </div>
          <Button
            type="primary"
            size="large"
            onClick={applyBulkStatus}
            loading={bulkLoading}
            block
          >
            Apply to selected ({selectedRowKeys.length})
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

      <Drawer
        title="Export delivery run PDF"
        placement="bottom"
        height="60vh"
        open={deliveryRunOpen}
        onClose={() => setDeliveryRunOpen(false)}
      >
        <div style={{ display: "grid", gap: 12 }}>
          <Select
            allowClear
            placeholder="Filter by location"
            style={{ width: "100%" }}
            value={deliveryRunLocationId || undefined}
            onChange={(v) => {
              setDeliveryRunLocationId(v || "");
              setDeliveryRunScheduleId("");
            }}
            options={locationOptions}
            size="large"
          />
          <Select
            allowClear
            placeholder="Filter by delivery slot"
            style={{ width: "100%" }}
            value={deliveryRunScheduleId || undefined}
            onChange={(v) => setDeliveryRunScheduleId(v || "")}
            options={deliveryRunScheduleOptions}
            size="large"
          />
          <Button
            type="primary"
            size="large"
            icon={<FilePdfOutlined />}
            onClick={exportDeliveryRunPdf}
            block
          >
            Export PDF
          </Button>
        </div>
      </Drawer>
    </Card>
  );
}
