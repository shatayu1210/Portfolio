'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('restaurant_owner_relationships', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      owner_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'restaurant_owners', 
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      restaurant_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'restaurants', 
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    // Ensure that each restaurant can only have one owner per relationship
    await queryInterface.addConstraint('restaurant_owner_relationships', {
      fields: ['restaurant_id', 'owner_id'], // Composite key on restaurant_id and owner_id
      type: 'unique',
      name: 'unique_restaurant_owner_relation', // Give a meaningful name to the constraint
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('restaurant_owner_relationships');
  },
};