import React, { useMemo, useState } from "react";
import {
  Button,
  Card,
  Checkbox,
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
import type {
  AdminPermission,
  AdminUserRecord,
} from "../pages/admin/AdminDashboardPage";

const { Text } = Typography;

type UserForm = {
  name?: string;
  email: string;
  password: string;
  isActive: boolean;
  permissions: AdminPermission[];
};

function hasPermission(
  permissions: AdminPermission[],
  needed: AdminPermission,
) {
  return permissions.includes("admin.full") || permissions.includes(needed);
}

const PERMISSION_GROUPS: {
  title: string;
  items: { label: string; value: AdminPermission }[];
}[] = [
  {
    title: "Dashboard",
    items: [{ label: "View dashboard", value: "dashboard.view" }],
  },
  {
    title: "Orders",
    items: [
      { label: "View orders", value: "orders.view" },
      { label: "Update order status", value: "orders.status.update" },
      { label: "Enter/update weights", value: "orders.weights.update" },
      { label: "Delete orders", value: "orders.delete" },
      { label: "Open packing slip / invoice PDFs", value: "packinglists.pdf" },
      { label: "Export packing lists", value: "packinglists.export" },
    ],
  },
  {
    title: "Products",
    items: [
      { label: "View products", value: "products.view" },
      { label: "Manage products", value: "products.manage" },
    ],
  },
  {
    title: "Categories",
    items: [
      { label: "View categories", value: "categories.view" },
      { label: "Manage categories", value: "categories.manage" },
    ],
  },
  {
    title: "Windows",
    items: [
      { label: "View order windows", value: "windows.view" },
      { label: "Manage order windows", value: "windows.manage" },
    ],
  },
  {
    title: "Dropoffs",
    items: [
      { label: "View dropoff locations", value: "dropoffs.view" },
      { label: "Manage dropoff locations", value: "dropoffs.manage" },
    ],
  },
  {
    title: "Users",
    items: [
      { label: "View users", value: "users.view" },
      { label: "Manage users", value: "users.manage" },
    ],
  },
  {
    title: "Everything",
    items: [{ label: "Full admin access", value: "admin.full" }],
  },
];

export default function UsersTab({
  loading,
  users,
  currentPermissions,
  onReload,
}: {
  loading: boolean;
  users: AdminUserRecord[];
  currentPermissions: AdminPermission[];
  onReload: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUserRecord | null>(null);
  const [form] = Form.useForm<UserForm>();

  const canManageUsers = hasPermission(currentPermissions, "users.manage");

  const allPermissions = useMemo(
    () => PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.value)),
    [],
  );

  function openCreate() {
    setEditingUser(null);
    form.resetFields();
    form.setFieldsValue({
      name: "",
      email: "",
      password: "",
      isActive: true,
      permissions: ["orders.view", "orders.weights.update"],
    });
    setOpen(true);
  }

  function openEdit(user: AdminUserRecord) {
    setEditingUser(user);
    form.resetFields();
    form.setFieldsValue({
      name: user.name || "",
      email: user.email,
      password: "",
      isActive: user.isActive,
      permissions: user.permissions || [],
    });
    setOpen(true);
  }

  async function saveUser() {
    const values = await form.validateFields();

    try {
      if (editingUser) {
        await api.put(`/api/admin/users/${editingUser.id}`, {
          name: values.name?.trim() || null,
          email: values.email.trim(),
          password: values.password?.trim() || undefined,
          isActive: values.isActive,
          permissions: values.permissions || [],
        });
        message.success("User updated");
      } else {
        await api.post("/api/admin/users", {
          name: values.name?.trim() || null,
          email: values.email.trim(),
          password: values.password,
          isActive: values.isActive,
          permissions: values.permissions || [],
        });
        message.success("User created");
      }

      setOpen(false);
      onReload();
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Failed to save user");
    }
  }

  async function toggleUserActive(user: AdminUserRecord, isActive: boolean) {
    try {
      await api.put(`/api/admin/users/${user.id}`, {
        name: user.name ?? null,
        email: user.email,
        isActive,
        permissions: user.permissions || [],
      });
      message.success(isActive ? "User activated" : "User disabled");
      onReload();
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Failed to update user");
    }
  }

  async function deleteUser(user: AdminUserRecord) {
    try {
      await api.delete(`/api/admin/users/${user.id}`);
      message.success("User deleted");
      onReload();
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Failed to delete user");
    }
  }

  const columns = [
    {
      title: "Name",
      key: "name",
      render: (_: any, u: AdminUserRecord) =>
        u.name || <Text type="secondary">—</Text>,
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
    },
    {
      title: "Status",
      key: "isActive",
      width: 120,
      render: (_: any, u: AdminUserRecord) =>
        u.isActive ? <Tag color="green">Active</Tag> : <Tag>Disabled</Tag>,
    },
    {
      title: "Permissions",
      key: "permissions",
      render: (_: any, u: AdminUserRecord) => (
        <Space size={[4, 4]} wrap>
          {(u.permissions || []).length === 0 ? (
            <Tag>None</Tag>
          ) : (
            u.permissions.map((p) => <Tag key={p}>{p}</Tag>)
          )}
        </Space>
      ),
    },
    {
      title: "",
      key: "actions",
      width: 240,
      render: (_: any, u: AdminUserRecord) =>
        canManageUsers ? (
          <Space>
            <Button onClick={() => openEdit(u)}>Edit</Button>
            <Switch
              checked={u.isActive}
              onChange={(checked) => toggleUserActive(u, checked)}
            />
            <Popconfirm
              title="Delete this user?"
              description="This cannot be undone."
              okText="Delete"
              okButtonProps={{ danger: true }}
              onConfirm={() => deleteUser(u)}
            >
              <Button danger>Delete</Button>
            </Popconfirm>
          </Space>
        ) : null,
    },
  ];

  return (
    <Card
      title="Users"
      extra={
        canManageUsers ? (
          <Button type="primary" onClick={openCreate}>
            New User
          </Button>
        ) : null
      }
    >
      <Table
        loading={loading}
        rowKey={(r) => r.id}
        dataSource={users}
        columns={columns as any}
      />

      <Modal
        title={editingUser ? "Edit User" : "New User"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={saveUser}
        okText="Save"
        width={760}
      >
        <Form layout="vertical" form={form}>
          <Form.Item name="name" label="Name">
            <Input />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: "Email is required" },
              { type: "email", message: "Enter a valid email" },
            ]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="password"
            label={editingUser ? "New password (optional)" : "Password"}
            rules={
              editingUser
                ? []
                : [
                    { required: true, message: "Password is required" },
                    { min: 6, message: "Minimum 6 characters" },
                  ]
            }
          >
            <Input.Password />
          </Form.Item>

          <Form.Item
            name="isActive"
            label="Active"
            valuePropName="checked"
            initialValue={true}
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="permissions"
            label="Permissions"
            rules={[
              { required: true, message: "Select at least one permission" },
            ]}
          >
            <Checkbox.Group style={{ width: "100%" }}>
              <div style={{ display: "grid", gap: 14 }}>
                {PERMISSION_GROUPS.map((group) => (
                  <Card key={group.title} size="small" title={group.title}>
                    <div style={{ display: "grid", gap: 8 }}>
                      {group.items.map((item) => (
                        <Checkbox key={item.value} value={item.value}>
                          {item.label}
                        </Checkbox>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            </Checkbox.Group>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
