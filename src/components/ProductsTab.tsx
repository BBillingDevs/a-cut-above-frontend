// src/components/ProductsTab.tsx
import React, { useMemo, useState, useEffect } from "react";
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
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
import { UploadOutlined } from "@ant-design/icons";
import { api, API_BASE } from "../api/client";
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
  stockQty: number;
  isActive: boolean;
  categoryId: string | null;
  cutType?: string;
};

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
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(
    null,
  );
  const [productForm] = Form.useForm<ProductForm>();

  const [groupByCategory, setGroupByCategory] = useState(true);

  // ✅ NEW: allow choosing image BEFORE saving (create flow)
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(
    null,
  );

  // cleanup preview blob URLs
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

  function openCreateProduct() {
    setEditingProduct(null);
    productForm.resetFields();
    productForm.setFieldsValue({
      unit: "kg",
      isActive: true,
      stockQty: 0,
      retailPrice: 0,
      wholesalePrice: 0,
      categoryId: null,
      name: "",
      description: "",
      cutType: "",
    });
    resetPendingImage();
    setProductModalOpen(true);
  }

  function openEditProduct(p: AdminProduct) {
    setEditingProduct(p);
    productForm.resetFields();
    productForm.setFieldsValue({
      name: p.name,
      description: p.description || "",
      unit: p.unit,
      retailPrice: Number(p.retailPrice),
      wholesalePrice: Number(p.wholesalePrice),
      stockQty: p.stockQty,
      isActive: p.isActive,
      categoryId: p.categoryId ?? null,
      cutType: (p as any).cutType || "",
    });
    resetPendingImage();
    setProductModalOpen(true);
  }

  async function deleteProduct(id: string) {
    await api.delete(`/api/admin/products/${id}`);
    message.success("Product archived");
    onReload();
  }

  async function moveProduct(
    productId: string,
    direction: "up" | "down",
    withinCategoryId: string | null,
  ) {
    const group = products
      .filter((p) => (p.categoryId ?? null) === withinCategoryId)
      .slice()
      .sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0));

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
    const values = await productForm.validateFields();

    const payload = {
      ...values,
      categoryId: values.categoryId ?? null,
      cutType: (values.cutType || "").trim(),
      description: values.description ?? "",
    };

    try {
      if (editingProduct) {
        // ✅ Update fields
        await api.put(`/api/admin/products/${editingProduct.id}`, payload);

        // ✅ If they picked a new image in the modal, upload it on save
        if (pendingImageFile) {
          await uploadImage(editingProduct.id, pendingImageFile);
        }

        message.success("Product updated");
        setProductModalOpen(false);
        resetPendingImage();
        onReload();
        return;
      }

      // ✅ Create: send multipart so image can be chosen BEFORE saving
      const fd = new FormData();
      fd.append("name", payload.name);
      fd.append("description", payload.description || "");
      fd.append("unit", payload.unit);
      fd.append("retailPrice", String(payload.retailPrice));
      fd.append("wholesalePrice", String(payload.wholesalePrice));
      fd.append("stockQty", String(payload.stockQty));
      fd.append("isActive", String(payload.isActive ?? true));
      fd.append("categoryId", payload.categoryId ?? "");
      fd.append("cutType", payload.cutType || "");

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

  const grouped = useMemo(() => {
    const map = new Map<string, AdminProduct[]>();

    const keyOf = (p: AdminProduct) => p.category?.name || "Unassigned";
    for (const p of products) {
      const k = keyOf(p);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    }

    for (const [k, list] of map.entries()) {
      map.set(
        k,
        list
          .slice()
          .sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0)),
      );
    }

    return [...map.entries()];
  }, [products]);

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

        const imgSrc = p.imageUrl ? `${API_BASE}${p.imageUrl}` : null;

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

              {p.imageUrl ? (
                <Button size="small" danger onClick={() => removeImage(p.id)}>
                  Remove
                </Button>
              ) : null}
            </Space>
          </div>
        );
      },
    },
    { title: "Name", dataIndex: "name", key: "name" },
    {
      title: "Cut Type",
      dataIndex: "cutType",
      key: "cutType",
      width: 160,
      render: (v: any) => {
        const s = typeof v === "string" ? v.trim() : "";
        return s ? <Tag>{s}</Tag> : <Tag color="default">—</Tag>;
      },
    },
    { title: "Unit", dataIndex: "unit", key: "unit", width: 90 },
    {
      title: "Retail",
      dataIndex: "retailPrice",
      key: "retailPrice",
      render: (v: any) => `$${Number(v).toFixed(2)}`,
      width: 110,
    },
    {
      title: "Wholesale",
      dataIndex: "wholesalePrice",
      key: "wholesalePrice",
      render: (v: any) => `$${Number(v).toFixed(2)}`,
      width: 120,
    },
    { title: "Stock", dataIndex: "stockQty", key: "stockQty", width: 90 },
    {
      title: "Category",
      key: "category",
      width: 180,
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
      title: "Active",
      dataIndex: "isActive",
      key: "isActive",
      width: 90,
      render: (v: boolean) =>
        v ? <Tag color="green">Yes</Tag> : <Tag color="red">No</Tag>,
    },
    {
      title: "Order",
      key: "order",
      width: 140,
      render: (_: any, p: AdminProduct) => (
        <Space size={6}>
          <Button
            size="small"
            onClick={() => moveProduct(p.id, "up", p.categoryId ?? null)}
          >
            ↑
          </Button>
          <Button
            size="small"
            onClick={() => moveProduct(p.id, "down", p.categoryId ?? null)}
          >
            ↓
          </Button>
        </Space>
      ),
    },
    {
      title: "",
      key: "actions",
      width: 180,
      render: (_: any, p: AdminProduct) => (
        <Space>
          <Button onClick={() => openEditProduct(p)}>Edit</Button>
          <Popconfirm
            title="Archive this product?"
            onConfirm={() => deleteProduct(p.id)}
          >
            <Button danger>Archive</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ] as any[];

  // ✅ Modal image picker (choose before save)
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
      const url = URL.createObjectURL(file as any);
      setPendingPreviewUrl(url);
      return false; // prevent auto upload
    },
  };

  return (
    <Card
      extra={
        <Space>
          <Space>
            <Text type="secondary">Group by category</Text>
            <Switch checked={groupByCategory} onChange={setGroupByCategory} />
          </Space>
          <Button type="primary" onClick={openCreateProduct}>
            New Product
          </Button>
        </Space>
      }
    >
      {!groupByCategory ? (
        <Table
          loading={loading}
          rowKey={(r) => r.id}
          dataSource={products
            .slice()
            .sort(
              (a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0),
            )}
          columns={baseColumns}
        />
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {grouped.map(([catName, list]) => (
            <Card key={catName} size="small" title={catName}>
              <Table
                loading={loading}
                rowKey={(r) => r.id}
                dataSource={list}
                columns={baseColumns}
                pagination={false}
              />
            </Card>
          ))}
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
          {/* ✅ Image picker lives INSIDE the modal and does not require save-first */}
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
                  <img
                    src={`${API_BASE}${editingProduct.imageUrl}`}
                    alt={editingProduct.name}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
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

          <Form.Item name="cutType" label="Cut type (optional)">
            <Input placeholder="e.g. Economy, Super, Prime..." />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} />
          </Form.Item>

          <Form.Item name="unit" label="Unit" rules={[{ required: true }]}>
            <Select
              options={[
                { value: "kg", label: "kg" },
                { value: "pack", label: "pack" },
              ]}
            />
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
                if (v === "__none__")
                  productForm.setFieldsValue({ categoryId: null });
              }}
            />
          </Form.Item>

          {/* ✅ Use Switch instead of raw checkbox */}
          <Form.Item name="isActive" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
