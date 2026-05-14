const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/docusign', {
      serverSelectionTimeoutMS: 5000
    });
    console.log('Connected to MongoDB');
    return conn;
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    throw err;
  }
};

// Document schema
const DocumentSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  filePath: { type: String, required: true },
  fileSize: { type: Number, required: true },
  currentStatus: { type: String, default: 'uploaded' },
  envelopeId: String,
  facilitySignerEmail: String,
  facilitySignerName: String,
  familySignerEmail: String,
  familySignerName: String,
  facilitySignedAt: Date,
  familySignedAt: Date,
}, { timestamps: true });

// Signing event schema
const SigningEventSchema = new mongoose.Schema({
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true },
  signerType: { type: String, required: true }, // 'facility' or 'family'
  signerEmail: { type: String, required: true },
  signerName: { type: String, required: true },
  eventType: { type: String, required: true }, // 'sent', 'signed', 'completed', 'declined'
  envelopeId: String,
  eventData: Object, // JSON data from DocuSign
}, { timestamps: true });

// Signed document schema
const SignedDocumentSchema = new mongoose.Schema({
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true },
  signerType: { type: String, required: true },
  filePath: { type: String, required: true },
  fileSize: { type: Number, required: true },
  envelopeId: String,
}, { timestamps: true });

const Document = mongoose.model('Document', DocumentSchema);
const SigningEvent = mongoose.model('SigningEvent', SigningEventSchema);
const SignedDocument = mongoose.model('SignedDocument', SignedDocumentSchema);

module.exports = {
  connectDB,
  Document,
  SigningEvent,
  SignedDocument
};
