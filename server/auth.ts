import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { queryOne } from "./db";

const JWT_SECRET = process.env.JWT_SECRET || "lorry_transport_super_secret_jwt_key_2026";

export interface AuthenticatedUser {
  id: number;
  username: string;
  name: string;
  company_name: string;
  phone?: string | null;
  address?: string | null;
  proprietor_name?: string | null;
  phone_cell?: string | null;
  devotional_line1?: string | null;
  devotional_line2?: string | null;
  vessel_name_default?: string | null;
  gstin?: string | null;
  memo_prefix?: string | null;
  memo_next_no?: number | null;
  deity_icon_left?: string | null;
  deity_icon_right?: string | null;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export function generateToken(user: AuthenticatedUser): string {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      name: user.name,
      company_name: user.company_name,
    },
    JWT_SECRET,
    { expiresIn: "3650d" } // 10-year persistent session
  );
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    res.status(401).json({ error: "Unauthorized. Please log in to access this resource." });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
    
    // Verify user exists in database and fetch latest profile
    const user = queryOne<AuthenticatedUser>(
      `SELECT id, username, name, company_name, phone, address, proprietor_name, phone_cell, 
              devotional_line1, devotional_line2, vessel_name_default, gstin, 
              memo_prefix, memo_next_no, deity_icon_left, deity_icon_right 
       FROM owners WHERE id = ?`,
      [decoded.id]
    );

    if (!user) {
      res.status(401).json({ error: "User session expired or user no longer exists." });
      return;
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired token." });
  }
}
