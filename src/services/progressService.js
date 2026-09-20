import mongoose from 'mongoose';
import Level from '../models/Level.js';
import Topic from '../models/Topic.js';
import Unit from '../models/Unit.js';
import Lesson from '../models/Lesson.js';
import UserLessonProgress from '../models/UserLessonProgress.js';
import UserExerciseProgress from '../models/UserExerciseProgress.js';
import UserVocabularyProgress from '../models/UserVocabularyProgress.js';

export const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh';

/**
 * Format a Date object to YYYY-MM-DD string in a specific timezone (defaults to Asia/Ho_Chi_Minh)
 * @param {Date|string|number} date
 * @param {string} [timeZone]
 * @returns {string}
 */
export const formatDateStr = (date, timeZone = DEFAULT_TIMEZONE) => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
};

/**
 * Calculate user daily learning streak from activity dates
 * @param {Set<string>} uniqueDatesSet - Set of 'YYYY-MM-DD' dates
 * @param {string} [timeZone]
 * @returns {number}
 */
export const calculateStreak = (uniqueDatesSet, timeZone = DEFAULT_TIMEZONE) => {
  if (!uniqueDatesSet || uniqueDatesSet.size === 0) return 0;

  const now = new Date();
  const todayStr = formatDateStr(now, timeZone);

  const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = formatDateStr(yesterdayDate, timeZone);

  const hasToday = uniqueDatesSet.has(todayStr);
  const hasYesterday = uniqueDatesSet.has(yesterdayStr);

  // If user didn't study today or yesterday, streak is broken
  if (!hasToday && !hasYesterday) {
    return 0;
  }

  // If user studied today, count backwards starting from today;
  // If not yet studied today, but studied yesterday, count backwards starting from yesterday.
  let checkTime = hasToday ? now.getTime() : yesterdayDate.getTime();
  let streak = 0;

  while (true) {
    const dateStr = formatDateStr(new Date(checkTime), timeZone);
    if (uniqueDatesSet.has(dateStr)) {
      streak += 1;
      checkTime -= 24 * 60 * 60 * 1000;
    } else {
      break;
    }
  }

  return Math.max(0, streak);
};

/**
 * Sync vocabulary progress when user submits an exercise attached to a vocabulary
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.userId
 * @param {Object} params.exercise
 * @param {boolean} params.isCorrect
 * @param {string|mongoose.Types.ObjectId} [params.lessonId]
 */
export const syncVocabularyProgress = async ({ userId, exercise, isCorrect, lessonId }) => {
  if (!exercise || !exercise.vocabulary_id) {
    return null;
  }

  const vocabId = exercise.vocabulary_id;
  const targetLessonId = lessonId || exercise.lesson_id || null;

  let vocabProg = await UserVocabularyProgress.findOne({
    user_id: userId,
    vocabulary_id: vocabId,
  });

  const now = new Date();

  if (!vocabProg) {
    const initialScore = isCorrect ? 25 : 0;
    const initialStreak = isCorrect ? 1 : 0;
    const nextReview = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    vocabProg = new UserVocabularyProgress({
      user_id: userId,
      vocabulary_id: vocabId,
      lesson_id: targetLessonId,
      status: isCorrect ? 'learning' : 'new',
      mastery_score: initialScore,
      correct_count: isCorrect ? 1 : 0,
      wrong_count: isCorrect ? 0 : 1,
      streak: initialStreak,
      interval: 1,
      last_reviewed_at: now,
      next_review_at: nextReview,
    });
  } else {
    if (isCorrect) {
      vocabProg.correct_count = (vocabProg.correct_count || 0) + 1;
      vocabProg.streak = (vocabProg.streak || 0) + 1;
      vocabProg.mastery_score = Math.min(100, Math.max(0, (vocabProg.mastery_score || 0) + 20));

      if (vocabProg.mastery_score >= 80) {
        vocabProg.status = 'mastered';
      } else {
        vocabProg.status = 'learning';
      }

      // Interval expands based on streak: 1, 2, 4, 8, 16, 30 days
      const streakVal = vocabProg.streak || 0;
      const daysToAdd = Math.max(1, Math.min(30, Math.pow(2, Math.min(streakVal - 1, 5))));
      vocabProg.interval = daysToAdd;
      vocabProg.next_review_at = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    } else {
      vocabProg.wrong_count = (vocabProg.wrong_count || 0) + 1;
      vocabProg.streak = 0;
      vocabProg.mastery_score = Math.max(0, Math.min(100, (vocabProg.mastery_score || 0) - 10));

      // Wrong answer drops word to review status
      vocabProg.status = 'review';
      vocabProg.interval = 1;
      vocabProg.next_review_at = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }

    vocabProg.last_reviewed_at = now;

    if (!vocabProg.lesson_id && targetLessonId) {
      vocabProg.lesson_id = targetLessonId;
    }
  }

  await vocabProg.save();
  return vocabProg;
};

/**
 * Calculate Progress Overview for authenticated user
 * @param {string|mongoose.Types.ObjectId} userId
 * @returns {Promise<Object>}
 */
export const calculateProgressOverview = async (userId) => {
  const userObjectId = new mongoose.Types.ObjectId(userId);

  // 1. Fetch Levels sorted by order ASC
  const levels = await Level.find().sort({ order: 1 }).lean();

  // 2. Fetch Topics and Units to map hierarchy
  const [topics, units] = await Promise.all([
    Topic.find({ isActive: { $ne: false } }).sort({ order: 1 }).lean(),
    Unit.find({ status: 'published' }).sort({ order: 1 }).lean(),
  ]);

  const topicMap = new Map();
  topics.forEach((t) => topicMap.set(t._id.toString(), t));

  const unitMap = new Map();
  units.forEach((u) => unitMap.set(u._id.toString(), u));

  // 3. Fetch all Published Lessons sorted by order ASC
  const publishedLessons = await Lesson.find({ status: 'published' })
    .sort({ order: 1 })
    .lean();

  const publishedLessonMap = new Map();
  publishedLessons.forEach((les) => {
    if (!les.level_id && les.unit_id) {
      const u = unitMap.get(les.unit_id.toString());
      if (u && u.level_id) {
        les.level_id = u.level_id;
      }
    }
    publishedLessonMap.set(les._id.toString(), les);
  });

  // 4. Fetch User Lesson Progresses
  const userLessonProgresses = await UserLessonProgress.find({ user_id: userObjectId }).lean();

  const lessonProgressMap = new Map();
  let totalXp = 0;

  const completedLessonIds = new Set();
  const activityDatesSet = new Set();
  const lessonsCompletedByDate = new Map();

  userLessonProgresses.forEach((ulp) => {
    const lIdStr = ulp.lesson_id ? ulp.lesson_id.toString() : '';
    lessonProgressMap.set(lIdStr, ulp);
    totalXp += Math.max(0, ulp.xp_earned || 0);

    if (ulp.status === 'completed' || (ulp.progress !== undefined && ulp.progress >= 100)) {
      completedLessonIds.add(lIdStr);
      if (ulp.completed_at || ulp.updatedAt) {
        const dStr = formatDateStr(ulp.completed_at || ulp.updatedAt, DEFAULT_TIMEZONE);
        activityDatesSet.add(dStr);
        lessonsCompletedByDate.set(dStr, (lessonsCompletedByDate.get(dStr) || 0) + 1);
      }
    } else if (ulp.status === 'in_progress') {
      if (ulp.updatedAt) {
        activityDatesSet.add(formatDateStr(ulp.updatedAt, DEFAULT_TIMEZONE));
      }
    }
  });

  // 5. Sequence all published lessons strictly according to Learning Path order:
  // Level.order ASC -> Unit.order ASC -> Lesson.order ASC
  const sortedPublishedLessons = [...publishedLessons].sort((a, b) => {
    const lvlA = levels.find((l) => l._id.toString() === (a.level_id ? a.level_id.toString() : ''));
    const lvlB = levels.find((l) => l._id.toString() === (b.level_id ? b.level_id.toString() : ''));
    const lvlOrderA = lvlA ? lvlA.order : 0;
    const lvlOrderB = lvlB ? lvlB.order : 0;
    if (lvlOrderA !== lvlOrderB) return lvlOrderA - lvlOrderB;

    const unitA = a.unit_id ? unitMap.get(a.unit_id.toString()) : null;
    const unitB = b.unit_id ? unitMap.get(b.unit_id.toString()) : null;
    const unitOrderA = unitA ? unitA.order : 0;
    const unitOrderB = unitB ? unitB.order : 0;
    if (unitOrderA !== unitOrderB) return unitOrderA - unitOrderB;

    return (a.order || 0) - (b.order || 0);
  });

  // Find first uncompleted published lesson in canonical curriculum sequence
  let firstIncompleteLesson = null;
  for (const les of sortedPublishedLessons) {
    if (!completedLessonIds.has(les._id.toString())) {
      firstIncompleteLesson = les;
      break;
    }
  }

  // 6. Calculate Level Progress List
  // Map published lessons by level_id
  const lessonsByLevel = new Map();
  levels.forEach((lvl) => lessonsByLevel.set(lvl._id.toString(), []));

  publishedLessons.forEach((les) => {
    const lvlKey = les.level_id ? les.level_id.toString() : '';
    if (lessonsByLevel.has(lvlKey)) {
      lessonsByLevel.get(lvlKey).push(les);
    }
  });

  const levelProgressList = [];
  levels.forEach((lvl) => {
    const lvlIdStr = lvl._id.toString();
    const lvLessons = lessonsByLevel.get(lvlIdStr) || [];
    const totalLevelLessons = lvLessons.length;
    let completedLevelLessons = 0;

    lvLessons.forEach((les) => {
      if (completedLessonIds.has(les._id.toString())) {
        completedLevelLessons += 1;
      }
    });

    completedLevelLessons = Math.min(totalLevelLessons, Math.max(0, completedLevelLessons));

    const completionPercentage = totalLevelLessons > 0
      ? Math.min(100, Math.max(0, Math.round((completedLevelLessons / totalLevelLessons) * 100)))
      : 0;

    levelProgressList.push({
      _id: lvl._id,
      level_name: lvl.level_name,
      order: lvl.order,
      totalLessons: totalLevelLessons,
      completedLessons: completedLevelLessons,
      completionPercentage,
      isCurrent: false,
    });
  });

  // Determine currentLevel according to Learning Path progression:
  // If there is an incomplete lesson in curriculum -> currentLevel is the level containing that lesson
  // If all lessons in curriculum are completed -> currentLevel is the last level (100% completed)
  let currentLevelId = null;
  if (firstIncompleteLesson && firstIncompleteLesson.level_id) {
    currentLevelId = firstIncompleteLesson.level_id.toString();
  } else if (levels.length > 0) {
    currentLevelId = levels[levels.length - 1]._id.toString();
  }

  let currentLevelObj = null;
  let currentLevelCompletionPercentage = 0;

  levelProgressList.forEach((lvlProg) => {
    if (currentLevelId && lvlProg._id.toString() === currentLevelId) {
      lvlProg.isCurrent = true;
      currentLevelObj = {
        _id: lvlProg._id,
        level_name: lvlProg.level_name,
        order: lvlProg.order,
      };
      currentLevelCompletionPercentage = lvlProg.completionPercentage;
    }
  });

  // Fallback if currentLevelObj still not matched
  if (!currentLevelObj && levels.length > 0) {
    currentLevelObj = {
      _id: levels[0]._id,
      level_name: levels[0].level_name,
      order: levels[0].order,
    };
    levelProgressList[0].isCurrent = true;
    currentLevelCompletionPercentage = levelProgressList[0].completionPercentage;
  }

  // 7. Continue Learning:
  // If all lessons completed: null.
  // Otherwise:
  // Within the current active level, if user has an in_progress lesson (that is not completed), pick it.
  // Otherwise, use firstIncompleteLesson.
  let continueLearning = null;

  if (firstIncompleteLesson) {
    let targetLesson = firstIncompleteLesson;
    const activeLevelIdStr = firstIncompleteLesson.level_id ? firstIncompleteLesson.level_id.toString() : '';

    // Check if user has an in_progress lesson in this active level
    const inProgressInActiveLevel = userLessonProgresses
      .filter((ulp) => {
        if (ulp.status !== 'in_progress') return false;
        const lDoc = publishedLessonMap.get(ulp.lesson_id ? ulp.lesson_id.toString() : '');
        return lDoc && lDoc.level_id && lDoc.level_id.toString() === activeLevelIdStr && !completedLessonIds.has(lDoc._id.toString());
      })
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));

    if (inProgressInActiveLevel.length > 0) {
      const activeProgLesson = publishedLessonMap.get(inProgressInActiveLevel[0].lesson_id.toString());
      if (activeProgLesson) {
        targetLesson = activeProgLesson;
      }
    }

    const uDoc = targetLesson.unit_id ? unitMap.get(targetLesson.unit_id.toString()) : null;
    const tDoc = uDoc && uDoc.topic_id ? topicMap.get(uDoc.topic_id.toString()) : null;
    const lvlDoc = levels.find((l) => l._id.toString() === (targetLesson.level_id ? targetLesson.level_id.toString() : ''));
    const existingProg = lessonProgressMap.get(targetLesson._id.toString());

    continueLearning = {
      lessonId: targetLesson._id,
      lessonTitle: targetLesson.title,
      unitId: uDoc ? uDoc._id : null,
      unitTitle: uDoc ? uDoc.title : '',
      topicId: tDoc ? tDoc._id : null,
      topicTitle: tDoc ? (tDoc.name || tDoc.topic_name) : '',
      levelId: lvlDoc ? lvlDoc._id : targetLesson.level_id,
      levelName: lvlDoc ? lvlDoc.level_name : '',
      progress: existingProg ? Math.min(100, Math.max(0, existingProg.progress || 0)) : 0,
      status: existingProg && existingProg.status === 'in_progress' ? 'in_progress' : 'not_started',
    };
  }

  // 8. Estimated Study Minutes
  let estimatedStudyMinutes = 0;
  publishedLessons.forEach((les) => {
    if (completedLessonIds.has(les._id.toString())) {
      estimatedStudyMinutes += les.estimated_minutes !== undefined ? Math.max(0, les.estimated_minutes) : 5;
    }
  });

  // 9. Vocabulary Progress Aggregation
  const now = new Date();
  const userVocabProgresses = await UserVocabularyProgress.find({ user_id: userObjectId }).lean();

  let vocabLearned = 0;
  let vocabMastered = 0;
  let vocabLearning = 0;
  let vocabNeedReview = 0;

  userVocabProgresses.forEach((vp) => {
    if (vp.status !== 'new') {
      vocabLearned += 1;
    }
    if (vp.status === 'mastered') {
      vocabMastered += 1;
    } else if (vp.status === 'learning') {
      vocabLearning += 1;
    }

    const isNextReviewDue = vp.next_review_at && new Date(vp.next_review_at) <= now;
    if (vp.status === 'review' || isNextReviewDue) {
      vocabNeedReview += 1;
    }
  });

  // 10. Exercise Performance & Activity Aggregation
  const exerciseAggregation = await UserExerciseProgress.aggregate([
    { $match: { user_id: userObjectId } },
    {
      $lookup: {
        from: 'exercises',
        localField: 'exercise_id',
        foreignField: '_id',
        as: 'exerciseInfo',
      },
    },
    { $unwind: { path: '$exerciseInfo', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        is_correct: 1,
        attempts: 1,
        createdAt: 1,
        exerciseType: '$exerciseInfo.type',
      },
    },
  ]);

  let totalAttempted = exerciseAggregation.length;
  let totalCorrect = 0;
  const byTypeMap = {};
  const exercisesByDate = new Map();

  exerciseAggregation.forEach((item) => {
    if (item.is_correct) {
      totalCorrect += 1;
    }

    if (item.createdAt) {
      const dStr = formatDateStr(item.createdAt, DEFAULT_TIMEZONE);
      activityDatesSet.add(dStr);
      exercisesByDate.set(dStr, (exercisesByDate.get(dStr) || 0) + 1);
    }

    const exType = item.exerciseType;
    if (exType) {
      if (!byTypeMap[exType]) {
        byTypeMap[exType] = { total: 0, correct: 0 };
      }
      byTypeMap[exType].total += 1;
      if (item.is_correct) {
        byTypeMap[exType].correct += 1;
      }
    }
  });

  const overallAccuracy = totalAttempted > 0
    ? Math.min(100, Math.max(0, Math.round((totalCorrect / totalAttempted) * 100)))
    : 0;

  const byType = {};
  for (const [tKey, tVal] of Object.entries(byTypeMap)) {
    byType[tKey] = {
      total: Math.max(0, tVal.total),
      correct: Math.max(0, tVal.correct),
      accuracy: tVal.total > 0 ? Math.min(100, Math.max(0, Math.round((tVal.correct / tVal.total) * 100))) : 0,
    };
  }

  // 11. Streak Calculation (in Asia/Ho_Chi_Minh)
  const streak = calculateStreak(activityDatesSet, DEFAULT_TIMEZONE);

  // 12. Activity (last 30 days)
  const thirtyDaysAgoDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgoStr = formatDateStr(thirtyDaysAgoDate, DEFAULT_TIMEZONE);

  const allActivityDates = Array.from(activityDatesSet)
    .filter((dStr) => dStr >= thirtyDaysAgoStr)
    .sort();

  const activity = allActivityDates.map((dStr) => ({
    date: dStr,
    exercisesCount: Math.max(0, exercisesByDate.get(dStr) || 0),
    lessonsCompleted: Math.max(0, lessonsCompletedByDate.get(dStr) || 0),
  }));

  // 13. Total lessons summary
  const totalLessons = publishedLessons.length;
  let lessonsCompleted = 0;
  publishedLessons.forEach((les) => {
    if (completedLessonIds.has(les._id.toString())) {
      lessonsCompleted += 1;
    }
  });
  lessonsCompleted = Math.min(totalLessons, Math.max(0, lessonsCompleted));

  return {
    overview: {
      currentLevel: currentLevelObj || {},
      levelCompletionPercentage: Math.min(100, Math.max(0, currentLevelCompletionPercentage)),
      lessonsCompleted,
      totalLessons,
      totalXp: Math.max(0, totalXp),
      streak: Math.max(0, streak),
      estimatedStudyMinutes: Math.max(0, estimatedStudyMinutes),
    },
    continueLearning,
    levels: levelProgressList,
    vocabulary: {
      learned: Math.max(0, vocabLearned),
      mastered: Math.max(0, vocabMastered),
      learning: Math.max(0, vocabLearning),
      needReview: Math.max(0, vocabNeedReview),
    },
    activity,
    exercisePerformance: {
      totalAttempted: Math.max(0, totalAttempted),
      totalCorrect: Math.max(0, totalCorrect),
      overallAccuracy,
      byType,
    },
  };
};

export default {
  DEFAULT_TIMEZONE,
  formatDateStr,
  calculateStreak,
  syncVocabularyProgress,
  calculateProgressOverview,
};
