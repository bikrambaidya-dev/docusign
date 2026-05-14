const docusign = require('docusign-esign');
const fs = require('fs');
const path = require('path');
const { Document, SigningEvent, SignedDocument } = require('../config/database-mongo');
const { sendFamilySigningRequest, sendCompletionNotification } = require('../utils/emailService');

// Handle DocuSign webhooks
exports.handleWebhook = async (req, res) => {
  try {
    const { event, envelope, recipients } = req.body;

    console.log('Webhook received:', { event, envelopeId: envelope?.envelopeId });

    if (!envelope || !envelope.envelopeId) {
      return res.status(400).json({ error: 'Invalid webhook data' });
    }

    // Find document by envelope ID
    const document = await Document.findOne({ envelopeId: envelope.envelopeId });
    if (!document) {
      console.log('No document found for envelope:', envelope.envelopeId);
      return res.status(404).json({ error: 'Document not found' });
    }

    console.log('Document found:', document.originalName);

    try {
      await processWebhookEvent(event, envelope, recipients, document);
      res.status(200).json({ message: 'Webhook processed successfully' });
    } catch (processingError) {
      console.error('Error processing webhook event:', processingError);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

// Process webhook events
const processWebhookEvent = async (event, envelope, recipients, document) => {
  const envelopeId = envelope.envelopeId;

  // Log the event
  await SigningEvent.create({
    documentId: document._id,
    signerType: event.data?.signer?.isInPerson ? 'in_person' : 
                 event.data?.signer?.signingGroupId ? 'group' : 'individual',
    signerEmail: event.data?.signer?.email || 'unknown',
    signerName: event.data?.signer?.name || 'Unknown',
    eventType: event.event,
    envelopeId,
    eventData: event
  });

  switch (event.event) {
    case 'envelope-sent':
      await Document.findByIdAndUpdate(document._id, { currentStatus: 'sent' });
      break;

    case 'envelope-delivered':
      await Document.findByIdAndUpdate(document._id, { currentStatus: 'delivered' });
      break;

    case 'envelope-completed':
      await Document.findByIdAndUpdate(document._id, { currentStatus: 'completed' });
      await sendCompletionNotification(document.familySignerEmail, document.familySignerName, document.originalName);
      break;

    case 'recipient-completed':
      if (event.data?.signer?.email === document.facilitySignerEmail) {
        await Document.findByIdAndUpdate(document._id, { 
          currentStatus: 'facility_signed',
          facilitySignedAt: new Date()
        });
        await sendFamilySigningRequest(document.familySignerEmail, document.familySignerName, document.originalName, document._id);
      } else if (event.data?.signer?.email === document.familySignerEmail) {
        await Document.findByIdAndUpdate(document._id, { 
          currentStatus: 'family_signed',
          familySignedAt: new Date()
        });
      }
      break;

    case 'recipient-signed':
      await downloadSignedDocument(envelopeId, document._id, event.data?.signer?.email);
      break;

    default:
      console.log('Unhandled event type:', event.event);
  }
};

// Download signed document from DocuSign
const downloadSignedDocument = async (envelopeId, documentId, signerEmail) => {
  try {
    const document = await Document.findById(documentId);
    if (!document) {
      console.error('Document not found for download');
      return;
    }

    const signerType = signerEmail === document.facilitySignerEmail ? 'facility' : 'family';
    const filename = `signed_${signerType}_${document.originalName}`;
    const filePath = path.join(__dirname, '../../signed_documents', filename);

    // Ensure directory exists
    const signedDir = path.dirname(filePath);
    if (!fs.existsSync(signedDir)) {
      fs.mkdirSync(signedDir, { recursive: true });
    }

    // Authenticate with DocuSign
    const privateKeyPath = process.env.DOCUSIGN_PRIVATE_KEY || path.join(__dirname, '../config/private.key');
    const privateKey = fs.readFileSync(privateKeyPath);

    const apiClient = new docusign.ApiClient();
    apiClient.setOAuthBasePath(process.env.DOCUSIGN_AUTH_SERVER);

    const results = await apiClient.requestJWTUserToken(
      process.env.DOCUSIGN_CLIENT_ID,
      process.env.DOCUSIGN_USER_ID,
      ["signature", "impersonation"],
      privateKey,
      3600
    );

    const accessToken = results.body.access_token;
    apiClient.addDefaultHeader("Authorization", "Bearer " + accessToken);
    apiClient.setBasePath(process.env.DOCUSIGN_BASE_PATH);

    const envelopesApi = new docusign.EnvelopesApi(apiClient);

    // Download the envelope documents
    const resultsDownload = await envelopesApi.getDocument(
      process.env.DOCUSIGN_ACCOUNT_ID,
      envelopeId,
      "combined",
      null
    );

    fs.writeFileSync(filePath, resultsDownload);

    // Save signed document record
    await SignedDocument.create({
      documentId,
      signerType,
      filePath,
      fileSize: fs.statSync(filePath).size,
      envelopeId
    });

    console.log(`Signed document downloaded: ${filePath}`);
  } catch (error) {
    console.error('Error downloading signed document:', error);
  }
};
