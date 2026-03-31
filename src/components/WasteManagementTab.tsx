import React, { useMemo, useState } from "react";
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { api } from "../api/client";
import type { AdminProduct } from "../pages/admin/AdminDashboardPage";

const { Text } = Typography;

type WasteRecord = {
  id: string;
  productId: string;
  qtyWasted: number;
  totalWeightG?: number | null;
  notes?: string | null;
  costValueLost: string | number;
  retailValueLost?: string | number;
  wholesaleValueLost?: string | number;
  createdAt: string;
};

type WasteForm = {
  productId: string;
  packsWasted: number;
  weightValue?: number | null;
  weightUnit: "g" | "kg";
  reason?: string;
};

function n(v: any): number {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

function money(v: number | string | null | undefined) {
  return `$${n(v).toFixed(2)}`;
}

function fmtGrams(g: number | null | undefined) {
  if (g === null || g === undefined) return "—";
  return g >= 1000 ? `${(g / 1000).toFixed(2)} kg` : `${g} g`;
}

function convertWeightToGrams(
  value: number | null | undefined,
  unit: "g" | "kg",
): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }
  return unit === "kg" ? Math.round(value * 1000) : Math.round(value);
}

function convertWeightToProductUnits(
  value: number | null | undefined,
  enteredUnit: "g" | "kg",
  productUnit: string,
): number {
  if (value === null || value === undefined || !Number.isFinite(value))
    return 0;

  const pu = String(productUnit || "").toLowerCase();

  if (pu === "kg") {
    return enteredUnit === "g" ? value / 1000 : value;
  }

  if (pu === "g") {
    return enteredUnit === "kg" ? value * 1000 : value;
  }

  return 0;
}

type ProductWasteSummaryRow = {
  key: string;
  productId: string;
  productName: string;
  unit: string;
  stockQty: number;
  costPrice: number;
  totalPacksWasted: number;
  totalWeightWastedG: number;
  totalWasteValue: number;
};

export default function WasteManagementTab({
  loading,
  products,
  onReload,
}: {
  loading: boolean;
  products: AdminProduct[];
  onReload: () => void;
}) {
  const [form] = Form.useForm<WasteForm>();
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);

  const [historyProduct, setHistoryProduct] = useState<AdminProduct | null>(
    null,
  );
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRows, setHistoryRows] = useState<WasteRecord[]>([]);

  const watchedProductId = Form.useWatch("productId", form);
  const watchedPacksWasted = Form.useWatch("packsWasted", form);
  const watchedWeightValue = Form.useWatch("weightValue", form);
  const watchedWeightUnit =
    (Form.useWatch("weightUnit", form) as "g" | "kg" | undefined) ?? "g";

  const activeProducts = useMemo(
    () => (products || []).filter((p) => p.isActive),
    [products],
  );

  const selectedProduct = useMemo(
    () =>
      activeProducts.find(
        (p) => String(p.id) === String(watchedProductId || ""),
      ) || null,
    [activeProducts, watchedProductId],
  );

  const selectedUnit = String(selectedProduct?.unit || "").toLowerCase();
  const needsWeight = selectedUnit === "kg" || selectedUnit === "g";
  const isPackOnly = selectedUnit === "pack";

  const productOptions = useMemo(
    () =>
      activeProducts.map((p) => ({
        label: `${p.name} (${p.unit})`,
        value: p.id,
      })),
    [activeProducts],
  );

  const wasteSummaryRows = useMemo<ProductWasteSummaryRow[]>(
    () =>
      activeProducts
        .map((p) => ({
          key: p.id,
          productId: p.id,
          productName: p.name,
          unit: p.unit,
          stockQty: n(p.stockQty),
          costPrice: n((p as any).costPrice),
          totalPacksWasted: n((p as any).totalPacksWasted),
          totalWeightWastedG: n((p as any).totalWeightWastedG),
          totalWasteValue: n((p as any).totalWasteValue),
        }))
        .sort((a, b) => b.totalWasteValue - a.totalWasteValue),
    [activeProducts],
  );

  const totals = useMemo(() => {
    return wasteSummaryRows.reduce(
      (acc, row) => {
        acc.totalWasteValue += row.totalWasteValue;
        acc.totalPacksWasted += row.totalPacksWasted;
        acc.totalWeightWastedG += row.totalWeightWastedG;
        return acc;
      },
      {
        totalWasteValue: 0,
        totalPacksWasted: 0,
        totalWeightWastedG: 0,
      },
    );
  }, [wasteSummaryRows]);

  const preview = useMemo(() => {
    if (!selectedProduct) {
      return {
        stockAfter: 0,
        estimatedWasteValue: 0,
      };
    }

    const packsWasted = n(watchedPacksWasted);
    const weightValue = n(watchedWeightValue);
    const costPrice = n((selectedProduct as any).costPrice);
    const unit = String(selectedProduct.unit || "").toLowerCase();

    let estimatedWasteValue = 0;

    if (unit === "pack") {
      estimatedWasteValue = packsWasted * costPrice;
    } else if (unit === "kg" || unit === "g") {
      const qtyInProductUnits = convertWeightToProductUnits(
        weightValue,
        watchedWeightUnit,
        unit,
      );
      estimatedWasteValue = qtyInProductUnits * costPrice;
    }

    return {
      stockAfter: Math.max(0, n(selectedProduct.stockQty) - packsWasted),
      estimatedWasteValue,
    };
  }, [
    selectedProduct,
    watchedPacksWasted,
    watchedWeightValue,
    watchedWeightUnit,
  ]);

  function openRecordModal(prefillProductId?: string) {
    form.resetFields();
    form.setFieldsValue({
      productId: prefillProductId || undefined,
      packsWasted: 0,
      weightValue: null,
      weightUnit: "g",
      reason: "",
    });
    setRecordModalOpen(true);
  }

  async function openHistoryModal(product: AdminProduct) {
    setHistoryModalOpen(true);
    setHistoryProduct(product);
    setHistoryRows([]);
    setHistoryLoading(true);

    try {
      const res = await api.get(`/api/admin/products/${product.id}/waste`);
      setHistoryRows(res.data?.wastes || []);
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Failed to load waste history");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function submitWaste() {
    const values = await form.validateFields();
    const productId = values.productId;
    const product = activeProducts.find((p) => p.id === productId);
    const unit = String(product?.unit || "").toLowerCase();

    if (unit === "pack" && n(values.packsWasted) <= 0) {
      message.error("Enter packs wasted");
      return;
    }

    if ((unit === "kg" || unit === "g") && n(values.packsWasted) <= 0) {
      message.error("Enter packs wasted");
      return;
    }

    if (
      (unit === "kg" || unit === "g") &&
      (values.weightValue === null ||
        values.weightValue === undefined ||
        n(values.weightValue) <= 0)
    ) {
      message.error("Enter total weight wasted");
      return;
    }

    try {
      await api.post(`/api/admin/products/${productId}/waste`, {
        packsWasted: n(values.packsWasted),
        weightValue: values.weightValue ?? null,
        weightUnit: values.weightUnit ?? "g",
        reason: (values.reason || "").trim(),
      });

      message.success("Waste recorded");
      setRecordModalOpen(false);
      form.resetFields();
      onReload();
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Failed to record waste");
    }
  }

  async function deleteWasteRecord(wasteId: string) {
    if (!historyProduct) return;

    try {
      await api.delete(
        `/api/admin/products/${historyProduct.id}/waste/${wasteId}`,
      );
      message.success("Waste record removed");

      const res = await api.get(
        `/api/admin/products/${historyProduct.id}/waste`,
      );
      setHistoryRows(res.data?.wastes || []);
      onReload();
    } catch (e: any) {
      message.error(
        e?.response?.data?.error || "Failed to remove waste record",
      );
    }
  }

  const summaryColumns: ColumnsType<ProductWasteSummaryRow> = [
    {
      title: "Product",
      dataIndex: "productName",
      key: "productName",
    },
    {
      title: "Unit",
      dataIndex: "unit",
      key: "unit",
      width: 90,
    },
    {
      title: "Stock",
      dataIndex: "stockQty",
      key: "stockQty",
      width: 90,
    },
    {
      title: "Cost Price",
      dataIndex: "costPrice",
      key: "costPrice",
      width: 120,
      render: (v) => money(v),
    },
    {
      title: "Wasted Packs",
      dataIndex: "totalPacksWasted",
      key: "totalPacksWasted",
      width: 130,
    },
    {
      title: "Wasted Weight",
      dataIndex: "totalWeightWastedG",
      key: "totalWeightWastedG",
      width: 140,
      render: (v) => fmtGrams(v),
    },
    {
      title: "Waste Value",
      dataIndex: "totalWasteValue",
      key: "totalWasteValue",
      width: 140,
      render: (v) => money(v),
    },
    {
      title: "",
      key: "actions",
      width: 220,
      render: (_, row) => (
        <Space wrap>
          <Button size="small" onClick={() => openRecordModal(row.productId)}>
            Record Waste
          </Button>
          <Button
            size="small"
            onClick={() => {
              const p = activeProducts.find((x) => x.id === row.productId);
              if (p) openHistoryModal(p);
            }}
          >
            History
          </Button>
        </Space>
      ),
    },
  ];

  const historyColumns: ColumnsType<WasteRecord> = [
    {
      title: "Date",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 180,
      render: (v) => new Date(v).toLocaleString(),
    },
    {
      title: "Packs",
      dataIndex: "qtyWasted",
      key: "qtyWasted",
      width: 90,
    },
    {
      title: "Weight",
      dataIndex: "totalWeightG",
      key: "totalWeightG",
      width: 130,
      render: (v) => fmtGrams(v),
    },
    {
      title: "Cost Value Lost",
      dataIndex: "costValueLost",
      key: "costValueLost",
      width: 140,
      render: (v) => money(v),
    },
    {
      title: "Reason",
      dataIndex: "notes",
      key: "notes",
      render: (v) => v || "—",
    },
    {
      title: "",
      key: "actions",
      width: 140,
      render: (_, row) => (
        <Popconfirm
          title="Remove this waste record and restore stock?"
          description="Use this only if the waste was recorded by mistake."
          okText="Remove"
          okButtonProps={{ danger: true }}
          onConfirm={() => deleteWasteRecord(row.id)}
        >
          <Button danger size="small">
            Undo
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Row gutter={[12, 12]}>
        <Col xs={24} sm={8}>
          <Card loading={loading}>
            <Statistic
              title="Total Value of Waste"
              value={money(totals.totalWasteValue)}
            />
          </Card>
        </Col>

        <Col xs={24} sm={8}>
          <Card loading={loading}>
            <Statistic
              title="Total Packs Wasted"
              value={totals.totalPacksWasted}
            />
          </Card>
        </Col>

        <Col xs={24} sm={8}>
          <Card loading={loading}>
            <Statistic
              title="Total Weight Wasted"
              value={fmtGrams(totals.totalWeightWastedG)}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="Waste Management"
        extra={
          <Button type="primary" onClick={() => openRecordModal()}>
            Record Waste
          </Button>
        }
      >
        <Table
          loading={loading}
          rowKey="key"
          dataSource={wasteSummaryRows}
          columns={summaryColumns}
          scroll={{ x: 1100 }}
        />
      </Card>

      <Modal
        title="Record Product Waste"
        open={recordModalOpen}
        onCancel={() => {
          setRecordModalOpen(false);
          form.resetFields();
        }}
        onOk={submitWaste}
        okText="Save Waste"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="productId"
            label="Product"
            rules={[{ required: true, message: "Select a product" }]}
          >
            <Select
              showSearch
              placeholder="Select product"
              options={productOptions}
              optionFilterProp="label"
            />
          </Form.Item>

          {selectedProduct ? (
            <Card
              size="small"
              style={{ marginBottom: 16, background: "#fafafa" }}
            >
              <div style={{ display: "grid", gap: 6 }}>
                <Text>
                  <strong>Current stock:</strong> {selectedProduct.stockQty}
                </Text>
                <Text>
                  <strong>Unit:</strong> {selectedProduct.unit}
                </Text>
                <Text>
                  <strong>Cost price:</strong>{" "}
                  {money((selectedProduct as any).costPrice)}
                </Text>
                <Text>
                  <strong>Total waste so far:</strong>{" "}
                  {n((selectedProduct as any).totalPacksWasted)} packs /{" "}
                  {fmtGrams(n((selectedProduct as any).totalWeightWastedG))} /{" "}
                  {money((selectedProduct as any).totalWasteValue)}
                </Text>
              </div>
            </Card>
          ) : null}

          <Form.Item
            name="packsWasted"
            label="Packs wasted"
            rules={[{ required: true, message: "Enter packs wasted" }]}
            extra={
              needsWeight
                ? "For kg/g products, stock still reduces by number of packs wasted."
                : "For pack products, value is calculated from packs wasted."
            }
          >
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>

          {needsWeight ? (
            <Form.Item
              label="Total weight wasted"
              extra="Value is calculated from the entered weight converted to the product unit."
              required
            >
              <Space.Compact style={{ width: "100%" }}>
                <Form.Item
                  name="weightValue"
                  noStyle
                  rules={[
                    {
                      validator: async (_, value) => {
                        if (!needsWeight) return;
                        if (
                          value === null ||
                          value === undefined ||
                          value === ""
                        ) {
                          throw new Error("Enter wasted weight");
                        }
                      },
                    },
                  ]}
                >
                  <InputNumber
                    min={0}
                    step={0.1}
                    placeholder="e.g. 750"
                    style={{ width: "100%" }}
                  />
                </Form.Item>
                <Form.Item name="weightUnit" noStyle initialValue="g">
                  <Select
                    style={{ width: 90 }}
                    options={[
                      { value: "g", label: "g" },
                      { value: "kg", label: "kg" },
                    ]}
                  />
                </Form.Item>
              </Space.Compact>
            </Form.Item>
          ) : null}

          <Form.Item name="reason" label="Reason (optional)">
            <Input.TextArea
              rows={3}
              placeholder="e.g. damaged, spoiled, trimming loss"
            />
          </Form.Item>

          {selectedProduct ? (
            <Card size="small" style={{ background: "#fafafa" }}>
              <div style={{ display: "grid", gap: 6 }}>
                <Text>
                  <strong>Stock after waste:</strong> {preview.stockAfter}
                </Text>
                <Text>
                  <strong>Estimated waste value:</strong>{" "}
                  {money(preview.estimatedWasteValue)}
                </Text>
                <Text type="secondary">
                  {isPackOnly
                    ? "Pack product: value uses wasted packs."
                    : "Kg/g product: stock uses wasted packs, value uses wasted weight in the product's unit basis."}
                </Text>
              </div>
            </Card>
          ) : null}
        </Form>
      </Modal>

      <Modal
        title={
          historyProduct
            ? `Waste History — ${historyProduct.name}`
            : "Waste History"
        }
        open={historyModalOpen}
        onCancel={() => {
          setHistoryModalOpen(false);
          setHistoryProduct(null);
          setHistoryRows([]);
        }}
        footer={null}
        width={1000}
      >
        <Table
          loading={historyLoading}
          rowKey="id"
          dataSource={historyRows}
          columns={historyColumns}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 900 }}
        />
        <div style={{ marginTop: 12 }}>
          <Text type="secondary">Use Undo only for mistaken entries.</Text>
        </div>
      </Modal>
    </Space>
  );
}
