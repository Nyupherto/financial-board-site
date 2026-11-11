import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { generateToken, requireAuth, AuthUser } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

const AVATAR_COLORS = [
  '#10b981', // Emerald
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#f59e0b', // Amber
  '#06b6d4', // Cyan
  '#f97316', // Orange
];

export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) {
    return 'A senha deve ter no mínimo 8 caracteres.';
  }
  if (!/[A-ZÀ-Ý]/.test(password)) {
    return 'A senha deve conter pelo menos uma letra maiúscula.';
  }
  if (!/[a-zà-ý]/.test(password)) {
    return 'A senha deve conter pelo menos uma letra minúscula.';
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) {
    return 'A senha deve conter pelo menos um caractere especial (ex: @, #, $, !, %).';
  }
  return null;
}

// List all family members
router.get('/users', async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarColor: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ error: 'Falha ao buscar usuários.', details: error.message });
  }
});

// Register New Account
router.post('/register', async (req: Request, res: Response) => {
  const { name, email, confirmEmail, password, confirmPassword } = req.body;

  if (!name || !email || !confirmEmail || !password || !confirmPassword) {
    res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    return;
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanConfirmEmail = confirmEmail.trim().toLowerCase();

  if (cleanEmail !== cleanConfirmEmail) {
    res.status(400).json({ error: 'Os endereços de email não coincidem.' });
    return;
  }

  if (password !== confirmPassword) {
    res.status(400).json({ error: 'As senhas não coincidem.' });
    return;
  }

  const passwordError = validatePasswordStrength(password);
  if (passwordError) {
    res.status(400).json({ error: passwordError });
    return;
  }

  try {
    // Check family quota (maximum 5 profiles)
    const userCount = await prisma.user.count();
    if (userCount >= 5) {
      res.status(400).json({
        error: 'Limite de perfis atingido (máximo de 5 contas familiares permitidas).',
      });
      return;
    }

    // Check if email already registered
    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      res.status(400).json({ error: 'Já existe uma conta cadastrada com este email.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const avatarColor = AVATAR_COLORS[userCount % AVATAR_COLORS.length];
    const role = userCount === 0 ? 'ADMIN' : 'MEMBER';

    const newUser = await prisma.user.create({
      data: {
        name: name.trim(),
        email: cleanEmail,
        passwordHash,
        role,
        avatarColor,
      },
    });

    const authUser: AuthUser = {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role as 'ADMIN' | 'MEMBER',
    };

    const token = generateToken(authUser);
    res.status(201).json({
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        avatarColor: newUser.avatarColor,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Falha ao registrar conta.', details: error.message });
  }
});

// Standard Login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Email e senha são obrigatórios.' });
    return;
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    const user = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (!user) {
      res.status(401).json({ error: 'Email ou senha incorretos.' });
      return;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ error: 'Email ou senha incorretos.' });
      return;
    }

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as 'ADMIN' | 'MEMBER',
    };

    const token = generateToken(authUser);
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarColor: user.avatarColor,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Falha ao efetuar login.', details: error.message });
  }
});

// Switch Profile (for logged in users to switch view between family members)
router.post('/switch-profile', requireAuth, async (req: Request, res: Response) => {
  const { userId } = req.body;
  if (!userId) {
    res.status(400).json({ error: 'userId é obrigatório.' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: 'Perfil não encontrado.' });
      return;
    }

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as 'ADMIN' | 'MEMBER',
    };

    const token = generateToken(authUser);
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarColor: user.avatarColor,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Falha ao trocar perfil.', details: error.message });
  }
});

// Get current profile
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, name: true, email: true, role: true, avatarColor: true },
    });
    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: 'Falha ao buscar usuário atual.' });
  }
});

export default router;
