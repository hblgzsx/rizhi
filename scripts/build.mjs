import {mkdir,copyFile,writeFile} from 'node:fs/promises';
const files=['index.html','app.js','core.js','markdown.js','exports.js','sources.js','hotboards.js','styles.css','writer.css','favicon.svg'];
await mkdir('public_build/data',{recursive:true});
for(const file of files)await copyFile(file,'public_build/'+file);
await copyFile('data/news.json','public_build/data/news.json');
await copyFile('data/hotboards.json','public_build/data/hotboards.json');
await writeFile('public_build/.nojekyll','');
console.log('Built public_build: public website files only.');
