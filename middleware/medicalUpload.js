// middleware/medicalUpload.js
const multer = require('multer');
const path = require('path');

const medicalStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (file.fieldname === 'profileImage') {
      cb(null, path.join('public', 'uploads', 'profiles'));
    } else if (file.fieldname === 'AmbulanceImage') {
      cb(null, path.join('public', 'uploads', 'shops'));
    }
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const medicalUpload = multer({
  storage: medicalStorage,
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images allowed'), false);
    }
  }
});

module.exports = medicalUpload;
