import 'dotenv/config';
import connectDB from '../config/db.js';
import Plan from '../models/Plan.js';

const initialPlans = [
  {
    name: 'Gói Miễn Phí',
    code: 'FREE',
    price: 0,
    durationDays: 0,
    description: 'Học tiếng Đức cơ bản miễn phí',
    features: [
      'Bài học & từ vựng cơ bản',
      'Bài kiểm tra & Quiz cơ bản',
      'Tham gia lớp học bằng mã lớp',
    ],
    permissions: [
      'basic_learning',
    ],
    planType: 'FREE',
    isActive: true,
    sortOrder: 0,
  },
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
    permissions: [
      'basic_learning',
      'ai_learning',
    ],
    planType: 'PREMIUM',
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
    permissions: [
      'basic_learning',
      'ai_learning',
    ],
    planType: 'PREMIUM',
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
    permissions: [
      'basic_learning',
      'ai_learning',
    ],
    planType: 'PREMIUM',
    isActive: true,
    sortOrder: 3,
  },
  {
    name: 'Custom Giáo viên & Tổ chức',
    code: 'CUSTOM_TEACHER',
    price: 200000,
    durationDays: 365,
    description: 'Dành cho giáo viên và tổ chức: Quản lý lớp học và Interactive Live Classes',
    features: [
      'Toàn bộ nội dung cơ bản',
      'Quản lý lớp học & danh sách học sinh',
      'Tạo Interactive Lessons & Từ vựng riêng',
      'Tổ chức Live Sessions tương tác (Flashcard, Quiz, Spin)',
      'Teacher Dashboard & Giám sát kết quả học sinh',
    ],
    permissions: [
      'basic_learning',
      'ai_learning',
      'class_management',
      'interactive_classes',
      'teacher_dashboard',
    ],
    planType: 'CUSTOM',
    isActive: true,
    sortOrder: 4,
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
