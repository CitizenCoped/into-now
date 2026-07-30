export const CATEGORIES = [
  "Garage Sale",
  "Electronics",
  "Furniture",
  "Services",
  "Food & Drink",
  "Events",
  "Hobbies",
  "Wellness",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_COLORS: Record<Category, string> = {
  "Garage Sale": "#F59E0B",
  Electronics: "#3B82F6",
  Furniture: "#10B981",
  Services: "#8B5CF6",
  "Food & Drink": "#EF4444",
  Events: "#EC4899",
  Hobbies: "#FF8A1E",
  Wellness: "#A78BFA",
};

export function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category as Category] ?? "#FF8A1E";
}
