const Admin = require('../models/Admin');

const seedAdmin = async () => {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || 'Platform Administrator';

  if (!email || !password) {
    console.warn('Skipping admin seed - ADMIN_EMAIL or ADMIN_PASSWORD missing');
    return;
  }

  const existing = await Admin.findOne({ email: email.toLowerCase() });
  if (existing) {
    return;
  }

  await Admin.create({
    email,
    name,
    password_hash: Admin.hashPassword(password)
  });
  console.log(`✅ Seeded default admin (${email})`);
};

module.exports = seedAdmin;

