import { execSync } from 'node:child_process';

const LEGACY_SA_ID = 'aje6k12e2ijmubei45r3';
const LEGACY_KEY_ID = 'ajevbkab02dgue1c7huj';

console.log('=== Legacy Access Key Revocation Tool (SAFETY GUARDED) ===');
console.log('Legacy Service Account:', LEGACY_SA_ID, '(domexit-sa)');
console.log('Legacy Static Key ID:  ', LEGACY_KEY_ID);

if (!process.argv.includes('--confirm-revoke')) {
  console.log('\n[DRY RUN / INSPECTION MODE]');
  console.log('To actually revoke this legacy key, you must explicitly pass: --confirm-revoke');
  console.log('Checking current key status via yc CLI...');
  try {
    const listRaw = execSync(`yc iam access-key list --service-account-id ${LEGACY_SA_ID} --format json`, {
      encoding: 'utf-8',
    });
    console.log('Found keys on legacy service account:');
    console.log(listRaw);
  } catch (err) {
    console.error('Failed to list keys:', err.message);
  }
  console.log('NO ACTION TAKEN. Legacy key is still intact.');
  process.exit(0);
}

// Actual revocation
console.log('\n[CRITICAL WARNING] --confirm-revoke passed. Deleting legacy access key...');
try {
  execSync(`yc iam access-key delete ${LEGACY_KEY_ID}`, { stdio: 'inherit' });
  console.log('✓ Successfully deleted legacy access key:', LEGACY_KEY_ID);
} catch (err) {
  console.error('✗ Failed to delete access key:', err.message);
  process.exit(1);
}
