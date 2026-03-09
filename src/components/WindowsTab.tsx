import React, { useMemo, useState } from "react";
import {
  Button,
  Card,
  DatePicker,
  Form,
  Grid,
  Input,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
  message,
  Switch,
} from "antd";
import dayjs from "dayjs";
import { api } from "../api/client";
import type { AdminWindow } from "../pages/admin/AdminDashboardPage";

const { Text } = Typography;
const { useBreakpoint } = Grid;

type WindowForm = {
  name: string;
  range: [dayjs.Dayjs, dayjs.Dayjs];
  isActive: boolean;
  isPermanent: boolean;
};

export default function WindowsTab({
  loading,
  windows,
  onReload,
}: {
  loading: boolean;
  windows: AdminWindow[];
  onReload: () => void;
}) {
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [windowModalOpen, setWindowModalOpen] = useState(false);
  const [editingWindow, setEditingWindow] = useState<AdminWindow | null>(null);
  const [windowForm] = Form.useForm<WindowForm>();

  const activeCount = useMemo(
    () => windows.filter((w) => w.isActive).length,
    [windows],
  );

  const isPermanent = Form.useWatch("isPermanent", windowForm) ?? false;

  function openCreateWindow() {
    setEditingWindow(null);
    windowForm.resetFields();
    windowForm.setFieldsValue({
      name: "Weekly Orders",
      range: [dayjs().startOf("day"), dayjs().add(7, "day").endOf("day")],
      isActive: true,
      isPermanent: false,
    });
    setWindowModalOpen(true);
  }

  function openEditWindow(w: AdminWindow) {
    setEditingWindow(w);
    windowForm.resetFields();
    windowForm.setFieldsValue({
      name: w.name,
      range: [dayjs(w.startsAt), dayjs(w.endsAt)],
      isActive: w.isActive,
      isPermanent: (w as any).isPermanent ?? false,
    });
    setWindowModalOpen(true);
  }

  async function saveWindow() {
    const values = await windowForm.validateFields();

    const payload = {
      name: values.name,
      startsAt: values.range[0].toISOString(),
      endsAt: values.range[1].toISOString(),
      isActive: values.isActive,
      isPermanent: values.isPermanent,
    };

    try {
      if (editingWindow) {
        await api.put(`/api/admin/windows/${editingWindow.id}`, payload);
        message.success("Window updated");
      } else {
        await api.post(`/api/admin/windows`, payload);
        message.success("Window created");
      }
      setWindowModalOpen(false);
      onReload();
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Save failed");
    }
  }

  const columns = useMemo(() => {
    // ✅ Mobile: single “card-like” column + Edit button.
    if (isMobile) {
      return [
        {
          title: "Windows",
          key: "window",
          render: (_: any, w: any) => (
            <div
              style={{
                display: "grid",
                gap: 8,
                padding: 10,
                border: "1px solid rgba(0,0,0,0.08)",
                borderRadius: 12,
                background: "#fff",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 800,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {w.name}
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    {w.isPermanent ? (
                      <Tag color="gold">Always open</Tag>
                    ) : (
                      <Tag>Normal</Tag>
                    )}
                    {w.isActive ? (
                      <Tag color="green">Active</Tag>
                    ) : (
                      <Tag color="red">Inactive</Tag>
                    )}
                  </div>
                </div>

                <Button
                  size="small"
                  type="primary"
                  onClick={() => openEditWindow(w)}
                >
                  Edit
                </Button>
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Starts
                  </Text>
                  <div style={{ fontWeight: 800 }}>
                    {new Date(w.startsAt).toLocaleString()}
                  </div>
                </div>

                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Ends
                  </Text>
                  <div style={{ fontWeight: 800 }}>
                    {new Date(w.endsAt).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          ),
        },
      ] as any[];
    }

    // ✅ Desktop: normal multi-column table
    return [
      { title: "Name", dataIndex: "name", key: "name" },
      {
        title: "Starts",
        dataIndex: "startsAt",
        key: "startsAt",
        render: (v: string) => new Date(v).toLocaleString(),
        width: 200,
      },
      {
        title: "Ends",
        dataIndex: "endsAt",
        key: "endsAt",
        render: (v: string) => new Date(v).toLocaleString(),
        width: 200,
      },
      {
        title: "Permanent",
        key: "isPermanent",
        width: 140,
        render: (_: any, w: any) =>
          w.isPermanent ? (
            <Tag color="gold">Always open</Tag>
          ) : (
            <Tag>Normal</Tag>
          ),
      },
      {
        title: "Active",
        dataIndex: "isActive",
        key: "isActive",
        width: 110,
        render: (v: boolean) =>
          v ? <Tag color="green">Yes</Tag> : <Tag color="red">No</Tag>,
      },
      {
        title: "",
        key: "actions",
        width: 120,
        render: (_: any, w: AdminWindow) => (
          <Button onClick={() => openEditWindow(w)}>Edit</Button>
        ),
      },
    ] as any[];
  }, [isMobile]);

  return (
    <Card
      bodyStyle={{ padding: isMobile ? 12 : undefined }}
      extra={
        isMobile ? (
          // ✅ Mobile header: stacked + full-width CTA
          <div style={{ display: "grid", gap: 10, width: "100%" }}>
            <Tag
              color={activeCount ? "green" : "default"}
              style={{ justifySelf: "start" }}
            >
              Active: {activeCount}
            </Tag>

            <Button type="primary" onClick={openCreateWindow} block>
              New Window
            </Button>
          </div>
        ) : (
          <Space>
            <Text type="secondary">
              Active windows: <b>{activeCount}</b>
            </Text>
            <Button type="primary" onClick={openCreateWindow}>
              New Window
            </Button>
          </Space>
        )
      }
    >
      <Table
        loading={loading}
        rowKey={(r) => (r as any).id}
        dataSource={windows}
        columns={columns as any}
        size={isMobile ? "small" : "middle"}
        // ✅ Mobile: no horizontal scroll needed because it’s single-column cards
        scroll={isMobile ? undefined : undefined}
        pagination={{
          pageSize: isMobile ? 6 : 50,
          showSizeChanger: !isMobile,
        }}
        // ✅ Mobile: hide table header so it feels like a list
        showHeader={!isMobile}
      />

      <Modal
        title={editingWindow ? "Edit Order Window" : "New Order Window"}
        open={windowModalOpen}
        onCancel={() => setWindowModalOpen(false)}
        onOk={saveWindow}
        okText="Save"
        width={isMobile ? "100%" : 720}
        style={isMobile ? { top: 0, padding: 0 } : undefined}
        bodyStyle={isMobile ? { padding: 12 } : undefined}
        okButtonProps={{ size: isMobile ? "large" : "middle" }}
        cancelButtonProps={{ size: isMobile ? "large" : "middle" }}
      >
        <Form layout="vertical" form={windowForm}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input size={isMobile ? "large" : "middle"} />
          </Form.Item>

          <Form.Item
            name="isPermanent"
            label="Always open (permanent)"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="range"
            label="Start / End"
            rules={[{ required: true }]}
            help={
              isPermanent
                ? "Dates won’t matter while window is marked permanent."
                : undefined
            }
          >
            <DatePicker.RangePicker
              showTime
              style={{ width: "100%" }}
              disabled={isPermanent}
              size={isMobile ? "large" : "middle"}
            />
          </Form.Item>

          <Form.Item name="isActive" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
