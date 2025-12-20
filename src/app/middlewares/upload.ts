
import multer from "multer";
import path from "path";
import fs from "fs/promises";

// Function to delete a file from the local filesystem
export const deleteFile = async (filePath: string) => {
    try {
        await fs.access(filePath);
        await fs.unlink(filePath);
    } catch (err: any) {
        // File doesn't exist or can't be deleted — silently ignore
    }
};

// Ensure 'uploads' folder exists before setting up storage
const uploadDir = path.join(process.cwd(), "uploads");
(async () => {
    try {
        await fs.access(uploadDir);
    } catch {
        await fs.mkdir(uploadDir, { recursive: true });
    }
})();

// Multer storage setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
    },
});

// Multer upload setup
export const upload = multer({ storage: storage });
