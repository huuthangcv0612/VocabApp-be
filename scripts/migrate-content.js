import mongoose from 'mongoose';
import 'dotenv/config';
import connectDB from '../src/config/db.js';
import Lektion from '../src/models/Lektion.js';
import Unit from '../src/models/Unit.js';
import Lesson from '../src/models/Lesson.js';
import LessonVocabulary from '../src/models/LessonVocabulary.js';
import Vocabulary from '../src/models/Vocabulary.js';

export const migrateContent = async () => {
  console.log('==================================================');
  console.log('🚀 Starting Content Migration (Lektions -> Units & Lessons)');
  console.log('==================================================');

  let unitsMigrated = 0;
  let lessonsMigrated = 0;
  let vocabRelationshipsMigrated = 0;
  const errors = [];

  try {
    const lektions = await Lektion.find({});
    console.log(`Found ${lektions.length} Lektion(s) to evaluate.`);

    for (const lektion of lektions) {
      try {
        const slug = lektion.slug || lektion.lektion_name.toLowerCase().trim().replace(/\s+/g, '-');

        // 1. Check duplicate Unit before insertion
        let unit = await Unit.findOne({
          topic_id: lektion.topic_id,
          $or: [{ title: lektion.lektion_name }, { slug }],
        });

        if (!unit) {
          unit = await Unit.create({
            topic_id: lektion.topic_id,
            title: lektion.lektion_name,
            slug,
            description: lektion.description || '',
            order: lektion.order || 1,
            status: 'published',
          });
          unitsMigrated++;
        }

        // 2. Check duplicate Lesson before insertion
        let lesson = await Lesson.findOne({
          unit_id: unit._id,
          $or: [{ title: lektion.lektion_name }, { slug }],
        });

        if (!lesson) {
          lesson = await Lesson.create({
            unit_id: unit._id,
            title: lektion.lektion_name,
            slug,
            description: lektion.description || '',
            order: 1,
            status: 'published',
            estimated_minutes: 5,
            xp: 20,
          });
          lessonsMigrated++;
        }

        // 3. Migrate Vocabulary references safely into LessonVocabulary
        const vocabularies = await Vocabulary.find({
          $or: [{ lektionId: lektion._id }, { lektion_id: lektion._id }],
        });

        for (let idx = 0; idx < vocabularies.length; idx++) {
          const vocab = vocabularies[idx];
          const existingRelation = await LessonVocabulary.findOne({
            lesson_id: lesson._id,
            vocabulary_id: vocab._id,
          });

          if (!existingRelation) {
            await LessonVocabulary.create({
              lesson_id: lesson._id,
              vocabulary_id: vocab._id,
              order: idx + 1,
              is_new: true,
            });
            vocabRelationshipsMigrated++;
          }
        }
      } catch (err) {
        console.error(`❌ Error migrating Lektion ID ${lektion._id}:`, err.message);
        errors.push({ lektion_id: lektion._id, error: err.message });
      }
    }

    console.log('==================================================');
    console.log('✅ Content Migration Summary:');
    console.log(`- Units migrated: ${unitsMigrated}`);
    console.log(`- Lessons migrated: ${lessonsMigrated}`);
    console.log(`- Vocabulary relationships migrated: ${vocabRelationshipsMigrated}`);
    console.log(`- Errors encountered: ${errors.length}`);
    console.log('==================================================');

    return {
      unitsMigrated,
      lessonsMigrated,
      vocabRelationshipsMigrated,
      errors,
    };
  } catch (error) {
    console.error('Fatal migration failure:', error);
    throw error;
  }
};

// Executable directly via `node scripts/migrate-content.js`
if (process.argv[1] && process.argv[1].includes('migrate-content.js')) {
  (async () => {
    try {
      await connectDB();
      await migrateContent();
      await mongoose.connection.close();
      process.exit(0);
    } catch (err) {
      console.error('Migration execution failed:', err);
      process.exit(1);
    }
  })();
}
