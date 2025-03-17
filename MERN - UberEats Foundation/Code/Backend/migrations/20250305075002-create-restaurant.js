'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('restaurants', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false
      },
      phone: {
        type: Sequelize.BIGINT,
        allowNull: false
      },
      address: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      offers_pickup: {
        type: Sequelize.BOOLEAN,
        allowNull: false
      },
      offers_delivery: {
        type: Sequelize.BOOLEAN,
        allowNull: false
      },
      ratings: {
        type: Sequelize.DECIMAL(10, 1),
        allowNull: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      image_url: {
        allowNull: true,
        type: Sequelize.STRING
      },
      owner_id: {
        type: Sequelize.INTEGER,
        allowNull: false, // Enforcing that this cannot be null
        references: {
          model: 'restaurant_owners', 
          key: 'id' // Reference to the id of RestaurantOwner
        },
        onDelete: 'CASCADE' // If a RestaurantOwner is deleted, delete associated restaurants as well
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('restaurants');
  }
};