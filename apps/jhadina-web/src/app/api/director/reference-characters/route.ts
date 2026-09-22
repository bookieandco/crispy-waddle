import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import {
  createDirectorProjectMembership,
  requireDirectorProjectAuthority,
} from '@/lib/director-project-authority';
import { createDirectorReferenceCharacter } from '@/lib/director-reference-character-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function errorStatus(message: string): number {
  if (message.includes('Authentication')) return 401;
  if (message.includes('ACCESS_DENIED') || message.includes('CAPABILITY_DENIED')) return 403;
  if (
    message.includes('REQUIRED') ||
    message.includes('INVALID') ||
    message.includes('UNSUPPORTED') ||
    message.includes('MISMATCH')
  ) return 400;
  return 500;
}

function parseLanguages(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return [...new Set(parsed.map(String).map((value) => value.trim()).filter(Boolean))].slice(0, 20);
    }
  } catch {
    // Fall through to comma-separated form.
  }
  return [...new Set(raw.split(',').map((value) => value.trim()).filter(Boolean))].slice(0, 20);
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > 32 * 1024 * 1024) {
    return NextResponse.json(
      { ok: false, error: 'DIRECTOR_REFERENCE_MULTIPART_TOO_LARGE' },
      { status: 413 },
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 });

  const privileged = createServiceRoleClient();
  if (!privileged) {
    return NextResponse.json(
      { ok: false, error: 'DIRECTOR_SUPABASE_SERVICE_ROLE_NOT_CONFIGURED' },
      { status: 503 },
    );
  }

  try {
    const form = await request.formData();
    const consent = form.get('consent') === 'true';
    if (!consent) {
      return NextResponse.json(
        { ok: false, error: 'DIRECTOR_REFERENCE_CONSENT_REQUIRED' },
        { status: 400 },
      );
    }

    let projectId = typeof form.get('projectId') === 'string'
      ? String(form.get('projectId')).trim()
      : '';
    if (projectId) {
      await requireDirectorProjectAuthority(privileged, {
        projectId,
        userId: user.id,
        capability: 'edit',
      });
    } else {
      projectId = `director:${user.id}:${randomUUID()}`;
      await createDirectorProjectMembership(privileged, {
        projectId,
        userId: user.id,
        role: 'owner',
      });
    }

    const displayName = typeof form.get('displayName') === 'string'
      ? String(form.get('displayName')).trim()
      : 'Reference character';
    const characterId = typeof form.get('characterId') === 'string' && String(form.get('characterId')).trim()
      ? String(form.get('characterId')).trim()
      : `character-${randomUUID().slice(0, 8)}`;
    const archetype = typeof form.get('archetype') === 'string'
      ? String(form.get('archetype')).trim()
      : 'human';
    const rightsRef = typeof form.get('rightsRef') === 'string'
      ? String(form.get('rightsRef')).trim()
      : 'user-provided-reference';
    const targetLanguages = parseLanguages(form.get('targetLanguages'));
    const rawFiles = form.getAll('references')
      .filter((value): value is File => typeof value !== 'string');
    if (!rawFiles.length || rawFiles.length > 3) {
      return NextResponse.json(
        { ok: false, error: 'DIRECTOR_REFERENCE_FILE_COUNT_INVALID' },
        { status: 400 },
      );
    }
    const files = rawFiles.map(async (file) => ({
      fileName: file.name,
      mimeType: file.type,
      bytes: Buffer.from(await file.arrayBuffer()),
    }));

    const prepared = await Promise.all(files);
    const result = await createDirectorReferenceCharacter(privileged, {
      userId: user.id,
      projectId,
      characterId,
      displayName,
      archetype,
      rightsRef,
      consentRef: `director-reference-consent:${user.id}:${new Date().toISOString()}`,
      files: prepared,
    });

    const primary = result.references[0];
    let previewUrl: string | null = null;
    if (primary) {
      const { data, error } = await privileged.storage
        .from('director-media')
        .createSignedUrl(primary.objectPath, 3600);
      if (!error) previewUrl = data?.signedUrl ?? null;
    }

    return NextResponse.json({
      ok: true,
      projectId: result.projectId,
      character: {
        characterId: result.characterId,
        displayName: result.cast.displayName,
        continuityRef: result.cast.continuityRef,
        appearanceVariantId: result.cast.canonicalAppearanceVariantId,
        referenceCount: result.references.length,
      },
      referenceCharacter: {
        characterId: result.characterId,
        appearanceVariantId: result.cast.canonicalAppearanceVariantId,
        targetLanguages,
      },
      bootstrapPlan: result.bootstrapPlan,
      previewUrl,
    }, { status: 201 });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'DIRECTOR_REFERENCE_CHARACTER_UPLOAD_FAILED';
    return NextResponse.json({ ok: false, error: message }, { status: errorStatus(message) });
  }
}
