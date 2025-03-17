'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Describe the Customers table to check if 'id' already exists
    const tableDescription = await queryInterface.describeTable('Customers');
    
    // Add the 'id' column only if it doesn't already exist
    if (!tableDescription.id) {
      await queryInterface.addColumn('Customers', 'id', {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      });
    }

    if (!tableDescription.image_url) {
      await queryInterface.addColumn('Customers', 'image_url', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    await queryInterface.changeColumn('Customers', 'email', {
      type: Sequelize.STRING,
      unique: true,
    });
  },

  async down (queryInterface, Sequelize) {
    // Remove the 'id' column and revert the 'email' column changes
    await queryInterface.removeColumn('Customers', 'image_url');
    await queryInterface.removeColumn('Customers', 'id');
    await queryInterface.changeColumn('Customers', 'email', {
      type: Sequelize.STRING,
    });
  }
};