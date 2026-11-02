const fs = require('fs');

// 1. LotsRepository.ts
{
  const p = 'd:/DomExit1.2/src/dal/repositories/LotsRepository.ts';
  let c = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
  c = c.replace(
    'let list = await DatabaseGateway.getAll<Lot>(COLLECTION, initialLots);',
    'let list = await DatabaseGateway.getAll<Lot>(COLLECTION, []);'
  );
  fs.writeFileSync(p, c, 'utf8');
  console.log('Updated LotsRepository.ts');
}

// 2. DealsRepository.ts
{
  const p = 'd:/DomExit1.2/src/dal/repositories/DealsRepository.ts';
  let c = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
  c = c.replace(
    'let list = await DatabaseGateway.getAll<DealTrack>(COLLECTION, initialDeals);',
    'let list = await DatabaseGateway.getAll<DealTrack>(COLLECTION, []);'
  );
  fs.writeFileSync(p, c, 'utf8');
  console.log('Updated DealsRepository.ts');
}

// 3. CandidatesRepository.ts
{
  const p = 'd:/DomExit1.2/src/dal/repositories/CandidatesRepository.ts';
  let c = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
  c = c.replace(
    'DatabaseGateway.getAll<BuyerCandidate>(COLLECTION, initialCandidates),',
    'DatabaseGateway.getAll<BuyerCandidate>(COLLECTION, []),'
  );
  fs.writeFileSync(p, c, 'utf8');
  console.log('Updated CandidatesRepository.ts');
}

// 4. SellerRequestsRepository.ts
{
  const p = 'd:/DomExit1.2/src/dal/repositories/SellerRequestsRepository.ts';
  let c = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
  c = c.replace(
    'const list = await DatabaseGateway.getAll<SellerExitRequest>(\n      COLLECTION,\n      initialSellerRequests\n    );',
    'const list = await DatabaseGateway.getAll<SellerExitRequest>(\n      COLLECTION,\n      []\n    );'
  );
  fs.writeFileSync(p, c, 'utf8');
  console.log('Updated SellerRequestsRepository.ts');
}

// 5. AuditLogsRepository.ts
{
  const p = 'd:/DomExit1.2/src/dal/repositories/AuditLogsRepository.ts';
  let c = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
  c = c.replace(
    'let logs = await DatabaseGateway.getAll<AuditLogEntry>(COLLECTION, initialLogs);',
    'let logs = await DatabaseGateway.getAll<AuditLogEntry>(COLLECTION, []);'
  );
  fs.writeFileSync(p, c, 'utf8');
  console.log('Updated AuditLogsRepository.ts');
}

// 6. BankPortalRepository.ts
{
  const p = 'd:/DomExit1.2/src/dal/repositories/BankPortalRepository.ts';
  let c = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
  
  c = c.replace(
    'return DatabaseGateway.getAll<BankEmployee>(BANK_EMP_COLLECTION, initialBankEmployees);',
    'return DatabaseGateway.getAll<BankEmployee>(BANK_EMP_COLLECTION, []);'
  );

  // special approvals fallback
  c = c.replace(
    /return DatabaseGateway\.getAll<SpecialApprovalRequest>\(\s*SPECIAL_APPROVAL_COLLECTION,\s*\[[\s\S]*?\]\s*\);/,
    'return DatabaseGateway.getAll<SpecialApprovalRequest>(SPECIAL_APPROVAL_COLLECTION, []);'
  );

  // credit limits fallback
  c = c.replace(
    /const list = await DatabaseGateway\.getAll<BuyerCreditLimitRequest>\(\s*CREDIT_LIMITS_COLLECTION,\s*\[[\s\S]*?\]\s*\);/,
    'const list = await DatabaseGateway.getAll<BuyerCreditLimitRequest>(CREDIT_LIMITS_COLLECTION, []);'
  );

  fs.writeFileSync(p, c, 'utf8');
  console.log('Updated BankPortalRepository.ts');
}
