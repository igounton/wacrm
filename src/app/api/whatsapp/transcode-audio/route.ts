import { NextResponse } from 'next/server'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ffmpegStatic from 'ffmpeg-static'
import { createClient } from '@/lib/supabase/server'
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit'
import { buildFfmpegArgs } from '@/lib/whatsapp/audio-transcode'
import { hasBetaFeature, CHAT_MEDIA_BETA } from '@/lib/auth/beta-features'

// ffmpeg + temp-file I/O need the Node runtime (not Edge).
export const runtime = 'nodejs'

// Recorded clips are short voice notes — same 16 MB ceiling as the
// chat-media bucket so we reject anything that couldn't be stored anyway.
const MAX_INPUT_BYTES = 16 * 1024 * 1024

/**
 * Resolve the ffmpeg binary path. `ffmpeg-static` ships a per-platform
 * binary and exports its absolute path; `FFMPEG_PATH` overrides it for
 * hosts where the bundled binary can't run (e.g. a system ffmpeg).
 */
function resolveFfmpegPath(): string | null {
  return process.env.FFMPEG_PATH || ffmpegStatic || null
}

function runFfmpeg(binary: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(binary, args, { timeout: 30_000 }, (error, _stdout, stderr) => {
      if (error) {
        reject(new Error(stderr?.toString().slice(-500) || error.message))
        return
      }
      resolve()
    })
  })
}

/**
 * POST /api/whatsapp/transcode-audio
 *
 * Accepts a recorded audio clip (multipart form field `file`, typically
 * Chromium's WebM/Opus) and returns OGG/Opus bytes that Meta accepts and
 * WhatsApp renders as a playable voice note. The client only calls this
 * when its recording isn't already a Meta-accepted format — Firefox
 * records OGG and Safari records MP4/AAC, which skip the round-trip.
 *
 * The route does NOT upload anywhere: it returns the bytes and the client
 * uploads them to the account-scoped chat-media bucket (same RLS path as
 * every other attachment).
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const limit = checkRateLimit(`transcode:${user.id}`, RATE_LIMITS.transcodeAudio)
    if (!limit.success) {
      return rateLimitResponse(limit)
    }

    // Voice notes are part of the beta-gated media feature — only opted-in
    // accounts may transcode (mirrors the send route + client gate).
    const { data: profile } = await supabase
      .from('profiles')
      .select('beta_features')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!hasBetaFeature(profile?.beta_features, CHAT_MEDIA_BETA)) {
      return NextResponse.json(
        { error: 'Voice notes are not enabled for your account.' },
        { status: 403 },
      )
    }

    const ffmpegPath = resolveFfmpegPath()
    if (!ffmpegPath) {
      console.error('[transcode-audio] ffmpeg binary not found')
      return NextResponse.json(
        { error: 'Audio transcoding is unavailable on this server.' },
        { status: 500 },
      )
    }

    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'Expected a `file` form field.' },
        { status: 400 },
      )
    }
    if (file.size === 0) {
      return NextResponse.json({ error: 'Empty audio file.' }, { status: 400 })
    }
    if (file.size > MAX_INPUT_BYTES) {
      return NextResponse.json(
        { error: 'Audio clip exceeds the 16 MB limit.' },
        { status: 400 },
      )
    }

    // Stage input + output in a per-request temp dir so concurrent
    // transcodes never collide, and clean it up no matter what.
    const dir = await mkdtemp(join(tmpdir(), 'wacrm-audio-'))
    const inputPath = join(dir, 'in')
    const outputPath = join(dir, 'out.ogg')
    try {
      await writeFile(inputPath, Buffer.from(await file.arrayBuffer()))
      await runFfmpeg(ffmpegPath, buildFfmpegArgs(inputPath, outputPath))
      const ogg = await readFile(outputPath)
      if (ogg.byteLength > MAX_INPUT_BYTES) {
        return NextResponse.json(
          { error: 'Transcoded audio exceeds the 16 MB limit.' },
          { status: 400 },
        )
      }
      return new Response(new Uint8Array(ogg), {
        status: 200,
        headers: {
          'Content-Type': 'audio/ogg',
          'Cache-Control': 'no-store',
        },
      })
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {})
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Audio transcoding failed'
    console.error('[transcode-audio] failed:', message)
    return NextResponse.json(
      { error: 'Failed to process the recording.' },
      { status: 500 },
    )
  }
}
