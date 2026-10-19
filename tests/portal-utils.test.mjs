import {test} from 'node:test';
import assert from 'node:assert/strict';
import {slugify,dateRange,escapeHTML,label,FORMATS} from '../assets/js/portal-utils.js';

test('slugify produces database-valid slugs',()=>{
 const valid=/^[a-z0-9]+(-[a-z0-9]+)*$/;
 for(const [input,expected] of [['Instrument Makers Lab','instrument-makers-lab'],['  SEMA — Production I ','sema-production-i'],['Café Beats!!','cafe-beats']])assert.equal(slugify(input),expected);
 assert.match(slugify('x'.repeat(79)+' y'),valid);
});
test('dateRange formats open and closed ranges',()=>{
 assert.equal(dateRange('2027-01-10','2027-06-30'),'10 Jan 2027 – 30 Jun 2027');
 assert.equal(dateRange('2027-01-10',null),'From 10 Jan 2027');
 assert.equal(dateRange(null,null),'');
 assert.equal(dateRange('2027-01-10','2027-01-10'),'10 Jan 2027');
});
test('escaping and labels',()=>{
 assert.equal(escapeHTML('<a href="x">'),'&lt;a href=&quot;x&quot;&gt;');
 assert.equal(label(FORMATS,'lab'),'Lab');
});
