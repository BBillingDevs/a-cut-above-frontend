// DeliveryLocationsTab.tsx
import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  Button,
  Card,
  DatePicker,
  Drawer,
  Form,
  Grid,
  Input,
  Modal,
  Popconfirm,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
  Empty,
  Divider,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { api } from "../api/client";

const { Text } = Typography;
const { useBreakpoint } = Grid;

export type DeliverySchedule = {
  id: string;
  cutoffDate: string;
  deliveryDate: string;
  dropoffLocationId: string;
  _count?: { orders: number };
};

export type DeliveryLocation = {
  id: string;
  name: string;
  description?: string | null;
  sortOrder: number;
  isActive: boolean;
  schedules?: DeliverySchedule[];
};

type LocationFormValues = {
  name: string;
  description?: string;
  isActive: boolean;
};

type ScheduleFormValues = {
  cutoffDate: dayjs.Dayjs;
  deliveryDate: dayjs.Dayjs;
};

function fmtDate(dt?: string | null) {
  if (!dt) return "—";
  const d = dayjs(dt);
  return d.isValid() ? d.format("ddd, D MMM YYYY") : "—";
}

// ─── Schedule List for a location ────────────────────────────────────────────

function ScheduleList({
  location,
  onChanged,
}: {
  location: DeliveryLocation;
  onChanged: () => void;
}) {
  const [schedules, setSchedules] = useState<DeliverySchedule[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm] = Form.useForm<ScheduleFormValues>();
  const [saving, setSaving] = useState(false);

  async function loadSchedules() {
    setLoadingSchedules(true);
    try {
      const res = await api.get(
        `/api/admin/dropoff-locations/${location.id}/schedules`,
      );
      setSchedules(res.data?.schedules || []);
    } catch {
      message.error("Failed to load schedules");
    } finally {
      setLoadingSchedules(false);
    }
  }

  useEffect(() => {
    loadSchedules();
  }, [location.id]);

  async function addSchedule() {
    const values = await addForm.validateFields();
    setSaving(true);
    try {
      await api.post(`/api/admin/dropoff-locations/${location.id}/schedules`, {
        cutoffDate: values.cutoffDate.startOf("day").toISOString(),
        deliveryDate: values.deliveryDate.startOf("day").toISOString(),
      });
      message.success("Schedule added");
      addForm.resetFields();
      setAddOpen(false);
      await loadSchedules();
      onChanged();
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Failed to add schedule");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSchedule(id: string) {
    try {
      await api.delete(`/api/admin/delivery-schedules/${id}`);
      message.success("Schedule deleted");
      await loadSchedules();
      onChanged();
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Failed to delete schedule");
    }
  }

  const columns = [
    {
      title: "Cut-off date",
      dataIndex: "cutoffDate",
      render: (v: string) => fmtDate(v),
    },
    {
      title: "Delivery date",
      dataIndex: "deliveryDate",
      render: (v: string) => fmtDate(v),
    },
    {
      title: "Orders",
      key: "orders",
      width: 80,
      render: (_: any, r: DeliverySchedule) => (
        <Tag color="blue">{r._count?.orders ?? 0}</Tag>
      ),
    },
    {
      title: "",
      key: "actions",
      width: 80,
      render: (_: any, r: DeliverySchedule) => (
        <Popconfirm
          title="Delete this schedule?"
          description={
            (r._count?.orders ?? 0) > 0
              ? `${r._count?.orders} order(s) will be unlinked.`
              : "This cannot be undone."
          }
          onConfirm={() => deleteSchedule(r.id)}
          okButtonProps={{ danger: true }}
          okText="Delete"
        >
          <Button danger size="small">
            Delete
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <Table
        rowKey="id"
        size="small"
        loading={loadingSchedules}
        dataSource={schedules}
        columns={columns as any}
        pagination={false}
        locale={{
          emptyText: (
            <Empty
              description="No schedules yet"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ),
        }}
      />

      {!addOpen ? (
        <Button
          icon={<PlusOutlined />}
          size="small"
          style={{ marginTop: 10 }}
          onClick={() => setAddOpen(true)}
        >
          Add schedule
        </Button>
      ) : (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            background: "#fafafa",
            borderRadius: 6,
            border: "1px solid #f0f0f0",
          }}
        >
          <Text strong style={{ display: "block", marginBottom: 8 }}>
            New schedule
          </Text>
          <Form form={addForm} layout="vertical">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <Form.Item
                name="cutoffDate"
                label="Cut-off date"
                rules={[{ required: true, message: "Required" }]}
                style={{ marginBottom: 8 }}
              >
                <DatePicker
                  style={{ width: "100%" }}
                  placeholder="Select cut-off date"
                  disabledDate={(c) => c && c.isBefore(dayjs().startOf("day"))}
                />
              </Form.Item>

              <Form.Item
                name="deliveryDate"
                label="Delivery date"
                rules={[
                  { required: true, message: "Required" },
                  {
                    validator: async (_, value) => {
                      if (!value) return;
                      const cutoff = addForm.getFieldValue("cutoffDate");
                      if (cutoff && value.isBefore(cutoff, "day")) {
                        throw new Error("Must be on or after cut-off");
                      }
                    },
                  },
                ]}
                style={{ marginBottom: 8 }}
              >
                <DatePicker
                  style={{ width: "100%" }}
                  placeholder="Select delivery date"
                  disabledDate={(c) => {
                    if (!c) return false;
                    if (c.isBefore(dayjs().startOf("day"))) return true;
                    const cutoff = addForm.getFieldValue("cutoffDate");
                    if (cutoff && c.isBefore(cutoff, "day")) return true;
                    return false;
                  }}
                />
              </Form.Item>
            </div>

            <Space>
              <Button
                type="primary"
                size="small"
                onClick={addSchedule}
                loading={saving}
              >
                Save
              </Button>
              <Button
                size="small"
                onClick={() => {
                  setAddOpen(false);
                  addForm.resetFields();
                }}
              >
                Cancel
              </Button>
            </Space>
          </Form>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DeliveryLocationsTab({
  loading,
  onReload,
}: {
  loading: boolean;
  onReload: () => void;
}) {
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [rows, setRows] = useState<DeliveryLocation[]>([]);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] =
    useState<DeliveryLocation | null>(null);
  const [locationForm] = Form.useForm<LocationFormValues>();
  const [schedulesModalLocation, setSchedulesModalLocation] =
    useState<DeliveryLocation | null>(null);

  async function load() {
    try {
      const res = await api.get("/api/admin/dropoff-locations");
      setRows(res.data?.locations || []);
    } catch (e: any) {
      message.error(
        e?.response?.data?.error || "Failed to load delivery locations",
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
    setEditingLocation(null);
    locationForm.resetFields();
    locationForm.setFieldsValue({ name: "", description: "", isActive: true });
    setLocationModalOpen(true);
  }

  function openEditLocation(r: DeliveryLocation) {
    setEditingLocation(r);
    locationForm.resetFields();
    locationForm.setFieldsValue({
      name: r.name,
      description: r.description || "",
      isActive: r.isActive,
    });
    setLocationModalOpen(true);
  }

  async function saveLocation() {
    const values = await locationForm.validateFields();
    const payload = {
      name: values.name,
      description: values.description || "",
      isActive: values.isActive ?? true,
    };

    try {
      if (editingLocation) {
        await api.put(
          `/api/admin/dropoff-locations/${editingLocation.id}`,
          payload,
        );
        message.success("Delivery location updated");
      } else {
        await api.post(`/api/admin/dropoff-locations`, payload);
        message.success("Delivery location created");
      }
      setLocationModalOpen(false);
      await reloadAll();
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Save failed");
    }
  }

  async function deleteLocation(id: string) {
    try {
      await api.delete(`/api/admin/dropoff-locations/${id}`);
      message.success("Deleted");
      await reloadAll();
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Failed to delete");
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

  const sortedRows = useMemo(
    () =>
      rows
        .slice()
        .sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0)),
    [rows],
  );

  const locationColumns = useMemo(
    () =>
      [
        {
          title: "Location",
          key: "location",
          render: (_: any, r: DeliveryLocation) => (
            <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 700,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {r.name}
              </div>
              {r.description ? (
                <Text
                  type="secondary"
                  style={{
                    fontSize: 12,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: 300,
                  }}
                >
                  {r.description}
                </Text>
              ) : null}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {r.isActive ? (
                  <Tag color="green">Active</Tag>
                ) : (
                  <Tag color="red">Inactive</Tag>
                )}
              </div>
            </div>
          ),
        },
        ...(!isMobile
          ? ([
            {
              title: "Active",
              dataIndex: "isActive",
              width: 90,
              render: (v: boolean) =>
                v ? <Tag color="green">Yes</Tag> : <Tag color="red">No</Tag>,
            },
            {
              title: "Order",
              key: "order",
              width: 110,
              render: (_: any, r: DeliveryLocation) => (
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
          ] as any[])
          : []),
        {
          title: "",
          key: "actions",
          width: isMobile ? 120 : 280,
          render: (_: any, r: DeliveryLocation) =>
            isMobile ? (
              <div style={{ display: "grid", gap: 6 }}>
                <Button size="small" block onClick={() => openEditLocation(r)}>
                  Edit
                </Button>
                <Button
                  size="small"
                  block
                  type="dashed"
                  onClick={() => setSchedulesModalLocation(r)}
                >
                  Schedules
                </Button>
                <Space size={4}>
                  <Button size="small" block onClick={() => move(r.id, "up")}>
                    ↑
                  </Button>
                  <Button size="small" block onClick={() => move(r.id, "down")}>
                    ↓
                  </Button>
                </Space>
                <Popconfirm
                  title="Delete this delivery location?"
                  description="This cannot be undone."
                  onConfirm={() => deleteLocation(r.id)}
                >
                  <Button danger size="small" block>
                    Delete
                  </Button>
                </Popconfirm>
              </div>
            ) : (
              <Space>
                <Button size="small" onClick={() => openEditLocation(r)}>
                  Edit
                </Button>
                <Button
                  size="small"
                  type="dashed"
                  onClick={() => setSchedulesModalLocation(r)}
                >
                  Schedules
                </Button>
                <Popconfirm
                  title="Delete this delivery location?"
                  description="This cannot be undone."
                  onConfirm={() => deleteLocation(r.id)}
                >
                  <Button danger size="small">
                    Delete
                  </Button>
                </Popconfirm>
              </Space>
            ),
        },
      ] as any[],
    [isMobile, rows],
  );

  return (
    <>
      <Card
        title="Delivery Locations"
        style={{ marginBottom: 20 }}
        extra={
          <Space>
            <Button onClick={reloadAll}>Refresh</Button>
            <Button type="primary" onClick={openCreate}>
              {isMobile ? "New" : "New Location"}
            </Button>
          </Space>
        }
        styles={{ body: { padding: isMobile ? 12 : undefined } }}
      >
        <Table
          rowKey="id"
          loading={loading}
          dataSource={sortedRows}
          columns={locationColumns}
          pagination={{
            pageSize: isMobile ? 8 : 50,
            showSizeChanger: !isMobile,
          }}
          size={isMobile ? "small" : "middle"}
          scroll={isMobile ? { x: 480 } : undefined}
          locale={{
            emptyText: (
              <Empty
                description="No delivery locations yet"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ),
          }}
        />
      </Card>

      {/* ── Per-location schedules section (desktop) ── */}
      {!isMobile && (
        <Card
          title="Cutoff & Delivery Schedules"
          styles={{ body: { padding: 0 } }}
        >
          {sortedRows.length === 0 ? (
            <div style={{ padding: 24 }}>
              <Empty
                description="Create delivery locations first"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            </div>
          ) : (
            sortedRows.map((r, idx) => (
              <div
                key={r.id}
                style={{
                  padding: 16,
                  borderBottom:
                    idx < sortedRows.length - 1
                      ? "1px solid #f0f0f0"
                      : undefined,
                }}
              >
                <div style={{ marginBottom: 12 }}>
                  <Text strong style={{ fontSize: 14 }}>
                    {r.name}
                  </Text>
                  {!r.isActive && (
                    <Tag color="red" style={{ marginLeft: 8, fontSize: 11 }}>
                      Inactive
                    </Tag>
                  )}
                  {r.description && (
                    <Text
                      type="secondary"
                      style={{ display: "block", fontSize: 12 }}
                    >
                      {r.description}
                    </Text>
                  )}
                </div>
                <ScheduleList location={r} onChanged={reloadAll} />
              </div>
            ))
          )}
        </Card>
      )}

      {/* ── Create / Edit Location Modal ── */}
      <Modal
        open={locationModalOpen}
        title={
          editingLocation ? "Edit Delivery Location" : "New Delivery Location"
        }
        onCancel={() => setLocationModalOpen(false)}
        onOk={saveLocation}
        okText={editingLocation ? "Save" : "Create"}
        width={isMobile ? "100%" : 520}
        style={isMobile ? { top: 0, padding: 0 } : undefined}
        styles={isMobile ? { body: { padding: 12 } } : undefined}
        okButtonProps={{ size: isMobile ? "large" : "middle" }}
        cancelButtonProps={{ size: isMobile ? "large" : "middle" }}
      >
        <Form layout="vertical" form={locationForm}>
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: "Name is required" }]}
          >
            <Input
              placeholder="e.g. Borrowdale Farm Shop"
              size={isMobile ? "large" : "middle"}
            />
          </Form.Item>

          <Form.Item name="description" label="Description (optional)">
            <Input
              placeholder="Short hint customers will see (optional)"
              size={isMobile ? "large" : "middle"}
            />
          </Form.Item>

          <Form.Item
            name="isActive"
            label="Active"
            valuePropName="checked"
            tooltip="Inactive locations won't show in checkout"
          >
            <Switch />
          </Form.Item>

          <Text type="secondary" style={{ fontSize: 12 }}>
            Tip: Once created, use the "Cutoff & Delivery Schedules" section to
            add schedules for this location.
          </Text>
        </Form>
      </Modal>

      {/* ── Mobile: Schedules Modal ── */}
      <Modal
        open={!!schedulesModalLocation}
        title={
          schedulesModalLocation
            ? `Schedules — ${schedulesModalLocation.name}`
            : "Schedules"
        }
        onCancel={() => setSchedulesModalLocation(null)}
        footer={null}
        width={isMobile ? "100%" : 600}
        style={isMobile ? { top: 0, padding: 0 } : undefined}
        styles={isMobile ? { body: { padding: 12 } } : undefined}
        destroyOnClose
      >
        {schedulesModalLocation && (
          <ScheduleList
            location={schedulesModalLocation}
            onChanged={reloadAll}
          />
        )}
      </Modal>
    </>
  );
}
