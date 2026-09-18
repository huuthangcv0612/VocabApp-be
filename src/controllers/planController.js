import Plan from '../models/Plan.js';
import asyncHandler from '../utils/asyncHandler.js';
import { AppError } from '../utils/errorHandler.js';
import { sendResponse } from '../utils/responseHandler.js';
import { HTTP_STATUS } from '../utils/constants.js';

/**
 * @desc    Get all active plans
 * @route   GET /api/plans
 * @access  Public
 */
export const getPlans = asyncHandler(async (req, res) => {
  const plans = await Plan.find({ isActive: true }).sort({ sortOrder: 1, price: 1 });

  sendResponse(
    res,
    HTTP_STATUS.OK,
    'Plans fetched successfully',
    { plans }
  );
});

/**
 * @desc    Get single plan by ID
 * @route   GET /api/plans/:id
 * @access  Public
 */
export const getPlanById = asyncHandler(async (req, res) => {
  const plan = await Plan.findById(req.params.id);

  if (!plan) {
    throw new AppError('Plan not found', HTTP_STATUS.NOT_FOUND);
  }

  sendResponse(
    res,
    HTTP_STATUS.OK,
    'Plan fetched successfully',
    { plan }
  );
});

/**
 * @desc    Create new plan (Admin)
 * @route   POST /api/plans
 * @access  Private/Admin
 */
export const createPlan = asyncHandler(async (req, res) => {
  const { name, code, price, durationDays, description, features, isActive, sortOrder } = req.body;

  if (!name || !code || price === undefined || !durationDays) {
    throw new AppError('Name, code, price, and durationDays are required', HTTP_STATUS.BAD_REQUEST);
  }

  const existingCode = await Plan.findOne({ code: code.toUpperCase() });
  if (existingCode) {
    throw new AppError('Plan with this code already exists', HTTP_STATUS.CONFLICT);
  }

  const plan = await Plan.create({
    name,
    code: code.toUpperCase(),
    price,
    durationDays,
    description: description || '',
    features: features || [],
    isActive: isActive !== undefined ? isActive : true,
    sortOrder: sortOrder || 0,
  });

  sendResponse(
    res,
    HTTP_STATUS.CREATED,
    'Plan created successfully',
    { plan }
  );
});

/**
 * @desc    Update plan (Admin)
 * @route   PUT /api/plans/:id
 * @access  Private/Admin
 */
export const updatePlan = asyncHandler(async (req, res) => {
  const { name, code, price, durationDays, description, features, isActive, sortOrder } = req.body;

  let plan = await Plan.findById(req.params.id);
  if (!plan) {
    throw new AppError('Plan not found', HTTP_STATUS.NOT_FOUND);
  }

  if (code && code.toUpperCase() !== plan.code) {
    const existingCode = await Plan.findOne({ code: code.toUpperCase() });
    if (existingCode) {
      throw new AppError('Plan code already in use', HTTP_STATUS.CONFLICT);
    }
  }

  plan = await Plan.findByIdAndUpdate(
    req.params.id,
    {
      ...(name && { name }),
      ...(code && { code: code.toUpperCase() }),
      ...(price !== undefined && { price }),
      ...(durationDays !== undefined && { durationDays }),
      ...(description !== undefined && { description }),
      ...(features && { features }),
      ...(isActive !== undefined && { isActive }),
      ...(sortOrder !== undefined && { sortOrder }),
    },
    { new: true, runValidators: true }
  );

  sendResponse(
    res,
    HTTP_STATUS.OK,
    'Plan updated successfully',
    { plan }
  );
});

/**
 * @desc    Delete plan (Admin)
 * @route   DELETE /api/plans/:id
 * @access  Private/Admin
 */
export const deletePlan = asyncHandler(async (req, res) => {
  const plan = await Plan.findById(req.params.id);
  if (!plan) {
    throw new AppError('Plan not found', HTTP_STATUS.NOT_FOUND);
  }

  await Plan.findByIdAndDelete(req.params.id);

  sendResponse(
    res,
    HTTP_STATUS.OK,
    'Plan deleted successfully',
    {}
  );
});

export default {
  getPlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan,
};
