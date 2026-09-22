import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { requireDirectorProjectAuthority } from '@/lib/director-project-authority';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PatchBody = {
  projectId?: string;
  characterDescription?: string | null;
  appearanceDescription?: string | null;
  performanceNotes?: string[] | null;
};

function cleanOptionalText(value: string | null | undefined, maxLength: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;
  if (cleaned.length > maxLength) throw new Error('DIRECTOR_CAST_DESCRIPTION_TOO_LONG');
  return cleaned;
}

function cleanNotes(value: string[] | null | undefined): string[] | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!Array.isArray(value) || value.length > 50) throw new Error('DIRECTOR_CAST_PERFORMANCE_NOTES_INVALID');
  const cleaned = [...new Set(value.map((note) => note.replace(/\s+/g, ' ').trim()).filter(Boolean))];
  if (cleaned.some((note) => note.length > 500)) throw new Error('DIRECTOR_CAST_PERFORMANCE_NOTE_TOO_LONG');
  return cleaned;
}

async function requestContext(
  context: { params: Promise<{ characterId: string }> },
  request?: Request,
) {
  const characterId = (await context.params).characterId.trim();
  if (!characterId) throw new Error('DIRECTOR_CHARACTER_ID_REQUIRED');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('AUTHENTICATION_REQUIRED');

  let projectId = '';
  let body: PatchBody | undefined;
  if (request) {
    body = await request.json() as PatchBody;
    projectId = body.projectId?.trim() ?? '';
  } else {
    const url = new URL('http://local');
    void url;
  }

  return { characterId, user, projectId, body };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ characterId: string }> },
) {
  try {
    const characterId = (await context.params).characterId.trim();
    const projectId = new URL(request.url).searchParams.get('projectId')?.trim() ?? '';
    if (!characterId || !projectId) {
      return NextResponse.json({ ok: false, error: 'projectId and characterId are required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 });

    const privileged = createServiceRoleClient();
    if (!privileged) return NextResponse.json({ ok: false, error: 'Director durable storage is not configured' }, { status: 503 });

    await requireDirectorProjectAuthority(privileged, { projectId, userId: user.id, capability: 'read' });

    const { data, error } = await privileged
      .from('director_cast_characters')
      .select('character_id,display_name,character_description,appearance_description,performance_notes,description_revision,description_updated_at,description_updated_by,canonical_appearance_variant_id')
      .eq('project_id', projectId)
      .eq('character_id', characterId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ ok: false, error: 'DIRECTOR_CAST_NOT_FOUND' }, { status: 404 });

    return NextResponse.json({
      ok: true,
      character: {
        characterId: data.character_id,
        displayName: data.display_name,
        characterDescription: data.character_description,
        appearanceDescription: data.appearance_description,
        performanceNotes: data.performance_notes ?? [],
        descriptionRevision: data.description_revision,
        descriptionUpdatedAt: data.description_updated_at,
        descriptionUpdatedBy: data.description_updated_by,
        canonicalReferenceSheetId: data.canonical_appearance_variant_id,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'DIRECTOR_CAST_DESCRIPTION_READ_FAILED';
    const status = message === 'AUTHENTICATION_REQUIRED' ? 401 : message.includes('ACCESS') || message.includes('authority') ? 403 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ characterId: string }> },
) {
  try {
    const characterId = (await context.params).characterId.trim();
    const body = await request.json() as PatchBody;
    const projectId = body.projectId?.trim() ?? '';
    if (!characterId || !projectId) {
      return NextResponse.json({ ok: false, error: 'projectId and characterId are required' }, { status: 400 });
    }

    const characterDescription = cleanOptionalText(body.characterDescription, 8000);
    const appearanceDescription = cleanOptionalText(body.appearanceDescription, 8000);
    const performanceNotes = cleanNotes(body.performanceNotes);
    if (characterDescription === undefined && appearanceDescription === undefined && performanceNotes === undefined) {
      return NextResponse.json({ ok: false, error: 'At least one description field is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 });

    const privileged = createServiceRoleClient();
    if (!privileged) return NextResponse.json({ ok: false, error: 'Director durable storage is not configured' }, { status: 503 });

    await requireDirectorProjectAuthority(privileged, { projectId, userId: user.id, capability: 'edit' });

    const { data: current, error: readError } = await privileged
      .from('director_cast_characters')
      .select('description_revision')
      .eq('project_id', projectId)
      .eq('character_id', characterId)
      .maybeSingle();

    if (readError) throw new Error(readError.message);
    if (!current) return NextResponse.json({ ok: false, error: 'DIRECTOR_CAST_NOT_FOUND' }, { status: 404 });

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {
      description_revision: Number(current.description_revision ?? 1) + 1,
      description_updated_at: now,
      description_updated_by: user.id,
    };
    if (characterDescription !== undefined) patch.character_description = characterDescription;
    if (appearanceDescription !== undefined) patch.appearance_description = appearanceDescription;
    if (performanceNotes !== undefined) patch.performance_notes = performanceNotes ?? [];

    const { data, error } = await privileged
      .from('director_cast_characters')
      .update(patch)
      .eq('project_id', projectId)
      .eq('character_id', characterId)
      .select('character_id,character_description,appearance_description,performance_notes,description_revision,description_updated_at,description_updated_by')
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({
      ok: true,
      character: {
        characterId: data.character_id,
        characterDescription: data.character_description,
        appearanceDescription: data.appearance_description,
        performanceNotes: data.performance_notes ?? [],
        descriptionRevision: data.description_revision,
        descriptionUpdatedAt: data.description_updated_at,
        descriptionUpdatedBy: data.description_updated_by,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'DIRECTOR_CAST_DESCRIPTION_UPDATE_FAILED';
    const status =
      message === 'AUTHENTICATION_REQUIRED' ? 401 :
      message.includes('TOO_LONG') || message.includes('INVALID') ? 400 :
      message.includes('ACCESS') || message.includes('authority') ? 403 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
