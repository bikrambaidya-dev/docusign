require('dotenv').config();
const { connectDB } = require('./src/config/database-mongo');
const { Document } = require('./src/config/database-mongo');

async function createTestDoc() {
  try {
    await connectDB();
    const testDoc = await Document.create({
      filename: 'test.pdf',
      originalName: 'Test Document',
      filePath: '/test/test.pdf',
      fileSize: 1234,
      facilitySignerEmail: 'facility@example.com',
      facilitySignerName: 'Facility User',
      familySignerEmail: 'family@example.com',
      familySignerName: 'Family User',
      envelopeId: 'test-123'
    });
    console.log('Test document created with envelopeId:', testDoc.envelopeId);
  } catch (err) {
    console.error('Error:', err.message);
  }
  process.exit(0);
}
createTestDoc();
