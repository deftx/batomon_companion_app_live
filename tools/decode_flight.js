const fs = require('fs');
const file = process.argv[2];
const html = fs.readFileSync(file, 'utf8');
// Collect RSC flight chunks: self.__next_f.push([1,"..."])
const re = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g;
const chunks = [...html.matchAll(re)].map(m => JSON.parse('"' + m[1] + '"'));
const flight = chunks.join('');
const out = file.replace(/\.html$/, '') + '_flight.txt';
fs.writeFileSync(out, flight);
console.log('flight length:', flight.length, '->', out);
const i = flight.indexOf('cooldown');
console.log('--- context around "cooldown" ---');
console.log(flight.slice(Math.max(0, i - 400), i + 1200));
