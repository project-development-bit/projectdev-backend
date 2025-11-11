const AddressModel = require("../models/address.model");
const HttpException = require("../utils/HttpException.utils");
const { validationResult } = require("express-validator");

class AddressController {
  //Validate request using express-validator
  checkValidation = (req) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new HttpException(
        400,
        "Validation failed. Please check your input fields.",
        "VALIDATION_ERROR",
        errors.array()
      );
    }
  };

  //Get all addresses for the current user
  getUserAddresses = async (req, res, next) => {
    try {
      const user = req.currentUser;

      if (!user) {
        throw new HttpException(404, "User not found", "USER_NOT_FOUND");
      }

      const { currency } = req.query;

      let addresses;
      if (currency) {
        addresses = await AddressModel.getAddressesByCurrency(user.id, currency.toUpperCase());
      } else {
        addresses = await AddressModel.getUserAddresses(user.id);
      }

      res.status(200).json({
        success: true,
        message: "Addresses retrieved successfully",
        data: addresses,
      });
    } catch (error) {
      next(error);
    }
  };

  //Get a single address by ID
  getAddressById = async (req, res, next) => {
    try {
      const user = req.currentUser;
      const { id } = req.params;

      if (!user) {
        throw new HttpException(404, "User not found", "USER_NOT_FOUND");
      }

      const address = await AddressModel.getAddressById(id, user.id);

      if (!address) {
        throw new HttpException(404, "Address not found", "ADDRESS_NOT_FOUND");
      }

      res.status(200).json({
        success: true,
        message: "Address retrieved successfully",
        data: address,
      });
    } catch (error) {
      next(error);
    }
  };

  //Create a new address
  createAddress = async (req, res, next) => {
    try {
      this.checkValidation(req);

      const user = req.currentUser;

      if (!user) {
        throw new HttpException(404, "User not found", "USER_NOT_FOUND");
      }

      const { currency, address, label } = req.body;

      const result = await AddressModel.createAddress({
        userId: user.id,
        currency: currency.toUpperCase(),
        address: address.trim(),
        label: label ? label.trim() : null,
      });

      if (!result.success) {
        throw new HttpException(409, result.error, "ADDRESS_ALREADY_EXISTS");
      }

      // Get the created address
      const createdAddress = await AddressModel.getAddressById(result.addressId, user.id);

      res.status(201).json({
        success: true,
        message: "Address added successfully",
        data: createdAddress,
      });
    } catch (error) {
      next(error);
    }
  };

  //Update an address
  updateAddress = async (req, res, next) => {
    try {
      this.checkValidation(req);

      const user = req.currentUser;
      const { id } = req.params;

      if (!user) {
        throw new HttpException(404, "User not found", "USER_NOT_FOUND");
      }

      // Check if address exists and belongs to user
      const existingAddress = await AddressModel.getAddressById(id, user.id);

      if (!existingAddress) {
        throw new HttpException(404, "Address not found", "ADDRESS_NOT_FOUND");
      }

      const { label, address } = req.body;

      const result = await AddressModel.updateAddress(id, user.id, {
        label: label !== undefined ? label.trim() : undefined,
        address: address !== undefined ? address.trim() : undefined,
      });

      if (!result.affectedRows) {
        throw new HttpException(500, "Failed to update address", "UPDATE_FAILED");
      }

      // Get the updated address
      const updatedAddress = await AddressModel.getAddressById(id, user.id);

      res.status(200).json({
        success: true,
        message: "Address updated successfully",
        data: updatedAddress,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete an address
   * DELETE /api/v1/addresses/:id
   */
  deleteAddress = async (req, res, next) => {
    try {
      const user = req.currentUser;
      const { id } = req.params;

      if (!user) {
        throw new HttpException(404, "User not found", "USER_NOT_FOUND");
      }

      const affectedRows = await AddressModel.deleteAddress(id, user.id);

      if (affectedRows === 0) {
        throw new HttpException(404, "Address not found", "ADDRESS_NOT_FOUND");
      }

      res.status(200).json({
        success: true,
        message: "Address deleted successfully",
        data: { id, deletedRows: affectedRows },
      });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = new AddressController();
