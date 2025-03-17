'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if the 'Restaurants' table has the 'id' column
    const tableDescription = await queryInterface.describeTable('Restaurants');

    // Add the `id` column (Primary Key) to the `Restaurant` table if it doesn't exist
    if (!tableDescription.id) {
      await queryInterface.addColumn('Restaurants', 'id', {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      });
    }

    // Adding image_url field if not present
    if (!tableDescription.image_url) {
      await queryInterface.addColumn('Restaurants', 'image_url', {
        type: Sequelize.STRING, // String type for storing image URLs
        allowNull: true, // Allow null values initially
      });
    }

    // Making the 'email' column unique if it's not already
    if (tableDescription.email && !tableDescription.email.unique) {
      await queryInterface.changeColumn('Restaurants', 'email', {
        type: Sequelize.STRING,
        unique: true,
        allowNull: false
      });
    }

    // Adding foreign key constraint from 'Restaurants' to 'RestaurantOwners' if it doesn't exist
    const restaurantOwnerFkExists = await queryInterface.sequelize.query(
      'SELECT * FROM information_schema.table_constraints WHERE table_name = "Restaurants" AND constraint_name = "restaurant_owner_fk";'
    );
    if (restaurantOwnerFkExists[0].length === 0) {
      await queryInterface.addConstraint('Restaurants', {
        fields: ['owner_id'],
        type: 'foreign key',
        name: 'restaurant_owner_fk',
        references: {
          table: 'restaurant_owners',
          field: 'id', // Correctly referencing the 'id' field of RestaurantOwners
        },
        onDelete: 'CASCADE', // Ensures that when a RestaurantOwner is deleted, related Restaurants are also deleted
      });
    }

    // Adding relationship between `Restaurants` and `Customers` through `Favourites` (many-to-many)
    const favouriteTableDescription = await queryInterface.describeTable('Favourites');
    const favouriteFkExists = await queryInterface.sequelize.query(
      'SELECT * FROM information_schema.table_constraints WHERE table_name = "Favourites" AND constraint_name = "favourite_restaurant_fk";'
    );
    if (favouriteFkExists[0].length === 0) {
      await queryInterface.addConstraint('Favourites', {
        fields: ['restaurant_id'],
        type: 'foreign key',
        name: 'favourite_restaurant_fk',
        references: {
          table: 'restaurants',
          field: 'id',
        },
        onDelete: 'CASCADE',
      });
    }

    // Add foreign key constraints for `Dishes` and `Orders` to reference `Restaurants` if they don't exist
    const dishTableDescription = await queryInterface.describeTable('Dishes');
    const dishFkExists = await queryInterface.sequelize.query(
      'SELECT * FROM information_schema.table_constraints WHERE table_name = "Dishes" AND constraint_name = "dish_restaurant_fk";'
    );
    if (dishFkExists[0].length === 0) {
      await queryInterface.addConstraint('Dishes', {
        fields: ['restaurant_id'],
        type: 'foreign key',
        name: 'dish_restaurant_fk',
        references: {
          table: 'restaurants',
          field: 'id',
        },
        onDelete: 'CASCADE',
      });
    }

    const orderTableDescription = await queryInterface.describeTable('Orders');
    const orderFkExists = await queryInterface.sequelize.query(
      'SELECT * FROM information_schema.table_constraints WHERE table_name = "Orders" AND constraint_name = "order_restaurant_fk";'
    );
    if (orderFkExists[0].length === 0) {
      await queryInterface.addConstraint('Orders', {
        fields: ['restaurant_id'],
        type: 'foreign key',
        name: 'order_restaurant_fk',
        references: {
          table: 'restaurants',
          field: 'id',
        },
        onDelete: 'CASCADE',
      });
    }
  },

  async down(queryInterface, Sequelize) {
    // Check if the 'Restaurants' table has foreign key constraints
    const tableDescription = await queryInterface.describeTable('Restaurants');

    // Check and remove image_url field
    if (tableDescription.image_url) {
      await queryInterface.removeColumn('Restaurants', 'image_url');
    }

    // Remove the foreign key constraints if they exist
    const restaurantOwnerFkExists = await queryInterface.sequelize.query(
      'SELECT * FROM information_schema.table_constraints WHERE table_name = "Restaurants" AND constraint_name = "restaurant_owner_fk";'
    );
    if (restaurantOwnerFkExists[0].length > 0) {
      await queryInterface.removeConstraint('Restaurants', 'restaurant_owner_fk');
    }

    // Check if the 'Favourites' table has the foreign key constraint
    const favouriteTableDescription = await queryInterface.describeTable('Favourites');
    const favouriteFkExists = await queryInterface.sequelize.query(
      'SELECT * FROM information_schema.table_constraints WHERE table_name = "Favourites" AND constraint_name = "favourite_restaurant_fk";'
    );
    if (favouriteFkExists[0].length > 0) {
      await queryInterface.removeConstraint('Favourites', 'favourite_restaurant_fk');
    }

    // Check if the 'Dishes' table has the foreign key constraint
    const dishTableDescription = await queryInterface.describeTable('Dishes');
    const dishFkExists = await queryInterface.sequelize.query(
      'SELECT * FROM information_schema.table_constraints WHERE table_name = "Dishes" AND constraint_name = "dish_restaurant_fk";'
    );
    if (dishFkExists[0].length > 0) {
      await queryInterface.removeConstraint('Dishes', 'dish_restaurant_fk');
    }

    // Check if the 'Orders' table has the foreign key constraint
    const orderTableDescription = await queryInterface.describeTable('Orders');
    const orderFkExists = await queryInterface.sequelize.query(
      'SELECT * FROM information_schema.table_constraints WHERE table_name = "Orders" AND constraint_name = "order_restaurant_fk";'
    );
    if (orderFkExists[0].length > 0) {
      await queryInterface.removeConstraint('Orders', 'order_restaurant_fk');
    }

    // Remove the `id` column from `Restaurants` if necessary
    if (tableDescription.id) {
      await queryInterface.removeColumn('Restaurants', 'id');
    }

    // Remove the `unique` constraint from the `email` column if needed
    if (tableDescription.email && tableDescription.email.unique) {
      await queryInterface.changeColumn('Restaurants', 'email', {
        type: Sequelize.STRING,
      });
    }
  }
};
