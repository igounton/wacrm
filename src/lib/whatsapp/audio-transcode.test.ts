import { describe, expect, it } from "vitest";
import {
  buildFfmpegArgs,
  isMetaAcceptedAudio,
  META_ACCEPTED_AUDIO_MIME,
} from "./audio-transcode";

describe("isMetaAcceptedAudio", () => {
  it("accepts the Meta-supported audio types", () => {
    for (const mime of META_ACCEPTED_AUDIO_MIME) {
      expect(isMetaAcceptedAudio(mime)).toBe(true);
    }
  });

  it("strips the codec suffix before matching", () => {
    expect(isMetaAcceptedAudio("audio/ogg;codecs=opus")).toBe(true);
    expect(isMetaAcceptedAudio("audio/mp4; codecs=mp4a.40.2")).toBe(true);
  });

  it("rejects WebM (Chromium's MediaRecorder default) — needs transcode", () => {
    expect(isMetaAcceptedAudio("audio/webm")).toBe(false);
    expect(isMetaAcceptedAudio("audio/webm;codecs=opus")).toBe(false);
  });

  it("rejects empty / nullish input", () => {
    expect(isMetaAcceptedAudio("")).toBe(false);
    expect(isMetaAcceptedAudio(undefined)).toBe(false);
    expect(isMetaAcceptedAudio(null)).toBe(false);
  });
});

describe("buildFfmpegArgs", () => {
  it("targets OGG/Opus mono and overwrites the output", () => {
    const args = buildFfmpegArgs("/tmp/in", "/tmp/out.ogg");
    expect(args).toContain("-y");
    expect(args).toEqual(expect.arrayContaining(["-i", "/tmp/in"]));
    expect(args).toEqual(expect.arrayContaining(["-c:a", "libopus"]));
    expect(args).toEqual(expect.arrayContaining(["-f", "ogg"]));
    expect(args).toEqual(expect.arrayContaining(["-ac", "1"]));
    // Output path is last so ffmpeg treats it as the destination.
    expect(args[args.length - 1]).toBe("/tmp/out.ogg");
  });
});
