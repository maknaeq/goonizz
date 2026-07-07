import multer from 'multer';

export const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (req, file, callback) => {
        if (!file.mimetype.startsWith('image/')) {
            callback(new Error('Only image files are allowed'));
            return;
        }
        callback(null, true);
    },
});
