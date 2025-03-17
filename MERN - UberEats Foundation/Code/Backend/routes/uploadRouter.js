const express = require("express");
const multer = require("multer");
const path = require("path");

const router = express.Router();

// Setting storage engine to Multer
const storage = multer.diskStorage({
    destination: "./public/uploads/",
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // Picking Unique namd
    },
});

const upload = multer({ storage });

// Route to handle file upload
router.post("/", upload.single("image_url"), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }
    const filePath = `/uploads/${req.file.filename}`; // Path relative to public folder
    res.json({ filePath }); // Sending file path
});

module.exports = router;