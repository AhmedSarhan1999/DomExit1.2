const fs = require('fs');

// 1. PartnerRequestsRepository.ts
{
  const p = 'd:/DomExit1.2/src/dal/repositories/PartnerRequestsRepository.ts';
  let c = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
  c = c.replace(
    /const all = await DatabaseGateway\.getAll<PartnerPreliminaryRequest>\(COLLECTION,\s*\[[\s\S]*?\]\s*\);/,
    'const all = await DatabaseGateway.getAll<PartnerPreliminaryRequest>(COLLECTION, []);'
  );
  fs.writeFileSync(p, c, 'utf8');
  console.log('Updated PartnerRequestsRepository.ts');
}

// 2. DevelopersRepository.ts
{
  const p = 'd:/DomExit1.2/src/dal/repositories/DevelopersRepository.ts';
  let c = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
  c = c.replace(
    'return DatabaseGateway.getAll<DeveloperAccreditationRequest>(\n      ACCREDITATION_REQUESTS_COLLECTION,\n      INITIAL_DEVELOPER_ACCREDITATION_REQUESTS\n    );',
    'return DatabaseGateway.getAll<DeveloperAccreditationRequest>(\n      ACCREDITATION_REQUESTS_COLLECTION,\n      []\n    );'
  );
  fs.writeFileSync(p, c, 'utf8');
  console.log('Updated DevelopersRepository.ts');
}
