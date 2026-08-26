import mongoose from 'mongoose';
import 'dotenv/config';
import connectDB from '../src/config/db.js';
import Lesson from '../src/models/Lesson.js';
import Unit from '../src/models/Unit.js';
import Topic from '../src/models/Topic.js';
import Lektion from '../src/models/Lektion.js';

export const migrateLessonLevels = async () => {
  console.log('==================================================');
  console.log('🚀 Starting Safe Lesson level_id Migration');
  console.log('==================================================');

  let totalLessons = 0;
  let alreadyMappedCount = 0;
  let mappedCount = 0;
  let unmappedCount = 0;
  const unmappedLessons = [];
  const errors = [];

  try {
    const lessons = await Lesson.find({});
    totalLessons = lessons.length;
    console.log(`Found ${totalLessons} Lesson(s) in database.`);

    for (const lesson of lessons) {
      try {
        if (lesson.level_id) {
          alreadyMappedCount++;
          continue;
        }

        let resolvedLevelId = null;

        // Strategy 1: Map via Lesson.unit_id -> Unit.topic_id -> Topic.level_id
        if (lesson.unit_id) {
          const unit = await Unit.findById(lesson.unit_id);
          if (unit && unit.topic_id) {
            const topic = await Topic.findById(unit.topic_id);
            if (topic && topic.level_id) {
              resolvedLevelId = topic.level_id;
            }
          }
        }

        // Strategy 2: If not found via Topic, try matching legacy Lektion
        if (!resolvedLevelId) {
          const lektion = await Lektion.findOne({
            $or: [
              { title: lesson.title },
              { lektion_name: lesson.title },
              { slug: lesson.slug },
            ],
          });
          if (lektion && lektion.level_id) {
            resolvedLevelId = lektion.level_id;
          }
        }

        if (resolvedLevelId) {
          lesson.level_id = resolvedLevelId;
          await lesson.save();
          mappedCount++;
        } else {
          unmappedCount++;
          unmappedLessons.push({
            _id: lesson._id.toString(),
            title: lesson.title,
            unit_id: lesson.unit_id ? lesson.unit_id.toString() : null,
          });
        }
      } catch (err) {
        console.error(`❌ Error migrating Lesson ID ${lesson._id}:`, err.message);
        errors.push({ lesson_id: lesson._id.toString(), error: err.message });
      }
    }

    console.log('==================================================');
    console.log('✅ Lesson Level Migration Summary:');
    console.log(`- Total lessons evaluated: ${totalLessons}`);
    console.log(`- Already mapped: ${alreadyMappedCount}`);
    console.log(`- Newly mapped level_id: ${mappedCount}`);
    console.log(`- Unmapped lessons (need manual mapping): ${unmappedCount}`);
    if (unmappedLessons.length > 0) {
      console.log('Unmapped lessons list:', JSON.stringify(unmappedLessons, null, 2));
    }
    console.log(`- Errors encountered: ${errors.length}`);
    console.log('==================================================');

    return {
      totalLessons,
      alreadyMappedCount,
      mappedCount,
      unmappedCount,
      unmappedLessons,
      errors,
    };
  } catch (error) {
    console.error('Fatal migration failure:', error);
    throw error;
  }
};

// Executable directly via `node scripts/migrate-lesson-levels.js`
if (process.argv[1] && process.argv[1].includes('migrate-lesson-levels.js')) {
  (async () => {
    try {
      await connectDB();
      await migrateLessonLevels();
      await mongoose.connection.close();
      process.exit(0);
    } catch (err) {
      console.error('Migration execution failed:', err);
      process.exit(1);
    }
  })();
}
