import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Drawer,
  FloatButton,
  Grid,
  Input,
  InputNumber,
  Row,
  Select,
  Tag,
  Typography,
  message,
} from "antd";
import {
  AppstoreOutlined,
  SearchOutlined,
  MinusOutlined,
  PlusOutlined,
  DeleteOutlined,
  ShoppingCartOutlined,
} from "@ant-design/icons";
import { api } from "../../api/client";
import { useImageUrl } from "../../lib/useImageUrl";
import type { Product } from "../../types";
import { useCart } from "../../context/CartContext";
import { useLocation, useNavigate } from "react-router-dom";
import { IconPreview } from "../../components/iconCatalog";

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

type WindowState = {
  open: boolean;
  name?: string;
  endsAt?: string;
  message?: string;
  isPermanent?: boolean;
};

type PricedProduct = Product & {
  pricePerKg?: number | null;
  pricePerPack?: number | null;
  packSizeKg?: number | null;
  category?: { id: string; name: string; iconKey: string } | null;
  imageUrl?: string | null;
  cutType?: string | null;
  avgWeightG?: number | null;
  stockQty?: number | null;
};

function asNumber(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function money(n: number | null | undefined) {
  return n === null || n === undefined ? "—" : `$${n.toFixed(2)}`;
}

function fmtGrams(g: number | null | undefined): string | null {
  if (g === null || g === undefined) return null;
  return g >= 1000 ? `${(g / 1000).toFixed(2)} kg` : `${g} g`;
}

function ProductImage({
  url,
  alt,
  style,
  className,
}: {
  url?: string | null;
  alt: string;
  style?: React.CSSProperties;
  className?: string;
}) {
  const src = useImageUrl(url);
  if (!src) return null;
  return (
    <img
      src={src}
      alt={alt}
      style={style}
      className={className}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = "none";
      }}
    />
  );
}

export default function ShopPage() {
  const { add, items, setQty, remove } = useCart();

  const location = useLocation();
  const navigate = useNavigate();
  const screens = useBreakpoint();

  const isMobile = !screens.md;
  const showSummary = !!screens.lg;
  const [cartOpen, setCartOpen] = useState(false);

  const [products, setProducts] = useState([] as PricedProduct[]);
  const [loading, setLoading] = useState(false);
  const [windowState, setWindowState] = useState({
    open: false,
  } as WindowState);
  const [qtyMap, setQtyMap] = useState({} as Record<string, number>);
  const [activeCat, setActiveCat] = useState("all");
  const [sort, setSort] = useState("featured");

  const q = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return (params.get("q") || "").trim().toLowerCase();
  }, [location.search]);

  const [shopSearch, setShopSearch] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const raw = params.get("q") || "";
    setShopSearch(raw ? decodeURIComponent(raw) : "");
  }, [location.search]);

  function setUrlQuery(next: string) {
    const params = new URLSearchParams(location.search);
    const cleaned = next.trim();
    if (cleaned) params.set("q", cleaned);
    else params.delete("q");
    const qs = params.toString();
    navigate(
      { pathname: location.pathname, search: qs ? `?${qs}` : "" },
      { replace: true },
    );
  }

  async function load() {
    setLoading(true);
    try {
      const [wRes, pRes] = await Promise.all([
        api.get("/api/public/order-window"),
        api.get("/api/public/products"),
      ]);

      setWindowState(wRes.data);

      const raw = (pRes.data?.products || []) as any[];
      setProducts(
        raw.map((p) => ({
          id: String(p.id),
          name: String(p.name),
          description: p.description ?? null,
          unit: String(p.unit),
          price: typeof p.price === "number" ? p.price : Number(p.price),
          stockQty:
            p.stockQty === null || p.stockQty === undefined
              ? null
              : Number(p.stockQty),
          pricePerKg: asNumber(p.pricePerKg ?? p.priceKg ?? null),
          pricePerPack: asNumber(p.pricePerPack ?? p.pricePack ?? null),
          packSizeKg: asNumber(p.packSizeKg ?? null),
          category: p.category ?? null,
          imageUrl: p.imageUrl ?? null,
          cutType: p.cutType ?? null,
          avgWeightG:
            p.avgWeightG === null || p.avgWeightG === undefined
              ? null
              : Number(p.avgWeightG),
        })),
      );
    } catch (e: any) {
      console.error(e);
      message.error(e?.response?.data?.error || e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const categoryDefs = useMemo(() => {
    const map: Map<string, { key: string; label: string; iconKey: string }> =
      new Map();
    for (const p of products) {
      if (p.category?.id) {
        map.set(p.category.id, {
          key: p.category.id,
          label: p.category.name,
          iconKey: p.category.iconKey,
        });
      }
    }
    const list = [...map.values()].sort((a, b) =>
      a.label.localeCompare(b.label),
    );
    return [{ key: "all", label: "All", iconKey: "__ALL__" }, ...list];
  }, [products]);

  const filtered = useMemo(() => {
    let list = products;

    if (activeCat !== "all") {
      list = list.filter((p) => p.category?.id === activeCat);
    }

    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description || "").toLowerCase().includes(q),
      );
    }

    const unitPrice = (p: PricedProduct) => {
      if ((p.unit || "").toLowerCase() === "kg")
        return p.pricePerKg ?? p.price ?? 0;
      return p.pricePerPack ?? p.price ?? 0;
    };

    if (sort === "price_asc")
      list = [...list].sort((a, b) => unitPrice(a) - unitPrice(b));
    if (sort === "price_desc")
      list = [...list].sort((a, b) => unitPrice(b) - unitPrice(a));

    return list;
  }, [products, q, activeCat, sort]);

  const summaryItems = useMemo(() => items.slice(0, 10), [items]);

  function summaryUnitLabel(p: any) {
    const u = String(p?.unit || "").toLowerCase();
    return u === "kg" ? "Price / kg" : "Price / pack";
  }

  function summaryUnitPrice(p: any) {
    const u = String(p?.unit || "").toLowerCase();
    if (u === "kg")
      return asNumber(p?.pricePerKg ?? p?.priceKg ?? p?.price) ?? 0;
    return asNumber(p?.pricePerPack ?? p?.pricePack ?? p?.price) ?? 0;
  }

  function stockFor(p: PricedProduct) {
    return p.stockQty === null || p.stockQty === undefined
      ? null
      : Number(p.stockQty);
  }

  function inCartQty(productId: string) {
    const row = items.find((x) => String(x.product.id) === String(productId));
    return Number(row?.qty || 0);
  }

  function remainingStock(p: PricedProduct) {
    const s = stockFor(p);
    if (s === null) return null;
    return Math.max(0, s - inCartQty(p.id));
  }

  function clampQtyForProduct(p: PricedProduct, desired: number) {
    const s = stockFor(p);
    if (s === null) return Math.max(1, desired);
    const remaining = remainingStock(p) ?? 0;
    return Math.max(1, Math.min(desired, remaining));
  }

  function isSoldOut(p: PricedProduct) {
    const s = stockFor(p);
    if (s === null) return false;
    return s <= 0;
  }

  return (
    <div className="aca-page">
      <div
        className="aca-page__top"
        style={{
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexDirection: isMobile ? "column" : "row",
        }}
      >
        <div style={{ width: "100%" }}>
          <Title
            level={2}
            className="aca-displayTitle"
            style={{ marginBottom: 4 }}
          >
            From our farm
          </Title>
          <Text className="aca-subtitle">
            Grass-fed, ethical and slow-raised meat.
          </Text>
        </div>

        <div
          style={{
            width: isMobile ? "100%" : "auto",
            display: "flex",
            gap: 10,
            alignItems: "center",
            justifyContent: isMobile ? "flex-start" : "flex-end",
          }}
        >
          <Text type="secondary" style={{ whiteSpace: "nowrap" }}>
            Sort by:
          </Text>
          <Select
            value={sort}
            onChange={setSort}
            style={{ width: isMobile ? "100%" : 220 }}
            options={[
              { value: "featured", label: "Best Sellers" },
              { value: "price_asc", label: "Price: Low to High" },
              { value: "price_desc", label: "Price: High to Low" },
            ]}
          />
        </div>
      </div>

      <div className="aca-search" style={{ marginTop: 10 }}>
        <Input
          allowClear
          value={shopSearch}
          onChange={(e) => {
            const next = e.target.value;
            setShopSearch(next);
            setUrlQuery(next);
          }}
          onPressEnter={() => setUrlQuery(shopSearch)}
          prefix={<SearchOutlined style={{ color: "rgba(0,0,0,0.35)" }} />}
          placeholder="Search for ribeye, wors, mince..."
        />
      </div>

      {isMobile ? (
        <div style={{ marginTop: 12 }}>
          <div
            style={{
              display: "flex",
              gap: 8,
              overflowX: "auto",
              paddingBottom: 6,
              WebkitOverflowScrolling: "touch",
            }}
          >
            {categoryDefs.map((c) => {
              const active = activeCat === c.key;
              return (
                <button
                  key={c.key}
                  className={`aca-catChip ${active ? "is-active" : ""}`}
                  onClick={() => setActiveCat(c.key)}
                  type="button"
                  style={{
                    flex: "0 0 auto",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 12px",
                    borderRadius: 999,
                    border: active
                      ? "1px solid var(--aca-forest)"
                      : "1px solid var(--aca-border)",
                    background: active ? "var(--aca-bg2)" : "var(--aca-card)",
                    fontWeight: 800,
                    whiteSpace: "nowrap",
                    cursor: "pointer",
                  }}
                >
                  <span aria-hidden="true" style={{ display: "inline-flex" }}>
                    {c.iconKey === "__ALL__" ? (
                      <AppstoreOutlined />
                    ) : (
                      <IconPreview iconKey={c.iconKey} />
                    )}
                  </span>
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: 14 }}>
        {!windowState.open && (
          <Alert
            type="warning"
            message={windowState.message || "Ordering is closed."}
            showIcon
            className="aca-alert"
          />
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: showSummary ? "320px 1fr" : "1fr",
          gap: 16,
          marginTop: 16,
          alignItems: "start",
        }}
      >
        {!isMobile ? (
          <aside
            style={{ position: showSummary ? "sticky" : "static", top: 16 }}
          >
            <div className="aca-sidebarCard">
              <h3 className="aca-sidebarTitle">Categories</h3>
              <div className="aca-catList">
                {categoryDefs.map((c) => (
                  <button
                    key={c.key}
                    className={`aca-catItem ${activeCat === c.key ? "is-active" : ""}`}
                    onClick={() => setActiveCat(c.key)}
                    type="button"
                  >
                    <span className="aca-catIcon" aria-hidden="true">
                      {c.iconKey === "__ALL__" ? (
                        <AppstoreOutlined />
                      ) : (
                        <IconPreview iconKey={c.iconKey} />
                      )}
                    </span>
                    <span>{c.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {showSummary ? (
              <div className="aca-sidebarCard" style={{ marginTop: 14 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    marginBottom: 12,
                  }}
                >
                  <h3 className="aca-sidebarTitle" style={{ margin: 0 }}>
                    Order Summary
                  </h3>
                  <Tag color={items.length ? "green" : "default"}>
                    {items.length} item(s)
                  </Tag>
                </div>

                {items.length === 0 ? (
                  <Text type="secondary">No items yet.</Text>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {summaryItems.map((row) => {
                      const unitLabel = summaryUnitLabel(row.product as any);
                      const unitPrice = summaryUnitPrice(row.product as any);
                      const qty = Number(row.qty || 1);
                      const prod = products.find(
                        (pp) => String(pp.id) === String(row.product.id),
                      );

                      return (
                        <div
                          key={row.product.id}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "44px 1fr",
                            gap: 10,
                            alignItems: "start",
                            padding: 10,
                            borderRadius: 14,
                            border: "1px solid var(--aca-border)",
                            background: "var(--aca-bg2)",
                          }}
                        >
                          <div
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 12,
                              overflow: "hidden",
                              background: "var(--aca-card)",
                              border: "1px solid var(--aca-border)",
                            }}
                          >
                            <ProductImage
                              url={(row.product as any).imageUrl}
                              alt={row.product.name}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                              }}
                            />
                          </div>

                          <div style={{ minWidth: 0, paddingTop: 4 }}>
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr auto",
                                gap: 10,
                                alignItems: "start",
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
                                  {row.product.name}
                                </div>
                                <div
                                  style={{
                                    fontSize: 12,
                                    color: "var(--aca-muted)",
                                    marginTop: 2,
                                  }}
                                >
                                  {unitLabel}:{" "}
                                  <span
                                    style={{
                                      fontWeight: 800,
                                      color: "var(--aca-forest)",
                                    }}
                                  >
                                    {money(unitPrice)}
                                  </span>
                                </div>
                              </div>

                              <div
                                style={{
                                  display: "grid",
                                  justifyItems: "end",
                                  gap: 8,
                                }}
                              >
                                <Button
                                  size="small"
                                  danger
                                  onClick={() => remove(row.product.id)}
                                  icon={<DeleteOutlined />}
                                />
                                <div
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                    border: "1px solid var(--aca-border)",
                                    background: "var(--aca-card)",
                                    borderRadius: 999,
                                    padding: "3px 4px",
                                  }}
                                >
                                  <Button
                                    size="small"
                                    type="text"
                                    icon={<MinusOutlined />}
                                    disabled={qty <= 1}
                                    onClick={() =>
                                      setQty(
                                        row.product.id,
                                        Math.max(1, qty - 1),
                                      )
                                    }
                                    style={{
                                      width: 22,
                                      height: 22,
                                      borderRadius: 999,
                                      padding: 0,
                                    }}
                                  />
                                  <span
                                    style={{
                                      minWidth: 14,
                                      textAlign: "center",
                                      fontWeight: 800,
                                      fontSize: 12,
                                    }}
                                  >
                                    {qty}
                                  </span>
                                  <Button
                                    size="small"
                                    type="text"
                                    icon={<PlusOutlined />}
                                    disabled={
                                      !prod ? false : remainingStock(prod) === 0
                                    }
                                    onClick={() => {
                                      if (!prod)
                                        return setQty(row.product.id, qty + 1);
                                      const rem = remainingStock(prod);
                                      if (rem === null || rem > 0)
                                        setQty(row.product.id, qty + 1);
                                    }}
                                    style={{
                                      width: 22,
                                      height: 22,
                                      borderRadius: 999,
                                      padding: 0,
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {items.length > 10 ? (
                      <Text type="secondary">+ {items.length - 10} more…</Text>
                    ) : null}
                  </div>
                )}

                <div style={{ marginTop: 14 }}>
                  <Button
                    type="primary"
                    block
                    disabled={items.length === 0}
                    onClick={() => navigate("/checkout")}
                  >
                    Go to checkout
                  </Button>
                </div>
              </div>
            ) : null}
          </aside>
        ) : null}

        <section className="aca-products">
          <Row gutter={[16, 16]}>
            {filtered.map((p) => {
              const stock = stockFor(p);
              const soldOut = isSoldOut(p);
              const remaining = remainingStock(p);
              const maxSelectable =
                remaining === null ? undefined : Math.max(1, remaining);

              const currentQty = qtyMap[p.id] ?? 1;
              const safeQty =
                remaining === null
                  ? Math.max(1, currentQty)
                  : Math.max(1, Math.min(currentQty, Math.max(1, remaining)));

              if (safeQty !== currentQty) {
                queueMicrotask(() => {
                  setQtyMap((m) => ({ ...m, [p.id]: safeQty }));
                });
              }

              const stockTag =
                stock === null ? (
                  <Tag>Wholesale</Tag>
                ) : (
                  <Tag color={soldOut ? "red" : "green"}>
                    {soldOut ? "Sold out" : `In stock: ${stock}`}
                  </Tag>
                );

              const unitLower = (p.unit || "").toLowerCase();
              const displayPrice =
                unitLower === "kg"
                  ? money(p.pricePerKg ?? p.price)
                  : money(p.pricePerPack ?? p.price);
              const displayLabel =
                unitLower === "kg" ? "Price / kg" : "Price / pack";

              const addDisabled =
                !windowState.open ||
                soldOut ||
                (remaining !== null && remaining <= 0);

              const avgWeightLabel = fmtGrams(p.avgWeightG);

              return (
                <Col key={p.id} xs={24} sm={12} lg={8}>
                  <Card
                    loading={loading}
                    className="aca-productCard"
                    title={
                      <span
                        className="aca-productTitle"
                        style={{
                          display: "block",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {p.name}
                      </span>
                    }
                    extra={stockTag}
                    cover={
                      <div className="aca-productMedia">
                        <ProductImage
                          url={p.imageUrl}
                          alt={p.name}
                          style={{
                            width: "100%",
                            height: 180,
                            objectFit: "cover",
                          }}
                        />
                        {!p.imageUrl && (
                          <div
                            className="aca-productMedia__placeholder"
                            style={{ height: 180 }}
                          />
                        )}
                        {p.cutType ? (
                          <div className="aca-productBadge">{p.cutType}</div>
                        ) : null}
                      </div>
                    }
                  >
                    {p.description ? (
                      <Text className="aca-productDesc">{p.description}</Text>
                    ) : null}

                    <div className="aca-priceBlock">
                      <div className="aca-priceRow">
                        <Text type="secondary">{displayLabel}</Text>
                        <Text strong className="aca-priceVal">
                          {displayPrice}
                        </Text>
                      </div>

                      <div className="aca-unitHint">
                        <Text type="secondary">Sold by: Pack</Text>
                      </div>

                      {avgWeightLabel ? (
                        <div className="aca-unitHint" style={{ marginTop: 2 }}>
                          <Text type="secondary">
                            Avg weight: <b>{avgWeightLabel}</b>
                          </Text>
                        </div>
                      ) : null}

                      {stock !== null ? (
                        <div className="aca-unitHint" style={{ marginTop: 4 }}>
                          <Text type="secondary">
                            Remaining: <b>{remaining} pack/s</b>
                          </Text>
                        </div>
                      ) : null}
                    </div>

                    <div
                      className="aca-productActions"
                      style={{
                        display: "grid",
                        gridTemplateColumns: isMobile ? "1fr" : "120px 1fr",
                        gap: 10,
                        marginTop: 12,
                      }}
                    >
                      <InputNumber
                        min={1}
                        max={maxSelectable}
                        value={safeQty}
                        disabled={addDisabled}
                        style={{ width: "100%" }}
                        size="large"
                        onChange={(v) => {
                          const desired = Number(v || 1);
                          const next = clampQtyForProduct(p, desired);
                          setQtyMap((m) => ({ ...m, [p.id]: next }));
                        }}
                      />
                      <Button
                        type="primary"
                        size="large"
                        disabled={addDisabled}
                        onClick={() => {
                          const desired = safeQty;
                          if (remaining !== null && desired > remaining) {
                            message.warning(`Only ${remaining} left in stock.`);
                            setQtyMap((m) => ({
                              ...m,
                              [p.id]: Math.max(1, remaining),
                            }));
                            return;
                          }
                          add(p as any, desired);
                          message.success("Added to cart");
                        }}
                        className="aca-addBtn"
                        block
                      >
                        {addDisabled ? "Sold out" : "Add to cart"}
                      </Button>
                    </div>
                  </Card>
                </Col>
              );
            })}
          </Row>
        </section>
      </div>

      {isMobile ? (
        <>
          <FloatButton
            icon={
              <Badge count={items.length} size="small">
                <ShoppingCartOutlined />
              </Badge>
            }
            tooltip="Cart"
            onClick={() => setCartOpen(true)}
          />

          <Drawer
            title={`Cart (${items.length})`}
            open={cartOpen}
            onClose={() => setCartOpen(false)}
            placement="bottom"
            height="75vh"
            bodyStyle={{ paddingBottom: 90 }}
          >
            {items.length === 0 ? (
              <Text type="secondary">No items yet.</Text>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {summaryItems.map((row) => {
                  const unitLabel = summaryUnitLabel(row.product as any);
                  const unitPrice = summaryUnitPrice(row.product as any);
                  const qty = Number(row.qty || 1);
                  const prod = products.find(
                    (pp) => String(pp.id) === String(row.product.id),
                  );

                  return (
                    <div
                      key={row.product.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "44px 1fr",
                        gap: 10,
                        alignItems: "start",
                        padding: 10,
                        borderRadius: 14,
                        border: "1px solid var(--aca-border)",
                        background: "var(--aca-bg2)",
                      }}
                    >
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 12,
                          overflow: "hidden",
                          background: "var(--aca-card)",
                          border: "1px solid var(--aca-border)",
                        }}
                      >
                        <ProductImage
                          url={(row.product as any).imageUrl}
                          alt={row.product.name}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      </div>

                      <div style={{ minWidth: 0, paddingTop: 2 }}>
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
                              {row.product.name}
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                color: "var(--aca-muted)",
                                marginTop: 2,
                              }}
                            >
                              {unitLabel}:{" "}
                              <span
                                style={{
                                  fontWeight: 800,
                                  color: "var(--aca-forest)",
                                }}
                              >
                                {money(unitPrice)}
                              </span>
                            </div>
                          </div>
                          <Button
                            size="small"
                            danger
                            onClick={() => remove(row.product.id)}
                            icon={<DeleteOutlined />}
                          />
                        </div>

                        <div
                          style={{
                            marginTop: 10,
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                          }}
                        >
                          <Button
                            icon={<MinusOutlined />}
                            disabled={qty <= 1}
                            onClick={() =>
                              setQty(row.product.id, Math.max(1, qty - 1))
                            }
                          />
                          <Text strong>{qty}</Text>
                          <Button
                            icon={<PlusOutlined />}
                            disabled={
                              !prod ? false : remainingStock(prod) === 0
                            }
                            onClick={() => {
                              if (!prod) return setQty(row.product.id, qty + 1);
                              const rem = remainingStock(prod);
                              if (rem === null || rem > 0)
                                setQty(row.product.id, qty + 1);
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}

                {items.length > 10 ? (
                  <Text type="secondary">+ {items.length - 10} more…</Text>
                ) : null}
              </div>
            )}

            <div
              style={{
                position: "fixed",
                left: 0,
                right: 0,
                bottom: 0,
                padding: 12,
                background: "rgba(255,255,255,0.92)",
                borderTop: "1px solid var(--aca-border)",
                backdropFilter: "blur(8px)",
              }}
            >
              <Button
                type="primary"
                block
                size="large"
                disabled={items.length === 0}
                onClick={() => navigate("/checkout")}
              >
                Go to checkout
              </Button>
            </div>
          </Drawer>
        </>
      ) : null}
    </div>
  );
}
