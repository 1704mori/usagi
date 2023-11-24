import * as amqp from "amqplib";
import { Connection } from "./connection";

export class Listener {
  private retryCount: number = 0;
  private _retryTimeout: number = 60000;

  constructor(private connectionManager: Connection, private queueName: string) { }

  public retry(count: number): this {
    this.retryCount = count;
    return this;
  }

  public retryTimeout(timeout: number): this {
    this._retryTimeout = timeout;
    return this;
  }

  public async listen<T = any>(callback: (message: T) => boolean | Promise<boolean>): Promise<void> {
    const channel = this.connectionManager.getChannel();

    const nackQueueName = `${this.queueName}.nack`;
    await this.setupNackQueue(channel, nackQueueName);

    await this.setupMainQueue(channel);

    console.log("[queue] queue %s binded", this.queueName);

    const consumeFn = async (msg: amqp.ConsumeMessage | null) => {
      if (!msg) return;

      try {
        const payload = JSON.parse(msg.content.toString());
        const result = await callback(payload);

        if (!result) {
          await this.handleNack(channel, msg, nackQueueName);
          return;
        }
        channel.ack(msg);
      } catch (error) {
        await this.handleNack(channel, msg, nackQueueName);
      }
    };

    await channel.consume(this.queueName, consumeFn, { noAck: false });
  }

  private async setupNackQueue(channel: amqp.Channel, nackQueueName: string): Promise<void> {
    await channel.assertQueue(nackQueueName, {
      durable: true,
      arguments: {
        "x-dead-letter-exchange": this.connectionManager["config"].exchange,
        "x-dead-letter-routing-key": `${this.queueName}.retry`,
        "x-message-ttl": this._retryTimeout,
      },
    });
    await channel.bindQueue(nackQueueName, this.connectionManager["config"].exchange, nackQueueName);
  }

  private async setupMainQueue(channel: amqp.Channel): Promise<void> {
    await channel.assertQueue(this.queueName, {
      deadLetterExchange: this.connectionManager["config"].exchange,
      deadLetterRoutingKey: `${this.queueName}.nack`,
      durable: true,
    });
    await channel.bindQueue(this.queueName, this.connectionManager["config"].exchange, this.queueName);
  }

  private async handleNack(channel: amqp.Channel, msg: amqp.ConsumeMessage, nackQueueName: string): Promise<void> {
    const retryCount = msg.properties.headers?.["x-retry-count"] || 0;

    if (retryCount < this.retryCount) {
      channel.publish(this.connectionManager["config"].exchange, this.queueName, msg.content, {
        headers: { "x-retry-count": retryCount + 1 },
        persistent: true,
      });
      console.log("[queue] a message message was requeued", msg.properties.messageId)
    } else {
      channel.sendToQueue(nackQueueName, msg.content, { persistent: true });
      console.log("[queue] a message was moved to nack queue %s", nackQueueName)
    }

    channel.ack(msg);
    console.log("[queue] a message reached max retry count, queue %s acked", this.queueName)
  }
}

