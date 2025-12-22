export type ItemType = "PRODUCT" | "SERVICE" | "SUBSCRIPTION";

export type Product = {
  id?: string;
  external_id?: string;
  name: string;
  description?: string | null;
  sku?: string | null;
  unit?: string | null;
  item_type?: ItemType;
  cost_price?: number | null;
  sale_price?: number | null;
  duration_minutes?: number | null;
  billing_type?: string | null;
  brand?: string | null;
  grouping?: string | null;
  power?: string | null;
  size?: string | null;
  supplier?: string | null;
  status?: string | null;
  specs?: string | null;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type ProductForm = Omit<Product, "cost_price" | "sale_price" | "duration_minutes"> & {
  cost_price?: string | number | null;
  sale_price?: string | number | null;
  duration_minutes?: string | number | null;
};
