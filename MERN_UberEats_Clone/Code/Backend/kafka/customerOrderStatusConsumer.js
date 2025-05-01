// Kafka consumer for customer service: Consumes kafka order status change event and emits to websocket for real-time update on CustomerOrders.jsx

const { orderStatusConsumer, connectOrderStatusConsumer } = require('./kafkaClient');
const mongoose = require('mongoose');
const Order = require('../models/order');

// Exporting function to start the restaurant order consumer from main backend server
async function startCustomerOrderStatusConsumer(io) {
  await connectOrderStatusConsumer();
  await orderStatusConsumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const event = JSON.parse(message.value.toString());
        
        // Emit the order status update to the customer component via WebSocket
        io.emit('order_status_update', event);

      } catch (err) {
        console.error('Error processing Kafka update order status message:', err);
      }
    },
  });
}

module.exports = { startCustomerOrderStatusConsumer };
