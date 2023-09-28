import * as amqp from "amqplib";

interface RabbitConfig {
  AMQP_DNS: string;
  exchange: string;
  exchangeType: string;
}

export class AmqpService {
  private connection: amqp.Connection | null = null;
  private channel: amqp.Channel | null = null;
  private name: string | null = null;
  private prefetchCount: number = 1; // Default prefetch count
  private retryCount: number = 0; // Default retry count
  private _retryTimeout: number = 0; // Default retry timeout in milliseconds

  constructor(private config: RabbitConfig) {}

  /**
   * Initializes the AmqpService and establishes a connection to RabbitMQ.
   * @param name - The name to assign to the RabbitMQ connection.
   */
  public async initialize(name: string): Promise<this> {
    if (this.connection) {
      console.log("[queue] connection %s already exists", name);
      return this;
    }

    this.connection = await amqp.connect(this.config.AMQP_DNS, {
      clientProperties: {
        connection_name: name,
      },
    });

    this.connection.on("error", () => {
      console.log("[queue] connection %s error", name);
    });

    this.connection.on("close", () => {
      console.log("[queue] connection %s closed", name);
    });

    this.name = name;

    console.log("[queue] new connection %s created", name);
    this.channel = await this.connection.createChannel();

    await this.channel.prefetch(this.prefetchCount);

    await this.channel.assertExchange(
      this.config.exchange,
      this.config.exchangeType,
      {
        durable: true,
      }
    );

    console.log("[queue] channel %s created", this.config.exchange);

    return this;
  }

  /**
   * Sets the prefetch count for message consumption.
   * @param count - The number of messages to prefetch.
   * @returns The AmqpService instance for method chaining.
   */
  public prefetch(count: number): this {
    this.prefetchCount = count;
    return this;
  }

  /**
   * Sets the number of retry attempts for message processing.
   * @param count - The number of retry attempts.
   * @returns The AmqpService instance for method chaining.
   */
  public retry(count: number): this {
    this.retryCount = count;
    return this;
  }

  /**
   * Sets the timeout between retry attempts (in milliseconds).
   * @param timeout - The time between retry attempts in milliseconds.
   * @returns The AmqpService instance for method chaining.
   */
  public retryTimeout(timeout: number): this {
    this._retryTimeout = timeout;
    return this;
  }

  /**
   * Sends a message to a RabbitMQ queue.
   * @param queue - The name of the queue to send the message to.
   * @param payload - The message payload to send.
   * @returns An object with a 'sent' property indicating whether the message was sent successfully.
   */
  public async send(queue: string, payload: any): Promise<{ sent: boolean }> {
    if (!this.channel) {
      throw new Error("RabbitService has not been initialized.");
    }

    const msg = Buffer.from(JSON.stringify(payload));

    const checkQueue = await this.channel.checkQueue(queue);

    if (!checkQueue) {
      console.log("[queue] queue %s not exists, creating...", queue);

      await this.channel.assertQueue(queue, {
        deadLetterExchange: this.config.exchange,
        deadLetterRoutingKey: queue + ".nack",
        durable: true,
      });

      console.log("[queue] queue %s created", queue);
    }

    const result = this.channel.publish(this.config.exchange, queue, msg, {
      persistent: true,
    });

    if (result) {
      console.log(
        "[queue] message sent to %s, buffer size: %d",
        queue,
        msg.length
      );

      return {
        sent: true,
      };
    }

    console.log(
      "[queue] message not sent to %s, buffer size: %d",
      queue,
      msg.length
    );

    return {
      sent: false,
    };
  }

  /**
   * Listens to messages from a RabbitMQ queue and invokes a callback for each received message.
   * @param queue - The name of the queue to listen to.
   * @param callback - A callback function to process each received message.
   */
  public async listen<T = any>(
    queue: string,
    callback: (message: T) => boolean | Promise<boolean>
  ): Promise<void> {
    if (!this.channel) {
      throw new Error("AmqpService has not been initialized.");
    }

    await this.channel.assertQueue(queue, {
      deadLetterExchange: this.config.exchange,
      deadLetterRoutingKey: queue + ".nack",
      durable: true,
    });

    await this.channel.bindQueue(queue, this.config.exchange, queue);

    console.log("[queue] queue %s binded", queue);

    this.channel.consume(queue, async (message) => {
      if (!message) return;

      const content = message.content.toString();
      const data = JSON.parse(content);

      let retryCount = 0;
      let retry = true;

      while (retry && retryCount < this.retryCount) {
        retry = !(await callback(data));
        retryCount++;

        if (retry) {
          console.log(
            "[queue] Message processing failed. Retrying in %d milliseconds...",
            this.retryTimeout
          );
          await new Promise((resolve) =>
            setTimeout(resolve, this._retryTimeout)
          );
        }
      }

      if (retry) {
        console.log(
          "[queue] Message processing failed after retries. Acknowledging and moving to dead-letter queue."
        );
        this.channel?.ack(message);
      } else {
        console.log("[queue] Message processed successfully. Acknowledging.");
        this.channel?.nack(message, false, false);
      }
    });
  }

  /**
   * Closes the RabbitMQ connection and channel.
   */
  public async close(): Promise<void> {
    console.log("[queue] closing connection %s", this.name);

    if (this.connection) {
      await this.connection.close();
      await this.channel?.close();

      this.connection = null;
      this.channel = null;
      console.log("[queue] connection %s closed", this.name);
    }
  }
}
