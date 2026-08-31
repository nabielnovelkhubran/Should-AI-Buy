import {
  PaperOrderStatus,
  PaperOrderIntent,
  PaperExecutionRecord,
  PaperOrderRequest,
  PaperOrderResult,
  AssetClass,
  DecisionState
} from '../types';

export {
  type PaperOrderStatus,
  type PaperOrderIntent,
  type PaperExecutionRecord,
  type PaperOrderRequest,
  type PaperOrderResult,
  type AssetClass,
  type DecisionState
};

export interface PaperTradingAdapter {
  submitOrder(request: PaperOrderRequest): Promise<PaperOrderResult>;
  getOrder(orderId: string): Promise<PaperOrderResult | undefined>;
  cancelOrder(orderId: string): Promise<boolean>;
  getOrders(): Promise<PaperOrderResult[]>;
}
