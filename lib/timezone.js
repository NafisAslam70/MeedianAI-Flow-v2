const IST_OFFSET_MINUTES = 5 * 60 + 30;

const ensureDate = (value) => {
  if (!value && value !== 0) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const toISTDate = (value) => {
  const input = ensureDate(value);
  if (!input) return null;
  const utcMs = input.getTime() + input.getTimezoneOffset() * 60000;
  return new Date(utcMs + IST_OFFSET_MINUTES * 60000);
};

export const formatISTDate = (value) => {
  const ist = toISTDate(value);
  if (!ist) return "";
  const year = ist.getFullYear();
  const month = String(ist.getMonth() + 1).padStart(2, "0");
  const day = String(ist.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const formatISTDateTime = (value, options = {}) => {
  const ist = toISTDate(value);
  if (!ist) return "";
  const formatter = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: options.includeSeconds ? "2-digit" : undefined,
    hour12: options.hour12 ?? false,
  });
  return formatter.format(ist);
};

export const nowIST = () => toISTDate(new Date());
