import re

with open('app/dashboard/community/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old_block = re.compile(
    r'const CATEGORIES = \[[\s\S]*?\];\n\nfunction timeAgo\(dateStr: string\) \{[\s\S]*?\}\n\nexport default function CommunityPage\(\) \{\n  const \[posts',
    re.MULTILINE
)

new_block = """export default function CommunityPage() {
  const { t } = useTranslation('common');

  const CATEGORIES = [
    { label: t('community.categories.all'), value: '' },
    { label: t('community.categories.food'), value: 'food' },
    { label: t('community.categories.housing'), value: 'housing' },
    { label: t('community.categories.school'), value: 'school' },
    { label: t('community.categories.job'), value: 'job' },
    { label: t('community.categories.hospital'), value: 'hospital' },
    { label: t('community.categories.info'), value: 'info' },
    { label: t('community.categories.free'), value: 'free' },
  ];

  const timeAgo = (dateStr: string) => {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return t('common.justNow');
    if (diff < 3600) return t('common.minutesAgo', { count: Math.floor(diff / 60) });
    if (diff < 86400) return t('common.hoursAgo', { count: Math.floor(diff / 3600) });
    return t('common.daysAgo', { count: Math.floor(diff / 86400) });
  };

  const [posts"""

result = old_block.sub(new_block, content)
if result == content:
    print("NO MATCH")
    idx = content.find("const CATEGORIES")
    print(f"CATEGORIES at index: {idx}")
    # Print the chars around that position
    print(repr(content[idx:idx+200]))
else:
    with open('app/dashboard/community/page.tsx', 'w', encoding='utf-8') as f:
        f.write(result)
    print("SUCCESS")
