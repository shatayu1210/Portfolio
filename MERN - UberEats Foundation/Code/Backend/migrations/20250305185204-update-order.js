'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const tableDescription = await queryInterface.describeTable('Orders');

    // Modified 'status' column if necessary
    if (tableDescription.status) {
      await queryInterface.changeColumn('Orders', 'status', {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'Pending', // Default value as in the create migration
      });
    }

    // Adding 'order_type' column if it doesn't exist
    if (!tableDescription.order_type) {
      await queryInterface.addColumn('Orders', 'order_type', {
        type: Sequelize.STRING,
        defaultValue: 'Delivery', // Default value as in the create migration
      });
    }

    // Ensuring 'restaurant_id' and 'customer_id' are there as foreign keys
    if (!tableDescription.restaurant_id) {
      await queryInterface.addColumn('Orders', 'restaurant_id', {
        type: Sequelize.INTEGER,
        references: {
          model: 'restaurants',
          key: 'id',
        },
        onDelete: 'CASCADE',
      });
    }

    if (!tableDescription.customer_id) {
      await queryInterface.addColumn('Orders', 'customer_id', {
        type: Sequelize.INTEGER,
        references: {
          model: 'customers',
          key: 'id',
        },
        onDelete: 'CASCADE',
      });
    }

    
    if (tableDescription.order_number) {
      await queryInterface.changeColumn('Orders', 'order_number', {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true, 
      });
    }
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('Orders', 'status');
    await queryInterface.removeColumn('Orders', 'restaurant_id');
    await queryInterface.removeColumn('Orders', 'customer_id');
    await queryInterface.removeColumn('Orders', 'order_type');
    await queryInterface.removeColumn('Orders', 'order_number');
  }
};
