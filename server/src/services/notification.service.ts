import type { Redis } from 'ioredis';
import type { WsGatewayDecorator } from '../plugins/websocket.js';

export interface BaseNotificationEnvelope<T = unknown> {
  event: string;
  channel: string;
  timestamp: number;
  data: T;
}

export interface JoinRequestNotificationData {
  teamId: string;
  teamName: string;
  requestId: string;
  applicantId: string;
  playerIgn: string;
  playerRole: string;
}

export interface RequestStatusNotificationData {
  teamId: string;
  teamName: string;
  status: 'accepted' | 'rejected' | 'cancelled';
}

export class NotificationService {
  /**
   * Dispatches real-time event when a player submits a squad join request
   */
  static async notifyCaptainJoinRequest(
    captainId: string,
    data: JoinRequestNotificationData,
    redis?: Redis,
    wsGateway?: WsGatewayDecorator
  ): Promise<BaseNotificationEnvelope<JoinRequestNotificationData>> {
    const channel = `user:${captainId}`;
    const envelope: BaseNotificationEnvelope<JoinRequestNotificationData> = {
      event: 'team:join_request',
      channel,
      timestamp: Date.now(),
      data,
    };

    if (redis) {
      await redis.publish(channel, JSON.stringify(envelope));
    }

    if (wsGateway) {
      wsGateway.broadcastToChannel(channel, envelope);
    }

    return envelope;
  }

  /**
   * Dispatches real-time event when a captain accepts or rejects a join request
   */
  static async notifyApplicantStatus(
    applicantId: string,
    data: RequestStatusNotificationData,
    redis?: Redis,
    wsGateway?: WsGatewayDecorator
  ): Promise<BaseNotificationEnvelope<RequestStatusNotificationData>> {
    const channel = `user:${applicantId}`;
    const envelope: BaseNotificationEnvelope<RequestStatusNotificationData> = {
      event: 'team:request_status',
      channel,
      timestamp: Date.now(),
      data,
    };

    if (redis) {
      await redis.publish(channel, JSON.stringify(envelope));
    }

    if (wsGateway) {
      wsGateway.broadcastToChannel(channel, envelope);
    }

    return envelope;
  }
}
