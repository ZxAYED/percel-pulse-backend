// utils/buildDynamicFilters.ts
const EXCLUDED_KEYS = ["page", "limit", "sortBy", "sortOrder"];

export const buildDynamicFilters = (
  filters: Record<string, any>,
  searchableFields: string[]
): Record<string, any> => {
  const andConditions: any[] = [];

  if (filters.searchTerm?.trim()) {
    andConditions.push({
      OR: searchableFields.map((field) => ({
        [field]: {
          contains: filters.searchTerm,
          mode: "insensitive",
        },
      })),
    });
  }

  const { searchTerm, ...rest } = filters;

  for (const [key, value] of Object.entries(rest)) {
    if (
      value !== undefined &&
      value !== null &&
      value !== "" &&
      !EXCLUDED_KEYS.includes(key)
    ) {
      andConditions.push({ [key]: value });
    }
  }

  return andConditions.length > 0 ? { AND: andConditions } : {};
};
