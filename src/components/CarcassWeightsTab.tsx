// src/components/CarcassWeightsTab.tsx
import React, { useMemo, useState } from "react";
import {
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import dayjs from "dayjs";
import type {
  AdminPermission,
  CarcassWeightRecord,
} from "../pages/admin/AdminDashboardPage";
import { api } from "../api/client";

const { Text } = Typography;

type CarcassWeightForm = {
  animalId: string;
  weighedAt: any;
  wetWeightKg: number;
  dryWeightKg?: number | null;
  dryWeighedAt?: any;
  notes?: string;
};

function n(v: any): number {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

function hasPermission(
  permissions: AdminPermission[],
  needed: AdminPermission,
) {
  return permissions.includes("admin.full") || permissions.includes(needed);
}

export default function CarcassWeightsTab({
  loading,
  records,
  permissions,
  onReload,
}: {
  loading: boolean;
  records: CarcassWeightRecord[];
  permissions: AdminPermission[];
  onReload: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CarcassWeightRecord | null>(null);
  const [dryOnlyMode, setDryOnlyMode] = useState(false);
  const [form] = Form.useForm<CarcassWeightForm>();

  const canManage = hasPermission(permissions, "carcassweights.manage");

  const sortedRecords = useMemo(
    () =>
      [...(records || [])].sort(
        (a, b) => dayjs(b.weighedAt).valueOf() - dayjs(a.weighedAt).valueOf(),
      ),
    [records],
  );

  function openCreate() {
    setEditing(null);
    setDryOnlyMode(false);
    form.resetFields();
    form.setFieldsValue({
      animalId: "",
      weighedAt: dayjs(),
      wetWeightKg: 0,
      dryWeightKg: null,
      dryWeighedAt: null,
      notes: "",
    });
    setOpen(true);
  }

  function openEdit(record: CarcassWeightRecord) {
    setEditing(record);
    setDryOnlyMode(false);
    form.resetFields();
    form.setFieldsValue({
      animalId: record.animalId,
      weighedAt: record.weighedAt ? dayjs(record.weighedAt) : dayjs(),
      wetWeightKg: n(record.wetWeightKg),
      dryWeightKg:
        record.dryWeightKg === null || record.dryWeightKg === undefined
          ? null
          : n(record.dryWeightKg),
      dryWeighedAt: record.dryWeighedAt ? dayjs(record.dryWeighedAt) : null,
      notes: record.notes || "",
    });
    setOpen(true);
  }

  function openAddDryWeights(record: CarcassWeightRecord) {
    setEditing(record);
    setDryOnlyMode(true);
    form.resetFields();
    form.setFieldsValue({
      animalId: record.animalId,
      weighedAt: record.weighedAt ? dayjs(record.weighedAt) : dayjs(),
      wetWeightKg: n(record.wetWeightKg),
      dryWeightKg:
        record.dryWeightKg === null || record.dryWeightKg === undefined
          ? null
          : n(record.dryWeightKg),
      dryWeighedAt: record.dryWeighedAt ? dayjs(record.dryWeighedAt) : dayjs(),
      notes: record.notes || "",
    });
    setOpen(true);
  }

  async function saveRecord() {
    const values = await form.validateFields();

    const payload = {
      animalId: String(values.animalId || "").trim(),
      weighedAt: values.weighedAt ? values.weighedAt.toISOString() : null,
      wetWeightKg: values.wetWeightKg,
      dryWeightKg:
        values.dryWeightKg === null || values.dryWeightKg === undefined
          ? null
          : values.dryWeightKg,
      dryWeighedAt: values.dryWeighedAt
        ? values.dryWeighedAt.toISOString()
        : null,
      notes: values.notes?.trim() || "",
    };

    try {
      if (editing) {
        await api.put(`/api/admin/carcass-weights/${editing.id}`, payload);
        message.success(
          dryOnlyMode ? "Dry weights recorded" : "Record updated",
        );
      } else {
        await api.post(`/api/admin/carcass-weights`, payload);
        message.success("Record created");
      }
      setOpen(false);
      setDryOnlyMode(false);
      onReload();
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Save failed");
    }
  }

  async function deleteRecord(id: string) {
    try {
      await api.delete(`/api/admin/carcass-weights/${id}`);
      message.success("Record deleted");
      onReload();
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Delete failed");
    }
  }

  const columns = [
    {
      title: "Animal ID",
      dataIndex: "animalId",
      key: "animalId",
      render: (v: any) => <b>{v}</b>,
    },
    {
      title: "Wet date",
      dataIndex: "weighedAt",
      key: "weighedAt",
      width: 140,
      render: (v: string) => (v ? dayjs(v).format("D MMM YYYY") : "—"),
    },
    {
      title: "Wet weight",
      dataIndex: "wetWeightKg",
      key: "wetWeightKg",
      width: 120,
      render: (v: any) => `${n(v).toFixed(2)} kg`,
    },
    {
      title: "Dry date",
      dataIndex: "dryWeighedAt",
      key: "dryWeighedAt",
      width: 140,
      render: (v: string | null) =>
        v ? dayjs(v).format("D MMM YYYY") : <Tag color="gold">Pending</Tag>,
    },
    {
      title: "Dry weight",
      dataIndex: "dryWeightKg",
      key: "dryWeightKg",
      width: 120,
      render: (v: any) =>
        v === null || v === undefined ? "—" : `${n(v).toFixed(2)} kg`,
    },
    {
      title: "Loss",
      key: "loss",
      width: 120,
      render: (_: any, row: CarcassWeightRecord) => {
        const wet = n(row.wetWeightKg);
        const dry =
          row.dryWeightKg === null || row.dryWeightKg === undefined
            ? null
            : n(row.dryWeightKg);
        if (dry === null) return "—";
        return `${(wet - dry).toFixed(2)} kg`;
      },
    },
    {
      title: "Loss %",
      key: "lossPct",
      width: 120,
      render: (_: any, row: CarcassWeightRecord) => {
        const wet = n(row.wetWeightKg);
        const dry =
          row.dryWeightKg === null || row.dryWeightKg === undefined
            ? null
            : n(row.dryWeightKg);
        if (dry === null || wet <= 0) return "—";
        return `${(((wet - dry) / wet) * 100).toFixed(1)}%`;
      },
    },
    {
      title: "Notes",
      dataIndex: "notes",
      key: "notes",
      render: (v: any) =>
        v ? <span>{v}</span> : <Text type="secondary">—</Text>,
    },
    {
      title: "",
      key: "actions",
      width: 260,
      render: (_: any, row: CarcassWeightRecord) =>
        canManage ? (
          <Space wrap>
            {row.dryWeightKg === null || row.dryWeightKg === undefined ? (
              <Button type="primary" onClick={() => openAddDryWeights(row)}>
                Add Dry Weights
              </Button>
            ) : null}
            <Button onClick={() => openEdit(row)}>Edit</Button>
            <Popconfirm
              title="Delete this record?"
              okText="Delete"
              okButtonProps={{ danger: true }}
              onConfirm={() => deleteRecord(row.id)}
            >
              <Button danger>Delete</Button>
            </Popconfirm>
          </Space>
        ) : null,
    },
  ];

  return (
    <Card
      title="Carcass Weights"
      extra={
        canManage ? (
          <Button type="primary" onClick={openCreate}>
            New Record
          </Button>
        ) : null
      }
    >
      <Table
        loading={loading}
        rowKey={(r) => r.id}
        dataSource={sortedRecords}
        columns={columns as any}
      />

      <Modal
        title={
          editing
            ? dryOnlyMode
              ? "Add Dry Weights"
              : "Edit Carcass Record"
            : "New Carcass Record"
        }
        open={open}
        onCancel={() => {
          setOpen(false);
          setDryOnlyMode(false);
        }}
        onOk={saveRecord}
        okText="Save"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="animalId"
            label="Animal ID"
            rules={[{ required: true, message: "Animal ID is required" }]}
          >
            <Input placeholder="e.g. BEEF-001" disabled={dryOnlyMode} />
          </Form.Item>

          <Form.Item
            name="weighedAt"
            label="Wet weighing date"
            rules={[{ required: true, message: "Wet date is required" }]}
          >
            <DatePicker style={{ width: "100%" }} disabled={dryOnlyMode} />
          </Form.Item>

          <Form.Item
            name="wetWeightKg"
            label="Wet weight (kg)"
            rules={[{ required: true, message: "Wet weight is required" }]}
          >
            <InputNumber
              min={0}
              step={0.1}
              style={{ width: "100%" }}
              disabled={dryOnlyMode}
            />
          </Form.Item>

          <Form.Item name="dryWeighedAt" label="Dry weighing date">
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item name="dryWeightKg" label="Dry weight (kg)">
            <InputNumber min={0} step={0.1} style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
