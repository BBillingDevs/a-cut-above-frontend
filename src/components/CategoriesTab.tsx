import React, { useMemo, useState } from "react";
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Table,
  Typography,
  message,
} from "antd";
import { api } from "../api/client";
import type { AdminCategory } from "../pages/admin/AdminDashboardPage";
import { ICONS, IconPreview } from "./iconCatalog";

const { Text } = Typography;

type CatForm = {
  name: string;
  key?: string;
  iconKey: string;
};

export default function CategoriesTab({
  loading,
  categories,
  onReload,
}: {
  loading: boolean;
  categories: AdminCategory[];
  onReload: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminCategory | null>(null);
  const [form] = Form.useForm<CatForm>();
  const [selectedIcon, setSelectedIcon] = useState<string>("steak");

  const iconKeys = useMemo(() => Object.keys(ICONS), []);

  function openCreate() {
    setEditing(null);
    setSelectedIcon("steak");
    form.resetFields();
    form.setFieldsValue({ name: "", key: "", iconKey: "steak" });
    setOpen(true);
  }

  function openEdit(cat: AdminCategory) {
    setEditing(cat);
    setSelectedIcon(cat.iconKey);
    form.resetFields();
    form.setFieldsValue({ name: cat.name, key: cat.key, iconKey: cat.iconKey });
    setOpen(true);
  }

  async function save() {
    const values = await form.validateFields();
    try {
      if (editing) {
        await api.put(`/api/admin/categories/${editing.id}`, {
          name: values.name,
          key: values.key || undefined,
          iconKey: values.iconKey,
        });
        message.success("Category updated");
      } else {
        await api.post(`/api/admin/categories`, {
          name: values.name,
          key: values.key || undefined,
          iconKey: values.iconKey,
        });
        message.success("Category created");
      }
      setOpen(false);
      onReload();
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Save failed");
    }
  }

  async function remove(id: string) {
    try {
      await api.delete(`/api/admin/categories/${id}`);
      message.success("Category removed");
      onReload();
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Delete failed");
    }
  }

  return (
    <Card
      extra={
        <Button type="primary" onClick={openCreate}>
          New Category
        </Button>
      }
    >
      <Table
        loading={loading}
        rowKey={(r) => r.id}
        dataSource={categories}
        pagination={false}
        columns={[
          {
            title: "Icon",
            key: "icon",
            width: 80,
            render: (_: any, c: AdminCategory) => (
              <span style={{ display: "inline-flex", alignItems: "center" }}>
                <IconPreview iconKey={c.iconKey} />
              </span>
            ),
          },
          { title: "Name", dataIndex: "name", key: "name" },
          { title: "Key", dataIndex: "key", key: "key" },
          {
            title: "",
            key: "actions",
            render: (_: any, c: AdminCategory) => (
              <Space>
                <Button onClick={() => openEdit(c)}>Edit</Button>
                <Popconfirm
                  title="Remove this category?"
                  description="Products will be unassigned from this category."
                  onConfirm={() => remove(c.id)}
                >
                  <Button danger>Remove</Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editing ? "Edit Category" : "New Category"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={save}
        okText="Save"
      >
        <Form layout="vertical" form={form}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Beef" />
          </Form.Item>

          <Form.Item name="key" label="Key (optional)">
            <Input placeholder="e.g. beef (leave blank to auto-generate)" />
          </Form.Item>

          <Form.Item name="iconKey" label="Icon" rules={[{ required: true }]}>
            <input type="hidden" />
          </Form.Item>

          <Text type="secondary">Pick an icon:</Text>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
              gap: 10,
              marginTop: 10,
            }}
          >
            {iconKeys.map((k) => {
              const active = selectedIcon === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    setSelectedIcon(k);
                    form.setFieldsValue({ iconKey: k });
                  }}
                  style={{
                    border: active
                      ? "2px solid #2D5233"
                      : "1px solid rgba(0,0,0,0.12)",
                    borderRadius: 12,
                    padding: 12,
                    background: active ? "rgba(45,82,51,0.08)" : "white",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{ display: "grid", placeItems: "center", gap: 6 }}
                  >
                    <IconPreview iconKey={k} size={1.0} />
                    <span style={{ fontSize: 11, opacity: 0.8 }}>
                      {ICONS[k].label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </Form>
      </Modal>
    </Card>
  );
}
