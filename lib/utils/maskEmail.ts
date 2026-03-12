/**
 * 이메일 마스킹 함수
 * 규칙:
 * - @ 앞: 앞 4글자만 보이고 나머지는 ****
 * - 도메인명: 첫 글자만 보이고 나머지는 ****
 * - TLD: ***
 * 
 * 예: wnwk6438@naver.com → wnwk****@n****.***
 */
export function maskEmail(email: string): string {
  const [localPart, domain] = email.split('@');

  if (!localPart || !domain) {
    return email;
  }

  // Email ID 마스킹: 앞 4글자만 보이고 나머지는 ****
  const maskedLocalPart = localPart.substring(0, 4) + '****';

  // 도메인 파싱: example.com → [example, com]
  const domainParts = domain.split('.');
  if (domainParts.length < 2) {
    return email;
  }

  // 도메인명 마스킹: 첫 글자만 보이고 나머지는 ****
  const domainName = domainParts[0];
  const maskedDomainName = domainName.charAt(0) + '****';

  // TLD 마스킹: ***
  const maskedTld = '***';

  return `${maskedLocalPart}@${maskedDomainName}.${maskedTld}`;
}
