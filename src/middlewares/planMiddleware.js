import mongoose from 'mongoose';
import { AppError } from '../utils/errorHandler.js';
import { HTTP_STATUS, ROLES, PERMISSIONS } from '../utils/constants.js';
import { getUserPlanAndPermissions } from '../services/permissionService.js';
import Class from '../models/Class.js';
import ClassMember from '../models/ClassMember.js';

/**
 * Middleware to require a specific plan permission
 *
 * @param {String} permission - Required permission string from PERMISSIONS
 */
export const requirePermission = (permission) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', HTTP_STATUS.UNAUTHORIZED);
      }

      // Admin bypasses permission checks
      if (req.user.role === ROLES.ADMIN) {
        return next();
      }

      const planInfo = await getUserPlanAndPermissions(req.user);
      req.userPlanInfo = planInfo;

      if (!planInfo.permissions.includes(permission)) {
        throw new AppError(
          `Action requires '${permission}' permission. Please upgrade your plan.`,
          HTTP_STATUS.FORBIDDEN
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware requiring active Custom Plan (or Admin) to create and manage classes
 */
export const requireCustomPlan = async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', HTTP_STATUS.UNAUTHORIZED);
    }

    // Admin has superuser privileges
    if (req.user.role === ROLES.ADMIN) {
      return next();
    }

    const planInfo = await getUserPlanAndPermissions(req.user);
    req.userPlanInfo = planInfo;

    if (
      planInfo.plan !== 'CUSTOM' &&
      !planInfo.permissions.includes(PERMISSIONS.CLASS_MANAGEMENT)
    ) {
      throw new AppError(
        'Custom plan is required to create and manage classes. Please upgrade to Custom Plan.',
        HTTP_STATUS.FORBIDDEN
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to ensure the authenticated user owns the class or is Admin
 *
 * @param {String} paramName - Name of the route parameter containing class ID (e.g. 'id' or 'class_id')
 */
export const requireClassOwner = (paramName = 'id') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', HTTP_STATUS.UNAUTHORIZED);
      }

      const classId = req.params[paramName] || req.body[paramName] || req.query[paramName];
      if (!classId || !mongoose.isValidObjectId(classId)) {
        throw new AppError('Valid Class ID is required', HTTP_STATUS.BAD_REQUEST);
      }

      const targetClass = await Class.findById(classId);
      if (!targetClass) {
        throw new AppError('Class not found', HTTP_STATUS.NOT_FOUND);
      }

      if (
        req.user.role !== ROLES.ADMIN &&
        targetClass.teacher_id.toString() !== req.user._id.toString()
      ) {
        throw new AppError('You are not authorized to manage this class', HTTP_STATUS.FORBIDDEN);
      }

      req.currentClass = targetClass;
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware allowing access if user is either the Teacher owner, Admin,
 * or an active member Student of the class.
 *
 * @param {String} paramName - Name of the route parameter containing class ID
 */
export const requireClassAccess = (paramName = 'id') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', HTTP_STATUS.UNAUTHORIZED);
      }

      const classId = req.params[paramName] || req.body[paramName] || req.query[paramName];
      if (!classId || !mongoose.isValidObjectId(classId)) {
        throw new AppError('Valid Class ID is required', HTTP_STATUS.BAD_REQUEST);
      }

      const targetClass = await Class.findById(classId);
      if (!targetClass) {
        throw new AppError('Class not found', HTTP_STATUS.NOT_FOUND);
      }

      // 1. Check if Admin
      if (req.user.role === ROLES.ADMIN) {
        req.currentClass = targetClass;
        req.isClassTeacher = true;
        return next();
      }

      // 2. Check if Teacher owner
      if (targetClass.teacher_id.toString() === req.user._id.toString()) {
        req.currentClass = targetClass;
        req.isClassTeacher = true;
        return next();
      }

      // 3. Check if active member
      const member = await ClassMember.findOne({
        class_id: classId,
        user_id: req.user._id,
        status: 'active',
      });

      if (!member) {
        throw new AppError('You are not a member of this class', HTTP_STATUS.FORBIDDEN);
      }

      req.currentClass = targetClass;
      req.classMember = member;
      req.isClassTeacher = false;
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware allowing Admin OR any user with active Custom Plan / class permissions
 */
export const isTeacherOrAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', HTTP_STATUS.UNAUTHORIZED);
    }

    if (req.user.role === ROLES.ADMIN) {
      return next();
    }

    const planInfo = await getUserPlanAndPermissions(req.user);
    req.userPlanInfo = planInfo;

    if (
      planInfo.plan === 'CUSTOM' ||
      planInfo.permissions.includes(PERMISSIONS.CLASS_MANAGEMENT) ||
      planInfo.permissions.includes(PERMISSIONS.INTERACTIVE_CLASSES) ||
      req.user.role === ROLES.TEACHER
    ) {
      return next();
    }

    throw new AppError(
      'Custom plan is required to access this feature. Please upgrade to Custom Plan.',
      HTTP_STATUS.FORBIDDEN
    );
  } catch (error) {
    next(error);
  }
};

export const hasCustomPlanOrAdmin = isTeacherOrAdmin;

export default {
  requirePermission,
  requireCustomPlan,
  requireClassOwner,
  requireClassAccess,
  isTeacherOrAdmin,
  hasCustomPlanOrAdmin,
};

