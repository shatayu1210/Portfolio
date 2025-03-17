'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if 'customer_id' foreign key exists before adding
    await queryInterface.addConstraint('Favourites', {
      fields: ['customer_id'],
      type: 'foreign key',
      name: 'favourites_customer_fk',
      references: {
        table: 'customers',
        field: 'id'
      },
      onDelete: 'CASCADE'
    });

    // Check if 'restaurant_id' foreign key exists before adding
    await queryInterface.addConstraint('Favourites', {
      fields: ['restaurant_id'],
      type: 'foreign key',
      name: 'favourites_restaurant_fk',
      references: {
        table: 'restaurants',
        field: 'id'
      },
      onDelete: 'CASCADE'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove the foreign key constraints
    await queryInterface.removeConstraint('Favourites', 'favourites_customer_fk');
    await queryInterface.removeConstraint('Favourites', 'favourites_restaurant_fk');
  }
};
