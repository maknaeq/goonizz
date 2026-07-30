import { createHash } from "crypto";
import { mkdirSync } from "fs";
import { access, mkdir, rm } from "fs/promises";
import path from "path";
import sharp, { FitEnum } from "sharp";
import type { Media } from "../entities/Media.js";
import { ffmpeg, runFfmpeg } from "./ffmpeg.js";
import { UPLOADS_ROOT } from "./media.js";

export const CACHE_ROOT = path.join(process.cwd(), "cache");

mkdirSync(CACHE_ROOT, { recursive: true });

export const VALID_FITS: (keyof FitEnum)[] = ["contain", "cover", "fill", "inside", "outside"];
export const VALID_RESOLUTIONS = [360, 480, 720, 1080] as const;
export const AUDIO_QUALITIES = { low: "96k", medium: "160k", high: "224k" } as const;

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function cachePath(mediaPath: string, options: unknown, extension: string): string {
  const key = createHash("sha256").update(JSON.stringify({ mediaPath, options })).digest("hex");
  return path.join(CACHE_ROOT, `${key}.${extension}`);
}

// Resolves the exact variant a client asked for (image size/fit, video resolution, audio
// quality), transcoding it once on first request and serving the cached file afterwards.
// Falls back to the file stored at upload time when no variant is requested.
export async function resolveMediaPath(
  media: Media,
  query: Record<string, unknown>,
): Promise<string> {
  const sourcePath = path.join(UPLOADS_ROOT, media.path);

  if (media.mimetype.startsWith("image/")) {
    return resolveImage(media.path, sourcePath, query);
  }
  if (media.mimetype === "video/mp4") {
    return resolveVideo(media, sourcePath, query);
  }
  if (media.mimetype === "audio/mpeg") {
    return resolveAudio(media.path, sourcePath, query);
  }

  return sourcePath;
}

async function resolveImage(
  mediaPath: string,
  sourcePath: string,
  query: Record<string, unknown>,
): Promise<string> {
  const width = query.width ? Number(query.width) : undefined;
  const height = query.height ? Number(query.height) : undefined;
  const fit = VALID_FITS.includes(query.fit as keyof FitEnum)
    ? (query.fit as keyof FitEnum)
    : undefined;

  if (!width && !height && !fit) {
    return sourcePath;
  }

  const cached = cachePath(mediaPath, { width, height, fit }, "webp");
  if (await exists(cached)) return cached;

  await sharp(sourcePath).resize({ width, height, fit }).webp().toFile(cached);
  return cached;
}

async function resolveVideo(
  media: Media,
  sourcePath: string,
  query: Record<string, unknown>,
): Promise<string> {
  const requested = Number(query.resolution);
  if (!VALID_RESOLUTIONS.includes(requested as (typeof VALID_RESOLUTIONS)[number])) {
    return sourcePath;
  }

  // Never upscale past what's actually stored.
  const targetHeight = media.height ? Math.min(requested, media.height) : requested;
  const cached = cachePath(media.path, { resolution: targetHeight }, "mp4");
  if (await exists(cached)) return cached;

  await runFfmpeg(
    ffmpeg(sourcePath)
      .videoFilter(`scale=-2:${targetHeight}`)
      .videoCodec("libx264")
      .outputOptions(["-crf", "26", "-preset", "veryfast"])
      .audioCodec("aac")
      .audioBitrate("128k"),
    cached,
  );

  return cached;
}

async function resolveAudio(
  mediaPath: string,
  sourcePath: string,
  query: Record<string, unknown>,
): Promise<string> {
  const bitrate = AUDIO_QUALITIES[query.quality as keyof typeof AUDIO_QUALITIES];
  if (!bitrate) {
    return sourcePath;
  }

  const cached = cachePath(mediaPath, { quality: query.quality }, "mp3");
  if (await exists(cached)) return cached;

  await runFfmpeg(ffmpeg(sourcePath).audioCodec("libmp3lame").audioBitrate(bitrate), cached);

  return cached;
}

export async function clearMediaCache(): Promise<void> {
  await rm(CACHE_ROOT, { recursive: true, force: true });
  await mkdir(CACHE_ROOT, { recursive: true });
}
