import type { AppRole, StoreType } from "./roles";

export type OrderPaymentMethod = "cash";
export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "assigned"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export type WalletOwnerType = "user" | "platform" | "external";
export type WalletPurpose = "merchant_commission" | "captain_commission" | "customer_rewards";
export type WalletTopupProvider = "fastpay" | "fib";
export type WalletTopupStatus = "pending" | "approved" | "rejected";

export interface MerchantCommissionAgreement {
  storeId: string;
  productId: string;
  amountPerUnitIQD: number;
  agreedAt: string;
  agreedBy: string;
}

export interface RewardCampaignDraft {
  postId: string;
  rewardPerCompletedUnitIQD: number;
  expectedUnits: number;
  reserveBudgetIQD: number;
  status: "draft" | "reserved" | "published" | "paused" | "completed" | "cancelled";
}

export interface ReferralAttribution {
  referralCodeId: string;
  referrerUserId: string;
  customerUserId: string;
  attributedAt: string;
  expiresAt: string;
  attributionModel: "first30";
}

export interface CaptainDeliverySettlement {
  orderId: string;
  captainUserId: string;
  deliveryFeeCollectedCashIQD: number;
  commissionRateBps: 2000;
  commissionDebitedFromWalletIQD: number;
  status: "pending" | "settled" | "blocked";
}

export interface RoleStorePolicy {
  role: AppRole;
  permittedStoreTypes: readonly StoreType[];
}
