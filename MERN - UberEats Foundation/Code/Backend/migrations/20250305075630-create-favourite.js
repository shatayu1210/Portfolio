'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Favourites', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      customer_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'customers',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      restaurant_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'restaurants',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // Check if the unique constraint already exists before adding it
    const [results] = await queryInterface.sequelize.query(`
      SELECT CONSTRAINT_NAME 
      FROM information_schema.table_constraints 
      WHERE table_name = 'Favourites' 
      AND constraint_type = 'UNIQUE' 
      AND CONSTRAINT_NAME = 'unique_customer_restaurant_favorite';
    `);

    if (results.length === 0) {
      await queryInterface.addConstraint('Favourites', {
        fields: ['customer_id', 'restaurant_id'],
        type: 'unique',
        name: 'unique_customer_restaurant_favorite'
      });
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeConstraint('Favourites', 'unique_customer_restaurant_favorite');
    await queryInterface.dropTable('Favourites');
  }
};