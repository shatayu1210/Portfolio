// kafkaClient.js
// Shared Kafka setup for producer and consumer
const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'order-system',
  brokers: [process.env.KAFKA_BROKER || 'kafka:9092'],
});

// Producer instance
const producer = kafka.producer();

async function connectProducer() {
  await producer.connect();
}

async function publishOrder(order) {
  if (!producer) {
    console.error('Kafka producer not initialized.');
    return;
  }

  try {
    await producer.send({
      topic: 'customer-orders',
      messages: [
        { value: JSON.stringify(order) },
      ],
    });
  } catch (error) {
    console.error('Error publishing order creation event:', error);
  }
}

async function publishOrderStatus(order, oldStatus, newStatus) {
  if (!producer) {
    console.error('Kafka producer not initialized.');
    return;
  }

  // Building event message
  const message = {
    event: `Order: ${order.orderNumber} status changed from "${oldStatus}" to "${newStatus}"`,
    timestamp: new Date().toISOString()   
  };

  try {
    await producer.send({
        topic: 'order-updates',
        messages: [
            { value: JSON.stringify(message) }
        ]
    });
  } catch (error) {
    console.error('Failed to publish order status update to Kafka:', error);
  }
}

// Publish order cancellation event to Kafka
async function publishOrderCancel(order) {
  if (!producer) {
    console.error('Kafka producer not initialized.');
    return;
  }
  const message = {
    event: `Order: ${order.orderNumber} has been cancelled`,
    orderNumber: order.orderNumber,
    restaurantId: order.restaurantId,
    timestamp: new Date().toISOString()
  };
  try {
    await producer.send({
      topic: 'order-cancels',
      messages: [
        { value: JSON.stringify(message) }
      ]
    });
  } catch (error) {
    console.error('Failed to publish order cancel event to Kafka:', error);
  }
}

// Consumer instance for restaurant
const orderConsumer = kafka.consumer({ groupId: 'restaurant-group' });

// Consumer instance for customer
const orderStatusConsumer = kafka.consumer({ groupId: 'customer-group' });

// Consumer instance for order cancellation (restaurant)
const orderCancelConsumer = kafka.consumer({ groupId: 'restaurant-cancel-group' });

async function connectOrderConsumer() {
  await orderConsumer.connect();
  await orderConsumer.subscribe({ topic: 'customer-orders', fromBeginning: false });
}

async function connectOrderStatusConsumer() {
  await orderStatusConsumer.connect();
  await orderStatusConsumer.subscribe({ topic: 'order-updates', fromBeginning: false });
}

// Connect and subscribe order cancel consumer
async function connectOrderCancelConsumer() {
  await orderCancelConsumer.connect();
  await orderCancelConsumer.subscribe({ topic: 'order-cancels', fromBeginning: false });
}

module.exports = {
  producer,
  connectProducer, // Generic Producer Connection
  publishOrder, // New Order Publisher
  connectOrderConsumer, // New Order Consumer
  orderConsumer,
  publishOrderStatus, // Order Status Publisher
  connectOrderStatusConsumer, // Order Status Consumer
  
  orderStatusConsumer,
  publishOrderCancel, // Order Cancel Publisher
  connectOrderCancelConsumer, // Order Cancel Consumer Connector
  orderCancelConsumer, // Order Cancel Consumer
  
};
