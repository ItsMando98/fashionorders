// Shared types for the FashionGram frontend.
// These mirror the JSON payloads from src/app/api/gram/*.

export type Person = {
  id: number;
  name: string;
  handle: string;
  bio?: string;
  avatar_initials: string;
};

export type Item = { id: number; title: string; brand: string; local_image: string };

export type Post = {
  id: number;
  item_id: number | null;
  title: string;
  caption: string;
  image: string;
  published: number;
};

export type Look = {
  id: number;
  title: string;
  published: number;
  result_image: string;
  status: string;
  items: { id: number; title: string }[];
};

export type MyReel = { id: number; video: string; caption: string; published: number };

export type TargetKind = "post" | "look" | "reel";

export type FeedPost = {
  kind: TargetKind;
  id: number;
  title: string;
  caption: string;
  image: string;
  created_at: string;
  user_id: number;
  name: string;
  handle: string;
  avatar_initials: string;
  like_count: number;
  comment_count: number;
  liked: number;
  saved: number;
};

export type ReelCard = {
  kind: "reel";
  id: number;
  caption: string;
  video: string;
  created_at: string;
  user_id: number;
  name: string;
  handle: string;
  avatar_initials: string;
  like_count: number;
  comment_count: number;
  liked: number;
  saved: number;
};

export type ExploreItem = {
  kind: TargetKind;
  id: number;
  title: string;
  image: string;
  created_at: string;
  handle: string;
  name: string;
  avatar_initials: string;
  like_count: number;
  comment_count: number;
  liked: number;
  saved: number;
};

export type StoryItem = {
  id: number;
  media: string;
  media_kind: string;
  caption: string;
  created_at: string;
};

export type StoryGroup = {
  user_id: number;
  name: string;
  handle: string;
  avatar_initials: string;
  mine: boolean;
  stories: StoryItem[];
};

export type Notification = {
  id: number;
  kind: string;
  target_kind: string;
  target_id: number;
  read_at: string | null;
  created_at: string;
  name: string;
  handle: string;
  avatar_initials: string;
};

export type Comment = {
  id: number;
  body: string;
  created_at: string;
  name: string;
  handle: string;
  avatar_initials: string;
};

export type Thread = {
  partner_id: number;
  name: string;
  handle: string;
  avatar_initials: string;
  body: string;
  created_at: string;
};

export type ChatMessage = {
  id: number;
  from_user_id: number;
  to_user_id: number;
  body: string;
  created_at: string;
};

export type ProfilePayload = {
  person: Person & { bio: string };
  posts: (FeedPost & { caption: string })[];
  looks: (FeedPost & { result_image: string })[];
  reels: FeedPost[];
  counts: { posts: number; followers: number; following: number };
  is_following: boolean;
  saved: { key: string; kind: TargetKind; id: number; title: string; image: string }[];
  viewer_id: number;
};
