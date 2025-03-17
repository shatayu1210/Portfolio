'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Favourite extends Model {
    static associate(models) {
      Favourite.belongsTo(models.Customer, { foreignKey: 'customer_id', onDelete: 'CASCADE' });
      Favourite.belongsTo(models.Restaurant, { foreignKey: 'restaurant_id', onDelete: 'CASCADE' });
    }
  }

  Favourite.init({
    id: { 
      type: DataTypes.INTEGER, 
      primaryKey: true, 
      autoIncrement: true 
    },
    customer_id: { 
      type: DataTypes.INTEGER, 
      allowNull: false, 
      references: { model: 'customers', key: 'id' }
    },
    restaurant_id: { 
      type: DataTypes.INTEGER, 
      allowNull: false, 
      references: { model: 'restaurants', key: 'id' }
    }
  }, { 
    sequelize, 
    modelName: 'Favourite',
    timestamps: true,
    underscored: true,
    tableName: 'favourites',
    indexes: [
      {
        unique: true,
        fields: ['customer_id', 'restaurant_id'] // Ensures uniqueness
      }
    ]
  });

  return Favourite;
};