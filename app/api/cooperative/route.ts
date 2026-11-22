import { COUNTRIES } from '@/lib/seasonal/types';
import { session } from '@/lib/server-auth';
import { body, database, failure, HttpError, json } from '@/lib/server-db';

type Profile = {
  coopId: string;
  name: string;
  country: string;
  region: string;
  locality: string;
  phone: string;
  email: string;
  contactName: string;
  createdAt?: string;
  updatedAt?: string;
  configured: boolean;
};

function profile(row: any, coopId: string): Profile {
  if (!row) return {
    coopId,
    name: 'Ma coopérative',
    country: 'TGO',
    region: '',
    locality: '',
    phone: '',
    email: '',
    contactName: '',
    configured: false,
  };
  return {
    coopId: row.coop_id,
    name: row.name,
    country: row.country,
    region: row.region,
    locality: row.locality,
    phone: row.phone,
    email: row.email,
    contactName: row.contact_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    configured: true,
  };
}

export async function GET(request: Request) {
  try {
    const s = await session(request);
    if (s.demo) {
      const letter = s.coopId.includes('demo-b') ? 'B' : 'A';
      return json({ profile: { ...profile(null, s.coopId), name: `Coopérative ${letter} · démonstration`, configured: true } });
    }
    const row = await database().prepare('SELECT * FROM cooperative_profiles WHERE coop_id=?').bind(s.coopId).first<any>();
    return json({ profile: profile(row, s.coopId) });
  } catch (e) {
    return failure(e);
  }
}

export async function POST(request: Request) {
  try {
    const s = await session(request);
    if (!['responsable', 'admin'].includes(s.role)) throw new HttpError(403, 'La mise à jour de la coopérative est réservée au responsable.');
    if (s.demo) throw new HttpError(403, 'Les informations d’une coopérative réelle ne peuvent pas être modifiées en démonstration.');

    const b = await body(request);
    if (b.action !== 'save' || !b.profile || typeof b.profile !== 'object' || Array.isArray(b.profile)) {
      throw new HttpError(400, 'Profil de coopérative attendu.');
    }
    const input = b.profile as Record<string, unknown>;
    const value = (key: string, max: number, required = false) => {
      const raw = input[key];
      if (raw === undefined || raw === null) return '';
      if (typeof raw !== 'string' || raw.length > max) throw new HttpError(400, `Le champ ${key} est invalide.`);
      const clean = raw.trim();
      if (required && !clean) throw new HttpError(400, 'Le nom de la coopérative est obligatoire.');
      return clean;
    };
    const name = value('name', 120, true);
    const country = value('country', 3, true);
    if (!Object.hasOwn(COUNTRIES, country)) throw new HttpError(400, 'Pays non pris en charge.');
    const region = value('region', 120);
    const locality = value('locality', 160);
    const phone = value('phone', 32);
    const email = value('email', 200).toLowerCase();
    const contactName = value('contactName', 120);
    if (phone && !/^\+?[0-9 ()-]{7,32}$/.test(phone)) throw new HttpError(400, 'Numéro de téléphone invalide.');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Adresse électronique invalide.');

    const db = database(), now = new Date().toISOString();
    await db.prepare(`INSERT INTO cooperative_profiles (coop_id,name,country,region,locality,phone,email,contact_name,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(coop_id) DO UPDATE SET name=excluded.name,country=excluded.country,region=excluded.region,
      locality=excluded.locality,phone=excluded.phone,email=excluded.email,contact_name=excluded.contact_name,updated_at=excluded.updated_at`)
      .bind(s.coopId, name, country, region, locality, phone, email, contactName, now, now).run();
    const row = await db.prepare('SELECT * FROM cooperative_profiles WHERE coop_id=?').bind(s.coopId).first<any>();
    return json({ profile: profile(row, s.coopId) });
  } catch (e) {
    return failure(e);
  }
}
