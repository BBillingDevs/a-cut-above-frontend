import React, { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  DatePicker,
  InputNumber,
  Select,
  Space,
  Table,
  Tag,
  message,
  Divider,
  Typography,
} from "antd";
import type { TableRowSelection } from "antd/es/table/interface";
import dayjs, { Dayjs } from "dayjs";
import * as XLSX from "xlsx";

import { api, API_BASE } from "../api/client";
import type {
  AdminOrder,
  AdminOrderItem,
} from "../pages/admin/AdminDashboardPage";

const { RangePicker } = DatePicker;
const { Text } = Typography;

const STATUS_OPTIONS = [
  { label: "Processing", value: "PROCESSING" },
  { label: "Packed", value: "PACKED" },
  { label: "Shipping", value: "SHIPPING" },
  { label: "Delivered", value: "DELIVERED" },
];

function money(v: any) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : "—";
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

function getDeliveryWindow(order: AdminOrder): string {
  const anyOrder = order as any;
  return (
    anyOrder.deliveryWindow ||
    anyOrder.deliverySlot ||
    anyOrder.deliveryTimeWindow ||
    anyOrder.deliveryDateWindow ||
    ""
  );
}

function formatDateForFilename(d: Dayjs) {
  return d.format("YYYY-MM-DD");
}

/**
 * ✅ Frontend recompute:
 * - Pack item: unitPrice * qty
 * - Kg item: unitPrice * weightKg (only if weightKg present)
 * Returns: { items, subtotal, total }
 */
function recomputeOrderClient(order: AdminOrder) {
  const nextItems = (order.items || []).map((it: any) => {
    const unit = String(it.unit || "").toLowerCase();
    const unitPrice = Number(it.unitPrice || 0);
    const qty = Number(it.qty || 0);

    if (unit === "kg") {
      const w = it.weightKg;
      const weightKg =
        w === null || w === undefined || w === "" ? null : Number(w);

      // If no weight yet, treat line total as 0 (or keep existing)
      const lineTotal =
        weightKg == null || !Number.isFinite(weightKg)
          ? 0
          : unitPrice * weightKg;

      return { ...it, lineTotal };
    }

    const lineTotal = unitPrice * qty;
    return { ...it, lineTotal };
  });

  const subtotal = nextItems.reduce((sum: number, it: any) => {
    const lt = Number(it.lineTotal || 0);
    return sum + (Number.isFinite(lt) ? lt : 0);
  }, 0);

  return { items: nextItems, subtotal, total: subtotal };
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
  /**
   * ✅ CRITICAL:
   * Use local state so Table gets a new dataSource reference.
   * Also, normalize totals client-side once when orders change.
   */
  const [displayOrders, setDisplayOrders] = useState<AdminOrder[]>([]);

  useEffect(() => {
    // Make sure we create NEW references + compute line totals
    const normalized = (orders || []).map((o) => {
      const recomputed = recomputeOrderClient(o);
      return { ...o, ...recomputed };
    });
    setDisplayOrders(normalized);
  }, [orders]);

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [bulkStatus, setBulkStatus] = useState<string>("PROCESSING");
  const [bulkLoading, setBulkLoading] = useState(false);

  const [packingRange, setPackingRange] = useState<
    [Dayjs | null, Dayjs | null] | null
  >(null);
  const [packingWindow, setPackingWindow] = useState<string | undefined>(
    undefined,
  );

  async function updateStatus(orderId: string, status: string) {
    try {
      await api.put(`/api/admin/orders/${orderId}/status`, { status });

      // ✅ optimistic patch (new refs)
      setDisplayOrders((prev) =>
        prev.map((o) =>
          String(o.id) === String(orderId) ? ({ ...o, status } as any) : o,
        ),
      );

      message.success("Status updated");
      onReload(); // optional, server truth
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Status update failed");
    }
  }

  /**
   * ✅ Frontend-only: patch item weight, recompute totals locally, THEN reload.
   * Even if reload returns same refs, UI already updated.
   */
  async function updateKgWeight(itemId: string, weightKg: number | null) {
    try {
      await api.put(`/api/admin/order-items/${itemId}/weight`, { weightKg });

      setDisplayOrders((prev) =>
        prev.map((o) => {
          const items = o.items || [];
          const idx = items.findIndex(
            (it: any) => String(it.id) === String(itemId),
          );
          if (idx === -1) return o;

          const target: any = items[idx];
          const nextWeight = weightKg === null ? null : Number(weightKg);

          const nextItems = items.map((it: any) =>
            String(it.id) === String(itemId)
              ? { ...it, weightKg: nextWeight }
              : it,
          );

          const nextOrder = { ...o, items: nextItems } as any;

          // ✅ recompute totals client-side + return new object
          const recomputed = recomputeOrderClient(nextOrder);
          return { ...nextOrder, ...recomputed };
        }),
      );

      // Optional server truth refresh (won't break UI now)
      onReload();
    } catch (e: any) {
      console.error("Weight update failed:", e?.response?.data || e);
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
        selectedRowKeys.map((id) => updateStatus(String(id), bulkStatus)),
      );
      message.success(`Updated ${selectedRowKeys.length} order(s)`);
      setSelectedRowKeys([]);
      onReload();
    } finally {
      setBulkLoading(false);
    }
  }

  const rowSelection: TableRowSelection<AdminOrder> = {
    selectedRowKeys,
    onChange: (keys) => setSelectedRowKeys(keys),
  };

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
          title: "Qty (packs)",
          dataIndex: "qty",
          key: "qty",
          width: 120,
          render: (v: any) => Number(v || 0),
        },
        {
          title: "Weight (kg)",
          key: "weightKg",
          width: 220,
          render: (_: any, it: AdminOrderItem) => {
            if (!isKgItem(it)) return <Tag>Pack item</Tag>;

            const raw = (it as any).weightKg;
            const current =
              raw === null || raw === undefined || raw === ""
                ? undefined
                : Number(raw);

            return (
              <InputNumber
                value={current}
                onChange={(v) =>
                  updateKgWeight(it.id, v === null ? null : Number(v))
                }
                placeholder="Enter kg"
                min={0}
                step={0.1}
                style={{ width: 160 }}
              />
            );
          },
        },
        {
          title: "Line total",
          key: "lineTotal",
          width: 140,
          render: (_: any, it: AdminOrderItem) => {
            const lt = Number((it as any).lineTotal || 0);
            if (!lt) return "—";
            return money(lt);
          },
        },
      ] as any[],
    [],
  );

  const mainColumns = useMemo(
    () =>
      [
        { title: "Order No", dataIndex: "orderNo", key: "orderNo", width: 170 },
        {
          title: "Customer",
          dataIndex: "customerName",
          key: "customerName",
          width: 180,
        },
        {
          title: "Phone",
          dataIndex: "customerPhone",
          key: "customerPhone",
          width: 140,
        },
        {
          title: "Status",
          dataIndex: "status",
          key: "status",
          width: 170,
          render: (_: any, row: AdminOrder) => (
            <Select
              value={row.status}
              style={{ width: 160 }}
              onChange={(v) => updateStatus(row.id, v)}
              options={STATUS_OPTIONS}
            />
          ),
        },
        {
          title: "Weights",
          key: "weights",
          width: 140,
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
          width: 120,
          render: (v: any) => money(v),
        },
        {
          title: "Created",
          dataIndex: "createdAt",
          key: "createdAt",
          width: 190,
          render: (v: string) => new Date(v).toLocaleString(),
        },
      ] as any[],
    [],
  );

  const deliveryWindowOptions = useMemo(() => {
    const set = new Set<string>();
    for (const o of displayOrders) {
      const w = getDeliveryWindow(o);
      if (w) set.add(String(w));
    }
    return Array.from(set)
      .sort((a, b) => a.localeCompare(b))
      .map((w) => ({ label: w, value: w }));
  }, [displayOrders]);

  const packingOrders = useMemo(() => {
    let filtered = [...displayOrders];

    if (packingRange && (packingRange[0] || packingRange[1])) {
      const start = packingRange[0]?.startOf("day") ?? null;
      const end = packingRange[1]?.endOf("day") ?? null;

      filtered = filtered.filter((o) => {
        const t = dayjs(o.createdAt);
        if (start && t.isBefore(start)) return false;
        if (end && t.isAfter(end)) return false;
        return true;
      });
    }

    if (packingWindow) {
      filtered = filtered.filter(
        (o) => String(getDeliveryWindow(o)) === String(packingWindow),
      );
    }

    return filtered;
  }, [displayOrders, packingRange, packingWindow]);

  function exportPackingListExcel() {
    if (!packingOrders.length) {
      message.warning("No orders match your packing list filters");
      return;
    }

    const productSet = new Set<string>();
    for (const o of packingOrders) {
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

    for (const o of packingOrders) {
      const row: any[] = [];
      row.push(o.customerName ?? "");
      row.push(o.customerPhone ?? "");
      row.push(o.orderNo ?? "");

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

    const now = dayjs();
    const start = packingRange?.[0];
    const end = packingRange?.[1];

    const rangeLabel =
      start || end
        ? `${start ? formatDateForFilename(start) : "start"}_to_${end ? formatDateForFilename(end) : "end"}`
        : formatDateForFilename(now);

    const windowLabel = packingWindow
      ? `_${packingWindow.replace(/\s+/g, "-")}`
      : "";
    const filename = `packing-list_${rangeLabel}${windowLabel}.xlsx`;

    XLSX.writeFile(wb, filename);
    message.success(`Packing list exported (${packingOrders.length} orders)`);
  }

  return (
    <Card
      title="Orders"
      extra={
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            alignItems: "flex-end",
          }}
        >
          <Space wrap>
            <Tag color={selectedRowKeys.length ? "blue" : "default"}>
              Selected: {selectedRowKeys.length}
            </Tag>

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
              Set status
            </Button>

            <Button
              onClick={() => setSelectedRowKeys([])}
              disabled={selectedRowKeys.length === 0}
            >
              Clear selection
            </Button>
          </Space>

          <Divider style={{ margin: 0 }} />

          <Space wrap>
            <Tag color="gold">Packing List</Tag>

            <RangePicker
              value={packingRange as any}
              onChange={(v) => setPackingRange(v as any)}
              allowEmpty={[true, true]}
              placeholder={["Start date", "End date"]}
            />

            <Select
              allowClear
              placeholder="Delivery window"
              style={{ width: 190 }}
              value={packingWindow}
              onChange={(v) => setPackingWindow(v)}
              options={deliveryWindowOptions}
            />

            <Button
              onClick={exportPackingListExcel}
              disabled={!displayOrders.length}
            >
              Export Packing List (Excel)
            </Button>
          </Space>
        </div>
      }
    >
      <Table
        loading={loading}
        rowKey={(r) => r.id}
        dataSource={displayOrders}
        rowSelection={rowSelection}
        expandable={{
          expandedRowRender: (order) => {
            // ✅ stable item order (no jumping)
            const stableItems = [...(order.items || [])].sort(
              (a: any, b: any) =>
                String(a.productName || "").localeCompare(
                  String(b.productName || ""),
                ) || String(a.id).localeCompare(String(b.id)),
            );

            return (
              <div style={{ padding: 8 }}>
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    flexWrap: "wrap",
                    marginBottom: 12,
                  }}
                >
                  <Button
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
                />
              </div>
            );
          },
        }}
        columns={mainColumns}
      />
    </Card>
  );
}
