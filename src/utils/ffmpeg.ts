import ffmpegPath from "ffmpeg-static";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import ffmpeg from "fluent-ffmpeg";

ffmpeg.setFfmpegPath(ffmpegPath as unknown as string);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

export { ffmpeg };

export function runFfmpeg(command: ReturnType<typeof ffmpeg>, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    command
      .on("error", reject)
      .on("end", () => resolve())
      .save(outputPath);
  });
}

export type ProbeInfo = { width?: number; height?: number; duration?: number };

export function probeMedia(filePath: string): Promise<ProbeInfo> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
        return;
      }

      const videoStream = data.streams.find((stream) => stream.codec_type === "video");
      resolve({
        width: videoStream?.width,
        height: videoStream?.height,
        duration: data.format.duration ? Number(data.format.duration) : undefined,
      });
    });
  });
}
