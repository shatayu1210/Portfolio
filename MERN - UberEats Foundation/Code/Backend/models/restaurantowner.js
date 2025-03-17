'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class RestaurantOwner extends Model {
    static associate(models) {
      RestaurantOwner.hasMany(models.Restaurant, { foreignKey: 'owner_id' });

    }
  }
  RestaurantOwner.init({
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    first_name: DataTypes.STRING,
    last_name: DataTypes.STRING,
    email: { type: DataTypes.STRING, unique: true },
    password: DataTypes.STRING,
    date_of_birth: DataTypes.DATE,
    phone: DataTypes.BIGINT,
    address: DataTypes.STRING,
    image_url: { type: DataTypes.STRING, allowNull: true}
  }, { sequelize, modelName: 'RestaurantOwner', timestamps: true, underscored: true, tableName: 'restaurant_owners' });
  return RestaurantOwner;
};