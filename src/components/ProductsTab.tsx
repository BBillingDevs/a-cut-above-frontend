import React, { useMemo, useState, useEffect } from "react";
import {
  Button,
  Card,
  Dropdown,
  Form,
  Input,
  InputNumber,
  MenuProps,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
  Switch,
  message,
} from "antd";
import type { UploadProps } from "antd";
import { UploadOutlined, MoreOutlined } from "@ant-design/icons";
import { api, RAILWAY_BASE } from "../api/client";
import type {
  AdminCategory,
  AdminProduct,
} from "../pages/admin/AdminDashboardPage";
import { IconPreview } from "./iconCatalog";

const { Text } = Typography;

type ProductForm = {
  name: string;
  description?: string;
  unit: string;
  retailPrice: number;
  wholesalePrice: number;
  costPrice: number;
  stockQty: number;
  isActive: boolean;
  isFifthQuarter: boolean;
  categoryId: string | null;
  cutType?: string;
  avgWeightValue?: number | null;
  avgWeightUnit: "g" | "kg";
};

type WasteForm = {
  packsWasted: number;
  weightValue?: number | null;
  weightUnit: "g" | "kg";
  reason?: string;
};

function resolveImageUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("/uploads/")) return `${RAILWAY_BASE}${url}`;
  return null;
}

function fmtGrams(g: number | null | undefined) {
  if (g === null || g === undefined) return "—";
  return g >= 1000 ? `${(g / 1000).toFixed(2)} kg` : `${g} g`;
}

function toGrams(
  value: number | null | undefined,
  unit: "g" | "kg",
): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value) || value < 0) return null;
  return unit === "kg" ? Math.round(value * 1000) : Math.round(value);
}

function fromGrams(grams: number | null | undefined): {
  value: number | null;
  unit: "g" | "kg";
} {
  if (grams === null || grams === undefined) return { value: null, unit: "g" };
  if (grams >= 1000 && grams % 1000 === 0)
    return { value: grams / 1000, unit: "kg" };
  if (grams >= 1000)
    return { value: parseFloat((grams / 1000).toFixed(3)), unit: "kg" };
  return { value: grams, unit: "g" };
}

function money(v: number | string | null | undefined) {
  return `$${Number(v ?? 0).toFixed(2)}`;
}

export default function ProductsTab({
  loading,
  products,
  categories,
  onReload,
}: {
  loading: boolean;
  products: AdminProduct[];
  categories: AdminCategory[];
  onReload: () => void;
}) {
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(
    null as AdminProduct | null,
  );
  const [productForm] = Form.useForm();

  const [wasteModalOpen, setWasteModalOpen] = useState(false);
  const [wasteProduct, setWasteProduct] = useState(null as AdminProduct | null);
  const [wasteForm] = Form.useForm();

  const [groupByCategory, setGroupByCategory] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [pendingImageFile, setPendingImageFile] = useState(null as File | null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState(
    null as string | null,
  );

  useEffect(() => {
    return () => {
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    };
  }, [pendingPreviewUrl]);

  function resetPendingImage() {
    setPendingImageFile(null);
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    setPendingPreviewUrl(null);
  }

  const categoryOptions = useMemo(
    () => [
      { label: "Unassigned", value: "__none__" },
      ...categories.map((c) => ({ label: c.name, value: c.id })),
    ],
    [categories],
  );

  const visibleProducts = useMemo(
    () => products.filter((p) => (showArchived ? !p.isActive : p.isActive)),
    [products, showArchived],
  );

  const archivedCount = useMemo(
    () => products.filter((p) => !p.isActive).length,
    [products],
  );

  function openCreateProduct() {
    setEditingProduct(null);
    productForm.resetFields();
    productForm.setFieldsValue({
      unit: "kg",
      isActive: true,
      isFifthQuarter: false,
      stockQty: 0,
      retailPrice: 0,
      wholesalePrice: 0,
      costPrice: 0,
      categoryId: null,
      name: "",
      description: "",
      cutType: "",
      avgWeightValue: null,
      avgWeightUnit: "g",
    });
    resetPendingImage();
    setProductModalOpen(true);
  }

  function openEditProduct(p: AdminProduct) {
    setEditingProduct(p);
    productForm.resetFields();
    const { value, unit } = fromGrams((p as any).avgWeightG ?? null);
    productForm.setFieldsValue({
      name: p.name,
      description: p.description || "",
      unit: p.unit,
      retailPrice: Number(p.retailPrice),
      wholesalePrice: Number(p.wholesalePrice),
      costPrice: Number((p as any).costPrice ?? 0),
      stockQty: p.stockQty,
      isActive: p.isActive,
      isFifthQuarter: Boolean((p as any).isFifthQuarter),
      categoryId: p.categoryId ?? null,
      cutType: (p as any).cutType || "",
      avgWeightValue: value,
      avgWeightUnit: unit,
    });
    resetPendingImage();
    setProductModalOpen(true);
  }

  function openWasteModal(p: AdminProduct) {
    setWasteProduct(p);
    wasteForm.resetFields();
    wasteForm.setFieldsValue({
      packsWasted: 0,
      weightValue: null,
      weightUnit: "g",
      reason: "",
    });
    setWasteModalOpen(true);
  }

  async function deleteOrArchiveProduct(p: AdminProduct) {
    try {
      const res = await api.delete(`/api/admin/products/${p.id}`);
      const action = res.data?.action;
      if (action === "archived") {
        message.warning({
          content:
            "This product is linked to previous orders and cannot be deleted. It has been archived instead.",
          duration: 5,
        });
      } else {
        message.success("Product deleted");
      }
      onReload();
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Failed");
    }
  }

  async function unarchiveProduct(p: AdminProduct) {
    try {
      await api.put(`/api/admin/products/${p.id}`, {
        name: p.name,
        description: p.description ?? "",
        unit: p.unit,
        retailPrice: Number(p.retailPrice),
        wholesalePrice: Number(p.wholesalePrice),
        costPrice: Number((p as any).costPrice ?? 0),
        stockQty: p.stockQty,
        isActive: true,
        isFifthQuarter: Boolean((p as any).isFifthQuarter),
        categoryId: p.categoryId ?? null,
        cutType: (p as any).cutType ?? "",
        avgWeightG: (p as any).avgWeightG ?? null,
      });
      message.success("Product restored to shop");
      onReload();
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Failed to unarchive");
    }
  }

  async function moveProduct(
    productId: string,
    direction: "up" | "down",
    withinCategoryId: string | null,
  ) {
    const group = products
      .filter((p) => (p.categoryId ?? null) === withinCategoryId)
      .slice()
      .sort(
        (a, b) =>
          Number((a as any).sortOrder ?? 0) - Number((b as any).sortOrder ?? 0),
      );
    const idx = group.findIndex((p) => p.id === productId);
    if (idx === -1) return;
    const swapWith = direction === "up" ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= group.length) return;
    const ids = group.map((p) => p.id);
    [ids[idx], ids[swapWith]] = [ids[swapWith], ids[idx]];
    try {
      await api.put("/api/admin/products/reorder", { ids });
      message.success("Reordered");
      onReload();
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Reorder failed");
    }
  }

  async function uploadImage(productId: string, file: File) {
    const fd = new FormData();
    fd.append("image", file);
    try {
      await api.post(`/api/admin/products/${productId}/image`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      message.success("Image uploaded");
      onReload();
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Upload failed");
    }
  }

  async function removeImage(productId: string) {
    try {
      await api.delete(`/api/admin/products/${productId}/image`);
      message.success("Image removed");
      onReload();
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Remove failed");
    }
  }

  async function saveProduct() {
    const values: ProductForm = await productForm.validateFields();
    const avgWeightG = toGrams(
      values.avgWeightValue ?? null,
      values.avgWeightUnit ?? "g",
    );

    const payload = {
      name: values.name,
      description: values.description ?? "",
      unit: values.unit,
      retailPrice: values.retailPrice,
      wholesalePrice: values.wholesalePrice,
      costPrice: values.costPrice,
      stockQty: values.stockQty,
      isActive: values.isActive ?? true,
      isFifthQuarter: values.isFifthQuarter ?? false,
      categoryId: values.categoryId ?? null,
      cutType: (values.cutType || "").trim(),
      avgWeightG,
    };

    try {
      if (editingProduct) {
        await api.put(`/api/admin/products/${editingProduct.id}`, payload);
        if (pendingImageFile) {
          await uploadImage(editingProduct.id, pendingImageFile);
        }
        message.success("Product updated");
        setProductModalOpen(false);
        resetPendingImage();
        onReload();
        return;
      }

      const fd = new FormData();
      fd.append("name", payload.name);
      fd.append("description", payload.description || "");
      fd.append("unit", payload.unit);
      fd.append("retailPrice", String(payload.retailPrice));
      fd.append("wholesalePrice", String(payload.wholesalePrice));
      fd.append("costPrice", String(payload.costPrice));
      fd.append("stockQty", String(payload.stockQty));
      fd.append("isActive", String(payload.isActive));
      fd.append("isFifthQuarter", String(payload.isFifthQuarter));
      fd.append("categoryId", payload.categoryId ?? "");
      fd.append("cutType", payload.cutType || "");
      fd.append(
        "avgWeightG",
        avgWeightG !== null && avgWeightG !== undefined
          ? String(avgWeightG)
          : "",
      );
      if (pendingImageFile) fd.append("image", pendingImageFile);

      await api.post(`/api/admin/products`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      message.success("Product created");
      setProductModalOpen(false);
      resetPendingImage();
      onReload();
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Save failed");
    }
  }

  async function saveWaste() {
    if (!wasteProduct) return;

    const values: WasteForm = await wasteForm.validateFields();
    const weightG = toGrams(
      values.weightValue ?? null,
      values.weightUnit ?? "g",
    );

    try {
      await api.post(`/api/admin/products/${wasteProduct.id}/waste`, {
        packsWasted: Number(values.packsWasted ?? 0),
        weightValue:
          values.weightValue === null || values.weightValue === undefined
            ? null
            : Number(values.weightValue),
        weightUnit: values.weightUnit ?? "g",
        reason: (values.reason || "").trim(),
      });

      message.success("Waste recorded");
      setWasteModalOpen(false);
      setWasteProduct(null);
      wasteForm.resetFields();
      onReload();
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Failed to record waste");
    }
  }

  const grouped = useMemo(() => {
    const map = new Map<string, AdminProduct[]>();
    const keyOf = (p: AdminProduct) => p.category?.name || "Unassigned";
    for (const p of visibleProducts) {
      const k = keyOf(p);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    }
    for (const [k, list] of map.entries()) {
      map.set(
        k,
        list
          .slice()
          .sort(
            (a, b) =>
              Number((a as any).sortOrder ?? 0) -
              Number((b as any).sortOrder ?? 0),
          ),
      );
    }
    return [...map.entries()];
  }, [visibleProducts]);

  const wastePreview = useMemo(() => {
    if (!wasteProduct) return { stockAfter: 0, estimatedValue: 0 };

    const packsWasted = Number(wasteForm.getFieldValue("packsWasted") ?? 0);
    const weightValue = wasteForm.getFieldValue("weightValue");
    const weightUnit = (wasteForm.getFieldValue("weightUnit") ?? "g") as
      | "g"
      | "kg";
    const weightG = toGrams(weightValue ?? null, weightUnit);

    let estimatedValue = 0;
    const costPrice = Number((wasteProduct as any).costPrice ?? 0);

    if (packsWasted > 0) {
      estimatedValue += packsWasted * costPrice;
    }

    if (weightG && weightG > 0) {
      if (wasteProduct.unit === "kg") {
        estimatedValue += (weightG / 1000) * costPrice;
      } else if (wasteProduct.unit === "g") {
        estimatedValue += weightG * costPrice;
      }
    }

    return {
      stockAfter: Math.max(0, Number(wasteProduct.stockQty ?? 0) - packsWasted),
      estimatedValue,
    };
  }, [wasteForm, wasteProduct]);

  const getActionMenuItems = (p: AdminProduct): MenuProps["items"] => {
    const items: MenuProps["items"] = [];

    if (showArchived) {
      items.push({
        key: "edit",
        label: "Edit",
        onClick: () => openEditProduct(p),
      });
      items.push({
        key: "unarchive",
        label: "Restore",
        onClick: () => unarchiveProduct(p),
      });
      return items;
    }

    items.push({
      key: "edit",
      label: "Edit",
      onClick: () => openEditProduct(p),
    });

    items.push({
      key: "waste",
      label: "Waste",
      onClick: () => openWasteModal(p),
    });

    items.push({
      key: "move-up",
      label: "Move Up",
      onClick: () => moveProduct(p.id, "up", p.categoryId ?? null),
    });

    items.push({
      key: "move-down",
      label: "Move Down",
      onClick: () => moveProduct(p.id, "down", p.categoryId ?? null),
    });

    const hasOrders = Number((p as any)._count?.orderItems ?? 0) > 0;
    const label = hasOrders ? "Archive" : "Delete";

    items.push({
      type: "divider",
    });

    items.push({
      key: "delete",
      danger: true,
      label,
      onClick: () => {
        Modal.confirm({
          title: hasOrders
            ? "This product has previous orders. It will be archived (hidden from shop)."
            : "Permanently delete this product? This cannot be undone.",
          okText: label,
          okButtonProps: { danger: true },
          onOk: () => deleteOrArchiveProduct(p),
        });
      },
    });

    return items;
  };

  const baseColumns = [
    {
      title: "Image",
      key: "image",
      width: 120,
      render: (_: any, p: AdminProduct) => {
        const uploadProps: UploadProps = {
          showUploadList: false,
          beforeUpload: (file) => {
            const okType = ["image/png", "image/jpeg", "image/webp"].includes(
              file.type,
            );
            if (!okType) message.error("Only PNG/JPG/WEBP images");
            const okSize = file.size / 1024 / 1024 < 5;
            if (!okSize) message.error("Image must be < 5MB");
            if (okType && okSize) uploadImage(p.id, file as any);
            return false;
          },
        };
        const imgSrc = resolveImageUrl((p as any).imageUrl);
        return (
          <div style={{ display: "grid", gap: 6 }}>
            <div
              style={{
                width: 96,
                height: 64,
                borderRadius: 10,
                overflow: "hidden",
                border: "1px solid rgba(0,0,0,0.12)",
                background: "#f5f5f5",
              }}
            >
              {imgSrc ? (
                <img
                  src={imgSrc}
                  alt={p.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display =
                      "none";
                  }}
                />
              ) : null}
            </div>
            <Space size={6} wrap>
              <Upload {...uploadProps}>
                <Button size="small" icon={<UploadOutlined />}>
                  Upload
                </Button>
              </Upload>
              {(p as any).imageUrl ? (
                <Button size="small" danger onClick={() => removeImage(p.id)}>
                  Remove
                </Button>
              ) : null}
            </Space>
          </div>
        );
      },
    },
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      width: 140,
      ellipsis: true,
      render: (_: any, p: AdminProduct) => (
        <Space size={8} wrap>
          <span>{p.name}</span>
          {(p as any).isFifthQuarter ? (
            <Tag color="purple">5th Quarter</Tag>
          ) : null}
        </Space>
      ),
    },
    {
      title: "Cut Type",
      dataIndex: "cutType",
      key: "cutType",
      width: 100,
      render: (v: any) => {
        const s = typeof v === "string" ? v.trim() : "";
        return s ? <Tag>{s}</Tag> : <Tag color="default">—</Tag>;
      },
    },
    { title: "Unit", dataIndex: "unit", key: "unit", width: 90 },
    {
      title: "Avg Weight",
      dataIndex: "avgWeightG",
      key: "avgWeightG",
      width: 120,
      render: (v: any) =>
        fmtGrams(v === null || v === undefined ? null : Number(v)),
    },
    {
      title: "Pricing",
      key: "pricing",
      width: 180,
      render: (_: any, p: AdminProduct) => (
        <div style={{ display: "grid", gap: 2, lineHeight: 1.3 }}>
          <div>
            <Text type="secondary">Retail:</Text>{" "}
            <Text strong>{money(p.retailPrice)}</Text>
          </div>
          <div>
            <Text type="secondary">Wholesale:</Text>{" "}
            <Text strong>{money(p.wholesalePrice)}</Text>
          </div>
          <div>
            <Text type="secondary">Cost:</Text>{" "}
            <Text strong>{money((p as any).costPrice)}</Text>
          </div>
        </div>
      ),
    },
    { title: "Stock", dataIndex: "stockQty", key: "stockQty", width: 90 },
    {
      title: "Category",
      key: "category",
      width: 120,
      render: (_: any, p: AdminProduct) =>
        p.category ? (
          <Space size={8}>
            <IconPreview iconKey={p.category.iconKey} />
            <span>{p.category.name}</span>
          </Space>
        ) : (
          <Tag>Unassigned</Tag>
        ),
    },
    {
      title: "",
      key: "actions",
      width: 80,
      align: "right" as const,
      render: (_: any, p: AdminProduct) => (
        <Dropdown
          menu={{ items: getActionMenuItems(p) }}
          trigger={["click"]}
          placement="bottomRight"
        >
          <Button
            type="text"
            icon={<MoreOutlined style={{ fontSize: 18 }} />}
          />
        </Dropdown>
      ),
    },
  ] as any[];

  const modalUploadProps: UploadProps = {
    showUploadList: false,
    beforeUpload: (file) => {
      const okType = ["image/png", "image/jpeg", "image/webp"].includes(
        file.type,
      );
      if (!okType) {
        message.error("Only PNG/JPG/WEBP images");
        return false;
      }
      const okSize = file.size / 1024 / 1024 < 5;
      if (!okSize) {
        message.error("Image must be < 5MB");
        return false;
      }
      setPendingImageFile(file as any);
      setPendingPreviewUrl(URL.createObjectURL(file as any));
      return false;
    },
  };

  return (
    <Card
      extra={
        <Space wrap>
          <Space>
            <Text type="secondary">Group by category</Text>
            <Switch checked={groupByCategory} onChange={setGroupByCategory} />
          </Space>
          <Button onClick={() => setShowArchived((v) => !v)}>
            {showArchived
              ? "Show Active"
              : `Show Archived${archivedCount > 0 ? ` (${archivedCount})` : ""}`}
          </Button>
          {!showArchived && (
            <Button type="primary" onClick={openCreateProduct}>
              New Product
            </Button>
          )}
        </Space>
      }
    >
      {!groupByCategory ? (
        <Table
          loading={loading}
          rowKey={(r) => r.id}
          dataSource={visibleProducts
            .slice()
            .sort(
              (a, b) =>
                Number((a as any).sortOrder ?? 0) -
                Number((b as any).sortOrder ?? 0),
            )}
          columns={baseColumns}
          scroll={{ x: "max-content" }}
          style={{ width: "100%" }}
        />
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {grouped.length === 0 ? (
            <Text type="secondary" style={{ padding: 16 }}>
              {showArchived ? "No archived products." : "No active products."}
            </Text>
          ) : (
            grouped.map(([catName, list]) => (
              <Card key={catName} size="small" title={catName}>
                <Table
                  loading={loading}
                  rowKey={(r) => r.id}
                  dataSource={list}
                  columns={baseColumns}
                  pagination={false}
                  scroll={{ x: "max-content" }}
                  style={{ width: "100%" }}
                />
              </Card>
            ))
          )}
        </div>
      )}

      <Modal
        title={editingProduct ? "Edit Product" : "New Product"}
        open={productModalOpen}
        onCancel={() => {
          setProductModalOpen(false);
          resetPendingImage();
        }}
        onOk={saveProduct}
        okText="Save"
      >
        <Form layout="vertical" form={productForm}>
          <Form.Item label="Image (optional)">
            <div style={{ display: "grid", gap: 10 }}>
              <div
                style={{
                  width: "100%",
                  height: 180,
                  borderRadius: 14,
                  overflow: "hidden",
                  border: "1px solid var(--aca-border)",
                  background: "var(--aca-bg2)",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                {pendingPreviewUrl ? (
                  <img
                    src={pendingPreviewUrl}
                    alt="Preview"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : editingProduct?.imageUrl ? (
                  (() => {
                    const src = resolveImageUrl(
                      (editingProduct as any).imageUrl,
                    );
                    return src ? (
                      <img
                        src={src}
                        alt={editingProduct.name}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display =
                            "none";
                        }}
                      />
                    ) : (
                      <Text type="secondary">Choose an image (optional)</Text>
                    );
                  })()
                ) : (
                  <Text type="secondary">Choose an image (optional)</Text>
                )}
              </div>
              <Space wrap>
                <Upload {...modalUploadProps}>
                  <Button icon={<UploadOutlined />}>Choose image</Button>
                </Upload>
                {pendingImageFile || pendingPreviewUrl ? (
                  <Button danger onClick={resetPendingImage}>
                    Clear
                  </Button>
                ) : null}
                {editingProduct?.id && editingProduct?.imageUrl ? (
                  <Button danger onClick={() => removeImage(editingProduct.id)}>
                    Remove current image
                  </Button>
                ) : null}
              </Space>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Tip: For a new product, choose an image now—then click Save
                once.
              </Text>
            </div>
          </Form.Item>

          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>

          <Form.Item
            name="isFifthQuarter"
            label="5th quarter product"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item name="cutType" label="Cut type (optional)">
            <Input placeholder="e.g. Economy, Super, Prime..." />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} />
          </Form.Item>

          <Form.Item name="unit" label="Unit" rules={[{ required: true }]}>
            <Select
              options={[
                { value: "kg", label: "kg — sold by kilogram" },
                { value: "pack", label: "pack — sold by pack" },
                { value: "g", label: "g — sold by gram" },
              ]}
            />
          </Form.Item>

          <Form.Item
            label="Average weight (optional)"
            extra="Shown to customers on the shop."
          >
            <Space.Compact style={{ width: "100%" }}>
              <Form.Item name="avgWeightValue" noStyle>
                <InputNumber
                  min={0}
                  step={0.1}
                  placeholder="e.g. 500"
                  style={{ width: "100%" }}
                />
              </Form.Item>
              <Form.Item name="avgWeightUnit" noStyle initialValue="g">
                <Select
                  style={{ width: 80 }}
                  options={[
                    { value: "g", label: "g" },
                    { value: "kg", label: "kg" },
                  ]}
                />
              </Form.Item>
            </Space.Compact>
          </Form.Item>

          <Form.Item
            name="retailPrice"
            label="Retail price"
            rules={[{ required: true }]}
          >
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item
            name="wholesalePrice"
            label="Wholesale price"
            rules={[{ required: true }]}
          >
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item
            name="costPrice"
            label="Cost price"
            rules={[{ required: true }]}
          >
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item
            name="stockQty"
            label="Stock quantity"
            rules={[{ required: true }]}
          >
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item name="categoryId" label="Category">
            <Select
              allowClear
              placeholder="Select category"
              options={categoryOptions}
              onChange={(v) => {
                if (v === "__none__") {
                  productForm.setFieldsValue({ categoryId: null });
                }
              }}
            />
          </Form.Item>

          <Form.Item name="isActive" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          wasteProduct
            ? `Waste Product — ${wasteProduct.name}`
            : "Waste Product"
        }
        open={wasteModalOpen}
        onCancel={() => {
          setWasteModalOpen(false);
          setWasteProduct(null);
          wasteForm.resetFields();
        }}
        onOk={saveWaste}
        okText="Record Waste"
      >
        <Form form={wasteForm} layout="vertical">
          {wasteProduct ? (
            <Card
              size="small"
              style={{ marginBottom: 16, background: "#fafafa" }}
            >
              <div style={{ display: "grid", gap: 6 }}>
                <Text>
                  <strong>Current stock:</strong> {wasteProduct.stockQty}
                </Text>
                <Text>
                  <strong>Unit:</strong> {wasteProduct.unit}
                </Text>
                <Text>
                  <strong>Cost price:</strong>{" "}
                  {money((wasteProduct as any).costPrice)}
                </Text>
                <Text>
                  <strong>Total wasted so far:</strong>{" "}
                  {Number((wasteProduct as any).totalPacksWasted ?? 0)} packs /{" "}
                  {fmtGrams(
                    Number((wasteProduct as any).totalWeightWastedG ?? 0),
                  )}{" "}
                  / {money((wasteProduct as any).totalWasteValue ?? 0)}
                </Text>
              </div>
            </Card>
          ) : null}

          <Form.Item
            name="packsWasted"
            label="Packs wasted"
            rules={[{ required: true, message: "Enter packs wasted" }]}
          >
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item
            label="Total weight wasted (optional)"
            extra="Useful when the wasted amount also has a measured total weight."
          >
            <Space.Compact style={{ width: "100%" }}>
              <Form.Item name="weightValue" noStyle>
                <InputNumber
                  min={0}
                  step={0.1}
                  placeholder="e.g. 750"
                  style={{ width: "100%" }}
                />
              </Form.Item>
              <Form.Item name="weightUnit" noStyle initialValue="g">
                <Select
                  style={{ width: 80 }}
                  options={[
                    { value: "g", label: "g" },
                    { value: "kg", label: "kg" },
                  ]}
                />
              </Form.Item>
            </Space.Compact>
          </Form.Item>

          <Form.Item name="reason" label="Reason (optional)">
            <Input.TextArea
              rows={3}
              placeholder="e.g. damaged, spoiled, trimming loss..."
            />
          </Form.Item>

          {wasteProduct ? (
            <Card size="small" style={{ background: "#fafafa" }}>
              <div style={{ display: "grid", gap: 6 }}>
                <Text>
                  <strong>Stock after waste:</strong> {wastePreview.stockAfter}
                </Text>
                <Text>
                  <strong>Estimated waste value:</strong>{" "}
                  {money(wastePreview.estimatedValue)}
                </Text>
              </div>
            </Card>
          ) : null}
        </Form>
      </Modal>
    </Card>
  );
}
