'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Customer extends Model {
    static associate(models) {
      Customer.hasMany(models.Order, { foreignKey: 'customer_id' });
      Customer.belongsToMany(models.Restaurant, {
        through: models.Favourite,
        foreignKey: 'customer_id'
      });
    }
  }
  Customer.init({
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    first_name: DataTypes.STRING,
    last_name: DataTypes.STRING,
    email: { type: DataTypes.STRING, unique: true },
    password: DataTypes.STRING,
    phone: DataTypes.BIGINT,
    date_of_birth: DataTypes.DATE,
    address: DataTypes.TEXT,
    image_url: { type: DataTypes.STRING, allowNull: true}
  }, {
    sequelize, modelName: 'Customer', timestamps: true, underscored: true, tableName: 'customers' 
  });
  return Customer;
};