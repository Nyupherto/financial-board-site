import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Executando limpeza total do banco de dados (Zero Usuários, Zero Transações)...');

  // 1. Delete all records in dependent order
  await prisma.allocationBucket.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.monthlyRecord.deleteMany();
  await prisma.savingsGoal.deleteMany();
  await prisma.user.deleteMany();
  await prisma.category.deleteMany();

  // 2. Create clean functional Group Categories (No transactions, no test values)
  const defaultGroups = [
    { name: 'Despesas', type: 'EXPENSE', icon: 'receipt', color: '#ef4444' },
    { name: 'Mantimento', type: 'EXPENSE', icon: 'shopping-cart', color: '#84cc16' },
    { name: 'Lazer', type: 'EXPENSE', icon: 'film', color: '#a855f7' },
    { name: 'Despesas com Carro', type: 'EXPENSE', icon: 'car', color: '#f97316' },
    { name: 'Moradia & Contas', type: 'EXPENSE', icon: 'home', color: '#eab308' },
    { name: 'Renda & Ganhos', type: 'INCOME', icon: 'trending-up', color: '#10b981' },
    { name: 'Ganhos com a Oficina', type: 'INCOME', icon: 'wrench', color: '#06b6d4' },
  ];

  for (const group of defaultGroups) {
    await prisma.category.create({
      data: {
        name: group.name,
        type: group.type,
        icon: group.icon,
        color: group.color,
        isDefault: true,
      },
    });
  }

  const userCount = await prisma.user.count();
  const txCount = await prisma.transaction.count();
  const catCount = await prisma.category.count();

  console.log(`✅ Banco zerado com sucesso! Usuários: ${userCount}, Transações: ${txCount}, Grupos disponíveis: ${catCount}`);
}

main()
  .catch((e) => {
    console.error('❌ Erro ao limpar banco:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
