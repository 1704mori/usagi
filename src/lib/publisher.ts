import { Connection } from "./connection";

export type PublishOptions = {
  persistent?: boolean;
}

export class Publisher {
  constructor(private connectionManager: Connection, private queue: string, private options?: PublishOptions) { }

  public async send(payload: any): Promise<{ sent: boolean }> {
    const channel = this.connectionManager.getChannel();
    const msg = Buffer.from(JSON.stringify(payload));

    const result = channel.publish(this.connectionManager.getExchange(), this.queue, msg, {
      persistent: this.options?.persistent ?? true,
      messageId: this.unikId(),
    });

    if (result) {
      console.log("[queue] message sent to %s, buffer size: %d", this.queue, msg.length);
      return { sent: true };
    }

    console.log("[queue] could'nt send message to %s, buffer size: %d", this.queue, msg.length);
    return { sent: false };
  }

  private unikId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}
