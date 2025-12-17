const dns = require('dns');

const host = 'aws-0-sa-east-1.pooler.supabase.com';

console.log(`Resolving ${host}...`);

dns.lookup(host, { family: 4 }, (err, address, family) => {
  if (err) {
    console.error('DNS Lookup failed:', err);
  } else {
    console.log('Address:', address);
    console.log('Family:', family);
  }
});
