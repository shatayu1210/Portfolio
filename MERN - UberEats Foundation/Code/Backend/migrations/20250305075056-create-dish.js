'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('dishes', {
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
      price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      restaurant_id: {
        type: Sequelize.INTEGER,
        allowNull: false, 
        references: {
          model: 'restaurants', 
          key: 'id', // Reference the 'id' column of the 'restaurants' table
        },
        onDelete: 'CASCADE',
      },
      size: {
        type: Sequelize.STRING,
        allowNull: true
      },
      image_url: {
        type: Sequelize.STRING,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      }
    });

    // Check if the constraint already exists before adding
    const [results] = await queryInterface.sequelize.query(`
      SELECT CONSTRAINT_NAME 
      FROM information_schema.table_constraints 
      WHERE table_name = 'dishes' 
      AND constraint_type = 'UNIQUE' 
      AND CONSTRAINT_NAME = 'unique_dish_per_size_per_restaurant';
    `);

    if (results.length === 0) {
      await queryInterface.addConstraint('dishes', {
        fields: ['name', 'size', 'restaurant_id'],
        type: 'unique',
        name: 'unique_dish_per_size_per_restaurant'
      });
    }
  },
  
  async down(queryInterface, Sequelize) {
    await queryInterface.removeConstraint('dishes', 'unique_dish_per_size_per_restaurant');
    await queryInterface.dropTable('dishes');
  }
};