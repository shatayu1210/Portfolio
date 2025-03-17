'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Restaurant extends Model {
    static associate(models) {
      Restaurant.hasMany(models.Dish, { foreignKey: 'restaurant_id' });
      Restaurant.hasMany(models.Order, { foreignKey: 'restaurant_id' });
      Restaurant.belongsToMany(models.Customer, {
        through: models.Favourite,
        foreignKey: 'restaurant_id'
      });
      // One RestaurantOwner can have many Restaurants, so the foreignKey will be owner_id
      Restaurant.belongsTo(models.RestaurantOwner, { foreignKey: 'owner_id' });
    }
  }
  
  Restaurant.init({
    id: { 
      type: DataTypes.INTEGER, 
      primaryKey: true, 
      autoIncrement: true 
    },
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: false },
    email: { 
      type: DataTypes.STRING,
      allowNull: false
    },
    phone: { type: DataTypes.BIGINT, allowNull: false },
    address: { type: DataTypes.TEXT, allowNull: false },
    offers_pickup: { type: DataTypes.BOOLEAN, allowNull: false },
    offers_delivery: { type: DataTypes.BOOLEAN, allowNull: false },
    ratings: { type: DataTypes.DECIMAL(10, 1), allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    image_url: { 
      type: DataTypes.STRING, 
      allowNull: true 
    },
    // Adding owner_id as a foreign key
    owner_id: { 
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'restaurant_owners', 
        key: 'id' // 'id' is the primary key in the referenced table
      },
      onDelete: 'CASCADE' // If the owner is deleted, the related restaurants will be deleted as well
    }
  }, { 
    sequelize, 
    modelName: 'Restaurant',
    timestamps: false,
    tableName: 'restaurants',
    underscored: true
  });

  return Restaurant;
};
