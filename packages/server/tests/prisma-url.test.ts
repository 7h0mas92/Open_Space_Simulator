import { describe, expect, it } from 'vitest';
import { withLibpqSslMode } from '../src/lib/prisma.js';

describe('withLibpqSslMode', () => {
  it('ne touche pas une URL locale sans sslmode', () => {
    const url = 'postgresql://oss:oss@localhost:5432/oss';
    expect(withLibpqSslMode(url)).toBe(url);
  });

  it('ajoute uselibpqcompat à une URL Supabase en sslmode=require', () => {
    const url =
      'postgresql://postgres.abc:secret@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require';
    const result = new URL(withLibpqSslMode(url));
    expect(result.searchParams.get('sslmode')).toBe('require');
    expect(result.searchParams.get('uselibpqcompat')).toBe('true');
    expect(result.password).toBe('secret');
    expect(result.host).toBe('aws-0-eu-central-1.pooler.supabase.com:5432');
  });

  it('respecte un choix explicite', () => {
    const verified = 'postgresql://u:p@h:5432/db?sslmode=verify-full';
    const explicit = 'postgresql://u:p@h:5432/db?sslmode=require&uselibpqcompat=false';
    expect(withLibpqSslMode(verified)).toBe(verified);
    expect(withLibpqSslMode(explicit)).toBe(explicit);
  });
});
