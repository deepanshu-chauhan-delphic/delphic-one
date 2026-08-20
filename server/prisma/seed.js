const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  await prisma.user.deleteMany();

  const password_hash = await bcrypt.hash('Password123!', 10);

  await prisma.user.createMany({
    data: [
      { name: 'Admin User', email: 'admin@delphic.local', password_hash, role: 'admin' },
      { name: 'Sales One', email: 'sales1@delphic.local', password_hash, role: 'sales' },
      { name: 'BDA One', email: 'bda1@delphic.local', password_hash, role: 'bda' },
      { name: 'Recruiter One', email: 'recruiter1@delphic.local', password_hash, role: 'recruiter' },
      { name: 'Recruiter Two', email: 'recruiter2@delphic.local', password_hash, role: 'recruiter' },
    ],
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
