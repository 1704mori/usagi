import { Usagi } from "../src/lib/usagi";

const mockCallback = jest.fn(async (payload: any) => {
  if (payload.data === 'error') {
    throw new Error('Simulated error');
  }
  return true;
});


describe("Usagi", () => {
  let usagi: Usagi;

  beforeAll(async () => {
    usagi = new Usagi({
      uri: "amqp://overlord:itadakimasu@localhost:5672",
      exchange: "test_exchange",
      exchangeType: "topic",
    });
    await usagi.initialize("test")
  });

  afterAll(async () => {
    await usagi.close();
  });

  it("should publish a message to a queue", async () => {
    const message = { data: "Test message" };
    const result = await usagi.publish("test_queue", message);

    expect(result.sent).toBe(true);
  });

  it("should listen to the queue and process messages", async () => {
    await usagi.publish('test_queue', { data: "test" });

    await usagi
      .queue("test_queue")
      .retryTimeout(5000)
      .listen(mockCallback);

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(mockCallback).toHaveBeenCalled();
  });

  it('should handle processing errors and retry', async () => {
    await usagi.publish('test_queue', { data: 'error' });

    await usagi
      .queue('test_queue')
      .retry(3)
      .retryTimeout(5000)
      .listen(mockCallback);

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(mockCallback).toHaveBeenCalledTimes(3);
  });
});
