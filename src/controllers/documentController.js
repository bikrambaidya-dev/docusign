const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Document, SigningEvent, SignedDocument } = require('../config/database-mongo');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.resolve(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Upload PDF document
exports.uploadDocument = async (req, res) => {
  upload.single('pdf')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    const { facilitySignerEmail, facilitySignerName, familySignerEmail, familySignerName } = req.body;

    // Save document to database
    const newDoc = new Document({
      filename: req.file.filename,
      originalName: req.file.originalname,
      filePath: req.file.path,
      fileSize: req.file.size,
      facilitySignerEmail,
      facilitySignerName,
      familySignerEmail,
      familySignerName
    });

    const savedDoc = await newDoc.save();

    // Log upload event
    await SigningEvent.create({
      documentId: savedDoc._id,
      signerType: 'system',
      signerEmail: 'system@docflow.com',
      signerName: 'System',
      eventType: 'uploaded'
    });

    res.json({
      message: 'Document uploaded successfully',
      documentId: savedDoc._id,
      filename: req.file.filename,
      originalName: req.file.originalname,
      filePath: req.file.path,
      facilitySignerEmail,
      facilitySignerName,
      familySignerEmail,
      familySignerName
    });
  });
};

// Get document by ID
exports.getDocument = async (req, res) => {
  const documentId = req.params.id;
  
  try {
    const doc = await Document.findById(documentId);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({
      id: doc._id,
      filename: doc.filename,
      originalName: doc.originalName,
      currentStatus: doc.currentStatus,
      envelopeId: doc.envelopeId,
      facilitySignerEmail: doc.facilitySignerEmail,
      facilitySignerName: doc.facilitySignerName,
      familySignerEmail: doc.familySignerEmail,
      familySignerName: doc.familySignerName,
      facilitySignedAt: doc.facilitySignedAt,
      familySignedAt: doc.familySignedAt,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    });
  } catch (err) {
    return res.status(500).json({ error: 'Database error' });
  }
};

// List all documents
exports.listDocuments = async (req, res) => {
  try {
    const docs = await Document.find().sort({ createdAt: -1 });
    res.json({
      documents: docs.map(doc => ({
        id: doc._id,
        filename: doc.filename,
        originalName: doc.originalName,
        currentStatus: doc.currentStatus,
        envelopeId: doc.envelopeId,
        facilitySignerEmail: doc.facilitySignerEmail,
        familySignerEmail: doc.familySignerEmail,
        facilitySignedAt: doc.facilitySignedAt,
        familySignedAt: doc.familySignedAt,
        createdAt: doc.createdAt
      }))
    });
  } catch (err) {
    return res.status(500).json({ error: 'Database error' });
  }
};

// Get document events
exports.getDocumentEvents = async (req, res) => {
  const documentId = req.params.id;
  
  try {
    const events = await SigningEvent.find({ documentId }).sort({ createdAt: 1 });
    res.json({
      events: events.map(event => ({
        id: event._id,
        signerType: event.signerType,
        signerEmail: event.signerEmail,
        signerName: event.signerName,
        eventType: event.eventType,
        envelopeId: event.envelopeId,
        eventData: event.eventData,
        createdAt: event.createdAt
      }))
    });
  } catch (err) {
    return res.status(500).json({ error: 'Database error' });
  }
};

// Get signed documents
exports.getSignedDocuments = async (req, res) => {
  const documentId = req.params.id;
  
  try {
    const signedDocs = await SignedDocument.find({ documentId }).sort({ createdAt: 1 });
    res.json({
      signedDocuments: signedDocs.map(doc => ({
        id: doc._id,
        signerType: doc.signerType,
        filePath: doc.filePath,
        fileSize: doc.fileSize,
        envelopeId: doc.envelopeId,
        createdAt: doc.createdAt
      }))
    });
  } catch (err) {
    return res.status(500).json({ error: 'Database error' });
  }
};

// Download signed document
exports.downloadSignedDocument = async (req, res) => {
  const signedDocId = req.params.signedDocId;
  
  try {
    const signedDoc = await SignedDocument.findById(signedDocId);
    if (!signedDoc) {
      return res.status(404).json({ error: 'Signed document not found' });
    }

    if (!fs.existsSync(signedDoc.filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    res.download(signedDoc.filePath, `signed_${signedDoc.signerType}_${path.basename(signedDoc.filePath)}`);
  } catch (err) {
    return res.status(500).json({ error: 'Database error' });
  }
};
