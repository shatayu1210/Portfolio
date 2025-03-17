'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Order extends Model {
    static associate(models) {
      Order.belongsTo(models.Customer, { foreignKey: 'customer_id' });
      Order.hasMany(models.OrderItem, { foreignKey: 'order_id' });
      Order.belongsTo(models.Restaurant, { foreignKey: 'restaurant_id' });
    }
  }

  Order.init({
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    customer_id: { type: DataTypes.INTEGER, allowNull: false},
    status: {
      type: DataTypes.STRING,
      defaultValue: 'Pending',
      allowNull: false
    },
    restaurant_id: { type: DataTypes.INTEGER, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    total: DataTypes.DECIMAL(10, 2),
    order_type: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Delivery',
    },
    order_number: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: true
    },
  }, {
    sequelize,
    modelName: 'Order',
    timestamps: false,
    underscored: true,
    tableName: 'orders', 
  });

  return Order;
};