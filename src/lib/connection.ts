import * as amqp from "amqplib";

export type ConnectionConfig = {
  uri: string;
  exchange: string;
  exchangeType: "topic";
};

export class Connection {
  private connection: amqp.Connection | null = null;
  private channel: amqp.Channel | null = null;
  private exchange: string | null = null;

  constructor(private config: ConnectionConfig) {}

  public async initialize(name: string): Promise<this> {
    if (this.connection) {
      console.log("[queue] connection %s already exists", name);
      return this;
    }

    this.connection = await amqp.connect(this.config.uri, {
      clientProperties: {
        connection_name: name,
      },
    });

    this.connection.on("error", (err) => {
      console.log("[queue] connection %s error", name, err);
    });

    this.connection.on("close", (err) => {
      console.log("[queue] connection %s closed", name, err);
    });

    console.log("[queue] new connection %s created", name);
    this.channel = await this.connection.createChannel();

    await this.channel.assertExchange(
      this.config.exchange,
      this.config.exchangeType,
      {
        durable: true,
      },
    );

    this.exchange = this.config.exchange;

    console.log("[queue] channel %s created", this.config.exchange);

    this.channel.on("error", (err) => {
      console.log("[queue] channel error", err);
    });

    return this;
  }

  public async close(): Promise<void> {
    console.log("[queue] closing connection");
    if (this.connection) {
      await this.channel?.close();
      await this.connection.close();

      this.connection = null;
      this.channel = null;
      console.log("[queue] connection closed");
    }
  }

  public getChannel(): amqp.Channel {
    if (!this.channel) {
      throw new Error("AmqpService has not been initialized.");
    }
    return this.channel;
  }

  public getExchange(): string {
    if (!this.exchange) {
      throw new Error("AmqpService has not been initialized.");
    }
    return this.exchange;
  }
}
