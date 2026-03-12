/**
 * Global constants for ANNYEONG platform
 */

export const BRAND_NAME = 'ANNYEONG'
export const BRAND_KOREAN_NAME = '안녕'

export const BRAND_COLORS = {
  primary: '#9DB8A0', // Sage Green
  secondary: '#F7FAF8', // Off White
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
}

export const CATEGORY_OPTIONS = [
  { value: 'visa', label: '비자' },
  { value: 'phone', label: '휴대폰' },
  { value: 'bank', label: '은행' },
  { value: 'housing', label: '주택' },
  { value: 'academy', label: '학원' },
  { value: 'job', label: '아르바이트' },
  { value: 'package', label: '정착 패키지' },
  { value: 'mentor', label: '멘토' },
  { value: 'events', label: '모임' },
]

export const REGION_OPTIONS = [
  { value: 'seoul', label: '서울' },
  { value: 'busan', label: '부산' },
  { value: 'daegu', label: '대구' },
  { value: 'incheon', label: '인천' },
  { value: 'gwangju', label: '광주' },
  { value: 'daejeon', label: '대전' },
  { value: 'ulsan', label: '울산' },
  { value: 'sejong', label: '세종' },
  { value: 'gyeonggi', label: '경기' },
  { value: 'gangwon', label: '강원' },
  { value: 'chungbuk', label: '충북' },
  { value: 'chungnam', label: '충남' },
  { value: 'jeonbuk', label: '전북' },
  { value: 'jeonnam', label: '전남' },
  { value: 'gyeongbuk', label: '경북' },
  { value: 'gyeongnam', label: '경남' },
  { value: 'jeju', label: '제주' },
]

export const ROLES = {
  user: 'user',
  mentor: 'mentor',
  admin: 'admin',
}

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
}

export const API_ENDPOINTS = {
  AUTH: '/api/auth',
  COMMUNITY: '/api/community',
  SERVICES: '/api/services',
  TRANSLATIONS: '/api/translations',
  USERS: '/api/users',
}

export const ERROR_MESSAGES = {
  NOT_FOUND: '찾을 수 없습니다.',
  UNAUTHORIZED: '권한이 없습니다.',
  SERVER_ERROR: '서버 오류가 발생했습니다.',
  NETWORK_ERROR: '네트워크 오류가 발생했습니다.',
  INVALID_INPUT: '입력이 올바르지 않습니다.',
}
