export type PricingTier = "RETAIL" | "WHOLESALE";

export type Product = {
  id: string;
  name: string;
  description?: string | null;
  unit: string;
  price: number;
  stockQty: number | null;

  // NEW:
  imageUrl?: string | null;
  category?: string | null; // category key, e.g. "beef"
};

export type CartItem = {
  product: Product;
  qty: number;
};

export type OrderTrackItem = {
  productName: string;
  unit: string;
  qty: number;
  wetWeightKg: number | null;
  dryWeightKg: number | null;
  yieldPct: number | null;
};

export type TrackedOrder = {
  orderNo: string;
  customerName: string;
  customerPhone: string;
  status: string;
  pricingTier: PricingTier;
  createdAt: string;
  items: OrderTrackItem[];
};
