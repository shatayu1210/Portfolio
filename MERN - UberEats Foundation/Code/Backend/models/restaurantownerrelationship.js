'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class RestaurantOwnerRelationship extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // Defining associations
      // RestaurantOwnerRelationship belongs to RestaurantOwner
      RestaurantOwnerRelationship.belongsTo(models.RestaurantOwner, {
        foreignKey: 'owner_id',
        as: 'owner',
        onDelete: 'CASCADE',
      });
      
      // RestaurantOwnerRelationship belongs to Restaurant
      RestaurantOwnerRelationship.belongsTo(models.Restaurant, {
        foreignKey: 'restaurant_id',
        as: 'restaurant',
        onDelete: 'CASCADE',
      });
    }
  }

  RestaurantOwnerRelationship.init({
    id: { 
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    owner_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'RestaurantOwner',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    restaurant_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Restaurant', 
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  }, {
    sequelize,
    modelName: 'RestaurantOwnerRelationship',
    tableName: 'restaurant_owner_relationships',
    timestamps: true,
    underscored: true
  });

  return RestaurantOwnerRelationship;
};