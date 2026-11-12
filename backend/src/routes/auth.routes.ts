import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { generateToken, requireAuth, AuthUser } from '../middleware/auth.js';
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

// Pre-computed dummy hash to equalize timing when email/user does not exist
const DUMMY_BCRYPT_HASH = '$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW';

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

// List profiles (Requires Authentication - prevents public user enumeration)
router.get('/users', requireAuth, async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        avatarColor: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Only expose email for the currently authenticated user
    const sanitized = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.id === req.user?.id ? u.email : '',
      avatarColor: u.avatarColor,
    }));

    res.json(sanitized);
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

    const newUser = await prisma.user.create({
      data: {
        name: cleanName,
        email: cleanEmail,
        passwordHash,
        avatarColor,
      },
    });

    const authUser: AuthUser = {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
    };

    const token = generateToken(authUser);
    res.status(201).json({
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
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
      await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
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
    };

    const token = generateToken(authUser);
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarColor: user.avatarColor,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Falha ao efetuar login.' });
  }
});

// Forgot / Reset Password (verifies registered email + exact full name + strong password policy)
router.post('/forgot-password', authRateLimiter, async (req: Request, res: Response) => {
  const { email, name, newPassword, confirmPassword } = req.body;

  if (
    typeof email !== 'string' ||
    typeof name !== 'string' ||
    typeof newPassword !== 'string' ||
    typeof confirmPassword !== 'string'
  ) {
    res.status(400).json({ error: 'Todos os campos de recuperação são obrigatórios.' });
    return;
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name.trim();

  if (!cleanEmail || !cleanName || cleanEmail.length > 150 || cleanName.length > 80) {
    res.status(400).json({ error: 'Dados informados inválidos.' });
    return;
  }

  if (newPassword !== confirmPassword) {
    res.status(400).json({ error: 'A confirmação de senha não coincide com a nova senha.' });
    return;
  }

  const passwordError = validatePasswordStrength(newPassword);
  if (passwordError) {
    res.status(400).json({ error: passwordError });
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { email: cleanEmail } });
    const isNameMatch =
      user !== null && user.name.trim().toLowerCase() === cleanName.toLowerCase();

    if (!user || !isNameMatch) {
      await bcrypt.compare(newPassword, DUMMY_BCRYPT_HASH);
      res.status(400).json({
        error: 'Não foi possível validar os dados da conta. Verifique o email e o nome cadastrado.',
      });
      return;
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash },
    });

    res.json({
      success: true,
      message: 'Senha redefinida com sucesso. Você já pode entrar com a nova senha.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Falha ao redefinir a senha.' });
  }
});

// Get current profile
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, name: true, email: true, avatarColor: true },
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
