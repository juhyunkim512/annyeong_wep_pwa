const fs = require('fs');
const langs = { ko: '삭제', en: 'Delete', ja: '削除', zh: '删除', vi: 'Xóa', es: 'Eliminar' };
for (const [lang, val] of Object.entries(langs)) {
  const file = `lib/locales/${lang}/common.json`;
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!data.common) data.common = {};
  data.common.delete = val;
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  console.log(lang + ' done');
}
