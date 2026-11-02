const fs = require('fs');
const p = 'd:/DomExit1.2/src/dal/seedData.ts';
let c = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

// Update canonical owner in initialUsers
c = c.replace(
  /id: 'usr-owner-001',\s*clientCode: 'DEX-000001',\s*name: 'Ahmed Abdallah - Владелец \/ CEO',/,
  "id: 'usr-owner-001',\n    clientCode: 'DEX-104662',\n    name: 'Ahmed Abdallah',\n    currentRole: 'owner',"
);

// Update canonical employee in initialUsers
c = c.replace(
  /id: 'usr-staff-002',\s*clientCode: 'DEX-000002',\s*name: 'Алексей Смирнов \(Ведущий куратор\)',/,
  "id: 'usr-staff-002',\n    clientCode: 'DEX-000002',\n    name: 'Алексей Смирнов',\n    currentRole: 'employee',"
);

// Update canonical bank officer in initialUsers
c = c.replace(
  /id: 'usr-bank-001',\s*clientCode: 'DEX-000004',\s*name: 'Игорь Соколов \(Банк-партнер Сбербанк\)',/,
  "id: 'usr-bank-001',\n    clientCode: 'DEX-000004',\n    name: 'Игорь Владимирович Соколов (Сбербанк)',\n    currentRole: 'bank',"
);

fs.writeFileSync(p, c, 'utf8');
console.log('Updated canonical initialUsers in seedData.ts');
