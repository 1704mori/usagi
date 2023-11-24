# Usagi

!This project is still in development and is not ready for production use (kinda)!

## Overview

Usagi provides a simple and flexible interface for interacting with RabbitMQ, including message publishing, listening, and retry mechanisms.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)
- [Examples](#examples)
- [Testing](#testing)
- [License](#license)

## Installation

To install the Usagi, use the following command:

```bash
npm install --save usagiq

# or
yarn add usagiq

# or
pnpm add usagiq
```

## Usage

```typescript
import { Usagi } from 'usagiq';

// RabbitMQ configuration
const rabbitConfig = {
  uri: 'amqp://user:pass@host:port/vhost',
  exchange: 'your_exchange_name',
  exchangeType: 'topic',
};

// Create an instance of Usagi
const amqp = new Usagi(rabbitConfig);

// Initialize the service
await amqp.initialize('your_connection_name');

// Use the service methods (publish, queue, listen, etc.)

// Close the connection when done
await amqp.close();
```

## Configuration

- **uri**: The RabbitMQ server URI.
- **exchange**: The name of the RabbitMQ exchange.
- **exchangeType**: The type of the exchange (e.g., 'topic').

## Examples

```typescript
// Example: Publish a message to a queue
const message = { data: 'Hello, RabbitMQ!' };
await amqp.publish('your_queue_name', message);

// Example: Set up a listener with retry mechanism
await amqp
  .queue('your_queue_name')
  .retry(3)
  .retryTimeout(5000)
  .listen(async (payload) => {
    // Your message processing logic goes here
    console.log('Received message:', payload);

    // Simulate an error condition
    if (Math.random() < 0.5) {
      console.log('Processing failed. Throwing an error.');
      throw new Error('Simulated error');
    }

    // Simulate successful processing
    console.log('Processing succeeded.');
    return true;
  });
```

## Testing

To run the tests, use the following command:

```bash
npm test
```

## License

This project is licensed under the [GNU GPLv3 License](LICENSE).