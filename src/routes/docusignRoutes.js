const express = require("express");
const router = express.Router();

// DocuSign routes
const { sendDocument } = require("../controllers/docusignController");

// Document management routes
const { 
  uploadDocument, 
  getDocument, 
  listDocuments, 
  getDocumentEvents, 
  getSignedDocuments, 
  downloadSignedDocument 
} = require("../controllers/documentController");

// Webhook routes
const { handleWebhook } = require("../controllers/webhookController");

// API Routes

// Document management
router.post("/upload", uploadDocument);
router.get("/documents", listDocuments);
router.get("/documents/:id", getDocument);
router.get("/documents/:id/events", getDocumentEvents);
router.get("/documents/:id/signed", getSignedDocuments);
router.get("/signed/:signedDocId", downloadSignedDocument);

// DocuSign integration
router.post("/send", sendDocument);

// Webhook handler
router.post("/webhook", handleWebhook);

module.exports = router;