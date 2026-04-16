// User types
export type User = {
  id: string
  email: string
  name: string
  profile_image_url?: string
  bio?: string
  language: string
  country_code: string
  role: 'user' | 'mentor' | 'admin'
  created_at: string
  updated_at: string
}

// Community types
export type CommunityPost = {
  id: string
  user_id: string
  title: string
  content: string
  category: string
  region: string
  language: string
  image_urls?: string[]
  likes_count: number
  comments_count: number
  created_at: string
  updated_at: string
}

export type CommunityComment = {
  id: string
  post_id: string
  user_id: string
  content: string
  language: string
  likes_count: number
  created_at: string
  updated_at: string
}

// Service types
export type Service = {
  id: string
  name: string
  description: string
  category: 'visa' | 'phone' | 'bank' | 'housing' | 'academy' | 'job' | 'package' | 'mentor' | 'events'
  price?: number
  is_free: boolean
  created_at: string
}

// Mentor/Buddy types
export type Mentor = {
  id: string
  user_id: string
  bio: string
  specializations: string[]
  rating: number
  reviews_count: number
  availability: string
  created_at: string
}

// Gather (모여라) types
export type GatherPost = {
  id: string
  author_id: string
  title: string
  content: string | null
  category: 'language' | 'drink' | 'sports' | 'food' | 'talk' | 'game' | 'pet' | 'travel' | 'sing' | 'movie' | 'etc'
  location_type: 'quick' | 'map'
  location_label: string
  lat: number | null
  lng: number | null
  meet_at: string
  max_participants: number
  expires_at: string
  created_at: string
  // 하위 호환성 유지
  chat_room_id: string | null
  // ✅ 확정 상태의 단일 기준
  confirmed: boolean
  confirmed_at: string | null
  confirmed_chat_room_id: string | null
}

export type GatherParticipant = {
  id: string
  gather_post_id: string
  user_id: string
  created_at: string
}

// Gather Group Chat types
export type GatherChatRoom = {
  id: string
  gather_post_id: string
  title: string
  expires_at: string
  created_at: string
}

export type GatherChatMember = {
  id: string
  room_id: string
  user_id: string
  created_at: string
}

export type GatherChatMessage = {
  id: string
  room_id: string
  sender_id: string
  content: string
  language: string | null
  created_at: string
}
