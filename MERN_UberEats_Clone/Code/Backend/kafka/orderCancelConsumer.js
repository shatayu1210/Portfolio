// Kafka consumer for order cancellations: emits to websocket for restaurant dashboard toast
const { Kafka } = require('kafkajs');
const { connectProducer } = require('./kafkaClient');
const mongoose = require('mongoose');
const Order = require('../models/order');

const kafka = new Kafka({
  clientId: 'order-system',
  brokers: [process.env.KAFKA_BROKER || 'kafka:9092'],
});

const orderCancelConsumer = kafka.consumer({ groupId: 'restaurant-cancel-group' });

async function connectOrderCancelConsumer() {
  await orderCancelConsumer.connect();
  await orderCancelConsumer.subscribe({ topic: 'order-cancels', fromBeginning: false });
}

async function startOrderCancelConsumer(io) {
  await connectOrderCancelConsumer();
  await orderCancelConsumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const cancelEvent = JSON.parse(message.value.toString());
        // Emit the cancellation event to all restaurants (or filter by restaurantId if needed)
        io.emit('order_cancelled', cancelEvent);
      } catch (err) {
        console.error('Error processing Kafka order cancel message:', err);
      }
    }
  });
}

module.exports = { startOrderCancelConsumer };
