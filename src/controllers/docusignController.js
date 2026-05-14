const docusign = require("docusign-esign");
const fs = require("fs");
const path = require("path");
const { Document, SigningEvent } = require("../config/database-mongo");
const { sendFacilitySigningRequest } = require("../utils/emailService");

exports.sendDocument = async (req, res) => {
  try {
    const { documentId } = req.body;

    if (!documentId) {
      return res.status(400).json({ error: 'Document ID is required' });
    }

    // Get document from database
    const document = await Document.findById(documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (!document.facilitySignerEmail || !document.familySignerEmail) {
      return res.status(400).json({ error: 'Both facility and family signer emails are required' });
    }

    try {
        const privateKeyPath =
          process.env.DOCUSIGN_PRIVATE_KEY ||
          path.resolve(__dirname, "../config/private.key");
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

        // Read the PDF file
        const pdfBytes = fs.readFileSync(document.filePath);

        const envelopeDefinition = new docusign.EnvelopeDefinition();
        envelopeDefinition.emailSubject = "Please sign this document";

        const doc = new docusign.Document();
        doc.documentBase64 = pdfBytes.toString("base64");
        doc.name = document.originalName;
        doc.fileExtension = "pdf";
        doc.documentId = "1";

        // Facility signer (first)
        const facilitySigner = new docusign.Signer();
        facilitySigner.email = document.facilitySignerEmail;
        facilitySigner.name = document.facilitySignerName || 'Facility User';
        facilitySigner.recipientId = "1";
        facilitySigner.routingOrder = "1";

        // Family signer (second)
        const familySigner = new docusign.Signer();
        familySigner.email = document.familySignerEmail;
        familySigner.name = document.familySignerName || 'Family User';
        familySigner.recipientId = "2";
        familySigner.routingOrder = "2";

        // Add signature tabs for both signers
        const facilitySignHere = new docusign.SignHere();
        facilitySignHere.anchorString = "/facility_sign/";
        facilitySignHere.recipientId = "1";

        const familySignHere = new docusign.SignHere();
        familySignHere.anchorString = "/family_sign/";
        familySignHere.recipientId = "2";

        // Set tabs for facility signer
        const facilityTabs = new docusign.Tabs();
        facilityTabs.signHereTabs = [facilitySignHere];
        facilitySigner.tabs = facilityTabs;

        // Set tabs for family signer
        const familyTabs = new docusign.Tabs();
        familyTabs.signHereTabs = [familySignHere];
        familySigner.tabs = familyTabs;

        const recipients = new docusign.Recipients();
        recipients.signers = [facilitySigner, familySigner];

        envelopeDefinition.documents = [doc];
        envelopeDefinition.recipients = recipients;
        envelopeDefinition.status = "sent";

        const envelopeResult = await envelopesApi.createEnvelope(
          process.env.DOCUSIGN_ACCOUNT_ID,
          { envelopeDefinition }
        );

        // Update document with envelope ID
        await Document.findByIdAndUpdate(documentId, {
          envelopeId: envelopeResult.envelopeId,
          currentStatus: 'sent_to_facility'
        });

        // Log signing events
        await SigningEvent.create([
          {
            documentId,
            signerType: 'facility',
            signerEmail: document.facilitySignerEmail,
            signerName: document.facilitySignerName,
            eventType: 'sent',
            envelopeId: envelopeResult.envelopeId
          },
          {
            documentId,
            signerType: 'family',
            signerEmail: document.familySignerEmail,
            signerName: document.familySignerName,
            eventType: 'sent',
            envelopeId: envelopeResult.envelopeId
          }
        ]);

        // Send email notifications
        try {
          await sendFacilitySigningRequest(
            document.facilitySignerEmail,
            document.facilitySignerName,
            document.originalName,
            documentId
          );
        } catch (emailError) {
          console.error('Error sending facility email:', emailError);
        }

        res.json({
          message: "Document sent for sequential signing",
          documentId,
          envelopeId: envelopeResult.envelopeId,
          facilitySigner: {
            email: document.facilitySignerEmail,
            name: document.facilitySignerName
          },
          familySigner: {
            email: document.familySignerEmail,
            name: document.familySignerName
          }
        });

      } catch (docusignError) {
        console.error('DocuSign error:', docusignError);
        const status = docusignError?.response?.status || 500;
        const details = docusignError?.response?.data || docusignError?.body || docusignError?.message;
        res.status(status).json({
          error: 'Failed to send document to DocuSign',
          details
        });
      }
    } catch (error) {
      console.error('Server error:', error);
      res.status(500).json({ error: 'Server error' });
    }
};
