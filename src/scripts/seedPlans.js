import 'dotenv/config';
import connectDB from '../config/db.js';
import Plan from '../models/Plan.js';

const initialPlans = [
  {
    name: 'Premium 1 tháng',
    code: 'PREMIUM_1_MONTH',
    price: 10000,
    durationDays: 30,
    description: 'Truy cập toàn bộ nội dung DeutschUp trong 1 tháng',
    features: [
      'Toàn bộ bài học & từ vựng',
      'Bài kiểm tra & Quiz không giới hạn',
      'Theo dõi tiến độ học chi tiết',
      'Hỗ trợ AI giải thích ngữ pháp',
    ],
    isActive: true,
    sortOrder: 1,
  },
  {
    name: 'Premium 6 tháng',
    code: 'PREMIUM_6_MONTHS',
    price: 50000,
    durationDays: 180,
    description: 'Truy cập toàn bộ nội dung DeutschUp trong 6 tháng (Tiết kiệm 16%)',
    features: [
      'Toàn bộ bài học & từ vựng',
      'Bài kiểm tra & Quiz không giới hạn',
      'Theo dõi tiến độ học chi tiết',
      'Hỗ trợ AI giải thích ngữ pháp',
      'Ưu đãi tiết kiệm chi phí',
    ],
    isActive: true,
    sortOrder: 2,
  },
  {
    name: 'Premium 1 năm',
    code: 'PREMIUM_1_YEAR',
    price: 90000,
    durationDays: 365,
    description: 'Truy cập toàn bộ nội dung DeutschUp trong 1 năm (Tiết kiệm 25%)',
    features: [
      'Toàn bộ bài học & từ vựng',
      'Bài kiểm tra & Quiz không giới hạn',
      'Theo dõi tiến độ học chi tiết',
      'Hỗ trợ AI giải thích ngữ pháp',
      'Tiết kiệm nhất',
    ],
    isActive: true,
    sortOrder: 3,
  },
];

const seedPlans = async () => {
  try {
    await connectDB();
    console.log('Connected to DB. Seeding plans...');

    for (const planData of initialPlans) {
      await Plan.findOneAndUpdate(
        { code: planData.code },
        planData,
        { upsert: true, new: true, runValidators: true }
      );
    }

    console.log('Plans seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding plans:', error);
    process.exit(1);
  }
};

seedPlans();
