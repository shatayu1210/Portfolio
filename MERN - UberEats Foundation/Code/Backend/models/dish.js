'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Dish extends Model {
    static associate(models) {
      // Belongs to the Restaurant model (foreign key 'restaurant_id')
      Dish.belongsTo(models.Restaurant, { foreignKey: 'restaurant_id' });
      
      // A dish can have many order items (foreign key 'dish_id')
      Dish.hasMany(models.OrderItem, { foreignKey: 'dish_id' });
    }
  }
  Dish.init({
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: false },
    price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    restaurant_id: { type: DataTypes.INTEGER, allowNull: false },
    size: { type: DataTypes.STRING, allowNull: true },
    image_url: { type: DataTypes.STRING, allowNull: true},
    created_at: {type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW},
    updated_at: {type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW}
  }, { sequelize, modelName: 'Dish', timestamps: false, tableName: 'dishes'  });
  return Dish;
};