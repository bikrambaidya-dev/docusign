require("dotenv").config();
const express = require("express");
const path = require("path");

// Connect to MongoDB
const { connectDB } = require("./src/config/database-mongo");
connectDB().catch(err => {
  console.error('MongoDB connection failed:', err.message);
  process.exit(1);
});

const docusignRoutes = require("./src/routes/docusignRoutes");

const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/downloads', express.static(path.join(__dirname, 'downloads')));

// Routes
app.use("/api/docusign", docusignRoutes);

// OAuth redirect/callback (used for DocuSign consent screen redirect)
app.get('/docusign/callback', (req, res) => {
  res.status(200).send('DocuSign consent redirect received. You can close this tab and return to the app.');
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Root endpoint with API documentation
app.get('/', (req, res) => {
  res.json({
    message: 'DocuSign Document Management API',
    version: '1.0.0',
    endpoints: {
      documentManagement: {
        upload: 'POST /api/docusign/upload - Upload PDF document',
        list: 'GET /api/docusign/documents - List all documents',
        get: 'GET /api/docusign/documents/:id - Get document details',
        events: 'GET /api/docusign/documents/:id/events - Get document events',
        signed: 'GET /api/docusign/documents/:id/signed - Get signed documents',
        status: 'GET /api/docusign/documents/:id/status - Get document status',
        download: 'GET /api/docusign/signed/:signedDocId - Download signed document'
      },
      signing: {
        send: 'POST /api/docusign/send - Send document for signing'
      },
      webhooks: {
        handler: 'POST /api/docusign/webhook - DocuSign webhook handler'
      },
      utility: {
        health: 'GET /health - Health check'
      }
    },
    workflow: {
      step1: 'Upload PDF with facility and family signer information',
      step2: 'Send document for sequential signing (facility first, then family)',
      step3: 'Facility user receives email and signs document',
      step4: 'Family user receives email and signs document',
      step5: 'Completed document is stored and notifications are sent'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API documentation: http://localhost:${PORT}/`);
});
