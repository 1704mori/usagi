import { Usagi } from "../src";

(async () => {
  const amqp = new Usagi({
    uri: "amqp://user:pass@host:port",
    exchange: "example",
    exchangeType: "topic",
  })

  await amqp.initialize("connection_name");

  await amqp
    .queue("yo")
    .retry(3)
    .retryTimeout(5000)
    .listen(async (msg) => {
      console.log("Received message:", msg);

      if (Math.random() < 0.67) {
        console.log("Processing failed. Throwing an error.");
        throw new Error("Simulated error");
      }

      console.log("Processing succeeded.");
      return true;
    });

  await new Promise((resolve) => setTimeout(resolve, 1000));
  await amqp.publish("yo", { hello: "世界" });
})()
