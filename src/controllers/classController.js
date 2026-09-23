import crypto from 'crypto';
import mongoose from 'mongoose';
import Class from '../models/Class.js';
import ClassMember from '../models/ClassMember.js';
import User from '../models/User.js';
import asyncHandler from '../utils/asyncHandler.js';
import { AppError } from '../utils/errorHandler.js';
import { sendResponse } from '../utils/responseHandler.js';
import { HTTP_STATUS, ROLES, SUCCESS_MESSAGES, ERROR_MESSAGES } from '../utils/constants.js';

/**
 * Generate a unique 6-character uppercase alphanumeric class code
 */
const generateClassCode = async () => {
  for (let attempts = 0; attempts < 10; attempts++) {
    const code = crypto.randomBytes(3).toString('hex').toUpperCase();
    const existing = await Class.findOne({ class_code: code });
    if (!existing) return code;
  }
  return `CLS${Date.now().toString(36).slice(-5).toUpperCase()}`;
};

/**
 * @desc    Create new class
 * @route   POST /api/classes
 * @access  Private (Teacher with Custom Plan / Admin)
 */
export const createClass = asyncHandler(async (req, res) => {
  const { name, description, class_code } = req.body;

  if (!name || !name.trim()) {
    throw new AppError('Class name is required', HTTP_STATUS.BAD_REQUEST);
  }

  let finalCode = (class_code || '').trim().toUpperCase();

  if (finalCode) {
    const existingClass = await Class.findOne({ class_code: finalCode });
    if (existingClass) {
      throw new AppError('Class code already exists', HTTP_STATUS.CONFLICT);
    }
  } else {
    finalCode = await generateClassCode();
  }

  const newClass = await Class.create({
    name: name.trim(),
    description: (description || '').trim(),
    teacher_id: req.user._id,
    class_code: finalCode,
    status: 'active',
  });

  // Automatically add teacher to class_members
  await ClassMember.create({
    class_id: newClass._id,
    user_id: req.user._id,
    role: 'teacher',
    status: 'active',
  });

  const populatedClass = await Class.findById(newClass._id).populate(
    'teacher_id',
    'name email username avatar'
  );

  sendResponse(
    res,
    HTTP_STATUS.CREATED,
    'Class created successfully',
    { class: populatedClass }
  );
});

/**
 * @desc    Get classes managed by teacher (or all for Admin)
 * @route   GET /api/classes
 * @access  Private (Teacher / Admin)
 */
export const getClasses = asyncHandler(async (req, res) => {
  const query = { status: { $ne: 'archived' } };

  if (req.user.role !== ROLES.ADMIN) {
    query.teacher_id = req.user._id;
  } else if (req.query.teacher_id && mongoose.isValidObjectId(req.query.teacher_id)) {
    query.teacher_id = req.query.teacher_id;
  }

  const classes = await Class.find(query)
    .populate('teacher_id', 'name email username avatar')
    .sort({ createdAt: -1 });

  const classIds = classes.map((c) => c._id);

  const studentCounts = classIds.length > 0
    ? await ClassMember.aggregate([
        {
          $match: {
            class_id: { $in: classIds },
            role: 'student',
            status: 'active',
          },
        },
        {
          $group: {
            _id: '$class_id',
            count: { $sum: 1 },
          },
        },
      ])
    : [];

  const countMap = new Map(
    studentCounts.map((item) => [item._id.toString(), item.count])
  );

  const enrichedClasses = classes.map((c) => {
    const classObj = c.toObject ? c.toObject() : { ...c };
    const count = countMap.get(c._id.toString()) || 0;
    return {
      ...classObj,
      students_count: count,
      studentCount: count,
    };
  });

  sendResponse(
    res,
    HTTP_STATUS.OK,
    'Classes fetched successfully',
    { classes: enrichedClasses, count: enrichedClasses.length }
  );
});

/**
 * @desc    Get class details by ID
 * @route   GET /api/classes/:id
 * @access  Private (Teacher owner, Admin, or Student member)
 */
export const getClassById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('Invalid class ID format', HTTP_STATUS.BAD_REQUEST);
  }

  const targetClass = await Class.findById(id).populate(
    'teacher_id',
    'name email username avatar'
  );

  if (!targetClass) {
    throw new AppError('Class not found', HTTP_STATUS.NOT_FOUND);
  }

  // Authorization check: Admin OR Owner Teacher OR Active Student member
  const teacherId = (targetClass.teacher_id._id || targetClass.teacher_id).toString();
  const isOwner = teacherId === req.user._id.toString();
  const isAdmin = req.user.role === ROLES.ADMIN;

  if (!isOwner && !isAdmin) {
    const membership = await ClassMember.findOne({
      class_id: id,
      user_id: req.user._id,
      status: 'active',
    });

    if (!membership) {
      throw new AppError('You are not a member of this class', HTTP_STATUS.FORBIDDEN);
    }
  }

  const studentCount = await ClassMember.countDocuments({
    class_id: id,
    role: 'student',
    status: 'active',
  });

  const classObj = {
    ...(targetClass.toObject ? targetClass.toObject() : targetClass),
    students_count: studentCount,
    studentCount,
  };

  sendResponse(
    res,
    HTTP_STATUS.OK,
    'Class details fetched successfully',
    {
      class: classObj,
      studentCount,
      students_count: studentCount,
      isTeacher: isOwner || isAdmin,
    }
  );
});

/**
 * @desc    Update class details
 * @route   PUT /api/classes/:id
 * @access  Private (Teacher owner / Admin)
 */
export const updateClass = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, status } = req.body;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('Invalid class ID format', HTTP_STATUS.BAD_REQUEST);
  }

  const targetClass = await Class.findById(id);
  if (!targetClass) {
    throw new AppError('Class not found', HTTP_STATUS.NOT_FOUND);
  }

  const teacherId = (targetClass.teacher_id._id || targetClass.teacher_id).toString();
  if (
    req.user.role !== ROLES.ADMIN &&
    teacherId !== req.user._id.toString()
  ) {
    throw new AppError('You are not authorized to update this class', HTTP_STATUS.FORBIDDEN);
  }

  if (name !== undefined) targetClass.name = name.trim();
  if (description !== undefined) targetClass.description = description.trim();
  if (status !== undefined && ['active', 'archived', 'inactive'].includes(status)) {
    targetClass.status = status;
  }

  await targetClass.save();

  const populatedClass = await Class.findById(id).populate(
    'teacher_id',
    'name email username avatar'
  );

  sendResponse(
    res,
    HTTP_STATUS.OK,
    'Class updated successfully',
    { class: populatedClass }
  );
});

/**
 * @desc    Delete / archive class
 * @route   DELETE /api/classes/:id
 * @access  Private (Teacher owner / Admin)
 */
export const deleteClass = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('Invalid class ID format', HTTP_STATUS.BAD_REQUEST);
  }

  const targetClass = await Class.findById(id);
  if (!targetClass) {
    throw new AppError('Class not found', HTTP_STATUS.NOT_FOUND);
  }

  const teacherId = (targetClass.teacher_id._id || targetClass.teacher_id).toString();
  if (
    req.user.role !== ROLES.ADMIN &&
    teacherId !== req.user._id.toString()
  ) {
    throw new AppError('You are not authorized to delete this class', HTTP_STATUS.FORBIDDEN);
  }

  await Class.findByIdAndDelete(id);
  await ClassMember.deleteMany({ class_id: id });

  sendResponse(
    res,
    HTTP_STATUS.OK,
    'Class deleted successfully',
    { deletedId: id }
  );
});

/**
 * @desc    Student joins class using class_code
 * @route   POST /api/classes/join
 * @access  Private (Student: Free or Premium)
 */
export const joinClass = asyncHandler(async (req, res) => {
  const { class_code } = req.body;

  if (!class_code || !class_code.trim()) {
    throw new AppError('Class code is required', HTTP_STATUS.BAD_REQUEST);
  }

  const cleanCode = class_code.trim().toUpperCase();

  const targetClass = await Class.findOne({
    class_code: cleanCode,
    status: 'active',
  }).populate('teacher_id', 'name email username avatar');

  if (!targetClass) {
    throw new AppError('Class not found or no longer active', HTTP_STATUS.NOT_FOUND);
  }

  // Teacher cannot join their own class as a student
  const teacherId = (targetClass.teacher_id._id || targetClass.teacher_id).toString();
  if (teacherId === req.user._id.toString()) {
    throw new AppError('You are the teacher of this class', HTTP_STATUS.BAD_REQUEST);
  }

  const existingMember = await ClassMember.findOne({
    class_id: targetClass._id,
    user_id: req.user._id,
  });

  if (existingMember) {
    if (existingMember.status === 'active') {
      throw new AppError('You are already a member of this class', HTTP_STATUS.CONFLICT);
    } else {
      // Reactivate membership if previously removed or pending
      existingMember.status = 'active';
      existingMember.joined_at = new Date();
      await existingMember.save();

      return sendResponse(
        res,
        HTTP_STATUS.OK,
        'Successfully rejoined class',
        { class: targetClass, membership: existingMember }
      );
    }
  }

  const membership = await ClassMember.create({
    class_id: targetClass._id,
    user_id: req.user._id,
    role: 'student',
    status: 'active',
  });

  sendResponse(
    res,
    HTTP_STATUS.OK,
    'Successfully joined class',
    { class: targetClass, membership }
  );
});

/**
 * @desc    Get classes joined by the current student
 * @route   GET /api/classes/my
 * @access  Private (Authenticated student)
 */
export const getMyClasses = asyncHandler(async (req, res) => {
  const memberships = await ClassMember.find({
    user_id: req.user._id,
    role: 'student',
    status: 'active',
  })
    .populate({
      path: 'class_id',
      match: { status: { $ne: 'archived' } },
      populate: {
        path: 'teacher_id',
        select: 'name email username avatar',
      },
    })
    .sort({ joined_at: -1 });

  // Filter out any entries where class_id is null (e.g. archived)
  const rawClasses = memberships
    .filter((m) => m.class_id)
    .map((m) => {
      const classDoc = m.class_id.toObject ? m.class_id.toObject() : m.class_id;
      return {
        ...classDoc,
        joined_at: m.joined_at,
        membership_id: m._id,
      };
    });

  const classIds = rawClasses.map((c) => c._id);

  const studentCounts = classIds.length > 0
    ? await ClassMember.aggregate([
        {
          $match: {
            class_id: { $in: classIds },
            role: 'student',
            status: 'active',
          },
        },
        {
          $group: {
            _id: '$class_id',
            count: { $sum: 1 },
          },
        },
      ])
    : [];

  const countMap = new Map(
    studentCounts.map((item) => [item._id.toString(), item.count])
  );

  const classes = rawClasses.map((c) => {
    const count = countMap.get(c._id.toString()) || 0;
    return {
      ...c,
      students_count: count,
      studentCount: count,
    };
  });

  sendResponse(
    res,
    HTTP_STATUS.OK,
    'Joined classes fetched successfully',
    { classes, count: classes.length }
  );
});

/**
 * @desc    Get student list of a class
 * @route   GET /api/classes/:id/students
 * @access  Private (Teacher owner / Admin)
 */
export const getClassStudents = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('Invalid class ID format', HTTP_STATUS.BAD_REQUEST);
  }

  const targetClass = await Class.findById(id);
  if (!targetClass) {
    throw new AppError('Class not found', HTTP_STATUS.NOT_FOUND);
  }

  const teacherId = (targetClass.teacher_id._id || targetClass.teacher_id).toString();
  if (
    req.user.role !== ROLES.ADMIN &&
    teacherId !== req.user._id.toString()
  ) {
    throw new AppError('You are not authorized to view students of this class', HTTP_STATUS.FORBIDDEN);
  }

  const members = await ClassMember.find({
    class_id: id,
    role: 'student',
    status: 'active',
  })
    .populate('user_id', 'name email username avatar createdAt')
    .sort({ joined_at: -1 });

  const students = members
    .filter((m) => m.user_id)
    .map((m) => {
      const u = m.user_id;
      const userIdStr = (u._id || u.id || u).toString();
      return {
        _id: userIdStr,
        id: userIdStr,
        student_id: userIdStr,
        name: u.name || 'Học viên',
        email: u.email || '',
        avatar: u.avatar || '',
        status: m.status,
        joined_at: m.joined_at,
        membership_id: m._id,
        user: u,
      };
    });

  sendResponse(
    res,
    HTTP_STATUS.OK,
    'Class students fetched successfully',
    { students, count: students.length }
  );
});

/**
 * @desc    Remove student from class
 * @route   DELETE /api/classes/:id/students/:studentId
 * @access  Private (Teacher owner / Admin)
 */
export const removeStudentFromClass = asyncHandler(async (req, res) => {
  const { id, studentId } = req.params;

  if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(studentId)) {
    throw new AppError('Invalid ID format', HTTP_STATUS.BAD_REQUEST);
  }

  const targetClass = await Class.findById(id);
  if (!targetClass) {
    throw new AppError('Class not found', HTTP_STATUS.NOT_FOUND);
  }

  const removeTeacherId = (targetClass.teacher_id._id || targetClass.teacher_id).toString();
  if (
    req.user.role !== ROLES.ADMIN &&
    removeTeacherId !== req.user._id.toString()
  ) {
    throw new AppError('You are not authorized to manage students of this class', HTTP_STATUS.FORBIDDEN);
  }

  const membership = await ClassMember.findOne({
    class_id: id,
    user_id: studentId,
  });

  if (!membership) {
    throw new AppError('Student is not a member of this class', HTTP_STATUS.NOT_FOUND);
  }

  membership.status = 'removed';
  await membership.save();

  sendResponse(
    res,
    HTTP_STATUS.OK,
    'Student removed from class successfully',
    { studentId, classId: id }
  );
});

export default {
  createClass,
  getClasses,
  getClassById,
  updateClass,
  deleteClass,
  joinClass,
  getMyClasses,
  getClassStudents,
  removeStudentFromClass,
};
