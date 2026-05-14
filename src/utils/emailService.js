const nodemailer = require('nodemailer');
require('dotenv').config();

// Create email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Send email function
const sendEmail = async (to, subject, html, attachments = []) => {
  try {
    // Validate email recipient
    if (!to || !to.includes('@')) {
      console.error('Invalid email recipient:', to);
      throw new Error('Invalid email recipient');
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: to,
      subject: subject,
      html: html,
      attachments: attachments
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', result.messageId);
    return result;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

// Send facility signing request
const sendFacilitySigningRequest = async (email, name, documentName, documentId) => {
  try {
    // Validate email recipient
    if (!email || !email.includes('@')) {
      console.error('Invalid facility email:', email);
      return; // Skip sending if email is invalid
    }

    const subject = 'Document Signing Request - Facility User';
    const html = `
      <h2>Document Signing Request</h2>
      <p>Dear ${name},</p>
      <p>You have been requested to sign the document: <strong>${documentName}</strong></p>
      <p>Document ID: ${documentId}</p>
      <p>Please check your email for the DocuSign signing request. This is the first step in the signing process.</p>
      <br>
      <p>Best regards,<br>Document Management System</p>
    `;

    const result = await sendEmail(email, subject, html);
    console.log('Facility signing request sent to:', email);
    return result;
  } catch (error) {
    console.error('Error sending facility signing request:', error.message);
    // Don't throw - allow process to continue
  }
};

// Send family signing request
const sendFamilySigningRequest = async (email, name, documentName, documentId) => {
  try {
    // Validate email recipient
    if (!email || !email.includes('@')) {
      console.error('Invalid family email:', email);
      return; // Skip sending if email is invalid
    }

    const subject = 'Document Signing Request - Family User';
    const html = `
      <h2>Document Signing Request</h2>
      <p>Dear ${name},</p>
      <p>You have been requested to sign the document: <strong>${documentName}</strong></p>
      <p>Document ID: ${documentId}</p>
      <p>The facility user has completed their signing. Please review and sign the document.</p>
      <p>Please check your email for the DocuSign signing request.</p>
      <br>
      <p>Best regards,<br>Document Management System</p>
    `;

    const result = await sendEmail(email, subject, html);
    console.log('Family signing request sent to:', email);
    return result;
  } catch (error) {
    console.error('Error sending family signing request:', error.message);
    // Don't throw - allow process to continue
  }
};

// Send completion notification
const sendCompletionNotification = async (familyEmail, familyName, documentName, documentId, signedDocumentPath) => {
  try {
    // Validate email recipient
    if (!familyEmail || !familyEmail.includes('@')) {
      console.error('Invalid family email for completion notification:', familyEmail);
      return; // Skip sending if email is invalid
    }

    const subject = 'Document Signing Completed';
    const html = `
      <h2>Document Signing Completed</h2>
      <p>The document <strong>${documentName}</strong> has been successfully signed by all parties.</p>
      <p>Document ID: ${documentId}</p>
      <p>The signed document is attached to this email for your records.</p>
      <br>
      <p>Best regards,<br>Document Management System</p>
    `;

    const attachments = [];
    if (signedDocumentPath) {
      attachments.push({
        filename: `signed_${documentName}`,
        path: signedDocumentPath
      });
    }

    await sendEmail(familyEmail, subject, html, attachments);
    console.log('Completion notification sent to:', familyEmail);
  } catch (error) {
    console.error('Error sending completion notification:', error.message);
    // Don't throw - allow webhook to continue
  }
};

module.exports = {
  sendEmail,
  sendFacilitySigningRequest,
  sendFamilySigningRequest,
  sendCompletionNotification
};
