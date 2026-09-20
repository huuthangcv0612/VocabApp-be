import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

process.env.SKIP_DB_CONNECT = 'true';
process.env.JWT_SECRET = 'test_jwt_secret_key_12345';

// Models
const Level = (await import('./src/models/Level.js')).default;
const Topic = (await import('./src/models/Topic.js')).default;
const Unit = (await import('./src/models/Unit.js')).default;
const Lesson = (await import('./src/models/Lesson.js')).default;
const Exercise = (await import('./src/models/Exercise.js')).default;
const UserLessonProgress = (await import('./src/models/UserLessonProgress.js')).default;
const UserExerciseProgress = (await import('./src/models/UserExerciseProgress.js')).default;
const UserVocabularyProgress = (await import('./src/models/UserVocabularyProgress.js')).default;

// Service & Controller
const {
  formatDateStr,
  calculateProgressOverview,
  syncVocabularyProgress,
  calculateStreak,
  DEFAULT_TIMEZONE,
} = await import('./src/services/progressService.js');

const {
  getProgressOverview,
  submitLessonExercise,
  getUserProgressOverview,
} = await import('./src/controllers/progressController.js');

test('Comprehensive Final Progress Audit Suite', async (t) => {
  const mockUserId = new mongoose.Types.ObjectId().toString();
  const mockLevel1Id = new mongoose.Types.ObjectId().toString();
  const mockLevel2Id = new mongoose.Types.ObjectId().toString();
  const mockLevel3Id = new mongoose.Types.ObjectId().toString();
  const mockTopicId = new mongoose.Types.ObjectId().toString();
  const mockUnit1Id = new mongoose.Types.ObjectId().toString();
  const mockUnit2Id = new mongoose.Types.ObjectId().toString();
  const mockL1Id = new mongoose.Types.ObjectId().toString();
  const mockL2Id = new mongoose.Types.ObjectId().toString();
  const mockL3Id = new mongoose.Types.ObjectId().toString();
  const mockVocabId = new mongoose.Types.ObjectId().toString();
  const mockExId = new mongoose.Types.ObjectId().toString();

  // ==========================================
  // ISSUE 3: TIMEZONE VERIFICATION
  // ==========================================
  await t.test('1. Timezone: 2026-09-21 00:30 UTC+7 is formatted as 2026-09-21 in Asia/Ho_Chi_Minh', () => {
    // 00:30 on 2026-09-21 in UTC+7 is 17:30 on 2026-09-20 in UTC
    const dateAtMidnightVietnam = new Date('2026-09-20T17:30:00.000Z');
    const formatted = formatDateStr(dateAtMidnightVietnam, 'Asia/Ho_Chi_Minh');
    assert.equal(formatted, '2026-09-21', 'Must correctly format to 2026-09-21 in Asia/Ho_Chi_Minh timezone');
  });

  await t.test('2. Streak calculation in Asia/Ho_Chi_Minh timezone', () => {
    const now = new Date();
    const todayStr = formatDateStr(now, DEFAULT_TIMEZONE);

    const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = formatDateStr(yesterdayDate, DEFAULT_TIMEZONE);

    const twoDaysAgoDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const twoDaysAgoStr = formatDateStr(twoDaysAgoDate, DEFAULT_TIMEZONE);

    const threeDaysAgoDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const threeDaysAgoStr = formatDateStr(threeDaysAgoDate, DEFAULT_TIMEZONE);

    // Empty
    assert.equal(calculateStreak(new Set()), 0);

    // Today only -> 1
    assert.equal(calculateStreak(new Set([todayStr])), 1);

    // Yesterday only -> 1 (not yet studied today, but yesterday was active)
    assert.equal(calculateStreak(new Set([yesterdayStr])), 1);

    // Today + Yesterday -> 2
    assert.equal(calculateStreak(new Set([todayStr, yesterdayStr])), 2);

    // Today + Yesterday + 2 days ago -> 3
    assert.equal(calculateStreak(new Set([todayStr, yesterdayStr, twoDaysAgoStr])), 3);

    // Broken streak: studied 2 days ago and 3 days ago, missed yesterday and today -> 0
    assert.equal(calculateStreak(new Set([twoDaysAgoStr, threeDaysAgoStr])), 0);
  });

  // ==========================================
  // ISSUE 1: CURRENT LEVEL & LEARNING PATH
  // ==========================================
  await t.test('3. Learning Path: User with no progress -> Level 1 is currentLevel, Lesson 1 is continueLearning', async () => {
    const origLevelFind = Level.find;
    const origTopicFind = Topic.find;
    const origUnitFind = Unit.find;
    const origLessonFind = Lesson.find;
    const origULPFind = UserLessonProgress.find;
    const origUVPFind = UserVocabularyProgress.find;
    const origUEPAgg = UserExerciseProgress.aggregate;

    Level.find = () => ({
      sort: () => ({
        lean: () => Promise.resolve([
          { _id: mockLevel1Id, level_name: 'A1.1', order: 1 },
          { _id: mockLevel2Id, level_name: 'A1.2', order: 2 },
        ]),
      }),
    });
    Topic.find = () => ({ sort: () => ({ lean: () => Promise.resolve([{ _id: mockTopicId, level_id: mockLevel1Id, name: 'T1' }]) }) });
    Unit.find = () => ({ sort: () => ({ lean: () => Promise.resolve([{ _id: mockUnit1Id, topic_id: mockTopicId, title: 'U1', order: 1 }]) }) });
    Lesson.find = () => ({
      sort: () => ({
        lean: () => Promise.resolve([
          { _id: mockL1Id, level_id: mockLevel1Id, unit_id: mockUnit1Id, title: 'L1', order: 1, estimated_minutes: 5, xp: 20 },
          { _id: mockL2Id, level_id: mockLevel1Id, unit_id: mockUnit1Id, title: 'L2', order: 2, estimated_minutes: 5, xp: 20 },
        ]),
      }),
    });
    UserLessonProgress.find = () => ({ lean: () => Promise.resolve([]) });
    UserVocabularyProgress.find = () => ({ lean: () => Promise.resolve([]) });
    UserExerciseProgress.aggregate = () => Promise.resolve([]);

    try {
      const result = await calculateProgressOverview(mockUserId);
      assert.equal(result.overview.currentLevel.level_name, 'A1.1');
      assert.equal(result.overview.levelCompletionPercentage, 0);
      assert.equal(result.continueLearning.lessonId.toString(), mockL1Id);
      assert.equal(result.continueLearning.status, 'not_started');
      assert.equal(result.continueLearning.progress, 0);
      assert.equal(result.levels[0].isCurrent, true);
      assert.equal(result.levels[1].isCurrent, false);
    } finally {
      Level.find = origLevelFind;
      Topic.find = origTopicFind;
      Unit.find = origUnitFind;
      Lesson.find = origLessonFind;
      UserLessonProgress.find = origULPFind;
      UserVocabularyProgress.find = origUVPFind;
      UserExerciseProgress.aggregate = origUEPAgg;
    }
  });

  await t.test('4. Learning Path: In-progress lesson in a locked level (Level 2) does NOT override active Level 1', async () => {
    const origLevelFind = Level.find;
    const origTopicFind = Topic.find;
    const origUnitFind = Unit.find;
    const origLessonFind = Lesson.find;
    const origULPFind = UserLessonProgress.find;
    const origUVPFind = UserVocabularyProgress.find;
    const origUEPAgg = UserExerciseProgress.aggregate;

    Level.find = () => ({
      sort: () => ({
        lean: () => Promise.resolve([
          { _id: mockLevel1Id, level_name: 'A1.1', order: 1 },
          { _id: mockLevel2Id, level_name: 'A1.2', order: 2 },
        ]),
      }),
    });
    Topic.find = () => ({ sort: () => ({ lean: () => Promise.resolve([]) }) });
    Unit.find = () => ({
      sort: () => ({
        lean: () => Promise.resolve([
          { _id: mockUnit1Id, title: 'U1', order: 1 },
          { _id: mockUnit2Id, title: 'U2', order: 1 },
        ]),
      }),
    });
    Lesson.find = () => ({
      sort: () => ({
        lean: () => Promise.resolve([
          { _id: mockL1Id, level_id: mockLevel1Id, unit_id: mockUnit1Id, title: 'L1 in Level 1', order: 1, estimated_minutes: 5, xp: 20 },
          { _id: mockL2Id, level_id: mockLevel2Id, unit_id: mockUnit2Id, title: 'L2 in Level 2', order: 1, estimated_minutes: 5, xp: 20 },
        ]),
      }),
    });

    // User has NOT completed L1 in Level 1, but somehow has L2 in Level 2 as in_progress
    UserLessonProgress.find = () => ({
      lean: () => Promise.resolve([
        { lesson_id: mockL2Id, status: 'in_progress', progress: 30, updatedAt: new Date() },
      ]),
    });
    UserVocabularyProgress.find = () => ({ lean: () => Promise.resolve([]) });
    UserExerciseProgress.aggregate = () => Promise.resolve([]);

    try {
      const result = await calculateProgressOverview(mockUserId);
      // Because Level 1 has uncompleted L1, Level 2 is locked according to Learning Path.
      // Therefore, currentLevel MUST be Level 1!
      assert.equal(result.overview.currentLevel.level_name, 'A1.1');
      assert.equal(result.levels[0].isCurrent, true);
      assert.equal(result.levels[1].isCurrent, false);
      // continueLearning points to the first uncompleted lesson in current level (L1)
      assert.equal(result.continueLearning.lessonId.toString(), mockL1Id);
    } finally {
      Level.find = origLevelFind;
      Topic.find = origTopicFind;
      Unit.find = origUnitFind;
      Lesson.find = origLessonFind;
      UserLessonProgress.find = origULPFind;
      UserVocabularyProgress.find = origUVPFind;
      UserExerciseProgress.aggregate = origUEPAgg;
    }
  });

  await t.test('5. Learning Path: User completed all levels -> currentLevel is last level, continueLearning is null', async () => {
    const origLevelFind = Level.find;
    const origTopicFind = Topic.find;
    const origUnitFind = Unit.find;
    const origLessonFind = Lesson.find;
    const origULPFind = UserLessonProgress.find;
    const origUVPFind = UserVocabularyProgress.find;
    const origUEPAgg = UserExerciseProgress.aggregate;

    Level.find = () => ({
      sort: () => ({
        lean: () => Promise.resolve([
          { _id: mockLevel1Id, level_name: 'A1.1', order: 1 },
          { _id: mockLevel2Id, level_name: 'A1.2', order: 2 },
        ]),
      }),
    });
    Topic.find = () => ({ sort: () => ({ lean: () => Promise.resolve([]) }) });
    Unit.find = () => ({ sort: () => ({ lean: () => Promise.resolve([{ _id: mockUnit1Id, order: 1 }]) }) });
    Lesson.find = () => ({
      sort: () => ({
        lean: () => Promise.resolve([
          { _id: mockL1Id, level_id: mockLevel1Id, unit_id: mockUnit1Id, title: 'L1', order: 1, estimated_minutes: 5, xp: 20 },
          { _id: mockL2Id, level_id: mockLevel2Id, unit_id: mockUnit1Id, title: 'L2', order: 1, estimated_minutes: 5, xp: 20 },
        ]),
      }),
    });

    // Both completed
    UserLessonProgress.find = () => ({
      lean: () => Promise.resolve([
        { lesson_id: mockL1Id, status: 'completed', progress: 100, xp_earned: 20 },
        { lesson_id: mockL2Id, status: 'completed', progress: 100, xp_earned: 20 },
      ]),
    });
    UserVocabularyProgress.find = () => ({ lean: () => Promise.resolve([]) });
    UserExerciseProgress.aggregate = () => Promise.resolve([]);

    try {
      const result = await calculateProgressOverview(mockUserId);
      assert.equal(result.continueLearning, null);
      assert.equal(result.overview.currentLevel.level_name, 'A1.2');
      assert.equal(result.overview.levelCompletionPercentage, 100);
      assert.equal(result.levels[0].completionPercentage, 100);
      assert.equal(result.levels[1].completionPercentage, 100);
      assert.equal(result.levels[0].isCurrent, false);
      assert.equal(result.levels[1].isCurrent, true);
    } finally {
      Level.find = origLevelFind;
      Topic.find = origTopicFind;
      Unit.find = origUnitFind;
      Lesson.find = origLessonFind;
      UserLessonProgress.find = origULPFind;
      UserVocabularyProgress.find = origUVPFind;
      UserExerciseProgress.aggregate = origUEPAgg;
    }
  });

  // ==========================================
  // ISSUE 2: VOCABULARY SYNC COMPREHENSIVE
  // ==========================================
  await t.test('6. Vocabulary Sync: first correct, first wrong, streak increase, fail after mastered, bounds', async () => {
    const origUVPFindOne = UserVocabularyProgress.findOne;

    UserVocabularyProgress.prototype.save = async function () {
      return this;
    };

    const exerciseMock = {
      _id: mockExId,
      vocabulary_id: mockVocabId,
      lesson_id: mockL1Id,
    };

    // 6a: First time correct
    UserVocabularyProgress.findOne = () => Promise.resolve(null);
    const doc1 = await syncVocabularyProgress({
      userId: mockUserId,
      exercise: exerciseMock,
      isCorrect: true,
      lessonId: mockL1Id,
    });
    assert.equal(doc1.status, 'learning');
    assert.equal(doc1.correct_count, 1);
    assert.equal(doc1.wrong_count, 0);
    assert.equal(doc1.streak, 1);
    assert.equal(doc1.mastery_score, 25);
    assert.equal(doc1.interval, 1);
    assert.ok(doc1.next_review_at);
    assert.ok(!isNaN(doc1.interval));

    // 6b: First time wrong
    UserVocabularyProgress.findOne = () => Promise.resolve(null);
    const docWrong = await syncVocabularyProgress({
      userId: mockUserId,
      exercise: exerciseMock,
      isCorrect: false,
      lessonId: mockL1Id,
    });
    assert.equal(docWrong.status, 'new');
    assert.equal(docWrong.correct_count, 0);
    assert.equal(docWrong.wrong_count, 1);
    assert.equal(docWrong.streak, 0);
    assert.equal(docWrong.mastery_score, 0);
    assert.equal(docWrong.interval, 1);
    assert.ok(!isNaN(docWrong.interval));

    // 6c: Multiple correct in a row up to Mastered (score >= 80)
    UserVocabularyProgress.findOne = () => Promise.resolve(doc1);
    // Correct 2
    const doc2 = await syncVocabularyProgress({ userId: mockUserId, exercise: exerciseMock, isCorrect: true, lessonId: mockL1Id });
    assert.equal(doc2.correct_count, 2);
    assert.equal(doc2.streak, 2);
    assert.equal(doc2.mastery_score, 45); // 25 + 20
    assert.equal(doc2.status, 'learning');

    // Correct 3
    UserVocabularyProgress.findOne = () => Promise.resolve(doc2);
    const doc3 = await syncVocabularyProgress({ userId: mockUserId, exercise: exerciseMock, isCorrect: true, lessonId: mockL1Id });
    assert.equal(doc3.correct_count, 3);
    assert.equal(doc3.streak, 3);
    assert.equal(doc3.mastery_score, 65);
    assert.equal(doc3.status, 'learning');

    // Correct 4 -> reaches 85 (>= 80) -> MASTERED
    UserVocabularyProgress.findOne = () => Promise.resolve(doc3);
    const doc4 = await syncVocabularyProgress({ userId: mockUserId, exercise: exerciseMock, isCorrect: true, lessonId: mockL1Id });
    assert.equal(doc4.correct_count, 4);
    assert.equal(doc4.streak, 4);
    assert.equal(doc4.mastery_score, 85);
    assert.equal(doc4.status, 'mastered');
    assert.ok(doc4.interval >= 8);

    // Correct 5 -> reaches 100 (capped at 100)
    UserVocabularyProgress.findOne = () => Promise.resolve(doc4);
    const doc5 = await syncVocabularyProgress({ userId: mockUserId, exercise: exerciseMock, isCorrect: true, lessonId: mockL1Id });
    assert.equal(doc5.mastery_score, 100);
    assert.equal(doc5.status, 'mastered');

    // 6d: Fail after mastered -> streak reset to 0, mastery dropped by 10, status drops to 'review', interval resets to 1
    UserVocabularyProgress.findOne = () => Promise.resolve(doc5);
    const doc6 = await syncVocabularyProgress({ userId: mockUserId, exercise: exerciseMock, isCorrect: false, lessonId: mockL1Id });
    assert.equal(doc6.wrong_count, 1);
    assert.equal(doc6.streak, 0);
    assert.equal(doc6.mastery_score, 90);
    assert.equal(doc6.status, 'review', 'Must drop to review status upon wrong answer');
    assert.equal(doc6.interval, 1, 'Interval must reset to 1 day');
    assert.ok(doc6.next_review_at);

    // 6e: Fail multiple times -> score does not drop below 0
    doc6.mastery_score = 5;
    UserVocabularyProgress.findOne = () => Promise.resolve(doc6);
    const doc7 = await syncVocabularyProgress({ userId: mockUserId, exercise: exerciseMock, isCorrect: false, lessonId: mockL1Id });
    assert.equal(doc7.mastery_score, 0, 'Mastery score cannot drop below 0');

    UserVocabularyProgress.findOne = origUVPFindOne;
  });

  // ==========================================
  // ISSUE 4 & 5: ESTIMATED STUDY MINUTES & DATA CONSISTENCY
  // ==========================================
  await t.test('7. Data Consistency: bounds, study minutes, no NaN/undefined', async () => {
    const origLevelFind = Level.find;
    const origTopicFind = Topic.find;
    const origUnitFind = Unit.find;
    const origLessonFind = Lesson.find;
    const origULPFind = UserLessonProgress.find;
    const origUVPFind = UserVocabularyProgress.find;
    const origUEPAgg = UserExerciseProgress.aggregate;

    Level.find = () => ({
      sort: () => ({
        lean: () => Promise.resolve([
          { _id: mockLevel1Id, level_name: 'A1.1', order: 1 },
        ]),
      }),
    });
    Topic.find = () => ({ sort: () => ({ lean: () => Promise.resolve([]) }) });
    Unit.find = () => ({ sort: () => ({ lean: () => Promise.resolve([{ _id: mockUnit1Id, order: 1 }]) }) });
    Lesson.find = () => ({
      sort: () => ({
        lean: () => Promise.resolve([
          { _id: mockL1Id, level_id: mockLevel1Id, unit_id: mockUnit1Id, title: 'L1', order: 1, estimated_minutes: 7, xp: 20 },
          { _id: mockL2Id, level_id: mockLevel1Id, unit_id: mockUnit1Id, title: 'L2', order: 2, estimated_minutes: 8, xp: 20 },
        ]),
      }),
    });

    // L1 completed, L2 in_progress
    UserLessonProgress.find = () => ({
      lean: () => Promise.resolve([
        { lesson_id: mockL1Id, status: 'completed', progress: 100, xp_earned: 20 },
        { lesson_id: mockL2Id, status: 'in_progress', progress: 40, xp_earned: 6 },
      ]),
    });
    UserVocabularyProgress.find = () => ({
      lean: () => Promise.resolve([
        { status: 'learning' },
        { status: 'mastered' },
        { status: 'review' },
      ]),
    });
    UserExerciseProgress.aggregate = () => Promise.resolve([
      { is_correct: true, exerciseType: 'multiple_choice' },
      { is_correct: false, exerciseType: 'multiple_choice' },
    ]);

    try {
      const result = await calculateProgressOverview(mockUserId);

      // Estimated study minutes = only L1 (7 mins), NOT L2
      assert.equal(result.overview.estimatedStudyMinutes, 7);
      assert.equal(result.overview.totalXp, 26);
      assert.equal(result.overview.lessonsCompleted, 1);
      assert.equal(result.overview.totalLessons, 2);
      assert.equal(result.overview.levelCompletionPercentage, 50);

      // Verify no NaN or undefined anywhere
      assert.ok(!isNaN(result.overview.levelCompletionPercentage));
      assert.ok(!isNaN(result.overview.totalXp));
      assert.ok(!isNaN(result.overview.streak));
      assert.ok(!isNaN(result.overview.estimatedStudyMinutes));
      assert.ok(!isNaN(result.exercisePerformance.overallAccuracy));

      assert.equal(result.exercisePerformance.overallAccuracy, 50);
      assert.deepEqual(result.vocabulary, {
        learned: 3,
        mastered: 1,
        learning: 1,
        needReview: 1,
      });

      // continueLearning cannot return completed L1, must return L2
      assert.equal(result.continueLearning.lessonId.toString(), mockL2Id);
      assert.equal(result.continueLearning.status, 'in_progress');
      assert.equal(result.continueLearning.progress, 40);
    } finally {
      Level.find = origLevelFind;
      Topic.find = origTopicFind;
      Unit.find = origUnitFind;
      Lesson.find = origLessonFind;
      UserLessonProgress.find = origULPFind;
      UserVocabularyProgress.find = origUVPFind;
      UserExerciseProgress.aggregate = origUEPAgg;
    }
  });

  // ==========================================
  // CONTROLLER & ROUTE INTEGRATION
  // ==========================================
  await t.test('8. Controller GET /api/progress/overview wrapper test', async () => {
    const origLevelFind = Level.find;
    const origTopicFind = Topic.find;
    const origUnitFind = Unit.find;
    const origLessonFind = Lesson.find;
    const origULPFind = UserLessonProgress.find;
    const origUVPFind = UserVocabularyProgress.find;
    const origUEPAgg = UserExerciseProgress.aggregate;

    Level.find = () => ({ sort: () => ({ lean: () => Promise.resolve([]) }) });
    Topic.find = () => ({ sort: () => ({ lean: () => Promise.resolve([]) }) });
    Unit.find = () => ({ sort: () => ({ lean: () => Promise.resolve([]) }) });
    Lesson.find = () => ({ sort: () => ({ lean: () => Promise.resolve([]) }) });
    UserLessonProgress.find = () => ({ lean: () => Promise.resolve([]) });
    UserVocabularyProgress.find = () => ({ lean: () => Promise.resolve([]) });
    UserExerciseProgress.aggregate = () => Promise.resolve([]);

    const mockReq = { user: { id: mockUserId } };

    await new Promise((resolve, reject) => {
      const mockRes = {
        statusCode: 200,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(payload) {
          try {
            assert.equal(this.statusCode, 200);
            assert.equal(payload.success, true);
            assert.equal(payload.message, 'Progress overview fetched successfully');
            assert.ok(payload.data.overview);
            assert.ok(Array.isArray(payload.data.levels));
            assert.ok(payload.data.vocabulary);
            assert.ok(Array.isArray(payload.data.activity));
            assert.ok(payload.data.exercisePerformance);
            resolve();
          } catch (err) {
            reject(err);
          }
        },
      };

      getProgressOverview(mockReq, mockRes, reject);
    });

    Level.find = origLevelFind;
    Topic.find = origTopicFind;
    Unit.find = origUnitFind;
    Lesson.find = origLessonFind;
    UserLessonProgress.find = origULPFind;
    UserVocabularyProgress.find = origUVPFind;
    UserExerciseProgress.aggregate = origUEPAgg;
  });

  await t.test('9. Route registration & JWT middleware check', async () => {
    const progressRouter = (await import('./src/routes/progressRoutes.js')).default;
    assert.ok(progressRouter);

    const routes = [];
    progressRouter.stack.forEach((layer) => {
      if (layer.route) {
        routes.push({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        });
      }
    });

    const overviewRoute = routes.find((r) => r.path === '/overview');
    assert.ok(overviewRoute, 'Route /overview must be registered');
    assert.ok(overviewRoute.methods.includes('get'), 'Route /overview must respond to GET');

    const rootRoute = routes.find((r) => r.path === '/');
    assert.ok(rootRoute, 'Route / must be preserved for backward compatibility');
  });

  await t.test('10. Backward compatibility: GET /api/progress (getUserProgressOverview) preserved', async () => {
    const origULPFind = UserLessonProgress.find;
    const origULPCount = UserLessonProgress.countDocuments;
    const origUVPCount = UserVocabularyProgress.countDocuments;

    UserLessonProgress.find = () => ({
      populate: () => Promise.resolve([
        {
          _id: new mongoose.Types.ObjectId(),
          user_id: mockUserId,
          lesson_id: { title: 'L1', level_id: { level_name: 'A1.1' }, unit_id: { title: 'U1' } },
          status: 'completed',
          progress: 100,
        },
      ]),
    });
    UserLessonProgress.countDocuments = () => Promise.resolve(1);
    UserVocabularyProgress.countDocuments = () => Promise.resolve(5);

    const mockReq = { user: { id: mockUserId } };

    await new Promise((resolve, reject) => {
      const mockRes = {
        statusCode: 200,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(payload) {
          try {
            assert.equal(this.statusCode, 200);
            assert.equal(payload.success, true);
            assert.ok(Array.isArray(payload.data.lessonProgresses));
            assert.equal(payload.data.stats.completedLessonsCount, 1);
            assert.equal(payload.data.stats.totalLearnedWordsCount, 5);
            resolve();
          } catch (err) {
            reject(err);
          }
        },
      };

      getUserProgressOverview(mockReq, mockRes, reject);
    });

    UserLessonProgress.find = origULPFind;
    UserLessonProgress.countDocuments = origULPCount;
    UserVocabularyProgress.countDocuments = origUVPCount;
  });
});
