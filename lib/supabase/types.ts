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
