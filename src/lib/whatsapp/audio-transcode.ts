/**
 * Pure helpers for the voice-note transcode flow. Kept free of Node /
 * ffmpeg imports so they can be unit-tested without spawning a process —
 * the route handler (`/api/whatsapp/transcode-audio`) does the actual
 * spawning.
 */

/**
 * Audio MIME types Meta accepts for OUTBOUND messages on the WhatsApp
 * Cloud API. Anything outside this set must be transcoded before send.
 * Notably absent: `audio/webm` (Chromium's default MediaRecorder output)
 * — which is exactly why the transcode step exists.
 *
 * https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media#supported-media-types
 */
export const META_ACCEPTED_AUDIO_MIME = new Set<string>([
  "audio/aac",
  "audio/mp4",
  "audio/mpeg",
  "audio/amr",
  "audio/ogg", // Opus only — the codec MediaRecorder + ffmpeg produce here
]);

/**
 * Whether a recorded clip's MIME type can be sent to Meta as-is. The
 * client only round-trips through the transcode route when this is false.
 * The codec suffix (e.g. `audio/ogg;codecs=opus`) is stripped before the
 * lookup.
 */
export function isMetaAcceptedAudio(mimeType: string | undefined | null): boolean {
  if (!mimeType) return false;
  const base = mimeType.split(";")[0]!.trim().toLowerCase();
  return META_ACCEPTED_AUDIO_MIME.has(base);
}

/**
 * ffmpeg arguments to remux/encode an arbitrary recorded clip into
 * OGG/Opus — the format WhatsApp renders as a playable voice note.
 *
 * We re-encode to libopus rather than `-c:a copy` so the output is valid
 * regardless of the input container/codec (Chromium gives WebM/Opus,
 * older browsers may give other codecs). Opus at 48k mono is the voice-
 * note sweet spot and keeps the file tiny.
 */
export function buildFfmpegArgs(inputPath: string, outputPath: string): string[] {
  return [
    "-y", // overwrite output if it exists
    "-i",
    inputPath,
    "-vn", // no video stream
    "-c:a",
    "libopus",
    "-b:a",
    "32k",
    "-ar",
    "48000",
    "-ac",
    "1",
    "-f",
    "ogg",
    outputPath,
  ];
}
