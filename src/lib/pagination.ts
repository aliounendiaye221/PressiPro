type PaginationOptions = {
  defaultPage?: number;
  defaultLimit?: number;
  maxLimit?: number;
};

export function parsePagination(
  searchParams: URLSearchParams,
  options: PaginationOptions = {}
) {
  const defaultPage = options.defaultPage ?? 1;
  const defaultLimit = options.defaultLimit ?? 20;
  const maxLimit = options.maxLimit ?? 50;

  const rawPage = Number.parseInt(searchParams.get("page") || "", 10);
  const rawLimit = Number.parseInt(searchParams.get("limit") || "", 10);

  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : defaultPage;
  const normalizedLimit =
    Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : defaultLimit;
  const limit = Math.min(maxLimit, normalizedLimit);

  return { page, limit };
}