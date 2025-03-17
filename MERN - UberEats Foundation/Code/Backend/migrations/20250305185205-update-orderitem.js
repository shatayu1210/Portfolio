'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDescription = await queryInterface.describeTable('order_items');

    // Added the `id` column if it doesn't exist
    if (!tableDescription.id) {
      await queryInterface.addColumn('order_items', 'id', {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      });
    }

    // Changed `order_id` type from STRING to INTEGER if found different
    if (tableDescription.order_id && tableDescription.order_id.type.toString() !== Sequelize.INTEGER.toString()) {
      await queryInterface.changeColumn('order_items', 'order_id', {
        type: Sequelize.INTEGER,
        allowNull: false,
      });
    }

    // Adding foreign key constraints
    try {
      await queryInterface.addConstraint('order_items', {
        fields: ['order_id'],
        type: 'foreign key',
        name: 'orderitem_order_fk',
        references: {
          table: 'orders',
          field: 'id',
        },
        onDelete: 'CASCADE',
      });
    } catch (error) {
      console.log('Foreign key for order_id already exists, skipping.');
    }

    try {
      await queryInterface.addConstraint('order_items', {
        fields: ['dish_id'],
        type: 'foreign key',
        name: 'orderitem_dish_fk',
        references: {
          table: 'dishes',
          field: 'id',
        },
        onDelete: 'CASCADE',
      });
    } catch (error) {
      console.log('Foreign key for dish_id already exists, skipping.');
    }
  },

  async down(queryInterface, Sequelize) {
    const tableDescription = await queryInterface.describeTable('order_items');

    // Removing the foreign key constraints if they exist
    try {
      await queryInterface.removeConstraint('order_items', 'orderitem_order_fk');
    } catch (error) {
      console.log('Foreign key for order_id not found, skipping removal.');
    }

    try {
      await queryInterface.removeConstraint('order_items', 'orderitem_dish_fk');
    } catch (error) {
      console.log('Foreign key for dish_id not found, skipping removal.');
    }

    // Change `order_id` back to STRING if necessary
    if (tableDescription.order_id && tableDescription.order_id.type.toString() === Sequelize.INTEGER.toString()) {
      await queryInterface.changeColumn('order_items', 'order_id', {
        type: Sequelize.STRING,
        allowNull: false,
      });
    }

    // Remove the `id` column if it exists
    if (tableDescription.id) {
      await queryInterface.removeColumn('order_items', 'id');
    }
  },
};
