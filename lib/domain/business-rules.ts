import { calculateBasisPointFee, multiplyIQD, asIQD, type IQD } from "./money";

export const CAPTAIN_COMMISSION_BPS = 2_000;
export const REFERRAL_ATTRIBUTION_DAYS = 30;

export function calculateCaptainCommission(deliveryFeeIQD: number): IQD {
  return calculateBasisPointFee(deliveryFeeIQD, CAPTAIN_COMMISSION_BPS);
}

export function calculateMerchantCommission(
  fixedCommissionPerUnitIQD: number,
  soldQuantity: number,
): IQD {
  return multiplyIQD(fixedCommissionPerUnitIQD, soldQuantity);
}

export function calculateRewardReserve(
  rewardPerCompletedUnitIQD: number,
  expectedUnits: number,
): IQD {
  if (!Number.isSafeInteger(expectedUnits) || expectedUnits < 1 || expectedUnits > 10_000_000) {
    throw new RangeError("Expected reward units must be between 1 and 10,000,000.");
  }
  return multiplyIQD(rewardPerCompletedUnitIQD, expectedUnits);
}

export function calculateCompletedItemReward(
  rewardPerCompletedUnitIQD: number,
  deliveredQuantity: number,
): IQD {
  if (!Number.isSafeInteger(deliveredQuantity) || deliveredQuantity < 1) {
    throw new RangeError("A reward requires at least one completed unit.");
  }
  return multiplyIQD(rewardPerCompletedUnitIQD, deliveredQuantity);
}

export function canCaptainAcceptOrder(
  availableCaptainWalletIQD: number,
  deliveryFeeIQD: number,
): boolean {
  const available = asIQD(availableCaptainWalletIQD);
  const requiredCommission = calculateCaptainCommission(deliveryFeeIQD);
  return available >= requiredCommission;
}

export function canMerchantKeepPostActive(
  availableMerchantWalletIQD: number,
  fixedCommissionPerUnitIQD: number,
): boolean {
  const available = asIQD(availableMerchantWalletIQD);
  const requiredForOneSale = asIQD(fixedCommissionPerUnitIQD);
  return available >= requiredForOneSale;
}

export function isReferralAttributionEligible(
  attributedAt: Date,
  qualifyingOrderCompletedAt: Date,
): boolean {
  const attributionTime = attributedAt.getTime();
  const completionTime = qualifyingOrderCompletedAt.getTime();
  if (!Number.isFinite(attributionTime) || !Number.isFinite(completionTime)) return false;

  const expiresAt = attributionTime + REFERRAL_ATTRIBUTION_DAYS * 24 * 60 * 60 * 1000;
  return completionTime >= attributionTime && completionTime <= expiresAt;
}
