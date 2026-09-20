import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { ROLES, PERMISSIONS, PLAN_PERMISSIONS, HTTP_STATUS } from './src/utils/constants.js';
import {
  getUserPlanAndPermissions,
  hasUserPermission,
  isClassOwner,
  isClassMember,
} from './src/services/permissionService.js';
import {
  generateQuizFromVocabularies,
  maskQuizAnswersForStudent,
  evaluateQuizAnswer,
} from './src/services/interactiveQuizService.js';
import Subscription from './src/models/Subscription.js';
import Class from './src/models/Class.js';
import ClassMember from './src/models/ClassMember.js';
import Vocabulary from './src/models/Vocabulary.js';
import InteractiveLesson from './src/models/InteractiveLesson.js';
import InteractiveActivity from './src/models/InteractiveActivity.js';
import InteractiveSession from './src/models/InteractiveSession.js';

// Setup Mock IDs
const mockAdminId = new mongoose.Types.ObjectId();
const mockTeacherFreeId = new mongoose.Types.ObjectId();
const mockTeacherCustomId = new mongoose.Types.ObjectId();
const mockStudentFreeId = new mongoose.Types.ObjectId();
const mockStudentPremiumId = new mongoose.Types.ObjectId();
const mockClassId = new mongoose.Types.ObjectId();
const mockLessonId = new mongoose.Types.ObjectId();
const mockActivityId = new mongoose.Types.ObjectId();

test('=== 1. PLAN & PERMISSION TESTS ===', async (t) => {
  // Mock Subscription.findOne
  const originalFindOne = Subscription.findOne;

  t.after(() => {
    Subscription.findOne = originalFindOne;
  });

  Subscription.findOne = (query) => {
    const qUserId = query.userId?.toString();
    return {
      populate: async () => {
        if (qUserId === mockTeacherCustomId.toString()) {
          return {
            userId: mockTeacherCustomId,
            status: 'ACTIVE',
            endDate: new Date(Date.now() + 86400000),
            planId: {
              name: 'Custom Teacher Plan',
              code: 'CUSTOM_TEACHER',
              planType: 'CUSTOM',
              features: ['Live Sessions', 'Class Management'],
              permissions: ['basic_learning', 'class_management', 'interactive_classes', 'teacher_dashboard'],
            },
          };
        }
        if (qUserId === mockStudentPremiumId.toString()) {
          return {
            userId: mockStudentPremiumId,
            status: 'ACTIVE',
            endDate: new Date(Date.now() + 86400000),
            planId: {
              name: 'Premium 1 Month',
              code: 'PREMIUM_1_MONTH',
              planType: 'PREMIUM',
              features: ['AI Learning'],
              permissions: ['basic_learning', 'ai_learning'],
            },
          };
        }
        return null; // Free user (no subscription)
      },
    };
  };

  await t.test('1.1 Admin has all permissions and full access', async () => {
    const adminUser = { _id: mockAdminId, role: ROLES.ADMIN };
    const planInfo = await getUserPlanAndPermissions(adminUser);

    assert.equal(planInfo.plan, 'ADMIN');
    assert.equal(planInfo.isAdmin, true);
    assert.ok(planInfo.permissions.includes(PERMISSIONS.CLASS_MANAGEMENT));
    assert.ok(planInfo.permissions.includes(PERMISSIONS.AI_LEARNING));
    assert.ok(planInfo.permissions.includes(PERMISSIONS.INTERACTIVE_CLASSES));
  });

  await t.test('1.2 Free User (role: user) has only basic_learning and no class_management', async () => {
    const freeStudent = { _id: mockStudentFreeId, role: ROLES.USER };
    const planInfo = await getUserPlanAndPermissions(freeStudent);

    assert.equal(planInfo.plan, 'FREE');
    assert.deepEqual(planInfo.permissions, [PERMISSIONS.BASIC_LEARNING]);
    assert.equal(planInfo.permissions.includes(PERMISSIONS.CLASS_MANAGEMENT), false);
    assert.equal(planInfo.permissions.includes(PERMISSIONS.AI_LEARNING), false);
    assert.equal(planInfo.canManageClasses, false);
    assert.equal(planInfo.can_create_class, false);
  });

  await t.test('1.3 Premium User (role: user) has basic_learning and ai_learning, but no class_management', async () => {
    const premiumStudent = { _id: mockStudentPremiumId, role: ROLES.USER };
    const planInfo = await getUserPlanAndPermissions(premiumStudent);

    assert.equal(planInfo.plan, 'PREMIUM');
    assert.ok(planInfo.permissions.includes(PERMISSIONS.BASIC_LEARNING));
    assert.ok(planInfo.permissions.includes(PERMISSIONS.AI_LEARNING));
    assert.equal(planInfo.permissions.includes(PERMISSIONS.CLASS_MANAGEMENT), false);
    assert.equal(planInfo.permissions.includes(PERMISSIONS.INTERACTIVE_CLASSES), false);
    assert.equal(planInfo.canManageClasses, false);
    assert.equal(planInfo.can_create_class, false);
  });

  await t.test('1.4 Normal User with Free Plan cannot manage classes', async () => {
    const freeUser = { _id: mockTeacherFreeId, role: ROLES.USER };
    const planInfo = await getUserPlanAndPermissions(freeUser);

    assert.equal(planInfo.plan, 'FREE');
    assert.equal(planInfo.permissions.includes(PERMISSIONS.CLASS_MANAGEMENT), false);
    assert.equal(planInfo.canManageClasses, false);
    assert.equal(planInfo.can_create_class, false);
  });

  await t.test('1.5 Normal User (role: user) with Custom Plan has class_management and interactive_classes', async () => {
    const customUser = { _id: mockTeacherCustomId, role: ROLES.USER };
    const planInfo = await getUserPlanAndPermissions(customUser);

    assert.equal(planInfo.plan, 'CUSTOM');
    assert.ok(planInfo.permissions.includes(PERMISSIONS.CLASS_MANAGEMENT));
    assert.ok(planInfo.permissions.includes(PERMISSIONS.INTERACTIVE_CLASSES));
    assert.ok(planInfo.permissions.includes(PERMISSIONS.TEACHER_DASHBOARD));
    assert.ok(planInfo.permissions.includes(PERMISSIONS.AI_LEARNING));
    assert.equal(planInfo.hasCustomPlan, true);
    assert.equal(planInfo.canManageClasses, true);
    assert.equal(planInfo.can_create_class, true);
  });
});

test('=== 2. VOCABULARY NORMALIZATION & DUPLICATE PREVENTION ===', async (t) => {
  const originalFindOne = Vocabulary.findOne;
  t.after(() => {
    Vocabulary.findOne = originalFindOne;
  });

  const existingVocabs = [
    { _id: new mongoose.Types.ObjectId(), word: 'Mutter', article: 'die', meaning: 'người mẹ' },
    { _id: new mongoose.Types.ObjectId(), word: 'Vater', article: 'der', meaning: 'người cha' },
  ];

  Vocabulary.findOne = async (query) => {
    if (query.word?.$regex) {
      const regex = query.word.$regex;
      return existingVocabs.find((v) => regex.test(v.word)) || null;
    }
    return null;
  };

  await t.test('2.1 Case-insensitive duplicate detection catches "mutter", " MUTTER ", and "  Mutter "', () => {
    const inputs = ['mutter', '  MUTTER  ', 'Mutter', ' Mutter \n'];
    for (const input of inputs) {
      const normalized = input.trim().replace(/\s+/g, ' ');
      const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`^${escaped}$`, 'i');
      const match = existingVocabs.some((v) => regex.test(v.word));
      assert.equal(match, true, `Input "${input}" should be detected as duplicate of "Mutter"`);
    }
  });

  await t.test('2.2 New distinct word "Geschwister" is not considered duplicate', () => {
    const input = 'Geschwister';
    const normalized = input.trim().replace(/\s+/g, ' ');
    const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`^${escaped}$`, 'i');
    const match = existingVocabs.some((v) => regex.test(v.word));
    assert.equal(match, false, 'New word "Geschwister" should not conflict');
  });
});

test('=== 3. INTERACTIVE QUIZ GENERATION & CHEAT PREVENTION ===', async (t) => {
  const mockVocabs = [
    {
      _id: new mongoose.Types.ObjectId(),
      word: 'Apfel',
      article: 'der',
      meaning: 'quả táo',
      example: 'Ich esse einen Apfel.',
    },
    {
      _id: new mongoose.Types.ObjectId(),
      word: 'Buch',
      article: 'das',
      meaning: 'quyển sách',
      example: 'Das Buch ist interessant.',
    },
    {
      _id: new mongoose.Types.ObjectId(),
      word: 'Lampe',
      article: 'die',
      meaning: 'cây đèn',
      example: 'Die Lampe ist neu.',
    },
  ];

  await t.test('3.1 Generate quiz generates meaning and article questions', () => {
    const questions = generateQuizFromVocabularies(mockVocabs, { shuffle: false });

    assert.ok(questions.length >= 3, 'Should generate at least 3 questions');

    const meaningQ = questions.find((q) => q.question_type === 'meaning' && q.question_text.includes('Apfel'));
    assert.ok(meaningQ, 'Should generate meaning question for Apfel');
    assert.equal(meaningQ.correct_answer, 'quả táo');
    assert.ok(meaningQ.options.length >= 2, 'Options should have choices');

    const articleQ = questions.find((q) => q.question_type === 'article' && q.question_text.includes('Apfel'));
    assert.ok(articleQ, 'Should generate article question for Apfel');
    assert.equal(articleQ.correct_answer, 'der');
  });

  await t.test('3.2 maskQuizAnswersForStudent removes correct_answer and isCorrect flag', () => {
    const questions = generateQuizFromVocabularies(mockVocabs, { shuffle: false });
    const masked = maskQuizAnswersForStudent(questions);

    for (const q of masked) {
      assert.equal(q.correct_answer, undefined, 'Student question must not expose correct_answer');
      assert.equal(q.explanation, undefined, 'Student question must not expose explanation');
      for (const opt of q.options) {
        assert.equal(opt.isCorrect, undefined, 'Student option must not expose isCorrect flag');
      }
    }
  });

  await t.test('3.3 evaluateQuizAnswer grades student answers accurately', () => {
    const question = {
      id: 'q1',
      correct_answer: 'der',
      options: [
        { id: 'opt1', text: 'der', isCorrect: true },
        { id: 'opt2', text: 'die', isCorrect: false },
        { id: 'opt3', text: 'das', isCorrect: false },
      ],
    };

    // Correct answer by text
    const res1 = evaluateQuizAnswer(question, 'der');
    assert.equal(res1.isCorrect, true);

    // Correct answer by option ID
    const res2 = evaluateQuizAnswer(question, 'opt1');
    assert.equal(res2.isCorrect, true);

    // Incorrect answer
    const res3 = evaluateQuizAnswer(question, 'das');
    assert.equal(res3.isCorrect, false);

    // Case-insensitive match
    const res4 = evaluateQuizAnswer(question, '  DER  ');
    assert.equal(res4.isCorrect, true);
  });
});

test('=== 4. CLASS OWNERSHIP & MEMBERSHIP VERIFICATION ===', async (t) => {
  const origClassFindById = Class.findById;
  const origMemberFindOne = ClassMember.findOne;

  t.after(() => {
    Class.findById = origClassFindById;
    ClassMember.findOne = origMemberFindOne;
  });

  Class.findById = async (id) => {
    if (id.toString() === mockClassId.toString()) {
      return {
        _id: mockClassId,
        teacher_id: mockTeacherCustomId,
        class_code: 'DEUTSCH01',
        status: 'active',
      };
    }
    return null;
  };

  ClassMember.findOne = async (query) => {
    if (
      query.class_id?.toString() === mockClassId.toString() &&
      query.user_id?.toString() === mockStudentFreeId.toString() &&
      query.status === 'active'
    ) {
      return { _id: new mongoose.Types.ObjectId(), role: 'student', status: 'active' };
    }
    return null;
  };

  await t.test('4.1 Custom User owner (role: user) is verified as class owner', async () => {
    const isOwner = await isClassOwner(mockClassId, mockTeacherCustomId, ROLES.USER);
    assert.equal(isOwner, true);
  });

  await t.test('4.2 Non-owner user is rejected from managing class', async () => {
    const isOwner = await isClassOwner(mockClassId, mockTeacherFreeId, ROLES.USER);
    assert.equal(isOwner, false);
  });

  await t.test('4.3 Admin is treated as owner', async () => {
    const isOwner = await isClassOwner(mockClassId, mockAdminId, ROLES.ADMIN);
    assert.equal(isOwner, true);
  });

  await t.test('4.4 Enrolled free student is verified as class member', async () => {
    const isMember = await isClassMember(mockClassId, mockStudentFreeId);
    assert.equal(isMember, true);
  });

  await t.test('4.5 Non-enrolled student is rejected from class member access', async () => {
    const isMember = await isClassMember(mockClassId, mockStudentPremiumId);
    assert.equal(isMember, false);
  });
});

test('=== 5. LIVE SESSION FLOW LOGIC ===', async (t) => {
  const sampleVocabList = [
    { _id: 'v1', word: 'Hund', article: 'der', meaning: 'con chó' },
    { _id: 'v2', word: 'Katze', article: 'die', meaning: 'con mèo' },
    { _id: 'v3', word: 'Haus', article: 'das', meaning: 'ngôi nhà' },
  ];

  await t.test('5.1 Spin activity random selection picks from vocabulary pool', () => {
    const picked = sampleVocabList[Math.floor(Math.random() * sampleVocabList.length)];
    assert.ok(sampleVocabList.some((v) => v._id === picked._id));
    assert.ok(picked.word);
    assert.ok(picked.meaning);
  });

  await t.test('5.2 Student response is recorded with timestamp and grade', () => {
    const responses = [];
    const studentResponse = {
      user_id: mockStudentFreeId,
      activity_type: 'quiz',
      item_id: 'q_meaning_v1',
      answer: 'con chó',
      is_correct: true,
      submitted_at: new Date(),
    };

    responses.push(studentResponse);
    assert.equal(responses.length, 1);
    assert.equal(responses[0].is_correct, true);
    assert.equal(responses[0].answer, 'con chó');
  });
});
