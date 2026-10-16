import { eq, desc, and } from 'drizzle-orm';
import { type SmexDatabase } from '../db/index.js';
import {
  boostingRates,
  boostingOrders,
  type BoostingRate,
  type NewBoostingOrder,
  type BoostingOrder,
} from '../db/schema/boosting.js';
import { ValidationError } from './boosting-calc.service.js';

export interface RateUpdateInput {
  priceInr?: number | string;
  isActive?: boolean;
  minStars?: number;
  maxStars?: number;
}

export interface OrderFilterOptions {
  status?: string;
  channel?: string;
  limit?: number;
  offset?: number;
}

export const ALLOWED_ORDER_TRANSITIONS: Record<string, string[]> = {
  inquiry: ['confirmed', 'cancelled'],
  confirmed: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export class BoostingRateService {
  /**
   * Retrieves all currently active boosting rates
   */
  static async getActiveRates(db: SmexDatabase): Promise<BoostingRate[]> {
    return db
      .select()
      .from(boostingRates)
      .where(eq(boostingRates.isActive, true));
  }

  /**
   * Retrieves all boosting rates (including inactive/historical) for admin management
   */
  static async getAllRates(db: SmexDatabase): Promise<BoostingRate[]> {
    return db.select().from(boostingRates);
  }

  /**
   * Updates an existing boosting rate row
   */
  static async updateRate(
    id: string,
    data: RateUpdateInput,
    db: SmexDatabase
  ): Promise<BoostingRate | undefined> {
    const [existing] = await db
      .select()
      .from(boostingRates)
      .where(eq(boostingRates.id, id));

    if (!existing) {
      return undefined;
    }

    if (data.priceInr !== undefined) {
      const num = Number(data.priceInr);
      if (isNaN(num) || num <= 0) {
        throw new ValidationError('INVALID_PRICE', 400, 'priceInr must be strictly positive');
      }
    }

    const newMin = data.minStars !== undefined ? data.minStars : existing.minStars;
    const newMax = data.maxStars !== undefined ? data.maxStars : existing.maxStars;

    if (newMin !== null && newMin !== undefined && newMax !== null && newMax !== undefined) {
      if (newMin < 0 || newMax < 0 || newMax < newMin) {
        throw new ValidationError(
          'INVALID_STAR_BOUNDARY',
          400,
          'maxStars must be greater than or equal to minStars, and both must be >= 0'
        );
      }
    }

    const updatePayload: Partial<typeof boostingRates.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (data.priceInr !== undefined) {
      updatePayload.priceInr = String(Number(data.priceInr).toFixed(2));
    }
    if (data.isActive !== undefined) {
      updatePayload.isActive = Boolean(data.isActive);
    }
    if (data.minStars !== undefined) {
      updatePayload.minStars = data.minStars;
    }
    if (data.maxStars !== undefined) {
      updatePayload.maxStars = data.maxStars;
    }

    const [updated] = await db
      .update(boostingRates)
      .set(updatePayload)
      .where(eq(boostingRates.id, id))
      .returning();

    return updated;
  }

  /**
   * Persists a customer booking inquiry
   */
  static async createOrder(
    data: NewBoostingOrder,
    db: SmexDatabase
  ): Promise<BoostingOrder> {
    const [order] = await db
      .insert(boostingOrders)
      .values(data)
      .returning();

    return order;
  }

  /**
   * Retrieves boosting orders with optional status/channel filters and pagination
   */
  static async getOrders(
    filters: OrderFilterOptions,
    db: SmexDatabase
  ): Promise<BoostingOrder[]> {
    const conditions = [];

    if (filters.status) {
      conditions.push(eq(boostingOrders.status, filters.status as BoostingOrder['status']));
    }
    if (filters.channel) {
      conditions.push(eq(boostingOrders.contactChannel, filters.channel as BoostingOrder['contactChannel']));
    }

    const limit = Math.max(1, Math.min(filters.limit ?? 20, 100));
    const offset = Math.max(0, filters.offset ?? 0);

    const baseQuery = db.select().from(boostingOrders);
    const query = conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery;

    return query
      .orderBy(desc(boostingOrders.createdAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Updates boosting order lifecycle status and administrative notes
   * Enforces LLD Section 4.2 State Machine Transition Invariants (BUG-M6-006)
   */
  static async updateOrderStatus(
    id: string,
    status: string,
    notes: string | undefined,
    db: SmexDatabase
  ): Promise<BoostingOrder> {
    const [existing] = await db
      .select()
      .from(boostingOrders)
      .where(eq(boostingOrders.id, id));

    if (!existing) {
      throw new ValidationError('ORDER_NOT_FOUND', 404, 'Order not found');
    }

    const currentStatus = existing.status;
    const allowed = ALLOWED_ORDER_TRANSITIONS[currentStatus] || [];

    if (!allowed.includes(status)) {
      throw new ValidationError(
        'INVALID_STATUS_TRANSITION',
        400,
        `Cannot transition order status from '${currentStatus}' to '${status}'. Allowed transitions: [${allowed.join(', ')}]`
      );
    }

    const updatePayload: Partial<NewBoostingOrder> = {
      status: status as BoostingOrder['status'],
    };
    if (notes !== undefined) {
      updatePayload.notes = notes;
    }

    const [updated] = await db
      .update(boostingOrders)
      .set(updatePayload)
      .where(eq(boostingOrders.id, id))
      .returning();

    return updated;
  }
}

