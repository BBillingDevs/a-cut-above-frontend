// DropoffLocationsTab.tsx
import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { api } from "../api/client";

const { Text } = Typography;

export type DropoffLocation = {
  id: string;
  name: string;
  description?: string | null;
  sortOrder: number;
  isActive: boolean;

  // ✅ matches Prisma
  deliveryCutoffAt?: string | null;
  nextDeliveryAt?: string | null;
};

type FormValues = {
  name: string;
  description?: string;
  isActive: boolean;

  // ✅ per-location override
  deliveryCutoffAt?: dayjs.Dayjs | null;
  nextDeliveryAt?: dayjs.Dayjs | null;
};

function fmt(dt?: string | null) {
  if (!dt) return "—";
  const d = dayjs(dt);
  return d.isValid() ? d.format("ddd, D MMM YYYY • HH:mm") : "—";
}

export default function DropoffLocationsTab({
  loading,
  onReload,
}: {
  loading: boolean;
  onReload: () => void;
}) {
  const [rows, setRows] = useState<DropoffLocation[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DropoffLocation | null>(null);
  const [form] = Form.useForm<FormValues>();

  // ✅ Global cutoff (applied to all locations when you click "Apply to all")
  const [globalDeliveryCutoffAt, setGlobalDeliveryCutoffAt] =
    useState<dayjs.Dayjs | null>(null);
  const [globalNextDeliveryAt, setGlobalNextDeliveryAt] =
    useState<dayjs.Dayjs | null>(null);
  const [applyingGlobal, setApplyingGlobal] = useState(false);

  async function load() {
    try {
      const res = await api.get("/api/admin/dropoff-locations");
      setRows(res.data?.locations || []);
    } catch (e: any) {
      message.error(
        e?.response?.data?.error || "Failed to load drop-off locations",
      );
      setRows([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function reloadAll() {
    await load();
    onReload();
  }

  function openCreate() {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      name: "",
      description: "",
      isActive: true,
      deliveryCutoffAt: globalDeliveryCutoffAt ?? null,
      nextDeliveryAt: globalNextDeliveryAt ?? null,
    });
    setModalOpen(true);
  }

  function openEdit(r: DropoffLocation) {
    setEditing(r);
    form.resetFields();
    form.setFieldsValue({
      name: r.name,
      description: r.description || "",
      isActive: r.isActive,
      deliveryCutoffAt: r.deliveryCutoffAt ? dayjs(r.deliveryCutoffAt) : null,
      nextDeliveryAt: r.nextDeliveryAt ? dayjs(r.nextDeliveryAt) : null,
    });
    setModalOpen(true);
  }

  async function save() {
    const values = await form.validateFields();

    const payload = {
      name: values.name,
      description: values.description || "",
      isActive: values.isActive ?? true,

      // ✅ correct field name for backend + prisma
      deliveryCutoffAt: values.deliveryCutoffAt
        ? values.deliveryCutoffAt.toISOString()
        : null,
      nextDeliveryAt: values.nextDeliveryAt
        ? values.nextDeliveryAt.toISOString()
        : null,
    };

    try {
      if (editing) {
        await api.put(`/api/admin/dropoff-locations/${editing.id}`, payload);
        message.success("Drop-off location updated");
      } else {
        await api.post(`/api/admin/dropoff-locations`, payload);
        message.success("Drop-off location created");
      }

      setModalOpen(false);
      await reloadAll();
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Save failed");
    }
  }

  async function deactivate(id: string) {
    try {
      await api.delete(`/api/admin/dropoff-locations/${id}`);
      message.success("Deactivated");
      await reloadAll();
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Failed to deactivate");
    }
  }

  async function move(id: string, direction: "up" | "down") {
    const list = rows
      .slice()
      .sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0));

    const idx = list.findIndex((r) => r.id === id);
    if (idx === -1) return;

    const swapWith = direction === "up" ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= list.length) return;

    const ids = list.map((r) => r.id);
    [ids[idx], ids[swapWith]] = [ids[swapWith], ids[idx]];

    try {
      await api.put("/api/admin/dropoff-locations/reorder", { ids });
      message.success("Reordered");
      await reloadAll();
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Reorder failed");
    }
  }

  async function applyGlobalToAll() {
    if (!globalDeliveryCutoffAt && !globalNextDeliveryAt) {
      message.warning("Set a global cut-off and/or next delivery first");
      return;
    }

    setApplyingGlobal(true);
    try {
      await Promise.all(
        rows.map((r) =>
          api.put(`/api/admin/dropoff-locations/${r.id}`, {
            name: r.name,
            description: r.description || "",
            isActive: r.isActive,

            // ✅ correct backend field name
            deliveryCutoffAt: globalDeliveryCutoffAt
              ? globalDeliveryCutoffAt.toISOString()
              : null,
            nextDeliveryAt: globalNextDeliveryAt
              ? globalNextDeliveryAt.toISOString()
              : null,
          }),
        ),
      );

      message.success("Applied global cutoff to all locations");
      await reloadAll();
    } catch (e: any) {
      message.error(
        e?.response?.data?.error || "Failed to apply global cutoff",
      );
    } finally {
      setApplyingGlobal(false);
    }
  }

  const columns = useMemo(
    () => [
      { title: "Name", dataIndex: "name" },
      { title: "Description", dataIndex: "description" },
      {
        title: "Cut-off",
        key: "deliveryCutoffAt",
        width: 220,
        render: (_: any, r: DropoffLocation) => (
          <span style={{ whiteSpace: "nowrap" }}>
            {fmt(r.deliveryCutoffAt)}
          </span>
        ),
      },
      {
        title: "Next delivery",
        key: "nextDeliveryAt",
        width: 220,
        render: (_: any, r: DropoffLocation) => (
          <span style={{ whiteSpace: "nowrap" }}>{fmt(r.nextDeliveryAt)}</span>
        ),
      },
      {
        title: "Active",
        dataIndex: "isActive",
        width: 110,
        render: (v: boolean) =>
          v ? <Tag color="green">Yes</Tag> : <Tag color="red">No</Tag>,
      },
      {
        title: "Order",
        key: "order",
        width: 120,
        render: (_: any, r: DropoffLocation) => (
          <Space size={6}>
            <Button size="small" onClick={() => move(r.id, "up")}>
              ↑
            </Button>
            <Button size="small" onClick={() => move(r.id, "down")}>
              ↓
            </Button>
          </Space>
        ),
      },
      {
        title: "Actions",
        key: "actions",
        width: 220,
        render: (_: any, r: DropoffLocation) => (
          <Space>
            <Button onClick={() => openEdit(r)}>Edit</Button>
            <Popconfirm
              title="Deactivate this drop-off location?"
              onConfirm={() => deactivate(r.id)}
            >
              <Button danger>Deactivate</Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [rows],
  );

  return (
    <Card
      title="Drop-off Locations"
      extra={
        <Space>
          <Button onClick={reloadAll}>Refresh</Button>
          <Button type="primary" onClick={openCreate}>
            New Drop-off
          </Button>
        </Space>
      }
    >
      {/* ✅ GLOBAL CUT-OFF CONTROLS */}
      <Card style={{ marginBottom: 14 }} bodyStyle={{ padding: 14 }} bordered>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr auto",
            gap: 12,
            alignItems: "end",
          }}
        >
          <div>
            <Text strong>Global cut-off (applies to all)</Text>
            <div style={{ marginTop: 6 }}>
              <DatePicker
                showTime
                style={{ width: "100%" }}
                value={globalDeliveryCutoffAt}
                onChange={(v) => setGlobalDeliveryCutoffAt(v)}
                placeholder="Select cut-off date & time"
              />
            </div>
          </div>

          <div>
            <Text strong>Global next delivery</Text>
            <div style={{ marginTop: 6 }}>
              <DatePicker
                showTime
                style={{ width: "100%" }}
                value={globalNextDeliveryAt}
                onChange={(v) => setGlobalNextDeliveryAt(v)}
                placeholder="Select next delivery date & time"
              />
            </div>
          </div>

          <Button
            type="primary"
            onClick={applyGlobalToAll}
            loading={applyingGlobal}
          >
            Apply to all
          </Button>
        </div>

        <Text
          type="secondary"
          style={{ display: "block", marginTop: 8, fontSize: 12 }}
        >
          This writes the values into each location. You can still override a
          single location by editing it.
        </Text>
      </Card>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows
          .slice()
          .sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0))}
        columns={columns as any}
        pagination={false}
      />

      <Modal
        open={modalOpen}
        title={editing ? "Edit Drop-off Location" : "New Drop-off Location"}
        onCancel={() => setModalOpen(false)}
        onOk={save}
        okText={editing ? "Save" : "Create"}
      >
        <Form layout="vertical" form={form}>
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: "Name is required" }]}
          >
            <Input placeholder="e.g. Borrowdale Farm Shop" />
          </Form.Item>

          <Form.Item name="description" label="Description (optional)">
            <Input placeholder="Short hint customers will see (optional)" />
          </Form.Item>

          <Form.Item name="deliveryCutoffAt" label="Cut-off (date & time)">
            <DatePicker showTime style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item name="nextDeliveryAt" label="Next delivery (date & time)">
            <DatePicker showTime style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item
            name="isActive"
            label="Active"
            valuePropName="checked"
            tooltip="Inactive locations won’t show in checkout"
          >
            <Switch />
          </Form.Item>

          <Text type="secondary" style={{ fontSize: 12 }}>
            Tip: Use ↑ / ↓ to control the order customers see in the checkout
            dropdown.
          </Text>
        </Form>
      </Modal>
    </Card>
  );
}
