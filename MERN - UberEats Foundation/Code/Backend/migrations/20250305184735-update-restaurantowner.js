'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const tableDescription = await queryInterface.describeTable('restaurant_owners');

    // Add the 'image_url' column only if it doesn't already exist
    if (!tableDescription.image_url) {
      await queryInterface.addColumn('restaurant_owners', 'image_url', {
        type: Sequelize.STRING,  
        allowNull: true,
      });
    }

    // Add or change other columns/constraints as needed
    await queryInterface.changeColumn('restaurant_owners', 'email', {
      type: Sequelize.STRING,
      unique: true,
    });
  },

  async down (queryInterface, Sequelize) {
    // Revert changes if needed
    await queryInterface.removeColumn('restaurant_owners', 'image_url');
    await queryInterface.changeColumn('restaurant_owners', 'email', {
      type: Sequelize.STRING,
    });
  }
};
