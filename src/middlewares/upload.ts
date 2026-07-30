import multer from "multer";

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    if (!/^(image|audio|video)\//.test(file.mimetype)) {
      callback(new Error("Only image, audio or video files are allowed"));
      return;
    }
    callback(null, true);
  },
});
