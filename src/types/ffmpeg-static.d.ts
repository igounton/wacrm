// `ffmpeg-static` ships no type declarations. Its default export is the
// absolute path to the bundled ffmpeg binary (or null if unavailable on
// the current platform).
declare module "ffmpeg-static" {
  const ffmpegPath: string | null;
  export default ffmpegPath;
}
