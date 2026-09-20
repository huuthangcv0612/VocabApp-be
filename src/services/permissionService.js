import Subscription from '../models/Subscription.js';
import Class from '../models/Class.js';
import ClassMember from '../models/ClassMember.js';
import { ROLES, PERMISSIONS, PLAN_PERMISSIONS } from '../utils/constants.js';

/**
 * Get a user's current effective plan and granted permissions
 *
 * @param {Object|String} userOrId - Mongoose user document or user ObjectId
 * @param {String} [fallbackRole] - Optional fallback role
 * @returns {Promise<{ plan: String, permissions: Array<String>, subscription: Object|null }>}
 */
export const getUserPlanAndPermissions = async (userOrId, fallbackRole = null) => {
  const userId = userOrId._id || userOrId.id || userOrId;
  const userRole = userOrId.role || fallbackRole || ROLES.USER;

  // Admin has full super-admin access
  if (userRole === ROLES.ADMIN) {
    return {
      plan: 'ADMIN',
      permissions: Object.values(PERMISSIONS),
      subscription: null,
      isAdmin: true,
      isTeacher: true,
      hasCustomPlan: true,
      canManageClasses: true,
      can_create_class: true,
    };
  }

  const now = new Date();
  const subscription = await Subscription.findOne({
    userId,
    status: 'ACTIVE',
    endDate: { $gt: now },
  }).populate('planId');

  // If no active subscription or expired, user is on FREE plan
  if (!subscription || !subscription.planId) {
    return {
      plan: 'FREE',
      permissions: [...PLAN_PERMISSIONS.FREE],
      subscription: null,
      isAdmin: false,
      isTeacher: userRole === ROLES.TEACHER,
      hasCustomPlan: false,
      canManageClasses: false,
      can_create_class: false,
    };
  }

  const plan = subscription.planId;
  const planCode = (plan.code || '').toUpperCase();
  const planType = (plan.planType || '').toUpperCase();

  let effectivePlan = 'PREMIUM';
  let permissions = [...PLAN_PERMISSIONS.PREMIUM];

  if (planCode.includes('CUSTOM') || planType === 'CUSTOM') {
    effectivePlan = 'CUSTOM';
    permissions = [...PLAN_PERMISSIONS.CUSTOM];
  }

  // Merge any custom permissions defined directly on the Plan document
  if (Array.isArray(plan.permissions) && plan.permissions.length > 0) {
    permissions = Array.from(new Set([...permissions, ...plan.permissions]));
  }

  const isCustom = effectivePlan === 'CUSTOM' || permissions.includes(PERMISSIONS.CLASS_MANAGEMENT);

  return {
    plan: effectivePlan,
    permissions,
    subscription,
    isAdmin: false,
    isTeacher: isCustom || userRole === ROLES.TEACHER,
    hasCustomPlan: isCustom,
    canManageClasses: isCustom,
    can_create_class: isCustom,
  };
};

/**
 * Check whether a user has a specific permission
 */
export const hasUserPermission = async (user, permission) => {
  if (!user) return false;
  if (user.role === ROLES.ADMIN) return true;

  const { permissions } = await getUserPlanAndPermissions(user);
  return permissions.includes(permission);
};

/**
 * Verify whether the user is the teacher/owner of the class or an Admin
 */
export const isClassOwner = async (classId, userId, userRole = null) => {
  if (userRole === ROLES.ADMIN) return true;

  const targetClass = await Class.findById(classId);
  if (!targetClass) return false;

  return targetClass.teacher_id.toString() === userId.toString();
};

/**
 * Verify whether the user is an active member of the class (student or teacher)
 */
export const isClassMember = async (classId, userId) => {
  const membership = await ClassMember.findOne({
    class_id: classId,
    user_id: userId,
    status: 'active',
  });

  return Boolean(membership);
};

export default {
  getUserPlanAndPermissions,
  hasUserPermission,
  isClassOwner,
  isClassMember,
};
