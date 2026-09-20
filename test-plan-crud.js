import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { EventEmitter } from 'events';

process.env.SKIP_DB_CONNECT = 'true';
process.env.JWT_SECRET = 'test_jwt_secret_key_plan_crud_12345';

const app = (await import('./src/app.js')).default;
const User = (await import('./src/models/User.js')).default;
const Plan = (await import('./src/models/Plan.js')).default;
const Order = (await import('./src/models/Order.js')).default;
const Payment = (await import('./src/models/Payment.js')).default;
const Subscription = (await import('./src/models/Subscription.js')).default;
const errorMiddleware = (await import('./src/middlewares/errorMiddleware.js')).default;

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
};

// In-memory collections
const db = {
  users: new Map(),
  plans: new Map(),
  orders: new Map(),
  payments: new Map(),
  subscriptions: new Map(),
};

function invokeRequest(app, { method, url, token, body = null }) {
  return new Promise((resolve, reject) => {
    const req = new EventEmitter();
    req.method = method.toUpperCase();
    req.url = url;
    req.headers = {
      'content-type': 'application/json',
    };
    if (token) {
      req.headers['authorization'] = `Bearer ${token}`;
    }
    req.cookies = {};

    let responseData = '';
    const res = new EventEmitter();
    res.statusCode = 200;
    res.headers = {};
    res.setHeader = (k, v) => {
      res.headers[k.toLowerCase()] = v;
    };
    res.removeHeader = (k) => {
      delete res.headers[k.toLowerCase()];
    };
    res.getHeader = (k) => res.headers[k.toLowerCase()];
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.json = (data) => {
      resolve({ status: res.statusCode, body: data, headers: res.headers });
    };
    res.send = (data) => {
      try {
        resolve({ status: res.statusCode, body: JSON.parse(data), headers: res.headers });
      } catch {
        resolve({ status: res.statusCode, body: data, headers: res.headers });
      }
    };
    res.end = (chunk) => {
      if (chunk) responseData += chunk;
      try {
        resolve({ status: res.statusCode, body: JSON.parse(responseData), headers: res.headers });
      } catch {
        resolve({ status: res.statusCode, body: responseData, headers: res.headers });
      }
    };

    if (body) {
      req.body = body;
    }

    try {
      app.handle(req, res, (err) => {
        if (err) {
          errorMiddleware(err, req, res, () => {});
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

const makeQuery = (result) => ({
  populate: function () {
    return makeQuery(result);
  },
  sort: function () {
    return makeQuery(result);
  },
  limit: function () {
    return makeQuery(result);
  },
  select: function () {
    return makeQuery(result);
  },
  then: function (resolve, reject) {
    return Promise.resolve(result).then(resolve, reject);
  },
  catch: function (reject) {
    return Promise.resolve(result).catch(reject);
  },
});

test('=== BACKEND PLAN AUDIT & VERIFICATION TEST SUITE ===', async (t) => {
  const adminId = new mongoose.Types.ObjectId().toString();
  const userId = new mongoose.Types.ObjectId().toString();

  const adminUser = {
    _id: new mongoose.Types.ObjectId(adminId),
    id: adminId,
    name: 'Admin User',
    email: 'admin@vocab.de',
    role: 'admin',
    isEmailVerified: true,
  };

  const regularUser = {
    _id: new mongoose.Types.ObjectId(userId),
    id: userId,
    name: 'Standard User',
    email: 'user@vocab.de',
    role: 'user',
    isEmailVerified: true,
  };

  db.users.set(adminId, adminUser);
  db.users.set(userId, regularUser);

  // Hook User.findById
  const origUserFindById = User.findById;
  User.findById = (id) => {
    const u = db.users.get(id?.toString()) || null;
    return makeQuery(u);
  };

  // Seed plans in-memory matching seedPlans.js exactly
  const initialSeededPlans = [
    {
      _id: new mongoose.Types.ObjectId(),
      name: 'Gói Miễn Phí',
      code: 'FREE',
      price: 0,
      durationDays: 0,
      description: 'Học tiếng Đức cơ bản miễn phí',
      features: ['Bài học & từ vựng cơ bản', 'Bài kiểm tra & Quiz cơ bản', 'Tham gia lớp học bằng mã lớp'],
      permissions: ['basic_learning'],
      planType: 'FREE',
      isActive: true,
      sortOrder: 0,
    },
    {
      _id: new mongoose.Types.ObjectId(),
      name: 'Premium 1 tháng',
      code: 'PREMIUM_1_MONTH',
      price: 10000,
      durationDays: 30,
      description: 'Truy cập toàn bộ nội dung DeutschUp trong 1 tháng',
      features: ['Toàn bộ bài học & từ vựng', 'Bài kiểm tra & Quiz không giới hạn', 'Hỗ trợ AI giải thích ngữ pháp'],
      permissions: ['basic_learning', 'ai_learning'],
      planType: 'PREMIUM',
      isActive: true,
      sortOrder: 1,
    },
    {
      _id: new mongoose.Types.ObjectId(),
      name: 'Premium 6 tháng',
      code: 'PREMIUM_6_MONTHS',
      price: 50000,
      durationDays: 180,
      description: 'Truy cập toàn bộ nội dung DeutschUp trong 6 tháng',
      features: ['Toàn bộ bài học & từ vựng', 'Ưu đãi tiết kiệm chi phí'],
      permissions: ['basic_learning', 'ai_learning'],
      planType: 'PREMIUM',
      isActive: true,
      sortOrder: 2,
    },
    {
      _id: new mongoose.Types.ObjectId(),
      name: 'Premium 1 năm',
      code: 'PREMIUM_1_YEAR',
      price: 90000,
      durationDays: 365,
      description: 'Truy cập toàn bộ nội dung DeutschUp trong 1 năm',
      features: ['Toàn bộ bài học & từ vựng', 'Tiết kiệm nhất'],
      permissions: ['basic_learning', 'ai_learning'],
      planType: 'PREMIUM',
      isActive: true,
      sortOrder: 3,
    },
    {
      _id: new mongoose.Types.ObjectId(),
      name: 'Custom Giáo viên & Tổ chức',
      code: 'CUSTOM_TEACHER',
      price: 200000,
      durationDays: 365,
      description: 'Dành cho giáo viên và tổ chức',
      features: ['Toàn bộ nội dung cơ bản', 'Quản lý lớp học & danh sách học sinh', 'Tổ chức Live Sessions tương tác'],
      permissions: ['basic_learning', 'ai_learning', 'class_management', 'interactive_classes', 'teacher_dashboard'],
      planType: 'CUSTOM',
      isActive: true,
      sortOrder: 4,
    },
  ];

  for (const p of initialSeededPlans) {
    db.plans.set(p._id.toString(), { ...p });
  }

  // Hook Plan methods
  const origPlanFind = Plan.find;
  const origPlanFindById = Plan.findById;
  const origPlanFindOne = Plan.findOne;
  const origPlanCreate = Plan.create;
  const origPlanFindByIdAndUpdate = Plan.findByIdAndUpdate;

  Plan.find = (query) => {
    let list = Array.from(db.plans.values());
    if (query?.isActive !== undefined) {
      list = list.filter((p) => p.isActive === query.isActive);
    }
    list.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || (a.price || 0) - (b.price || 0));
    return makeQuery(list);
  };

  Plan.findById = (id) => {
    const p = db.plans.get(id?.toString()) || null;
    return makeQuery(p);
  };

  Plan.findOne = (query) => {
    const list = Array.from(db.plans.values());
    if (query?.code) {
      const found = list.find((p) => p.code === query.code);
      return makeQuery(found || null);
    }
    if (query?._id) {
      const found = list.find((p) => p._id.toString() === query._id.toString());
      return makeQuery(found || null);
    }
    return makeQuery(null);
  };

  Plan.create = async (data) => {
    const doc = {
      _id: new mongoose.Types.ObjectId(),
      planType: 'PREMIUM', // schema default
      permissions: [],     // schema default
      features: [],        // schema default
      isActive: true,      // schema default
      sortOrder: 0,        // schema default
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    db.plans.set(doc._id.toString(), doc);
    return doc;
  };

  Plan.findByIdAndUpdate = async (id, update) => {
    const existing = db.plans.get(id?.toString());
    if (!existing) return null;
    const updated = {
      ...existing,
      ...update,
      updatedAt: new Date(),
    };
    db.plans.set(id.toString(), updated);
    return updated;
  };

  // Hook Subscription.findOne for Auth tests
  const origSubFindOne = Subscription.findOne;
  Subscription.findOne = (query) => {
    const sub = db.subscriptions.get(query?.userId?.toString()) || null;
    return makeQuery(sub);
  };

  // Hook Order.create and Payment.create
  const origOrderCreate = Order.create;
  const origPaymentCreate = Payment.create;
  Order.create = async (data) => {
    const doc = {
      _id: new mongoose.Types.ObjectId(),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    db.orders.set(doc._id.toString(), doc);
    return doc;
  };
  Payment.create = async (data) => {
    const doc = {
      _id: new mongoose.Types.ObjectId(),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    db.payments.set(doc._id.toString(), doc);
    return doc;
  };

  t.after(() => {
    User.findById = origUserFindById;
    Plan.find = origPlanFind;
    Plan.findById = origPlanFindById;
    Plan.findOne = origPlanFindOne;
    Plan.create = origPlanCreate;
    Plan.findByIdAndUpdate = origPlanFindByIdAndUpdate;
    Subscription.findOne = origSubFindOne;
    Order.create = origOrderCreate;
    Payment.create = origPaymentCreate;
  });

  const adminToken = generateToken(adminId);
  const userToken = generateToken(userId);

  // === 1. GET /api/plans ===
  await t.test('1. GET /api/plans returns all active plans with complete fields', async () => {
    const res = await invokeRequest(app, {
      method: 'GET',
      url: '/api/plans',
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data.plans));
    assert.equal(res.body.data.plans.length, 5);

    const plans = res.body.data.plans;

    // Check all required fields exist on every plan
    for (const p of plans) {
      assert.ok(p._id, `Plan ${p.code} missing _id`);
      assert.ok(p.name, `Plan ${p.code} missing name`);
      assert.ok(p.code, `Plan ${p.code} missing code`);
      assert.ok(p.planType, `Plan ${p.code} missing planType`);
      assert.ok(p.price !== undefined, `Plan ${p.code} missing price`);
      assert.ok(p.durationDays !== undefined, `Plan ${p.code} missing durationDays`);
      assert.ok(p.description !== undefined, `Plan ${p.code} missing description`);
      assert.ok(Array.isArray(p.features), `Plan ${p.code} features is not array`);
      assert.ok(Array.isArray(p.permissions), `Plan ${p.code} permissions is not array`);
    }

    // Verify FREE plan
    const freePlan = plans.find((p) => p.code === 'FREE');
    assert.ok(freePlan, 'FREE plan must exist');
    assert.equal(freePlan.planType, 'FREE');
    assert.equal(freePlan.price, 0);
    assert.equal(freePlan.durationDays, 0);
    assert.deepEqual(freePlan.permissions, ['basic_learning']);

    // Verify PREMIUM plans
    const prem1m = plans.find((p) => p.code === 'PREMIUM_1_MONTH');
    assert.ok(prem1m, 'PREMIUM_1_MONTH must exist');
    assert.equal(prem1m.planType, 'PREMIUM');
    assert.deepEqual(prem1m.permissions, ['basic_learning', 'ai_learning']);

    const prem6m = plans.find((p) => p.code === 'PREMIUM_6_MONTHS');
    assert.ok(prem6m, 'PREMIUM_6_MONTHS must exist');
    assert.equal(prem6m.planType, 'PREMIUM');
    assert.deepEqual(prem6m.permissions, ['basic_learning', 'ai_learning']);

    const prem1y = plans.find((p) => p.code === 'PREMIUM_1_YEAR');
    assert.ok(prem1y, 'PREMIUM_1_YEAR must exist');
    assert.equal(prem1y.planType, 'PREMIUM');
    assert.deepEqual(prem1y.permissions, ['basic_learning', 'ai_learning']);

    // Verify CUSTOM plan has all 5 permissions
    const customPlan = plans.find((p) => p.code === 'CUSTOM_TEACHER');
    assert.ok(customPlan, 'CUSTOM_TEACHER must exist');
    assert.equal(customPlan.planType, 'CUSTOM');
    assert.deepEqual(customPlan.permissions, [
      'basic_learning',
      'ai_learning',
      'class_management',
      'interactive_classes',
      'teacher_dashboard',
    ]);
  });

  // === 2. POST /api/plans (Admin Create Plan) ===
  await t.test('2.1 Admin creates FREE plan with planType FREE and durationDays 0', async () => {
    const res = await invokeRequest(app, {
      method: 'POST',
      url: '/api/plans',
      token: adminToken,
      body: {
        name: 'Test Free Tier',
        code: 'TEST_FREE',
        planType: 'FREE',
        price: 0,
        durationDays: 0,
        description: 'Test Free tier',
        features: ['Feature 1'],
        permissions: ['basic_learning'],
      },
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.plan.code, 'TEST_FREE');
    assert.equal(res.body.data.plan.planType, 'FREE');
    assert.equal(res.body.data.plan.price, 0);
    assert.equal(res.body.data.plan.durationDays, 0);
    assert.deepEqual(res.body.data.plan.permissions, ['basic_learning']);
  });

  await t.test('2.2 Admin creates CUSTOM plan with 5 permissions', async () => {
    const res = await invokeRequest(app, {
      method: 'POST',
      url: '/api/plans',
      token: adminToken,
      body: {
        name: 'Test Custom School',
        code: 'TEST_CUSTOM',
        planType: 'CUSTOM',
        price: 500000,
        durationDays: 365,
        description: 'Custom for School',
        features: ['Full Live Classes'],
        permissions: ['basic_learning', 'ai_learning', 'class_management', 'interactive_classes', 'teacher_dashboard'],
      },
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.plan.planType, 'CUSTOM');
    assert.deepEqual(res.body.data.plan.permissions, [
      'basic_learning',
      'ai_learning',
      'class_management',
      'interactive_classes',
      'teacher_dashboard',
    ]);
  });

  await t.test('2.3 Admin creates plan without planType -> defaults to PREMIUM', async () => {
    const res = await invokeRequest(app, {
      method: 'POST',
      url: '/api/plans',
      token: adminToken,
      body: {
        name: 'Test Default Premium',
        code: 'TEST_DEFAULT_PREM',
        price: 25000,
        durationDays: 60,
      },
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.plan.planType, 'PREMIUM');
    assert.deepEqual(res.body.data.plan.permissions, []);
  });

  await t.test('2.4 Admin rejects invalid planType with 400 Bad Request', async () => {
    const res = await invokeRequest(app, {
      method: 'POST',
      url: '/api/plans',
      token: adminToken,
      body: {
        name: 'Test Invalid',
        code: 'TEST_INVALID',
        planType: 'SUPER_VIP_INVALID',
        price: 10000,
        durationDays: 30,
      },
    });

    assert.equal(res.status, 400);
    assert.match(res.body.message, /Invalid planType/i);
  });

  await t.test('2.5 Non-admin user cannot create plan (403 Forbidden)', async () => {
    const res = await invokeRequest(app, {
      method: 'POST',
      url: '/api/plans',
      token: userToken,
      body: {
        name: 'Hacked Plan',
        code: 'HACKED',
        price: 0,
        durationDays: 30,
      },
    });

    assert.equal(res.status, 403);
  });

  // === 3. PUT /api/plans/:id (Admin Update Plan) ===
  await t.test('3.1 Admin updates planType and permissions on existing plan', async () => {
    const createdPlan = db.plans.get(Array.from(db.plans.keys())[0]);

    const res = await invokeRequest(app, {
      method: 'PUT',
      url: `/api/plans/${createdPlan._id}`,
      token: adminToken,
      body: {
        planType: 'CUSTOM',
        permissions: ['basic_learning', 'class_management'],
        description: 'Updated Description',
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.plan.planType, 'CUSTOM');
    assert.deepEqual(res.body.data.plan.permissions, ['basic_learning', 'class_management']);
    assert.equal(res.body.data.plan.description, 'Updated Description');
  });

  await t.test('3.2 Admin rejects invalid planType on update (400 Bad Request)', async () => {
    const createdPlan = db.plans.get(Array.from(db.plans.keys())[0]);

    const res = await invokeRequest(app, {
      method: 'PUT',
      url: `/api/plans/${createdPlan._id}`,
      token: adminToken,
      body: {
        planType: 'NOT_A_VALID_TYPE',
      },
    });

    assert.equal(res.status, 400);
    assert.match(res.body.message, /Invalid planType/i);
  });

  // === 4. AUTH COMPATIBILITY (user.plan) ===
  await t.test('4.1 GET /api/auth/me returns user.plan as FREE for user without active subscription', async () => {
    const res = await invokeRequest(app, {
      method: 'GET',
      url: '/api/auth/me',
      token: userToken,
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.user.plan, 'FREE');
    assert.equal(res.body.data.plan, 'FREE');
    assert.equal(res.body.user.hasCustomPlan, false);
    assert.equal(res.body.user.canManageClasses, false);
    assert.deepEqual(res.body.user.permissions, ['basic_learning']);
  });

  await t.test('4.2 GET /api/auth/me returns user.plan as ADMIN for admin user', async () => {
    const res = await invokeRequest(app, {
      method: 'GET',
      url: '/api/auth/me',
      token: adminToken,
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.user.plan, 'ADMIN');
    assert.equal(res.body.data.plan, 'ADMIN');
    assert.equal(res.body.user.hasCustomPlan, true);
    assert.equal(res.body.user.canManageClasses, true);
  });

  // === 5. ORDER COMPATIBILITY ({ planId: "..." }) ===
  await t.test('5.1 POST /api/orders successfully accepts { planId: "..." }', async () => {
    const targetPlan = Array.from(db.plans.values()).find((p) => p.code === 'PREMIUM_1_MONTH');

    const res = await invokeRequest(app, {
      method: 'POST',
      url: '/api/orders',
      token: userToken,
      body: {
        planId: targetPlan._id.toString(),
      },
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.order);
    assert.equal(res.body.data.order.amount, targetPlan.price);
    assert.ok(res.body.data.payment.qrCodeUrl);
    assert.equal(res.body.data.payment.method, 'BANK_TRANSFER');
  });
});
