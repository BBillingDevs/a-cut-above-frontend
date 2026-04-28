import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Collapse,
  Divider,
  Drawer,
  Dropdown,
  Empty,
  Grid,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { MenuProps } from "antd";
import {
  DownloadOutlined,
  FilePdfOutlined,
  FilterOutlined,
  PlusOutlined,
  SettingOutlined,
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
  { label: "Ready to Pack", value: "READY_TO_PACK" },
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

type WeightEntry = {
  value?: number;
  unit: "kg" | "g";
};

type PackingStateItem = {
  itemId: string;
  packed: boolean;
  weights: WeightEntry[];
};

type AdminCreateProduct = {
  id: string;
  name: string;
  unit: string;
  stockQty?: number | null;
  retailPrice?: string | number | null;
  wholesalePrice?: string | number | null;
  price?: string | number | null;
  pricePerKg?: string | number | null;
  pricePerPack?: string | number | null;
};

type CreateOrderItem = {
  productId: string;
  qty: number;
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

function normalizeWeightToKg(
  value: number | undefined | null,
  unit: "kg" | "g",
) {
  if (
    value === undefined ||
    value === null ||
    !Number.isFinite(Number(value))
  ) {
    return null;
  }

  return unit === "g" ? Number(value) / 1000 : Number(value);
}

function parseExistingWeights(item: any): WeightEntry[] {
  const raw = item.packWeights;

  if (!Array.isArray(raw)) {
    const qty = Math.max(0, Math.round(Number(item.qty || 0)));
    return Array.from({ length: qty }, () => ({
      value: undefined,
      unit: "kg" as const,
    }));
  }

  const parsed = raw.map((w: any) => ({
    value:
      w?.value === null || w?.value === undefined ? undefined : Number(w.value),
    unit: w?.unit === "g" ? ("g" as const) : ("kg" as const),
  }));

  const qty = Math.max(0, Math.round(Number(item.qty || 0)));

  while (parsed.length < qty) {
    parsed.push({ value: undefined, unit: "kg" });
  }

  return parsed.slice(0, qty);
}

function PackingItemRow({
  item,
  state,
  isMobile,
  onChangePacked,
  onChangeWeightValue,
  onChangeWeightUnit,
}: {
  item: AdminOrderItem;
  state: PackingStateItem;
  isMobile: boolean;
  onChangePacked: (checked: boolean) => void;
  onChangeWeightValue: (index: number, value: number | undefined) => void;
  onChangeWeightUnit: (index: number, unit: "kg" | "g") => void;
}) {
  const needsWeight = isKgItem(item);
  const qty = Math.max(0, Math.round(Number((item as any).qty || 0)));

  return (
    <Card size="small">
      <div style={{ display: "grid", gap: 10 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr",
            gap: 12,
            alignItems: "start",
          }}
        >
          <div>
            <div style={{ fontWeight: 800 }}>
              {String((item as any).productName || "Item")}
            </div>

            <Text type="secondary" style={{ fontSize: 12 }}>
              Qty: {qty} • Unit:{" "}
              {String((item as any).unit || "").toLowerCase()}
            </Text>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: isMobile ? "flex-start" : "flex-end",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <Checkbox
              checked={state.packed}
              onChange={(e) => onChangePacked(e.target.checked)}
            >
              Packed
            </Checkbox>
          </div>
        </div>

        {needsWeight ? (
          <div style={{ display: "grid", gap: 8 }}>
            {Array.from({ length: qty }).map((_, idx) => {
              const entry = state.weights[idx] || {
                value: undefined,
                unit: "kg" as const,
              };

              return (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ minWidth: 56 }}>Pack {idx + 1}</Text>

                  <InputNumber
                    value={entry.value}
                    onChange={(v) =>
                      onChangeWeightValue(
                        idx,
                        v === null ? undefined : Number(v),
                      )
                    }
                    placeholder="Weight"
                    min={0}
                    step={entry.unit === "g" ? 1 : 0.1}
                    style={{ width: isMobile ? 120 : 140 }}
                  />

                  <Select
                    value={entry.unit}
                    onChange={(v) => onChangeWeightUnit(idx, v)}
                    style={{ width: 80 }}
                    options={[
                      { label: "kg", value: "kg" },
                      { label: "g", value: "g" },
                    ]}
                  />

                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {entry.value !== undefined
                      ? `= ${(normalizeWeightToKg(entry.value, entry.unit) || 0).toFixed(3)} kg`
                      : "Enter weight"}
                  </Text>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function OrderTable({
  orders,
  isMobile,
  expandedRowKeys,
  onExpandedRowKeysChange,
  onStatusUpdate,
  onDelete,
  selectedRowKeys,
  onSelectedRowKeysChange,
  onOpenPacking,
  onOpenWaste,
}: {
  orders: AdminOrder[];
  isMobile: boolean;
  expandedRowKeys: React.Key[];
  onExpandedRowKeysChange: (keys: React.Key[]) => void;
  onStatusUpdate: (orderId: string, status: string) => Promise<void>;
  onDelete: (orderId: string, orderNo: string) => Promise<void>;
  selectedRowKeys: React.Key[];
  onSelectedRowKeysChange: (keys: React.Key[]) => void;
  onOpenPacking: (order: AdminOrder) => void;
  onOpenWaste: (order: AdminOrder, item: AdminOrderItem) => void;
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
          width: 160,
          render: (_: any, it: AdminOrderItem) => {
            if (!isKgItem(it)) return <Tag>Pack</Tag>;

            const weights = Array.isArray((it as any).packWeights)
              ? (it as any).packWeights
              : [];

            return weights.length ? (
              <div style={{ display: "grid", gap: 4 }}>
                {weights.map((w: any, i: number) => (
                  <Tag key={i} color="green">
                    Pack {i + 1}: {Number(w.value || 0)} {w.unit || "kg"}
                  </Tag>
                ))}
              </div>
            ) : (
              <Tag color="gold">Missing</Tag>
            );
          },
        },
        {
          title: "Line",
          key: "lineTotal",
          width: 170,
          render: (_: any, it: AdminOrderItem) => {
            const order = (it as any).__order as AdminOrder;

            return (
              <Space>
                <span>{money((it as any).lineTotal)}</span>
                <Button
                  danger
                  size="small"
                  onClick={() => onOpenWaste(order, it)}
                >
                  Waste
                </Button>
              </Space>
            );
          },
        },
      ] as any[],
    [onOpenWaste],
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
          title: "Packed By",
          dataIndex: "packerInitials",
          key: "packerInitials",
          width: 110,
          render: (v: any) =>
            v ? <Tag color="blue">{String(v).toUpperCase()}</Tag> : "—",
        },
        {
          title: "Packing",
          key: "packing",
          width: 150,
          render: (_: any, row: AdminOrder) =>
            row.status === "DELIVERED" ? (
              <Tag color="green">Delivered</Tag>
            ) : (
              <Button type="primary" onClick={() => onOpenPacking(row)}>
                Pack Order
              </Button>
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
    [isMobile, onDelete, onOpenPacking, onStatusUpdate],
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
      scroll={isMobile ? { x: 1040 } : undefined}
      pagination={{ pageSize: 20, showSizeChanger: false }}
      expandable={{
        expandedRowKeys,
        onExpandedRowsChange: (keys) => onExpandedRowKeysChange(keys),
        expandedRowRender: (order) => {
          const stableItems = [...(order.items || [])]
            .map((item: any) => ({
              ...item,
              __order: order,
            }))
            .sort(
              (a: any, b: any) =>
                String(a.productName || "").localeCompare(
                  String(b.productName || ""),
                ) || String(a.id).localeCompare(String(b.id)),
            );

          return (
            <div style={{ padding: isMobile ? 4 : 8 }}>
              {(order as any).packerInitials ? (
                <div style={{ marginBottom: 10 }}>
                  <Text type="secondary">Packed by: </Text>
                  <Tag color="blue">
                    {String((order as any).packerInitials).toUpperCase()}
                  </Tag>
                </div>
              ) : null}

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
                scroll={isMobile ? { x: 760 } : undefined}
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

  const [bulkStatus, setBulkStatus] = useState("READY_TO_PACK");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const [sendWhatsApp, setSendWhatsApp] = useState(true);

  const [packingOpen, setPackingOpen] = useState(false);
  const [packingScheduleId, setPackingScheduleId] = useState("");

  const [deliveryRunOpen, setDeliveryRunOpen] = useState(false);
  const [deliveryRunScheduleId, setDeliveryRunScheduleId] = useState("");
  const [deliveryRunLocationId, setDeliveryRunLocationId] = useState("");

  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);

  const [packingOrder, setPackingOrder] = useState<AdminOrder | null>(null);
  const [packingItems, setPackingItems] = useState<
    Record<string, PackingStateItem>
  >({});
  const [packingInitialsOpen, setPackingInitialsOpen] = useState(false);
  const [packerInitials, setPackerInitials] = useState("");
  const [savingPacking, setSavingPacking] = useState(false);

  const [wasteModalOpen, setWasteModalOpen] = useState(false);
  const [wasteOrder, setWasteOrder] = useState<AdminOrder | null>(null);
  const [wasteItem, setWasteItem] = useState<AdminOrderItem | null>(null);
  const [wasteQty, setWasteQty] = useState<number>(1);
  const [savingWaste, setSavingWaste] = useState(false);

  const [createOrderOpen, setCreateOrderOpen] = useState(false);
  const [adminProducts, setAdminProducts] = useState<AdminCreateProduct[]>([]);
  const [savingCreateOrder, setSavingCreateOrder] = useState(false);
  const [createCustomerName, setCreateCustomerName] = useState("");
  const [createCustomerPhone, setCreateCustomerPhone] = useState("");
  const [createCustomerEmail, setCreateCustomerEmail] = useState("");
  const [createPricingTier, setCreatePricingTier] = useState<
    "RETAIL" | "WHOLESALE"
  >("RETAIL");
  const [createDropoffLocationId, setCreateDropoffLocationId] = useState("");
  const [createDeliveryScheduleId, setCreateDeliveryScheduleId] = useState("");
  const [createNotes, setCreateNotes] = useState("");
  const [createItems, setCreateItems] = useState<CreateOrderItem[]>([
    { productId: "", qty: 1 },
  ]);

  useEffect(() => {
    const normalized = (orders || []).map((o) => ({
      ...o,
      status: o.status === "ORDER_PLACED" ? "READY_TO_PACK" : o.status,
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

  useEffect(() => {
    if (!createOrderOpen) return;

    api
      .get("/api/admin/products")
      .then((res) => setAdminProducts(res.data?.products || []))
      .catch(() => message.error("Failed to load products"));
  }, [createOrderOpen]);

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

  const createScheduleOptions = useMemo(() => {
    return schedules
      .filter(
        (s) =>
          !createDropoffLocationId ||
          s.dropoffLocationId === createDropoffLocationId,
      )
      .map((s) => ({
        value: s.id,
        label: `${s.dropoffLocation.name} — Cutoff: ${fmtDate(s.cutoffDate)} → Delivery: ${fmtDate(s.deliveryDate)}`,
      }));
  }, [schedules, createDropoffLocationId]);

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

  const productOptions = useMemo(
    () =>
      adminProducts.map((p) => ({
        value: p.id,
        label: `${p.name} (${String(p.unit || "pack")})`,
      })),
    [adminProducts],
  );

  const grouped = useMemo((): LocationGroup[] => {
    const filteredOrders = displayOrders.filter((o) => {
      const anyO = o as any;

      if (filterLocationId && anyO.dropoffLocationId !== filterLocationId) {
        return false;
      }

      if (filterScheduleId && anyO.deliveryScheduleId !== filterScheduleId) {
        return false;
      }

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

  function openWasteModal(order: AdminOrder, item: AdminOrderItem) {
    setWasteOrder(order);
    setWasteItem(item);
    setWasteQty(1);
    setWasteModalOpen(true);
  }

  async function confirmWasteOrderItem() {
    if (!wasteOrder || !wasteItem) return;

    const maxQty = Math.max(1, Number((wasteItem as any).qty || 1));
    const cleanQty = Math.min(Math.max(1, Number(wasteQty || 1)), maxQty);

    setSavingWaste(true);

    try {
      const res = await api.post(
        `/api/admin/orders/${wasteOrder.id}/items/${wasteItem.id}/waste`,
        {
          qtyWasted: cleanQty,
          notes: "Wasted from orders screen",
        },
      );

      const updated = res.data?.order as AdminOrder;

      setDisplayOrders((prev) =>
        prev.map((o) =>
          String(o.id) === String(updated.id)
            ? ({ ...updated, ...recomputeOrderClient(updated) } as any)
            : o,
        ),
      );

      message.success("Waste recorded and order updated");

      setWasteModalOpen(false);
      setWasteOrder(null);
      setWasteItem(null);
      setWasteQty(1);

      onReload();
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Failed to waste product");
    } finally {
      setSavingWaste(false);
    }
  }

  function openPacking(order: AdminOrder) {
    const state: Record<string, PackingStateItem> = {};

    for (const item of order.items || []) {
      state[item.id] = {
        itemId: item.id,
        packed: false,
        weights: isKgItem(item) ? parseExistingWeights(item as any) : [],
      };
    }

    setPackingOrder(order);
    setPackingItems(state);
  }

  function getPackingValidation(order: AdminOrder | null) {
    if (!order) {
      return { missing: [], ok: false };
    }

    const missing: string[] = [];

    for (const item of order.items || []) {
      const state = packingItems[item.id];
      const name = String((item as any).productName || "Item");

      if (!state?.packed) {
        missing.push(`${name}: packed not ticked`);
        continue;
      }

      if (isKgItem(item)) {
        const qty = Math.max(0, Math.round(Number((item as any).qty || 0)));
        const weights = state.weights || [];

        if (weights.length !== qty) {
          missing.push(`${name}: ${qty} weights required`);
          continue;
        }

        const hasMissingWeight = weights.some((w) => {
          const normalized = normalizeWeightToKg(w.value, w.unit);
          return normalized === null || normalized <= 0;
        });

        if (hasMissingWeight) {
          missing.push(`${name}: one or more weights missing`);
        }
      }
    }

    return {
      missing,
      ok: missing.length === 0,
    };
  }

  async function savePacking() {
    const validation = getPackingValidation(packingOrder);

    if (!validation.ok) {
      message.warning(
        "Please complete all per-pack weights and packing checkboxes.",
      );
      return;
    }

    setPackingInitialsOpen(true);
  }

  async function confirmSavePacking() {
    if (!packingOrder) return;

    const initials = packerInitials.trim().toUpperCase();

    if (!initials) {
      message.error("Enter packer initials");
      return;
    }

    const validation = getPackingValidation(packingOrder);

    if (!validation.ok) {
      message.warning(
        "Please complete all per-pack weights and packing checkboxes.",
      );
      setPackingInitialsOpen(false);
      return;
    }

    setSavingPacking(true);

    try {
      const itemsPayload = (packingOrder.items || []).map((item) => {
        const state = packingItems[item.id];

        return {
          itemId: item.id,
          packed: !!state?.packed,
          weights: isKgItem(item)
            ? (state?.weights || []).map((w) => ({
              value: w.value ?? 0,
              unit: w.unit,
            }))
            : [],
        };
      });

      const res = await api.put(`/api/admin/orders/${packingOrder.id}/pack`, {
        items: itemsPayload,
        packerInitials: initials,
        sendWhatsApp,
      });

      const updated = res.data?.order as AdminOrder;

      setDisplayOrders((prev) =>
        prev.map((o) =>
          String(o.id) === String(updated.id)
            ? ({ ...updated, ...recomputeOrderClient(updated) } as any)
            : o,
        ),
      );

      message.success("Order packed and moved to Out for Delivery");

      setPackingInitialsOpen(false);
      setPackerInitials("");
      setPackingOrder(null);
      setPackingItems({});

      onReload();
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Failed to save packing");
    } finally {
      setSavingPacking(false);
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

  async function createAdminOrder() {
    const validItems = createItems
      .filter((x) => x.productId && Number(x.qty || 0) > 0)
      .map((x) => ({
        productId: x.productId,
        qty: Number(x.qty || 1),
      }));

    if (!createCustomerName.trim()) {
      message.error("Enter customer name");
      return;
    }

    if (!createCustomerPhone.trim()) {
      message.error("Enter customer phone");
      return;
    }

    if (!validItems.length) {
      message.error("Add at least one product");
      return;
    }

    setSavingCreateOrder(true);

    try {
      await api.post("/api/admin/orders", {
        customerName: createCustomerName.trim(),
        customerPhone: createCustomerPhone.trim(),
        customerEmail: createCustomerEmail.trim(),
        pricingTier: createPricingTier,
        dropoffLocationId: createDropoffLocationId,
        deliveryScheduleId: createDeliveryScheduleId,
        notes: createNotes.trim(),
        items: validItems,
      });

      message.success("Order created");

      setCreateOrderOpen(false);
      setCreateCustomerName("");
      setCreateCustomerPhone("");
      setCreateCustomerEmail("");
      setCreatePricingTier("RETAIL");
      setCreateDropoffLocationId("");
      setCreateDeliveryScheduleId("");
      setCreateNotes("");
      setCreateItems([{ productId: "", qty: 1 }]);

      onReload();
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Failed to create order");
    } finally {
      setSavingCreateOrder(false);
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

    for (const p of productNames) {
      totals[p] = 0;
    }

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
      key: "create-order",
      label: "Create order",
      icon: <PlusOutlined />,
      onClick: () => setCreateOrderOpen(true),
    },
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
                onDelete={handleDelete}
                selectedRowKeys={selectedRowKeys}
                onSelectedRowKeysChange={setSelectedRowKeys}
                onOpenPacking={openPacking}
                onOpenWaste={openWasteModal}
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
                  onDelete={handleDelete}
                  selectedRowKeys={selectedRowKeys}
                  onSelectedRowKeysChange={setSelectedRowKeys}
                  onOpenPacking={openPacking}
                  onOpenWaste={openWasteModal}
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

  const packingValidation = getPackingValidation(packingOrder);

  return (
    <Card loading={loading} styles={{ body: { padding: isMobile ? 8 : 16 } }}>
      {!isMobile ? (
        <div style={{ display: "grid", gap: 16, marginBottom: 16 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
            }}
          >
            <Title level={4} style={{ margin: 0 }}>
              Orders
            </Title>

            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateOrderOpen(true)}
            >
              Create Order
            </Button>
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

          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateOrderOpen(true)}
          />

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

      <Modal
        title={
          packingOrder ? `Pack Order — ${packingOrder.orderNo}` : "Pack Order"
        }
        open={!!packingOrder}
        onCancel={() => {
          setPackingOrder(null);
          setPackingItems({});
        }}
        onOk={savePacking}
        okText="Save Packing"
        width={950}
      >
        {packingOrder ? (
          <div style={{ display: "grid", gap: 14 }}>
            <Alert
              type={packingValidation.ok ? "success" : "warning"}
              showIcon
              message={
                packingValidation.ok
                  ? "All items are ready to save."
                  : "All items must be packed. Kg items need one weight per pack ordered."
              }
              description={
                !packingValidation.ok
                  ? packingValidation.missing.join(" | ")
                  : undefined
              }
            />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile
                  ? "1fr"
                  : "repeat(3, minmax(0, 1fr))",
                gap: 12,
              }}
            >
              <Card size="small">
                <Text type="secondary">Customer</Text>
                <div style={{ fontWeight: 800, marginTop: 4 }}>
                  {packingOrder.customerName}
                </div>
              </Card>

              <Card size="small">
                <Text type="secondary">Status</Text>
                <div style={{ fontWeight: 800, marginTop: 4 }}>
                  {packingOrder.status === "ORDER_PLACED"
                    ? "Ready to Pack"
                    : packingOrder.status.replace(/_/g, " ")}
                </div>
              </Card>

              <Card size="small">
                <Text type="secondary">Order</Text>
                <div style={{ fontWeight: 800, marginTop: 4 }}>
                  {packingOrder.orderNo}
                </div>
              </Card>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {(packingOrder.items || []).map((item) => {
                const state = packingItems[item.id] || {
                  itemId: item.id,
                  packed: false,
                  weights: isKgItem(item)
                    ? parseExistingWeights(item as any)
                    : [],
                };

                return (
                  <PackingItemRow
                    key={item.id}
                    item={item}
                    state={state}
                    isMobile={isMobile}
                    onChangePacked={(checked) =>
                      setPackingItems((prev) => ({
                        ...prev,
                        [item.id]: {
                          ...state,
                          packed: checked,
                        },
                      }))
                    }
                    onChangeWeightValue={(index, value) =>
                      setPackingItems((prev) => {
                        const nextWeights = [...(state.weights || [])];

                        nextWeights[index] = {
                          ...(nextWeights[index] || { unit: "kg" }),
                          value,
                        };

                        return {
                          ...prev,
                          [item.id]: {
                            ...state,
                            weights: nextWeights,
                          },
                        };
                      })
                    }
                    onChangeWeightUnit={(index, unit) =>
                      setPackingItems((prev) => {
                        const nextWeights = [...(state.weights || [])];

                        nextWeights[index] = {
                          ...(nextWeights[index] || { value: undefined }),
                          unit,
                        };

                        return {
                          ...prev,
                          [item.id]: {
                            ...state,
                            weights: nextWeights,
                          },
                        };
                      })
                    }
                  />
                );
              })}
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        title="Waste product"
        open={wasteModalOpen}
        onCancel={() => {
          setWasteModalOpen(false);
          setWasteOrder(null);
          setWasteItem(null);
          setWasteQty(1);
        }}
        onOk={confirmWasteOrderItem}
        okText="Waste"
        okButtonProps={{ danger: true }}
        confirmLoading={savingWaste}
      >
        {wasteItem ? (
          <div style={{ display: "grid", gap: 12 }}>
            <Alert
              type="warning"
              showIcon
              message="Record product waste"
              description="This will reduce the quantity on the order. If you waste the full quantity, the item will be removed from the order."
            />

            <div>
              <Text type="secondary">Product</Text>
              <div style={{ fontWeight: 800 }}>
                {String((wasteItem as any).productName || "Item")}
              </div>
            </div>

            <div>
              <Text type="secondary">Quantity to waste</Text>
              <InputNumber
                min={1}
                max={Math.max(1, Number((wasteItem as any).qty || 1))}
                value={wasteQty}
                onChange={(v) => setWasteQty(Number(v || 1))}
                style={{ width: "100%", marginTop: 6 }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Current order quantity: {Number((wasteItem as any).qty || 0)}
              </Text>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        title="Create Order"
        open={createOrderOpen}
        onCancel={() => setCreateOrderOpen(false)}
        onOk={createAdminOrder}
        okText="Create Order"
        confirmLoading={savingCreateOrder}
        width={900}
      >
        <div style={{ display: "grid", gap: 14 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
              gap: 12,
            }}
          >
            <div>
              <Text type="secondary">Customer name</Text>
              <Input
                value={createCustomerName}
                onChange={(e) => setCreateCustomerName(e.target.value)}
                placeholder="Customer name"
              />
            </div>

            <div>
              <Text type="secondary">Customer phone</Text>
              <Input
                value={createCustomerPhone}
                onChange={(e) => setCreateCustomerPhone(e.target.value)}
                placeholder="Customer phone"
              />
            </div>

            <div>
              <Text type="secondary">Customer email</Text>
              <Input
                value={createCustomerEmail}
                onChange={(e) => setCreateCustomerEmail(e.target.value)}
                placeholder="Optional"
              />
            </div>

            <div>
              <Text type="secondary">Pricing tier</Text>
              <Select
                value={createPricingTier}
                onChange={setCreatePricingTier}
                style={{ width: "100%" }}
                options={[
                  { value: "RETAIL", label: "Retail" },
                  { value: "WHOLESALE", label: "Wholesale" },
                ]}
              />
            </div>

            <div>
              <Text type="secondary">Delivery location</Text>
              <Select
                allowClear
                value={createDropoffLocationId || undefined}
                onChange={(v) => {
                  setCreateDropoffLocationId(v || "");
                  setCreateDeliveryScheduleId("");
                }}
                placeholder="Select location"
                style={{ width: "100%" }}
                options={locationOptions}
              />
            </div>

            <div>
              <Text type="secondary">Delivery schedule</Text>
              <Select
                allowClear
                value={createDeliveryScheduleId || undefined}
                onChange={(v) => setCreateDeliveryScheduleId(v || "")}
                placeholder="Select schedule"
                style={{ width: "100%" }}
                options={createScheduleOptions}
              />
            </div>
          </div>

          <div>
            <Text type="secondary">Notes</Text>
            <Input.TextArea
              value={createNotes}
              onChange={(e) => setCreateNotes(e.target.value)}
              rows={2}
              placeholder="Optional"
            />
          </div>

          <Divider style={{ margin: "4px 0" }} />

          <div style={{ display: "grid", gap: 10 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
              }}
            >
              <Text strong>Products</Text>
              <Button
                size="small"
                icon={<PlusOutlined />}
                onClick={() =>
                  setCreateItems((prev) => [...prev, { productId: "", qty: 1 }])
                }
              >
                Add product
              </Button>
            </div>

            {createItems.map((row, index) => (
              <Card size="small" key={index}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1fr" : "1fr 120px 90px",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <Select
                    showSearch
                    value={row.productId || undefined}
                    onChange={(v) =>
                      setCreateItems((prev) =>
                        prev.map((x, i) =>
                          i === index ? { ...x, productId: v } : x,
                        ),
                      )
                    }
                    placeholder="Select product"
                    options={productOptions}
                    optionFilterProp="label"
                  />

                  <InputNumber
                    min={1}
                    value={row.qty}
                    onChange={(v) =>
                      setCreateItems((prev) =>
                        prev.map((x, i) =>
                          i === index ? { ...x, qty: Number(v || 1) } : x,
                        ),
                      )
                    }
                    style={{ width: "100%" }}
                  />

                  <Button
                    danger
                    disabled={createItems.length <= 1}
                    onClick={() =>
                      setCreateItems((prev) =>
                        prev.filter((_, i) => i !== index),
                      )
                    }
                  >
                    Remove
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </Modal>

      <Modal
        title="Packer Initials"
        open={packingInitialsOpen}
        onCancel={() => setPackingInitialsOpen(false)}
        onOk={confirmSavePacking}
        okText="Confirm Save"
        confirmLoading={savingPacking}
      >
        <div style={{ display: "grid", gap: 12 }}>
          <Text>Enter the initials of the person packing this order.</Text>

          <Input
            value={packerInitials}
            onChange={(e) => setPackerInitials(e.target.value.toUpperCase())}
            placeholder="e.g. BB"
            maxLength={8}
          />
        </div>
      </Modal>
    </Card>
  );
}
