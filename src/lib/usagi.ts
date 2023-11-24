import { ConnectionConfig, Connection } from "./connection";
import { Listener } from "./listener";
import { PublishOptions, Publisher } from "./publisher";

export class Usagi {
  private connectionManager: Connection;

  constructor(private config: ConnectionConfig) {
    this.connectionManager = new Connection(this.config);
  }

  public async initialize(name: string): Promise<void> {
    await this.connectionManager.initialize(name);
  }

  public async publish(queue: string, payload: any, options?: PublishOptions): Promise<{ sent: boolean }> {
    const publisher = new Publisher(this.connectionManager, queue, options);
    return await publisher.send(payload);
  }

  public queue(queueName: string): Listener {
    return new Listener(this.connectionManager, queueName);
  }

  public async close(): Promise<void> {
    await this.connectionManager.close();
  }
}

