import { createReadStream, readFileSync, statSync } from 'fs';
import * as tus from 'tus-js-client';

const filePath = 'C:/Users/Zebrosha/AppData/Local/Temp/test_real.mp4';
const fileSize = statSync(filePath).size;

// For small files, read into buffer; for creation-with-upload we need the full body
const fileBuffer = readFileSync(filePath);

const upload = new tus.Upload(fileBuffer as any, {
  endpoint: 'https://uploader.kinescope.io/v2/video',
  headers: {
    'Authorization': 'Bearer 6756bfa2-08cc-4340-a72a-ddbcc7741655',
  },
  metadata: {
    parent_id: 'ad127c11-6187-4fe2-bbfa-16f0d708a41c',
    title: 'Test Upload Delete Me',
    type: 'video',
  },
  uploadSize: fileSize,
  // Send the whole file in the creation request
  uploadDataDuringCreation: true,
  onError: (error: any) => {
    console.error('Upload failed:', error.message);
    if (error.originalResponse) {
      console.error('Response body:', error.originalResponse.getBody());
      console.error('Response status:', error.originalResponse.getStatus());
    }
  },
  onProgress: (bytesUploaded: number, bytesTotal: number) => {
    const pct = ((bytesUploaded / bytesTotal) * 100).toFixed(1);
    console.log(`Progress: ${pct}% (${bytesUploaded}/${bytesTotal})`);
  },
  onSuccess: () => {
    console.log('Upload complete!');
    console.log('Upload URL:', upload.url);
  },
});

upload.start();
