'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class OrderItem extends Model {
    static associate(models) {
      OrderItem.belongsTo(models.Order, { 
        foreignKey: 'order_id',
        onDelete: 'CASCADE', 
        onUpdate: 'CASCADE'
      });
      OrderItem.belongsTo(models.Dish, { 
        foreignKey: 'dish_id',
        onDelete: 'CASCADE', 
        onUpdate: 'CASCADE'
      });
    }
  }
  
  OrderItem.init({
    id: { 
      type: DataTypes.INTEGER, 
      primaryKey: true, 
      autoIncrement: true 
    },
    order_id: {
      type: DataTypes.INTEGER,
      allowNull: false, 
    },
    dish_id: {
      type: DataTypes.INTEGER,
      allowNull: false, 
    },
    size: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false, 
    },
    price: {
      type: DataTypes.DECIMAL,
      allowNull: false, 
    }
  }, { 
    sequelize, 
    modelName: 'OrderItem',
    timestamps: true,
    underscored: true,
    tableName: 'order_items'
  });

  return OrderItem;
};