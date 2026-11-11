import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { generateToken, requireAuth, requireAdmin, AuthUser } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();
const prisma = new PrismaClient();

const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 15,
  message: 'Muitas tentativas de autenticação. Aguarde 15 minutos antes de tentar novamente.',
});

const AVATAR_COLORS = [
  '#10b981', // Emerald
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#f59e0b', // Amber
  '#06b6d4', // Cyan
  '#f97316', // Orange
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) {
    return 'A senha não atende ao tamanho mínimo exigido.';
  }
  if (password.length > 128) {
    return 'A senha excede o limite máximo de caracteres.';
  }
  if (!/[A-ZÀ-Ý]/.test(password)) {
    return 'A senha não atende aos critérios de complexidade exigidos.';
  }
  if (!/[a-zà-ý]/.test(password)) {
    return 'A senha não atende aos critérios de complexidade exigidos.';
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) {
    return 'A senha não atende aos critérios de complexidade exigidos.';
  }
  return null;
}

// List family members (Requires Authentication - prevents public user enumeration)
router.get('/users', requireAuth, async (req: Request, res: Response) => {
  try {
    const isAdmin = req.user?.role === 'ADMIN';
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: isAdmin,
        role: true,
        avatarColor: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Falha ao buscar usuários.' });
  }
});

// Register New Account
router.post('/register', authRateLimiter, async (req: Request, res: Response) => {
  const { name, email, confirmEmail, password, confirmPassword } = req.body;

  if (
    typeof name !== 'string' ||
    typeof email !== 'string' ||
    typeof confirmEmail !== 'string' ||
    typeof password !== 'string' ||
    typeof confirmPassword !== 'string'
  ) {
    res.status(400).json({ error: 'Dados de cadastro inválidos.' });
    return;
  }

  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();
  const cleanConfirmEmail = confirmEmail.trim().toLowerCase();

  if (!cleanName || cleanName.length > 80) {
    res.status(400).json({ error: 'Nome inválido (máximo 80 caracteres).' });
    return;
  }

  if (!EMAIL_REGEX.test(cleanEmail) || cleanEmail.length > 150) {
    res.status(400).json({ error: 'Formato de email inválido.' });
    return;
  }

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
    const userCount = await prisma.user.count();
    if (userCount >= 5) {
      res.status(400).json({
        error: 'Limite máximo de perfis atingido.',
      });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      res.status(400).json({ error: 'Não foi possível concluir o cadastro com este email.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const avatarColor = AVATAR_COLORS[userCount % AVATAR_COLORS.length];
    const role = userCount === 0 ? 'ADMIN' : 'MEMBER';

    const newUser = await prisma.user.create({
      data: {
        name: cleanName,
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
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Falha interna ao registrar conta.' });
  }
});

// Standard Login
router.post('/login', authRateLimiter, async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    res.status(400).json({ error: 'Email e senha são obrigatórios.' });
    return;
  }

  if (password.length > 128 || email.length > 150) {
    res.status(401).json({ error: 'Credenciais inválidas.' });
    return;
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    const user = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (!user) {
      res.status(401).json({ error: 'Credenciais inválidas.' });
      return;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ error: 'Credenciais inválidas.' });
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
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Falha ao efetuar login.' });
  }
});

// Switch Profile (Restricted strictly to ADMIN users to prevent privilege escalation)
router.post('/switch-profile', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { userId } = req.body;
  if (typeof userId !== 'string' || !userId) {
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
  } catch (error) {
    console.error('Switch profile error:', error);
    res.status(500).json({ error: 'Falha ao trocar perfil.' });
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
  } catch (error) {
    console.error('Fetch current user error:', error);
    res.status(500).json({ error: 'Falha ao buscar usuário atual.' });
  }
});

export default router;
