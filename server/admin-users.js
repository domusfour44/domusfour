import { createHmac, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { database } from './services.js';

const derive = promisify(scrypt);
const options = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const deny = (status, message) => { throw Object.assign(new Error(message), { status }); };
const ownerEmail = () => process.env.ADMIN_EMAIL?.trim().toLowerCase();
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const safeColumns = 'id,name,email,active,must_change_password,created_at';
const digest = value => {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) deny(503, 'Configurare SESSION_SECRET (almeno 32 caratteri).');
  return createHmac('sha256', process.env.SESSION_SECRET).update(value).digest();
};
const ownerVersion = () => digest(JSON.stringify([ownerEmail(), process.env.ADMIN_PASSWORD])).toString('hex');
const owner = () => ({ id: 'owner', name: 'Proprietario', email: ownerEmail(), owner: true, must_change_password: false, session_version: ownerVersion() });
const publicUser = user => ({ id: user.id, name: user.name, email: user.email, owner: user.owner === true, must_change_password: user.must_change_password });
export const sessionUser = publicUser;

export function validateAdminPassword(password, minimum = 16) {
  if (typeof password !== 'string' || password.length < minimum || password.length > 256 || !password.trim()) deny(400, `Usa una password da ${minimum} a 256 caratteri.`);
  return password;
}
async function passwordFields(password, minimum = 16) {
  validateAdminPassword(password, minimum);
  const salt = randomBytes(16).toString('hex');
  const hash = (await derive(password, salt, 64, options)).toString('hex');
  return { password_hash: hash, password_salt: salt, session_version: randomUUID() };
}
async function passwordMatches(password, user) {
  const salt = user?.password_salt || '00000000000000000000000000000000';
  const hash = await derive(password, salt, 64, options);
  const expected = Buffer.from(user?.password_hash || '00'.repeat(64), 'hex');
  return expected.length === hash.length && timingSafeEqual(hash, expected) && !!user;
}
function credentialsConfigured() {
  if (!ownerEmail() || !process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 16) deny(503, 'Accesso amministratore da configurare.');
}

export async function authenticateAdmin(data) {
  credentialsConfigured();
  if (!data || typeof data.email !== 'string' || data.email.length > 254 || typeof data.password !== 'string' || data.password.length > 256) deny(401, 'Credenziali non valide.');
  const email = data.email.trim().toLowerCase();
  if (email === ownerEmail()) {
    if (!timingSafeEqual(digest(data.password), digest(process.env.ADMIN_PASSWORD))) deny(401, 'Credenziali non valide.');
    return owner();
  }
  const rows = await database(`admin_users?email=eq.${encodeURIComponent(email)}&limit=1`);
  const user = rows[0];
  if (!await passwordMatches(data.password, user) || !user.active) deny(401, 'Credenziali non valide.');
  return { ...user, owner: false };
}

export async function authorizeAdmin(token) {
  if (!token) deny(401, 'Accedi come amministratore.');
  if (token.sub === 'owner') {
    credentialsConfigured();
    if (token.version !== ownerVersion()) deny(401, 'Accedi nuovamente come amministratore.');
    return owner();
  }
  if (!uuid(token.sub)) deny(401, 'Accedi come amministratore.');
  const rows = await database(`admin_users?id=eq.${token.sub}&select=${safeColumns},session_version&limit=1`);
  const user = rows[0];
  if (!user?.active || token.version !== user.session_version) deny(401, 'Accesso revocato o scaduto. Accedi nuovamente.');
  return { ...user, owner: false };
}

export function requireOwner(user) {
  if (!user.owner) deny(403, 'Solo il proprietario può gestire gli accessi.');
}
export async function listAdminUsers() {
  const users = await database(`admin_users?select=${safeColumns}&order=created_at.asc`);
  return [{ ...sessionUser(owner()), active: true }, ...users.map(user => ({...sessionUser(user),active:user.active,created_at:user.created_at}))];
}
export async function createAdminUser(data) {
  const email = typeof data?.email === 'string' ? data.email.trim().toLowerCase() : '';
  const name = typeof data?.name === 'string' ? data.name.trim() : '';
  if (!name || name.length > 100 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) deny(400, 'Inserisci un nome e una email valida.');
  if (email === ownerEmail()) deny(409, 'Questa email appartiene già al proprietario.');
  const fields = await passwordFields(data.password);
  try {
    const rows = await database(`admin_users?select=${safeColumns}`, { method: 'POST', body: JSON.stringify({ name, email, ...fields }) });
    return { ...sessionUser(rows[0]), active: rows[0].active };
  } catch (error) {
    if (error.status === 409) deny(409, 'Esiste già un utente con questa email. Puoi riattivarlo dall’elenco.');
    throw error;
  }
}
export async function updateAdminUser(id, data, resetPassword = false) {
  if (!uuid(id)) deny(400, 'Utente non valido.');
  let fields;
  if (resetPassword) fields = { ...await passwordFields(data?.password), must_change_password: true };
  else {
    if (typeof data?.active !== 'boolean') deny(400, 'Stato dell’accesso non valido.');
    fields = { active: data.active, session_version: randomUUID() };
  }
  const rows = await database(`admin_users?id=eq.${id}&select=${safeColumns}`, { method: 'PATCH', body: JSON.stringify(fields) });
  if (!rows.length) deny(404, 'Utente non trovato.');
  return { ...sessionUser(rows[0]), active: rows[0].active };
}
export async function changeAdminPassword(user, data) {
  if (user.owner) deny(400, 'La password del proprietario si modifica nelle variabili ADMIN_PASSWORD su Render.');
  validateAdminPassword(data?.password, 6);
  if (typeof data?.current_password !== 'string' || data.current_password.length > 256) deny(400, 'Inserisci la password attuale.');
  const rows = await database(`admin_users?id=eq.${user.id}&limit=1`);
  const stored = rows[0];
  if (!stored?.active || stored.session_version !== user.session_version) deny(401, 'Accedi nuovamente.');
  if (!await passwordMatches(data.current_password, stored)) deny(400, 'La password attuale non è corretta.');
  if (data.current_password === data.password) deny(400, 'Scegli una password diversa da quella attuale.');
  const fields = { ...await passwordFields(data.password, 6), must_change_password: false };
  // Compare the version as well: a concurrent revocation/reset must win over this request.
  const updated = await database(`admin_users?id=eq.${user.id}&session_version=eq.${user.session_version}&active=eq.true&select=${safeColumns},session_version`, { method: 'PATCH', body: JSON.stringify(fields) });
  if (!updated.length) deny(401, 'Accesso modificato. Accedi nuovamente.');
  return { ...updated[0], owner: false };
}
