'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Describe the Dishes table to check existing columns
    const tableDescription = await queryInterface.describeTable('Dishes');

    // Adding the 'image_url' column if it doesn't exist
    if (!tableDescription.image_url) {
      await queryInterface.addColumn('Dishes', 'image_url', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    // Adding 'restaurant_id' column if it doesn't exist
    if (!tableDescription.restaurant_id) {
      await queryInterface.addColumn('Dishes', 'restaurant_id', {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'restaurants',
          key: 'id', // Reference to 'id' column in Restaurants table
        },
        onDelete: 'CASCADE',
      });
    }

    // Ensure the unique constraint (name, size, restaurant_id) exists
    const [results] = await queryInterface.sequelize.query(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'Dishes' AND constraint_type = 'UNIQUE' AND constraint_name = 'unique_dish_per_size_per_restaurant'
    `);

    if (results.length === 0) {
      await queryInterface.addConstraint('Dishes', {
        fields: ['name', 'size', 'restaurant_id'],
        type: 'unique',
        name: 'unique_dish_per_size_per_restaurant', // Custom constraint name
      });
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeConstraint('Dishes', 'unique_dish_per_size_per_restaurant');
    await queryInterface.removeColumn('Dishes', 'restaurant_id');
    await queryInterface.removeColumn('Dishes', 'image_url');
  }
};