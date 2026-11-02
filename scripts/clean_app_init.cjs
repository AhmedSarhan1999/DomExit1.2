const fs = require('fs');
const p = 'd:/DomExit1.2/src/App.tsx';
let c = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

c = c.replace(
  "  useEffect(() => {\n    DatabaseInitializer.initLiveDatabase();\n  }, []);",
  "  // Anti-seeding enforced: mock lots/deals auto-injection disabled."
);

fs.writeFileSync(p, c, 'utf8');
console.log('Cleaned App.tsx initialization');
