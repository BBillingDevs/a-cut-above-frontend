// src/pages/public/ShopPage.tsx

import React, { useEffect, useMemo, useRef, useState } from "react";
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
  Modal,
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
  ArrowUpOutlined,
} from "@ant-design/icons";
import { api, RAILWAY_BASE } from "../../api/client";
import type { Product } from "../../types";
import { useCart } from "../../context/CartContext";
import { useLocation, useNavigate } from "react-router-dom";
import { IconPreview } from "../../components/iconCatalog";

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const PREFERRED_LOCATION_KEY = "aca_preferred_dropoff_location";
const HEADER_STICKY_OFFSET = 95;
const SEARCH_STICKY_HEIGHT = 82;
const SIDEBAR_STICKY_TOP = HEADER_STICKY_OFFSET + SEARCH_STICKY_HEIGHT + 12;

type WindowState = {
  open: boolean;
  name?: string;
  endsAt?: string;
  message?: string;
  isPermanent?: boolean;
  nextDeliveryDate?: string;
};

type DropoffLocation = {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  sortOrder: number;
  nextSchedule?: {
    cutoffDate: string;
    deliveryDate: string;
  } | null;
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

function resolveImageUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("/uploads/")) return `${RAILWAY_BASE}${url}`;
  return url;
}

function formatDeliveryDate(value?: string) {
  if (!value) return null;

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) return value;

  return d.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function deriveDeliveryBannerText(
  selectedLocation: DropoffLocation | null,
  windowState: WindowState,
): string | null {
  if (selectedLocation?.nextSchedule?.deliveryDate) {
    const delivery = formatDeliveryDate(
      selectedLocation.nextSchedule.deliveryDate,
    );
    const cutoff = formatDeliveryDate(selectedLocation.nextSchedule.cutoffDate);

    if (cutoff) {
      return `${selectedLocation.name}: order by ${cutoff} • delivery ${delivery}`;
    }

    return `${selectedLocation.name}: delivery ${delivery}`;
  }

  if (selectedLocation?.name) {
    return `No next delivery date currently available for ${selectedLocation.name}`;
  }

  if (windowState.nextDeliveryDate) {
    return `Next delivery date: ${formatDeliveryDate(windowState.nextDeliveryDate)}`;
  }

  if (windowState.endsAt) {
    return `Next delivery date: ${formatDeliveryDate(windowState.endsAt)}`;
  }

  if (windowState.name) {
    return `Next delivery: ${windowState.name}`;
  }

  return null;
}

export default function ShopPage() {
  const { add, items, setQty, remove } = useCart();

  const location = useLocation();
  const navigate = useNavigate();
  const screens = useBreakpoint();

  const isMobile = !screens.md;
  const showSummary = !!screens.lg;

  const [cartOpen, setCartOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);

  const [products, setProducts] = useState([] as PricedProduct[]);
  const [loading, setLoading] = useState(false);
  const [windowState, setWindowState] = useState<WindowState>({
    open: true,
  });

  const [dropoffLocations, setDropoffLocations] = useState<DropoffLocation[]>(
    [],
  );
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    null,
  );
  const [locationPromptOpen, setLocationPromptOpen] = useState(false);
  const didCheckPromptRef = useRef(false);

  const [qtyMap, setQtyMap] = useState({} as Record<string, number>);
  const [activeCat, setActiveCat] = useState("all");
  const [sort, setSort] = useState("featured");
  const [shopSearch, setShopSearch] = useState("");

  const [previewImage, setPreviewImage] = useState<{
    src: string;
    alt: string;
  } | null>(null);

  const q = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return (params.get("q") || "").trim().toLowerCase();
  }, [location.search]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const raw = params.get("q") || "";

    setShopSearch(raw ? decodeURIComponent(raw) : "");
  }, [location.search]);

  useEffect(() => {
    const onScroll = () => {
      setShowBackToTop(window.scrollY > 280);
    };

    onScroll();

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function setUrlQuery(next: string) {
    const params = new URLSearchParams(location.search);
    const cleaned = next.trim();

    if (cleaned) {
      params.set("q", cleaned);
    } else {
      params.delete("q");
    }

    const qs = params.toString();

    navigate(
      { pathname: location.pathname, search: qs ? `?${qs}` : "" },
      { replace: true },
    );
  }

  function savePreferredLocation(id: string | null) {
    if (!id) return;

    localStorage.setItem(PREFERRED_LOCATION_KEY, id);
    setSelectedLocationId(id);
    setLocationPromptOpen(false);
  }

  async function load() {
    setLoading(true);

    try {
      const [wRes, pRes, lRes] = await Promise.all([
        api.get("/api/public/order-window"),
        api.get("/api/public/products"),
        api.get("/api/public/dropoff-locations"),
      ]);

      setWindowState(wRes.data);

      const rawLocations = (lRes.data?.locations || lRes.data || []) as any[];

      const activeLocations = rawLocations
        .filter((loc) => loc?.isActive !== false)
        .sort((a, b) => Number(a?.sortOrder || 0) - Number(b?.sortOrder || 0))
        .map(
          (loc): DropoffLocation => ({
            id: String(loc.id),
            name: String(loc.name),
            description: loc.description ?? null,
            isActive: Boolean(loc.isActive),
            sortOrder: Number(loc.sortOrder || 0),
            nextSchedule: loc.nextSchedule
              ? {
                  cutoffDate: String(loc.nextSchedule.cutoffDate),
                  deliveryDate: String(loc.nextSchedule.deliveryDate),
                }
              : null,
          }),
        );

      setDropoffLocations(activeLocations);

      const savedLocationId = localStorage.getItem(PREFERRED_LOCATION_KEY);

      setSelectedLocationId((prev) => {
        if (prev && activeLocations.some((loc) => loc.id === prev)) {
          return prev;
        }

        if (
          savedLocationId &&
          activeLocations.some((loc) => loc.id === savedLocationId)
        ) {
          return savedLocationId;
        }

        return activeLocations[0]?.id ?? null;
      });

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

  useEffect(() => {
    if (didCheckPromptRef.current) return;
    if (!dropoffLocations.length) return;

    didCheckPromptRef.current = true;

    const savedLocationId = localStorage.getItem(PREFERRED_LOCATION_KEY);
    const hasValidSaved =
      !!savedLocationId &&
      dropoffLocations.some((loc) => loc.id === savedLocationId);

    if (!hasValidSaved) {
      setLocationPromptOpen(true);
    }
  }, [dropoffLocations]);

  const selectedLocation = useMemo(
    () =>
      dropoffLocations.find(
        (loc) => String(loc.id) === String(selectedLocationId),
      ) || null,
    [dropoffLocations, selectedLocationId],
  );

  const locationUnavailable = useMemo(() => {
    if (!selectedLocation) return true;

    return !selectedLocation.nextSchedule?.deliveryDate;
  }, [selectedLocation]);

  const locationUnavailableMessage =
    "Unfortunately there are no deliveries to that location at the current moment, please check back in moment as the issue should be resolved shortly.";

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
      if ((p.unit || "").toLowerCase() === "kg") {
        return p.pricePerKg ?? p.price ?? 0;
      }

      return p.pricePerPack ?? p.price ?? 0;
    };

    if (sort === "price_asc") {
      list = [...list].sort((a, b) => unitPrice(a) - unitPrice(b));
    }

    if (sort === "price_desc") {
      list = [...list].sort((a, b) => unitPrice(b) - unitPrice(a));
    }

    return list;
  }, [products, q, activeCat, sort]);

  const summaryItems = useMemo(() => items.slice(0, 10), [items]);

  const deliveryBannerText = useMemo(
    () => deriveDeliveryBannerText(selectedLocation, windowState),
    [selectedLocation, windowState],
  );

  function summaryUnitLabel(p: any) {
    const u = String(p?.unit || "").toLowerCase();

    return u === "kg" ? "Price / kg" : "Price / pack";
  }

  function summaryUnitPrice(p: any) {
    const u = String(p?.unit || "").toLowerCase();

    if (u === "kg") {
      return asNumber(p?.pricePerKg ?? p?.priceKg ?? p?.price) ?? 0;
    }

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

  function isSoldOut(p: PricedProduct) {
    const s = stockFor(p);

    if (s === null) return false;

    return s <= 0;
  }

  function confirmAddToCart(p: PricedProduct, desiredQty: number) {
    if (locationUnavailable) {
      message.warning(locationUnavailableMessage);
      return;
    }

    const remaining = remainingStock(p);

    if (remaining !== null && remaining <= 0) {
      message.warning("This item is out of stock.");
      return;
    }

    if (remaining !== null && desiredQty > remaining) {
      Modal.confirm({
        title: "Not enough stock",
        content: `There is not enough stock. Would you like to add ${remaining} to the cart instead?`,
        okText: `Add ${remaining}`,
        cancelText: "Cancel",
        onOk: () => {
          add(p as any, remaining);
          setQtyMap((m) => ({ ...m, [p.id]: remaining }));
          message.success(`Added ${remaining} to cart`);
        },
      });

      return;
    }

    add(p as any, desiredQty);
    message.success("Added to cart");
  }

  return (
    <div className="aca-page">
      <div className="aca-page__top">
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
        id="shop-sticky-start"
        style={{
          position: "sticky",
          top: HEADER_STICKY_OFFSET,
          zIndex: 40,
          marginTop: 12,
          paddingTop: 8,
          paddingBottom: 10,
          background: "var(--aca-bg)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "220px 280px 1fr",
            gap: 10,
            alignItems: "end",
          }}
        >
          <div style={{ display: "grid", gap: 6 }}>
            <Text type="secondary">Sort by:</Text>

            <Select
              value={sort}
              onChange={setSort}
              style={{ width: "100%" }}
              options={[
                { value: "featured", label: "Best Sellers" },
                { value: "price_asc", label: "Price: Low to High" },
                { value: "price_desc", label: "Price: High to Low" },
              ]}
            />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <Text type="secondary">Delivery location:</Text>

            <Select
              value={selectedLocationId ?? undefined}
              onChange={savePreferredLocation}
              placeholder="Select delivery location"
              style={{ width: "100%" }}
              options={dropoffLocations.map((loc) => ({
                value: loc.id,
                label: loc.name,
              }))}
            />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <Text type="secondary">Search:</Text>

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
        </div>
      </div>

      {deliveryBannerText ? (
        <div style={{ marginTop: 12 }}>
          <div
            style={{
              background: "var(--aca-forest)",
              color: "#fff",
              borderRadius: 14,
              padding: isMobile ? "10px 12px" : "12px 16px",
              boxShadow: "0 10px 24px rgba(0,0,0,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              fontWeight: 700,
            }}
          >
            {deliveryBannerText}
          </div>
        </div>
      ) : null}

      {locationUnavailable && selectedLocation ? (
        <div style={{ marginTop: 12 }}>
          <Alert type="warning" showIcon message={locationUnavailableMessage} />
        </div>
      ) : null}

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
            style={{
              position: showSummary ? "sticky" : "static",
              top: showSummary ? SIDEBAR_STICKY_TOP : undefined,
              alignSelf: "start",
              overflow: "visible",
            }}
          >
            <div
              className="aca-sidebarCard"
              style={{ overflow: "visible", paddingTop: 14 }}
            >
              <h3
                className="aca-sidebarTitle"
                style={{ marginTop: 0, paddingTop: 4 }}
              >
                Categories
              </h3>

              <div className="aca-catList">
                {categoryDefs.map((c) => (
                  <button
                    key={c.key}
                    className={`aca-catItem ${
                      activeCat === c.key ? "is-active" : ""
                    }`}
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
                      const img = resolveImageUrl(
                        (row.product as any).imageUrl,
                      );
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
                          <button
                            type="button"
                            onClick={() => {
                              if (img) {
                                setPreviewImage({
                                  src: img,
                                  alt: row.product.name,
                                });
                              }
                            }}
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 12,
                              overflow: "hidden",
                              background: "var(--aca-card)",
                              border: "1px solid var(--aca-border)",
                              padding: 0,
                              cursor: img ? "zoom-in" : "default",
                            }}
                          >
                            {img ? (
                              <img
                                src={img}
                                alt={row.product.name}
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                  display: "block",
                                }}
                                onError={(e) => {
                                  (
                                    e.currentTarget as HTMLImageElement
                                  ).style.display = "none";
                                }}
                              />
                            ) : null}
                          </button>

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
                                  disabled={locationUnavailable}
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
                                    disabled={qty <= 1 || locationUnavailable}
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
                                      locationUnavailable ||
                                      (!prod
                                        ? false
                                        : remainingStock(prod) === 0)
                                    }
                                    onClick={() => {
                                      if (!prod) {
                                        setQty(row.product.id, qty + 1);
                                        return;
                                      }

                                      const rem = remainingStock(prod);

                                      if (rem === null || rem > 0) {
                                        setQty(row.product.id, qty + 1);
                                      }
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
                    disabled={items.length === 0 || locationUnavailable}
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
          <Row gutter={[16, 16]} align="stretch">
            {filtered.map((p) => {
              const stock = stockFor(p);
              const soldOut = isSoldOut(p);
              const remaining = remainingStock(p);
              const currentQty = Math.max(1, qtyMap[p.id] ?? 1);

              const stockTag =
                stock === null ? (
                  <Tag style={{ marginInlineEnd: 0 }}>Wholesale</Tag>
                ) : (
                  <Tag
                    color={soldOut ? "red" : "green"}
                    style={{ marginInlineEnd: 0 }}
                  >
                    {soldOut ? "Sold out" : `In stock: ${stock}`}
                  </Tag>
                );

              const imgSrc = resolveImageUrl(p.imageUrl);
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
                locationUnavailable ||
                (remaining !== null && remaining <= 0);

              const avgWeightLabel = fmtGrams(p.avgWeightG);

              return (
                <Col
                  key={p.id}
                  xs={12}
                  sm={12}
                  lg={8}
                  style={{ display: "flex" }}
                >
                  <Card
                    loading={loading}
                    className="aca-productCard"
                    style={{
                      width: "100%",
                      display: "flex",
                      flexDirection: "column",
                    }}
                    styles={{
                      body: {
                        display: "flex",
                        flexDirection: "column",
                        flex: 1,
                        padding: isMobile ? 10 : 16,
                      },
                    }}
                    title={
                      isMobile ? (
                        <div style={{ minWidth: 0 }}>
                          <div
                            className="aca-productTitle"
                            style={{
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                              whiteSpace: "normal",
                              lineHeight: 1.2,
                              fontSize: 14,
                            }}
                          >
                            {p.name}
                          </div>

                          <div style={{ marginTop: 6 }}>{stockTag}</div>
                        </div>
                      ) : (
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
                      )
                    }
                    extra={isMobile ? null : stockTag}
                    cover={
                      <button
                        type="button"
                        className="aca-productMedia"
                        onClick={() => {
                          if (imgSrc) {
                            setPreviewImage({
                              src: imgSrc,
                              alt: p.name,
                            });
                          }
                        }}
                        style={{
                          width: "100%",
                          border: 0,
                          padding: 0,
                          background: "transparent",
                          cursor: imgSrc ? "zoom-in" : "default",
                          position: "relative",
                          overflow: "hidden",
                          display: "block",
                        }}
                      >
                        {imgSrc ? (
                          <img
                            src={imgSrc}
                            alt={p.name}
                            style={{
                              width: "100%",
                              height: isMobile ? 145 : 220,
                              objectFit: "cover",
                              display: "block",
                            }}
                            onError={(e) => {
                              (
                                e.currentTarget as HTMLImageElement
                              ).style.display = "none";
                            }}
                          />
                        ) : (
                          <div
                            className="aca-productMedia__placeholder"
                            style={{ height: isMobile ? 145 : 220 }}
                          />
                        )}

                        {p.cutType ? (
                          <div className="aca-productBadge">{p.cutType}</div>
                        ) : null}
                      </button>
                    }
                  >
                    {p.description && !isMobile ? (
                      <Text className="aca-productDesc">{p.description}</Text>
                    ) : null}

                    <div
                      className="aca-priceBlock"
                      style={{ marginTop: isMobile ? 0 : 6 }}
                    >
                      <div
                        className="aca-priceRow"
                        style={{
                          flexDirection: isMobile ? "column" : "row",
                          alignItems: isMobile ? "flex-start" : "baseline",
                          gap: isMobile ? 2 : 0,
                          margin: isMobile ? "0 0 6px" : undefined,
                        }}
                      >
                        <Text
                          type="secondary"
                          style={{ fontSize: isMobile ? 12 : undefined }}
                        >
                          {displayLabel}
                        </Text>

                        <Text
                          strong
                          className="aca-priceVal"
                          style={{ fontSize: isMobile ? 15 : undefined }}
                        >
                          {displayPrice}
                        </Text>
                      </div>

                      {!isMobile ? (
                        <div className="aca-unitHint">
                          <Text type="secondary">Sold by: Pack</Text>
                        </div>
                      ) : null}

                      {avgWeightLabel ? (
                        <div
                          className="aca-unitHint"
                          style={{ marginTop: isMobile ? 4 : 2 }}
                        >
                          <Text
                            type="secondary"
                            style={{ fontSize: isMobile ? 11 : undefined }}
                          >
                            Avg weight: <b>{avgWeightLabel}</b>
                          </Text>
                        </div>
                      ) : null}

                      {stock !== null ? (
                        <div className="aca-unitHint" style={{ marginTop: 4 }}>
                          <Text
                            type="secondary"
                            style={{ fontSize: isMobile ? 11 : undefined }}
                          >
                            Remaining: <b>{remaining} pack/s</b>
                          </Text>
                        </div>
                      ) : null}
                    </div>

                    <div style={{ flex: 1 }} />

                    <div
                      className="aca-productActions"
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr",
                        gap: 8,
                        marginTop: 12,
                      }}
                    >
                      <InputNumber
                        min={1}
                        value={currentQty}
                        disabled={addDisabled}
                        style={{ width: "100%" }}
                        size={isMobile ? "middle" : "large"}
                        onChange={(v) => {
                          const desired = Math.max(1, Number(v || 1));

                          setQtyMap((m) => ({ ...m, [p.id]: desired }));
                        }}
                      />

                      <Button
                        type="primary"
                        size={isMobile ? "middle" : "large"}
                        disabled={addDisabled}
                        onClick={() => confirmAddToCart(p, currentQty)}
                        className="aca-addBtn"
                        block
                      >
                        {locationUnavailable
                          ? "Unavailable"
                          : addDisabled
                            ? "Sold out"
                            : "Add to cart"}
                      </Button>
                    </div>
                  </Card>
                </Col>
              );
            })}
          </Row>
        </section>
      </div>

      <Modal
        title="Choose your delivery location"
        open={locationPromptOpen}
        closable={false}
        maskClosable={false}
        cancelButtonProps={{ style: { display: "none" } }}
        okButtonProps={{ style: { display: "none" } }}
      >
        <div style={{ display: "grid", gap: 12 }}>
          <Text>Please select your preferred delivery location.</Text>

          <Select
            value={selectedLocationId ?? undefined}
            onChange={setSelectedLocationId}
            placeholder="Select delivery location"
            style={{ width: "100%" }}
            options={dropoffLocations.map((loc) => ({
              value: loc.id,
              label: loc.name,
            }))}
          />

          <Button
            type="primary"
            disabled={!selectedLocationId}
            onClick={() => savePreferredLocation(selectedLocationId)}
          >
            Save location
          </Button>
        </div>
      </Modal>

      <Modal
        open={!!previewImage}
        footer={null}
        onCancel={() => setPreviewImage(null)}
        centered
        width={900}
        destroyOnHidden
        styles={{
          body: {
            padding: 0,
            background: "transparent",
          },
        }}
      >
        {previewImage ? (
          <img
            src={previewImage.src}
            alt={previewImage.alt}
            style={{
              width: "100%",
              maxHeight: "82vh",
              objectFit: "contain",
              display: "block",
              borderRadius: 12,
              background: "#fff",
            }}
          />
        ) : null}
      </Modal>

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
            style={{ right: 24, bottom: showBackToTop ? 96 : 24 }}
          />

          {showBackToTop ? (
            <FloatButton
              icon={<ArrowUpOutlined />}
              tooltip="Back to top"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              style={{ right: 24, bottom: 24 }}
            />
          ) : null}

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
                  const img = resolveImageUrl((row.product as any).imageUrl);
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
                      <button
                        type="button"
                        onClick={() => {
                          if (img) {
                            setPreviewImage({
                              src: img,
                              alt: row.product.name,
                            });
                          }
                        }}
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 12,
                          overflow: "hidden",
                          background: "var(--aca-card)",
                          border: "1px solid var(--aca-border)",
                          padding: 0,
                          cursor: img ? "zoom-in" : "default",
                        }}
                      >
                        {img ? (
                          <img
                            src={img}
                            alt={row.product.name}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                              display: "block",
                            }}
                            onError={(e) => {
                              (
                                e.currentTarget as HTMLImageElement
                              ).style.display = "none";
                            }}
                          />
                        ) : null}
                      </button>

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
                            disabled={locationUnavailable}
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
                            disabled={qty <= 1 || locationUnavailable}
                            onClick={() =>
                              setQty(row.product.id, Math.max(1, qty - 1))
                            }
                          />

                          <Text strong>{qty}</Text>

                          <Button
                            icon={<PlusOutlined />}
                            disabled={
                              locationUnavailable ||
                              (!prod ? false : remainingStock(prod) === 0)
                            }
                            onClick={() => {
                              if (!prod) {
                                setQty(row.product.id, qty + 1);
                                return;
                              }

                              const rem = remainingStock(prod);

                              if (rem === null || rem > 0) {
                                setQty(row.product.id, qty + 1);
                              }
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
                disabled={items.length === 0 || locationUnavailable}
                onClick={() => navigate("/checkout")}
              >
                Go to checkout
              </Button>
            </div>
          </Drawer>
        </>
      ) : showBackToTop ? (
        <FloatButton
          icon={<ArrowUpOutlined />}
          tooltip="Back to top"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          style={{ right: 24, bottom: 24 }}
        />
      ) : null}
    </div>
  );
}
