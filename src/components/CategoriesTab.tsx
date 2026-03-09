import React, { useMemo, useState } from "react";
import {
  Button,
  Card,
  Form,
  Grid,
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
const { useBreakpoint } = Grid;

type CatForm = {
  name: string;
  key?: string;
  description?: string; // ✅ NEW
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
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminCategory | null>(null);
  const [form] = Form.useForm<CatForm>();
  const [selectedIcon, setSelectedIcon] = useState<string>("steak");

  const iconKeys = useMemo(() => Object.keys(ICONS), []);

  function openCreate() {
    setEditing(null);
    setSelectedIcon("steak");
    form.resetFields();
    form.setFieldsValue({
      name: "",
      key: "",
      description: "", // ✅ NEW
      iconKey: "steak",
    });
    setOpen(true);
  }

  function openEdit(cat: AdminCategory) {
    setEditing(cat);
    setSelectedIcon((cat as any).iconKey);
    form.resetFields();
    form.setFieldsValue({
      name: (cat as any).name,
      key: (cat as any).key,
      description: (cat as any).description || "", // ✅ NEW (safe)
      iconKey: (cat as any).iconKey,
    });
    setOpen(true);
  }

  async function save() {
    const values = await form.validateFields();
    try {
      const payload = {
        name: values.name,
        key: values.key || undefined,
        description: values.description?.trim() || undefined, // ✅ NEW
        iconKey: values.iconKey,
      };

      if (editing) {
        await api.put(`/api/admin/categories/${editing.id}`, payload);
        message.success("Category updated");
      } else {
        await api.post(`/api/admin/categories`, payload);
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
        <Button type="primary" onClick={openCreate} block={isMobile}>
          New Category
        </Button>
      }
      bodyStyle={{ padding: isMobile ? 12 : undefined }}
    >
      <Table
        loading={loading}
        rowKey={(r) => r.id}
        dataSource={categories}
        pagination={{
          pageSize: isMobile ? 10 : 50,
          showSizeChanger: !isMobile,
        }}
        size={isMobile ? "small" : "middle"}
        scroll={isMobile ? { x: 640 } : undefined}
        columns={[
          {
            title: "Icon",
            key: "icon",
            width: 70,
            render: (_: any, c: AdminCategory) => (
              <span style={{ display: "inline-flex", alignItems: "center" }}>
                <IconPreview iconKey={(c as any).iconKey} />
              </span>
            ),
          },
          {
            title: "Name",
            dataIndex: "name",
            key: "name",
            render: (v: any) => (
              <span
                style={{
                  display: "block",
                  maxWidth: isMobile ? 180 : 320,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {v}
              </span>
            ),
          },
          {
            title: "Description",
            dataIndex: "description",
            key: "description",
            render: (v: any) => v || "—",
          },
          ...(isMobile
            ? ([] as any[])
            : ([
              {
                title: "Key",
                dataIndex: "key",
                key: "key",
                render: (v: any) => v || "—",
              },
            ] as any[])),
          {
            title: "",
            key: "actions",
            width: isMobile ? 120 : 200,
            render: (_: any, c: AdminCategory) =>
              isMobile ? (
                <div style={{ display: "grid", gap: 8 }}>
                  <Button size="small" onClick={() => openEdit(c)} block>
                    Edit
                  </Button>
                  <Popconfirm
                    title="Remove this category?"
                    description="Products will be unassigned from this category."
                    onConfirm={() => remove(String((c as any).id))}
                  >
                    <Button danger size="small" block>
                      Remove
                    </Button>
                  </Popconfirm>
                </div>
              ) : (
                <Space>
                  <Button onClick={() => openEdit(c)}>Edit</Button>
                  <Popconfirm
                    title="Remove this category?"
                    description="Products will be unassigned from this category."
                    onConfirm={() => remove(String((c as any).id))}
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
        okButtonProps={{ size: isMobile ? "large" : "middle" }}
        cancelButtonProps={{ size: isMobile ? "large" : "middle" }}
        width={isMobile ? "100%" : 720}
        style={isMobile ? { top: 0, padding: 0 } : undefined}
        bodyStyle={isMobile ? { padding: 12 } : undefined}
      >
        <Form layout="vertical" form={form}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input
              placeholder="e.g. Beef"
              size={isMobile ? "large" : "middle"}
            />
          </Form.Item>

          <Form.Item name="key" label="Key (optional)">
            <Input
              placeholder="e.g. beef (leave blank to auto-generate)"
              size={isMobile ? "large" : "middle"}
            />
          </Form.Item>

          {/* ✅ NEW */}
          <Form.Item
            name="description"
            label="Description (optional)"
            tooltip="Shown to customers in the shop/category list."
          >
            <Input.TextArea
              placeholder="Short description, e.g. Grass-fed beef cuts and mince"
              autoSize={{ minRows: 2, maxRows: 4 }}
            />
          </Form.Item>

          <Form.Item name="iconKey" label="Icon" rules={[{ required: true }]}>
            <input type="hidden" />
          </Form.Item>

          <Text type="secondary">Pick an icon:</Text>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile
                ? "repeat(3, minmax(0, 1fr))"
                : "repeat(5, minmax(0, 1fr))",
              gap: 10,
              marginTop: 10,
            }}
          >
            {Object.keys(ICONS).map((k) => {
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
                    padding: isMobile ? 10 : 12,
                    background: active ? "rgba(45,82,51,0.08)" : "white",
                    cursor: "pointer",
                    minHeight: isMobile ? 86 : 96,
                  }}
                >
                  <div
                    style={{ display: "grid", placeItems: "center", gap: 6 }}
                  >
                    <IconPreview iconKey={k} size={isMobile ? 0.95 : 1.0} />
                    <span
                      style={{
                        fontSize: 11,
                        opacity: 0.8,
                        maxWidth: "100%",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {ICONS[k].label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {isMobile ? (
            <div style={{ marginTop: 12 }}>
              <Text type="secondary">
                Selected: <b>{ICONS[selectedIcon]?.label ?? selectedIcon}</b>
              </Text>
            </div>
          ) : null}
        </Form>
      </Modal>
    </Card>
  );
}
