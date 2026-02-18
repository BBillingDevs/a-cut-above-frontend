import React, { useMemo, useState } from "react";
import {
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import dayjs from "dayjs";
import { api, API_BASE } from "../api/client";
import type { AdminWindow } from "../pages/admin/AdminDashboardPage";

const { Text } = Typography;

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

    // If permanent: we still store dates, but they become irrelevant because permanent wins.
    // Keeping them avoids making endsAt nullable + keeps DB simple.
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

  return (
    <Card
      extra={
        <Space>
          <Text type="secondary">
            Active windows: <b>{activeCount}</b>
          </Text>
          <Button type="primary" onClick={openCreateWindow}>
            New Window
          </Button>
        </Space>
      }
    >
      <Table
        loading={loading}
        rowKey={(r) => r.id}
        dataSource={windows}
        columns={[
          { title: "Name", dataIndex: "name", key: "name" },
          {
            title: "Starts",
            dataIndex: "startsAt",
            key: "startsAt",
            render: (v: string) => new Date(v).toLocaleString(),
          },
          {
            title: "Ends",
            dataIndex: "endsAt",
            key: "endsAt",
            render: (v: string) => new Date(v).toLocaleString(),
          },
          {
            title: "Permanent",
            key: "isPermanent",
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
            render: (v: boolean) =>
              v ? <Tag color="green">Yes</Tag> : <Tag color="red">No</Tag>,
          },
          {
            title: "",
            key: "actions",
            render: (_: any, w: AdminWindow) => (
              <Space>
                <Button onClick={() => openEditWindow(w)}>Edit</Button>
                <Button
                  onClick={() =>
                    window.open(
                      `${API_BASE}/api/admin/windows/${w.id}/packing-list`,
                      "_blank",
                    )
                  }
                >
                  Packing List JSON
                </Button>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editingWindow ? "Edit Order Window" : "New Order Window"}
        open={windowModalOpen}
        onCancel={() => setWindowModalOpen(false)}
        onOk={saveWindow}
        okText="Save"
      >
        <Form layout="vertical" form={windowForm}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>

          <Form.Item
            name="isPermanent"
            label="Always open (permanent)"
            valuePropName="checked"
          >
            <input type="checkbox" />
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
            />
          </Form.Item>

          <Form.Item name="isActive" label="Active" valuePropName="checked">
            <input type="checkbox" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
