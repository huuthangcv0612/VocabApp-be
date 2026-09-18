import mongoose from 'mongoose';
import 'dotenv/config';
import connectDB from '../config/db.js';
import Lektion from '../models/Lektion.js';
import Unit from '../models/Unit.js';
import Lesson from '../models/Lesson.js';
import LessonVocabulary from '../models/LessonVocabulary.js';
import Vocabulary from '../models/Vocabulary.js';

export const migrateLektionsToUnits = async () => {
  console.log('🚀 Starting Migration: Lektions -> Units & Lessons...');

  const lektions = await Lektion.find({});
  console.log(`Found ${lektions.length} lektion(s) to process.`);

  let unitsCreated = 0;
  let lessonsCreated = 0;
  let vocabLinksCreated = 0;

  for (const lektion of lektions) {
    // 1. Create or find corresponding Unit
    let unit = await Unit.findOne({
      topic_id: lektion.topic_id,
      title: lektion.lektion_name,
    });

    if (!unit) {
      unit = await Unit.create({
        topic_id: lektion.topic_id,
        title: lektion.lektion_name,
        slug: lektion.slug || lektion.lektion_name.toLowerCase().replace(/\s+/g, '-'),
        description: lektion.description || '',
        order: lektion.order || 1,
        status: 'published',
      });
      unitsCreated++;
    }

    // 2. Create or find default Lesson inside Unit
    let lesson = await Lesson.findOne({
      unit_id: unit._id,
      title: lektion.lektion_name,
    });

    if (!lesson) {
      lesson = await Lesson.create({
        unit_id: unit._id,
        title: lektion.lektion_name,
        slug: lektion.slug || lektion.lektion_name.toLowerCase().replace(/\s+/g, '-'),
        description: lektion.description || '',
        order: 1,
        status: 'published',
        estimated_minutes: 5,
        xp: 20,
      });
      lessonsCreated++;
    }

    // 3. Find vocabularies linked to this lektion and associate via LessonVocabulary
    const vocabularies = await Vocabulary.find({
      $or: [{ lektionId: lektion._id }, { lektion_id: lektion._id }],
    });

    for (let index = 0; index < vocabularies.length; index++) {
      const vocab = vocabularies[index];
      const existingLink = await LessonVocabulary.findOne({
        lesson_id: lesson._id,
        vocabulary_id: vocab._id,
      });

      if (!existingLink) {
        await LessonVocabulary.create({
          lesson_id: lesson._id,
          vocabulary_id: vocab._id,
          order: index + 1,
          is_new: true,
        });
        vocabLinksCreated++;
      }
    }
  }

  console.log('✅ Migration completed successfully!');
  console.log(`- Units created: ${unitsCreated}`);
  console.log(`- Lessons created: ${lessonsCreated}`);
  console.log(`- LessonVocabulary links created: ${vocabLinksCreated}`);

  return { unitsCreated, lessonsCreated, vocabLinksCreated };
};

// Executable if run directly via CLI
if (process.argv[1] && process.argv[1].endsWith('migrateLektionsToUnits.js')) {
  (async () => {
    try {
      await connectDB();
      await migrateLektionsToUnits();
      await mongoose.connection.close();
      process.exit(0);
    } catch (err) {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    }
  })();
}
