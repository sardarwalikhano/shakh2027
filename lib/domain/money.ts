const MAX_IQD_MINOR = Number.MAX_SAFE_INTEGER;

export type IQD = number & { readonly __currency: "IQD" };

export function asIQD(value: number): IQD {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_IQD_MINOR) {
    throw new RangeError("IQD amounts must be non-negative safe integers.");
  }
  return value as IQD;
}

export function formatIQD(value: number, locale = "ku-IQ"): string {
  const amount = asIQD(value);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "IQD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function calculateBasisPointFee(amountIQD: number, rateBps: number): IQD {
  if (!Number.isSafeInteger(rateBps) || rateBps < 0 || rateBps > 10_000) {
    throw new RangeError("Rate must be an integer from 0 through 10000 basis points.");
  }
  const amount = asIQD(amountIQD);
  const fee = Math.floor((amount * rateBps) / 10_000);
  return asIQD(fee);
}

export function multiplyIQD(unitAmount: number, quantity: number): IQD {
  const unit = asIQD(unitAmount);
  if (!Number.isSafeInteger(quantity) || quantity < 0) {
    throw new RangeError("Quantity must be a non-negative safe integer.");
  }
  const total = unit * quantity;
  return asIQD(total);
}
