// Kafka consumer for restaurant service: saves kafka order event to MongoDB and brings it to 'received' order status.
// Also emits to websocket for realtime updates to restaurant component.

const { orderConsumer, connectOrderConsumer } = require('./kafkaClient');
const mongoose = require('mongoose');
const Order = require('../models/order');

// Exporting function to start the restaurant order consumer from main backend server
async function startRestaurantOrderConsumer(io) {
  await connectOrderConsumer();
  await orderConsumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const orderEvent = JSON.parse(message.value.toString());
        orderEvent.status = 'received';
        
        const newOrder = new Order(orderEvent);
        await newOrder.save();

        // Emit the new order to the restaurant component via WebSocket
        io.emit('new_order', newOrder);

      } catch (err) {
        console.error('Error processing Kafka order message:', err);
      }
    },
  });
}

module.exports = { startRestaurantOrderConsumer };
