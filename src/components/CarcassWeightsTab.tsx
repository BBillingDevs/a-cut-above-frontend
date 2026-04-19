// src/components/CarcassWeightsTab.tsx
import React, { useMemo, useState } from "react";
import {
  Button,
  Card,
  DatePicker,
  Divider,
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
import { api } from "../api/client";
import type { AdminPermission } from "../pages/admin/AdminDashboardPage";

const { Text } = Typography;

type ProductOption = {
  id: string;
  name: string;
  unit: string;
  stockQty?: number;
  isFifthQuarter?: boolean;
};

type CarcassDryWeightRow = {
  id: string;
  carcassBatchId: string;
  productId: string;
  weighedAt: string;
  totalWeightKg: number | string;
  packetCount: number;
  notes?: string | null;
  product?: {
    id: string;
    name: string;
    unit: string;
    isFifthQuarter?: boolean;
  };
};

type CarcassBatchRecord = {
  id: string;
  animalId: string;
  weighedAt: string;
  notes?: string | null;

  hindquarterWeight1Kg: number | string;
  hindquarterWeight2Kg: number | string;
  forequarterWeight1Kg: number | string;
  forequarterWeight2Kg: number | string;
  fifthQuarterWeightKg?: number | string | null;

  totalCarcassWeightKg: number | string;
  totalWetWeightKg: number | string;
  totalDryWeightKg?: number | string | null;

  createdAt: string;
  updatedAt: string;

  dryWeights?: CarcassDryWeightRow[];
};

type FifthQuarterItemForm = {
  productId: string;
  totalWeightKg: number;
  packetCount: number;
  notes?: string;
};

type WetForm = {
  animalId: string;
  weighedAt: dayjs.Dayjs;
  hindquarterWeight1Kg: number;
  hindquarterWeight2Kg: number;
  forequarterWeight1Kg: number;
  forequarterWeight2Kg: number;
  notes?: string;
  fifthQuarterItems: FifthQuarterItemForm[];
};

type DryItemForm = {
  productId: string;
  totalWeightKg: number;
  packetCount: number;
  notes?: string;
};

type DryForm = {
  animalId: string;
  weighedAt: dayjs.Dayjs;
  items: DryItemForm[];
};

function n(v: any): number {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

function fmtKg(v: any) {
  return `${n(v).toFixed(2)} kg`;
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
  records: CarcassBatchRecord[];
  permissions: AdminPermission[];
  onReload: () => void;
}) {
  const canManage = hasPermission(permissions, "carcassweights.manage");

  const [wetModalOpen, setWetModalOpen] = useState(false);
  const [dryModalOpen, setDryModalOpen] = useState(false);

  const [editingWet, setEditingWet] = useState<CarcassBatchRecord | null>(null);
  const [dryTarget, setDryTarget] = useState<CarcassBatchRecord | null>(null);

  const [wetForm] = Form.useForm<WetForm>();
  const [dryForm] = Form.useForm<DryForm>();

  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const sortedRecords = useMemo(
    () =>
      [...(records || [])].sort(
        (a, b) => dayjs(b.weighedAt).valueOf() - dayjs(a.weighedAt).valueOf(),
      ),
    [records],
  );

  const wetFormWatch = Form.useWatch([], wetForm);
  const dryItemsWatch = Form.useWatch("items", dryForm) || [];

  const fifthQuarterProducts = useMemo(
    () => productOptions.filter((p) => p.isFifthQuarter),
    [productOptions],
  );

  const nonFifthQuarterProducts = useMemo(
    () => productOptions.filter((p) => !p.isFifthQuarter),
    [productOptions],
  );

  const fifthQuarterItemsWatch =
    Form.useWatch("fifthQuarterItems", wetForm) || [];

  const wetTotalCarcassPreview = useMemo(() => {
    const v = wetForm.getFieldsValue();
    return (
      n(v.hindquarterWeight1Kg) +
      n(v.hindquarterWeight2Kg) +
      n(v.forequarterWeight1Kg) +
      n(v.forequarterWeight2Kg)
    );
  }, [wetFormWatch, wetForm]);

  const fifthQuarterTotalPreview = useMemo(() => {
    return (fifthQuarterItemsWatch || []).reduce(
      (sum: number, item: any) => sum + n(item?.totalWeightKg),
      0,
    );
  }, [fifthQuarterItemsWatch]);

  const fifthQuarterPacketsPreview = useMemo(() => {
    return (fifthQuarterItemsWatch || []).reduce(
      (sum: number, item: any) => sum + n(item?.packetCount),
      0,
    );
  }, [fifthQuarterItemsWatch]);

  const dryOnlyTotalPreview = useMemo(() => {
    return (dryItemsWatch || []).reduce(
      (sum: number, item: any) => sum + n(item?.totalWeightKg),
      0,
    );
  }, [dryItemsWatch]);

  const dryOnlyPacketsPreview = useMemo(() => {
    return (dryItemsWatch || []).reduce(
      (sum: number, item: any) => sum + n(item?.packetCount),
      0,
    );
  }, [dryItemsWatch]);

  async function loadProductsForCreation() {
    setLoadingProducts(true);
    try {
      const res = await api.get(`/api/admin/products`);
      const products = (res.data?.products || []) as ProductOption[];
      setProductOptions(products);
      return products;
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Failed to load products");
      return [];
    } finally {
      setLoadingProducts(false);
    }
  }

  function buildFifthQuarterItems(products: ProductOption[]) {
    return products
      .filter((p) => p.isFifthQuarter)
      .map((p) => ({
        productId: p.id,
        totalWeightKg: 0,
        packetCount: 0,
        notes: "",
      }));
  }

  async function openCreateWet() {
    setEditingWet(null);
    wetForm.resetFields();

    const products = await loadProductsForCreation();

    wetForm.setFieldsValue({
      animalId: "",
      weighedAt: dayjs(),
      hindquarterWeight1Kg: 0,
      hindquarterWeight2Kg: 0,
      forequarterWeight1Kg: 0,
      forequarterWeight2Kg: 0,
      notes: "",
      fifthQuarterItems: buildFifthQuarterItems(products),
    });

    setWetModalOpen(true);
  }

  async function openEditWet(record: CarcassBatchRecord) {
    setEditingWet(record);
    wetForm.resetFields();

    const products = await loadProductsForCreation();

    const existingFifthQuarterByProductId = new Map(
      (record.dryWeights || [])
        .filter((x) => x.product?.isFifthQuarter)
        .map((x) => [
          String(x.productId),
          {
            productId: x.productId,
            totalWeightKg: n(x.totalWeightKg),
            packetCount: n(x.packetCount),
            notes: x.notes || "",
          },
        ]),
    );

    wetForm.setFieldsValue({
      animalId: record.animalId,
      weighedAt: record.weighedAt ? dayjs(record.weighedAt) : dayjs(),
      hindquarterWeight1Kg: n(record.hindquarterWeight1Kg),
      hindquarterWeight2Kg: n(record.hindquarterWeight2Kg),
      forequarterWeight1Kg: n(record.forequarterWeight1Kg),
      forequarterWeight2Kg: n(record.forequarterWeight2Kg),
      notes: record.notes || "",
      fifthQuarterItems: products
        .filter((p) => p.isFifthQuarter)
        .map((p) => {
          const existing = existingFifthQuarterByProductId.get(String(p.id));
          return (
            existing || {
              productId: p.id,
              totalWeightKg: 0,
              packetCount: 0,
              notes: "",
            }
          );
        }),
    });

    setWetModalOpen(true);
  }

  async function openAddDryWeights(record: CarcassBatchRecord) {
    setDryTarget(record);
    setLoadingProducts(true);
    dryForm.resetFields();

    try {
      const res = await api.get(
        `/api/admin/carcass-weights/${encodeURIComponent(record.animalId)}/products`,
      );

      const products = (res.data?.products || []) as ProductOption[];
      setProductOptions(products);

      const existingByProductId = new Map(
        (record.dryWeights || [])
          .filter((x) => !x.product?.isFifthQuarter)
          .map((row) => [
            String(row.productId),
            {
              productId: row.productId,
              totalWeightKg: n(row.totalWeightKg),
              packetCount: n(row.packetCount),
              notes: row.notes || "",
            },
          ]),
      );

      dryForm.setFieldsValue({
        animalId: record.animalId,
        weighedAt: dayjs(),
        items: products
          .filter((p) => !p.isFifthQuarter)
          .map((p) => {
            const existing = existingByProductId.get(String(p.id));
            return (
              existing || {
                productId: p.id,
                totalWeightKg: 0,
                packetCount: 0,
                notes: "",
              }
            );
          }),
      });

      setDryModalOpen(true);
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Failed to load products");
    } finally {
      setLoadingProducts(false);
    }
  }

  async function saveWetRecord() {
    const values = await wetForm.validateFields();

    const payload = {
      animalId: String(values.animalId || "").trim(),
      weighedAt: values.weighedAt ? values.weighedAt.toISOString() : null,
      hindquarterWeight1Kg: n(values.hindquarterWeight1Kg),
      hindquarterWeight2Kg: n(values.hindquarterWeight2Kg),
      forequarterWeight1Kg: n(values.forequarterWeight1Kg),
      forequarterWeight2Kg: n(values.forequarterWeight2Kg),
      notes: values.notes?.trim() || "",
      fifthQuarterItems: (values.fifthQuarterItems || [])
        .map((item) => ({
          productId: String(item.productId || "").trim(),
          totalWeightKg: n(item.totalWeightKg),
          packetCount: Math.trunc(n(item.packetCount)),
          notes: item.notes?.trim() || "",
        }))
        .filter(
          (item) =>
            item.productId &&
            (item.totalWeightKg > 0 || item.packetCount > 0 || item.notes),
        ),
    };

    try {
      if (editingWet) {
        await api.put(
          `/api/admin/carcass-weights/wet/${editingWet.id}`,
          payload,
        );
        message.success("Record updated");
      } else {
        await api.post(`/api/admin/carcass-weights/wet`, payload);
        message.success("Record created");
      }

      setWetModalOpen(false);
      setEditingWet(null);
      onReload();
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Save failed");
    }
  }

  async function saveDryRecord() {
    if (!dryTarget) return;

    const values = await dryForm.validateFields();

    const items = (values.items || [])
      .map((item) => ({
        productId: String(item.productId || "").trim(),
        totalWeightKg: n(item.totalWeightKg),
        packetCount: Math.trunc(n(item.packetCount)),
        notes: item.notes?.trim() || "",
      }))
      .filter(
        (item) =>
          item.productId &&
          (item.totalWeightKg > 0 || item.packetCount > 0 || item.notes),
      );

    if (items.length === 0) {
      message.error("Enter at least one dry product line");
      return;
    }

    try {
      await api.post(`/api/admin/carcass-weights/dry`, {
        animalId: dryTarget.animalId,
        weighedAt: values.weighedAt ? values.weighedAt.toISOString() : null,
        items,
      });

      message.success("Dry weights saved");
      setDryModalOpen(false);
      setDryTarget(null);
      onReload();
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Save failed");
    }
  }

  async function deleteWetRecord(id: string) {
    try {
      await api.delete(`/api/admin/carcass-weights/wet/${id}`);
      message.success("Record deleted");
      onReload();
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Delete failed");
    }
  }

  function getFifthQuarterTotal(row: CarcassBatchRecord) {
    return (row.dryWeights || []).reduce((sum, item) => {
      return item.product?.isFifthQuarter ? sum + n(item.totalWeightKg) : sum;
    }, 0);
  }

  function getDryWeightTotal(row: CarcassBatchRecord) {
    return (row.dryWeights || []).reduce((sum, item) => {
      return !item.product?.isFifthQuarter ? sum + n(item.totalWeightKg) : sum;
    }, 0);
  }

  function hasDryWeights(row: CarcassBatchRecord) {
    return (row.dryWeights || []).some((x) => !x.product?.isFifthQuarter);
  }

  const columns = [
    {
      title: "Tag Number",
      dataIndex: "animalId",
      key: "animalId",
      render: (v: any) => <b>{v}</b>,
    },
    {
      title: "Live Weight",
      dataIndex: "totalWetWeightKg",
      key: "totalWetWeightKg",
      width: 140,
      render: (v: any) => fmtKg(v),
    },
    {
      title: "5th Quarter",
      key: "fifthQuarterTotal",
      width: 140,
      render: (_: any, row: CarcassBatchRecord) => {
        const total = getFifthQuarterTotal(row);
        return total > 0 ? fmtKg(total) : <Tag color="gold">Pending</Tag>;
      },
    },
    {
      title: "Dry Weight",
      key: "dryWeightOnlyTotal",
      width: 140,
      render: (_: any, row: CarcassBatchRecord) => {
        const total = getDryWeightTotal(row);
        return total > 0 ? fmtKg(total) : <Tag color="gold">Pending</Tag>;
      },
    },
    {
      title: "Wet Date",
      dataIndex: "weighedAt",
      key: "weighedAt",
      width: 130,
      render: (v: string) => (v ? dayjs(v).format("D MMM YYYY") : "—"),
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
      width: 320,
      render: (_: any, row: CarcassBatchRecord) =>
        canManage ? (
          <Space wrap>
            <Button type="primary" onClick={() => openAddDryWeights(row)}>
              {hasDryWeights(row) ? "Edit Dry Weights" : "Add Dry Weights"}
            </Button>
            <Button onClick={() => openEditWet(row)}>Edit</Button>
            <Popconfirm
              title="Delete this record?"
              okText="Delete"
              okButtonProps={{ danger: true }}
              onConfirm={() => deleteWetRecord(row.id)}
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
          <Button type="primary" onClick={openCreateWet}>
            New Entry
          </Button>
        ) : null
      }
    >
      <Table
        loading={loading}
        rowKey={(r) => r.id}
        dataSource={sortedRecords}
        columns={columns as any}
        expandable={{
          expandedRowRender: (row: CarcassBatchRecord) => {
            const fifthQuarterRows = (row.dryWeights || []).filter(
              (x) => x.product?.isFifthQuarter,
            );
            const dryRows = (row.dryWeights || []).filter(
              (x) => !x.product?.isFifthQuarter,
            );

            return (
              <div style={{ display: "grid", gap: 14 }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 12,
                  }}
                >
                  <Card size="small">
                    <Text type="secondary">Hindquarter 1</Text>
                    <div style={{ fontWeight: 700, marginTop: 4 }}>
                      {fmtKg(row.hindquarterWeight1Kg)}
                    </div>
                  </Card>
                  <Card size="small">
                    <Text type="secondary">Hindquarter 2</Text>
                    <div style={{ fontWeight: 700, marginTop: 4 }}>
                      {fmtKg(row.hindquarterWeight2Kg)}
                    </div>
                  </Card>
                  <Card size="small">
                    <Text type="secondary">Forequarter 1</Text>
                    <div style={{ fontWeight: 700, marginTop: 4 }}>
                      {fmtKg(row.forequarterWeight1Kg)}
                    </div>
                  </Card>
                  <Card size="small">
                    <Text type="secondary">Forequarter 2</Text>
                    <div style={{ fontWeight: 700, marginTop: 4 }}>
                      {fmtKg(row.forequarterWeight2Kg)}
                    </div>
                  </Card>
                  <Card size="small">
                    <Text type="secondary">Carcass Weight</Text>
                    <div style={{ fontWeight: 700, marginTop: 4 }}>
                      {fmtKg(row.totalCarcassWeightKg)}
                    </div>
                  </Card>
                  <Card size="small">
                    <Text type="secondary">Live Weight</Text>
                    <div style={{ fontWeight: 700, marginTop: 4 }}>
                      {fmtKg(row.totalWetWeightKg)}
                    </div>
                  </Card>
                </div>

                <div>
                  <Text strong>5th Quarter Products</Text>
                  <Table
                    size="small"
                    style={{ marginTop: 10 }}
                    rowKey={(r: any) => r.id}
                    dataSource={fifthQuarterRows}
                    pagination={false}
                    locale={{
                      emptyText: "No 5th quarter products entered yet",
                    }}
                    columns={[
                      {
                        title: "Product",
                        key: "product",
                        render: (_: any, item: CarcassDryWeightRow) =>
                          item.product?.name || "—",
                      },
                      {
                        title: "Weight",
                        dataIndex: "totalWeightKg",
                        key: "totalWeightKg",
                        width: 130,
                        render: (v: any) => fmtKg(v),
                      },
                      {
                        title: "Packets",
                        dataIndex: "packetCount",
                        key: "packetCount",
                        width: 110,
                      },
                      {
                        title: "Notes",
                        dataIndex: "notes",
                        key: "notes",
                        render: (v: any) =>
                          v ? v : <Text type="secondary">—</Text>,
                      },
                    ]}
                  />
                </div>

                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      marginBottom: 10,
                      marginTop: 6,
                    }}
                  >
                    <Text strong>Dry Weight Products</Text>
                    {canManage ? (
                      <Button
                        type="primary"
                        onClick={() => openAddDryWeights(row)}
                      >
                        {hasDryWeights(row)
                          ? "Edit Dry Weights"
                          : "Add Dry Weights"}
                      </Button>
                    ) : null}
                  </div>

                  <Table
                    size="small"
                    rowKey={(r: any) => r.id}
                    dataSource={dryRows}
                    pagination={false}
                    locale={{ emptyText: "No dry-weight products entered yet" }}
                    columns={[
                      {
                        title: "Product",
                        key: "product",
                        render: (_: any, item: CarcassDryWeightRow) =>
                          item.product?.name || "—",
                      },
                      {
                        title: "Weight",
                        dataIndex: "totalWeightKg",
                        key: "totalWeightKg",
                        width: 130,
                        render: (v: any) => fmtKg(v),
                      },
                      {
                        title: "Packets",
                        dataIndex: "packetCount",
                        key: "packetCount",
                        width: 110,
                      },
                      {
                        title: "Notes",
                        dataIndex: "notes",
                        key: "notes",
                        render: (v: any) =>
                          v ? v : <Text type="secondary">—</Text>,
                      },
                    ]}
                  />
                </div>
              </div>
            );
          },
        }}
      />

      <Modal
        title={editingWet ? "Edit Entry" : "New Entry"}
        open={wetModalOpen}
        onCancel={() => {
          setWetModalOpen(false);
          setEditingWet(null);
        }}
        onOk={saveWetRecord}
        okText="Save"
        width={1100}
        confirmLoading={loadingProducts}
      >
        <Form form={wetForm} layout="vertical">
          <Form.Item
            name="animalId"
            label="Tag Number"
            rules={[{ required: true, message: "Tag number is required" }]}
          >
            <Input placeholder="e.g. BEEF-001" disabled={!!editingWet} />
          </Form.Item>

          <Form.Item
            name="weighedAt"
            label="Wet / Live Weight Date"
            rules={[{ required: true, message: "Date is required" }]}
          >
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>

          <Divider orientation="left">Quarter Weights</Divider>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            <Form.Item
              name="hindquarterWeight1Kg"
              label="Hindquarter Weight 1 (kg)"
              rules={[{ required: true, message: "Required" }]}
            >
              <InputNumber min={0} step={0.1} style={{ width: "100%" }} />
            </Form.Item>

            <Form.Item
              name="hindquarterWeight2Kg"
              label="Hindquarter Weight 2 (kg)"
              rules={[{ required: true, message: "Required" }]}
            >
              <InputNumber min={0} step={0.1} style={{ width: "100%" }} />
            </Form.Item>

            <Form.Item
              name="forequarterWeight1Kg"
              label="Forequarter Weight 1 (kg)"
              rules={[{ required: true, message: "Required" }]}
            >
              <InputNumber min={0} step={0.1} style={{ width: "100%" }} />
            </Form.Item>

            <Form.Item
              name="forequarterWeight2Kg"
              label="Forequarter Weight 2 (kg)"
              rules={[{ required: true, message: "Required" }]}
            >
              <InputNumber min={0} step={0.1} style={{ width: "100%" }} />
            </Form.Item>
          </div>

          <Card
            size="small"
            style={{ marginBottom: 16, background: "#fafafa" }}
          >
            <div style={{ display: "grid", gap: 6 }}>
              <Text>
                <strong>Carcass Weight:</strong>{" "}
                {wetTotalCarcassPreview.toFixed(2)} kg
              </Text>
              <Text>
                <strong>5th Quarter Weight:</strong>{" "}
                {fifthQuarterTotalPreview.toFixed(2)} kg
              </Text>
              <Text>
                <strong>Total 5th Quarter Packs:</strong>{" "}
                {fifthQuarterPacketsPreview}
              </Text>
            </div>
          </Card>

          <Divider orientation="left">5th Quarter Products</Divider>

          <Form.List name="fifthQuarterItems">
            {(fields) => (
              <div style={{ display: "grid", gap: 10 }}>
                {fields.length === 0 ? (
                  <Text type="secondary">
                    No products are marked as 5th quarter.
                  </Text>
                ) : (
                  fields.map((field) => {
                    const productId = wetForm.getFieldValue([
                      "fifthQuarterItems",
                      field.name,
                      "productId",
                    ]);
                    const product = fifthQuarterProducts.find(
                      (p) => String(p.id) === String(productId),
                    );

                    return (
                      <Card key={field.key} size="small">
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "2fr 1fr 1fr",
                            gap: 12,
                          }}
                        >
                          <div>
                            <Form.Item
                              {...field}
                              name={[field.name, "productId"]}
                              hidden
                              rules={[{ required: true, message: "Required" }]}
                            >
                              <Input />
                            </Form.Item>

                            <Form.Item
                              label="Product"
                              style={{ marginBottom: 0 }}
                            >
                              <Input disabled value={product?.name || ""} />
                            </Form.Item>
                          </div>

                          <Form.Item
                            {...field}
                            name={[field.name, "totalWeightKg"]}
                            label="Total Weight (kg)"
                            rules={[{ required: true, message: "Required" }]}
                          >
                            <InputNumber
                              min={0}
                              step={0.1}
                              style={{ width: "100%" }}
                            />
                          </Form.Item>

                          <Form.Item
                            {...field}
                            name={[field.name, "packetCount"]}
                            label="Packets"
                            rules={[{ required: true, message: "Required" }]}
                          >
                            <InputNumber
                              min={0}
                              step={1}
                              style={{ width: "100%" }}
                            />
                          </Form.Item>
                        </div>

                        <Form.Item
                          {...field}
                          name={[field.name, "notes"]}
                          label="Notes"
                          style={{ marginBottom: 0 }}
                        >
                          <Input.TextArea rows={2} />
                        </Form.Item>

                        <div style={{ marginTop: 8 }}>
                          <Text type="secondary">
                            {product?.name || "Product"}
                            {product?.unit ? ` • unit: ${product.unit}` : ""}
                            {typeof product?.stockQty === "number"
                              ? ` • current stock: ${product.stockQty}`
                              : ""}
                          </Text>
                        </div>
                      </Card>
                    );
                  })
                )}
              </div>
            )}
          </Form.List>

          <Form.Item name="notes" label="Notes" style={{ marginTop: 16 }}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          dryTarget
            ? `${hasDryWeights(dryTarget) ? "Edit" : "Add"} Dry Weights — ${dryTarget.animalId}`
            : "Dry Weights"
        }
        open={dryModalOpen}
        onCancel={() => {
          setDryModalOpen(false);
          setDryTarget(null);
        }}
        onOk={saveDryRecord}
        okText="Save Dry Weights"
        width={1000}
        confirmLoading={loadingProducts}
      >
        <Form form={dryForm} layout="vertical">
          <Form.Item name="animalId" label="Tag Number">
            <Input disabled />
          </Form.Item>

          <Form.Item
            name="weighedAt"
            label="Dry Weight Date"
            rules={[{ required: true, message: "Dry weight date is required" }]}
          >
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>

          <Divider orientation="left">Dry Weight Products</Divider>

          <Form.List name="items">
            {(fields) => (
              <div style={{ display: "grid", gap: 10 }}>
                {fields.length === 0 ? (
                  <Text type="secondary">No dry-weight products found.</Text>
                ) : (
                  fields.map((field) => {
                    const productId = dryForm.getFieldValue([
                      "items",
                      field.name,
                      "productId",
                    ]);
                    const product = nonFifthQuarterProducts.find(
                      (p) => String(p.id) === String(productId),
                    );

                    return (
                      <Card key={field.key} size="small">
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "2fr 1fr 1fr",
                            gap: 12,
                          }}
                        >
                          <div>
                            <Form.Item
                              {...field}
                              name={[field.name, "productId"]}
                              hidden
                              rules={[{ required: true, message: "Required" }]}
                            >
                              <Input />
                            </Form.Item>

                            <Form.Item
                              label="Product"
                              style={{ marginBottom: 0 }}
                            >
                              <Input disabled value={product?.name || ""} />
                            </Form.Item>
                          </div>

                          <Form.Item
                            {...field}
                            name={[field.name, "totalWeightKg"]}
                            label="Total Weight (kg)"
                            rules={[{ required: true, message: "Required" }]}
                          >
                            <InputNumber
                              min={0}
                              step={0.1}
                              style={{ width: "100%" }}
                            />
                          </Form.Item>

                          <Form.Item
                            {...field}
                            name={[field.name, "packetCount"]}
                            label="Packets"
                            rules={[{ required: true, message: "Required" }]}
                          >
                            <InputNumber
                              min={0}
                              step={1}
                              style={{ width: "100%" }}
                            />
                          </Form.Item>
                        </div>

                        <Form.Item
                          {...field}
                          name={[field.name, "notes"]}
                          label="Notes"
                          style={{ marginBottom: 0 }}
                        >
                          <Input.TextArea rows={2} />
                        </Form.Item>

                        <div style={{ marginTop: 8 }}>
                          <Text type="secondary">
                            {product?.name || "Product"}
                            {product?.unit ? ` • unit: ${product.unit}` : ""}
                            {typeof product?.stockQty === "number"
                              ? ` • current stock: ${product.stockQty}`
                              : ""}
                          </Text>
                        </div>
                      </Card>
                    );
                  })
                )}
              </div>
            )}
          </Form.List>

          <Card size="small" style={{ marginTop: 16, background: "#fafafa" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <Text>
                <strong>Dry Weight Total:</strong>{" "}
                {dryOnlyTotalPreview.toFixed(2)} kg
              </Text>
              <Text>
                <strong>Total Packets Added To Stock:</strong>{" "}
                {dryOnlyPacketsPreview}
              </Text>
            </div>
          </Card>
        </Form>
      </Modal>
    </Card>
  );
}
