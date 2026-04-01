export const generateId = (length = 10): string => {
  const chars = "abcdefghijklmnopqrstuvwzyx0123456789";

  return Array.from(
    { length },
    () => chars[Math.floor(Math.random() * (chars.length - 1))],
  ).join("");
};
