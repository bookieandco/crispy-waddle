import { after, NextRequest, NextResponse } from 'next/server';
import { createCreativeJob, runCreativeJob } from '@/lib/creative-jobs';
import { newOwnerToken, OWNER_COOKIE } from '@/lib/platform';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const ownerToken = request.cookies.get(OWNER_COOKIE)?.value ?? newOwnerToken();
  try {
    const form = await request.formData();
    const photos = form.getAll('photos').filter((value): value is File => value instanceof File);
    const legacyPhoto = form.get('photo');
    if (photos.length === 0 && legacyPhoto instanceof File) photos.push(legacyPhoto);
    if (photos.length === 0)
      return NextResponse.json(
        { success: false, error: 'A pet photo is required.' },
        { status: 400 }
      );
    const idempotencyKey = request.headers.get('idempotency-key') ?? crypto.randomUUID();
    const { jobId } = await createCreativeJob({
      ownerToken,
      petName: String(form.get('petName') ?? 'My Pet'),
      productId: String(form.get('productId') ?? ''),
      artStyle: String(form.get('artStyleId') ?? ''),
      prompt: String(form.get('prompt') ?? ''),
      backgroundMode: String(form.get('backgroundMode') ?? 'auto'),
      files: await Promise.all(
        photos.map(async (photo) => ({
          fileName: photo.name,
          mimeType: photo.type,
          bytes: Buffer.from(await photo.arrayBuffer()),
        }))
      ),
      consent: form.get('consent') === 'true',
      idempotencyKey,
    });
    after(async () => {
      try {
        await runCreativeJob(jobId, ownerToken);
      } catch (error) {
        console.error('PupsonStuff creative job failed', { jobId, error });
      }
    });
    const response = NextResponse.json({ success: true, jobId, status: 'queued' }, { status: 202 });
    if (!request.cookies.has(OWNER_COOKIE)) {
      response.cookies.set(OWNER_COOKIE, ownerToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
      });
    }
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Could not create the creative job.',
      },
      { status: 400 }
    );
  }
}
