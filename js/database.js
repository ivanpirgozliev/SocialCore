/**
 * SocialCore - Database Helper Functions
 * Supabase database operations for posts, comments, likes, follows
 */

import { supabase } from './supabase.js';

// ============================================
// POSTS
// ============================================

/**
 * Create a new post
 * @param {Object} postData - Post data (content, image_url)
 * @returns {Promise<Object>} Created post
 */
export async function createPost(postData) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('posts')
    .insert([
      {
        user_id: user.id,
        content: postData.content,
        image_url: postData.image_url || null,
      }
    ])
    .select(`
      *,
      profiles:user_id (
        id,
        username,
        full_name,
        avatar_url
      )
    `)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get posts for feed (with pagination)
 * @param {number} limit - Number of posts to fetch
 * @param {number} offset - Offset for pagination
 * @returns {Promise<Array>} Array of posts
 */
export async function getFeedPosts(limit = 10, offset = 0) {
  const { data, error } = await supabase
    .from('posts')
    .select(`
      *,
      profiles:user_id (
        id,
        username,
        full_name,
        avatar_url
      )
    `)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return data || [];
}

/**
 * Get posts by user ID
 * @param {string} userId - User ID
 * @param {number} limit - Number of posts to fetch
 * @returns {Promise<Array>} Array of posts
 */
export async function getUserPosts(userId, limit = 20) {
  const { data, error } = await supabase
    .from('posts')
    .select(`
      *,
      profiles:user_id (
        id,
        username,
        full_name,
        avatar_url
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

/**
 * Delete a post
 * @param {string} postId - Post ID
 */
export async function deletePost(postId) {
  const { error } = await supabase
    .from('posts')
    .delete()
    .eq('id', postId);

  if (error) throw error;
}

// ============================================
// LIKES
// ============================================

/**
 * Like a post
 * @param {string} postId - Post ID
 */
export async function likePost(postId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { error } = await supabase
    .from('likes')
    .insert([
      {
        user_id: user.id,
        post_id: postId,
      }
    ]);

  if (error) throw error;
}

/**
 * Unlike a post
 * @param {string} postId - Post ID
 */
export async function unlikePost(postId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { error } = await supabase
    .from('likes')
    .delete()
    .eq('user_id', user.id)
    .eq('post_id', postId);

  if (error) throw error;
}

/**
 * Check if user liked a post
 * @param {string} postId - Post ID
 * @returns {Promise<boolean>} True if liked
 */
export async function isPostLiked(postId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from('likes')
    .select('id')
    .eq('user_id', user.id)
    .eq('post_id', postId)
    .single();

  return !error && !!data;
}

// ============================================
// COMMENTS
// ============================================

/**
 * Create a comment on a post
 * @param {string} postId - Post ID
 * @param {string} content - Comment content
 * @returns {Promise<Object>} Created comment
 */
export async function createComment(postId, content) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('comments')
    .insert([
      {
        post_id: postId,
        user_id: user.id,
        content: content,
      }
    ])
    .select(`
      *,
      profiles:user_id (
        id,
        username,
        full_name,
        avatar_url
      )
    `)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get comments for a post
 * @param {string} postId - Post ID
 * @param {number} limit - Number of comments to fetch
 * @returns {Promise<Array>} Array of comments
 */
export async function getPostComments(postId, limit = 50) {
  const { data, error } = await supabase
    .from('comments')
    .select(`
      *,
      profiles:user_id (
        id,
        username,
        full_name,
        avatar_url
      )
    `)
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

/**
 * Delete a comment
 * @param {string} commentId - Comment ID
 */
export async function deleteComment(commentId) {
  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', commentId);

  if (error) throw error;
}

// ============================================
// FOLLOWS
// ============================================

/**
 * Follow a user
 * @param {string} userId - User ID to follow
 */
export async function followUser(userId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { error } = await supabase
    .from('follows')
    .insert([
      {
        follower_id: user.id,
        following_id: userId,
      }
    ]);

  if (error) throw error;
}

/**
 * Unfollow a user
 * @param {string} userId - User ID to unfollow
 */
export async function unfollowUser(userId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', user.id)
    .eq('following_id', userId);

  if (error) throw error;
}

/**
 * Check if user is following another user
 * @param {string} userId - User ID to check
 * @returns {Promise<boolean>} True if following
 */
export async function isFollowing(userId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from('follows')
    .select('id')
    .eq('follower_id', user.id)
    .eq('following_id', userId)
    .single();

  return !error && !!data;
}

/**
 * Get followers for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of followers
 */
export async function getFollowers(userId) {
  const { data, error } = await supabase
    .from('follows')
    .select(`
      follower_id,
      profiles:follower_id (
        id,
        username,
        full_name,
        avatar_url
      )
    `)
    .eq('following_id', userId);

  if (error) throw error;
  return data?.map(f => f.profiles) || [];
}

/**
 * Get users that a user is following
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of users
 */
export async function getFollowing(userId) {
  const { data, error } = await supabase
    .from('follows')
    .select(`
      following_id,
      profiles:following_id (
        id,
        username,
        full_name,
        avatar_url
      )
    `)
    .eq('follower_id', userId);

  if (error) throw error;
  return data?.map(f => f.profiles) || [];
}

// ============================================
// PROFILES
// ============================================

/**
 * Get user profile by ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User profile
 */
export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get user profile id by username
 * @param {string} username - Username
 * @returns {Promise<{ id: string }>} Profile id
 */
export async function getProfileIdByUsername(username) {
  const normalized = String(username || '').trim();
  if (!normalized) throw new Error('Missing username');

  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', normalized)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update user profile
 * @param {string} userId - User ID
 * @param {Object} updates - Profile updates
 */
export async function updateProfile(userId, updates) {
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);

  if (error) throw error;
}

/**
 * Search users by username or full name
 * @param {string} query - Search query
 * @param {number} limit - Number of results
 * @returns {Promise<Array>} Array of users
 */
export async function searchUsers(query, limit = 20) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url')
    .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// ============================================
// FILE UPLOADS
// ============================================

/**
 * Upload profile image (avatar or cover)
 * @param {File} file - Image file
 * @param {string} type - 'avatar' or 'cover'
 * @returns {Promise<string>} Public URL of uploaded image
 */
export async function uploadProfileImage(file, type = 'avatar') {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // Validate file
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    throw new Error('Image size must be less than 5MB');
  }

  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Only JPG, PNG and WebP images are allowed');
  }

  // Create unique filename
  const fileExt = file.name.split('.').pop();
  const fileName = `${user.id}/${type}-${Date.now()}.${fileExt}`;

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from('profile-images')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: true
    });

  if (error) throw error;

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('profile-images')
    .getPublicUrl(fileName);

  return publicUrl;
}

/**
 * Upload post image
 * @param {File} file - Image file
 * @returns {Promise<string>} Public URL of uploaded image
 */
export async function uploadPostImage(file) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // Validate file
  const maxSize = 10 * 1024 * 1024; // 10MB for posts
  if (file.size > maxSize) {
    throw new Error('Image size must be less than 10MB');
  }

  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Only JPG, PNG, WebP and GIF images are allowed');
  }

  // Create unique filename
  const fileExt = file.name.split('.').pop();
  const fileName = `${user.id}/post-${Date.now()}.${fileExt}`;

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from('post-images')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) throw error;

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('post-images')
    .getPublicUrl(fileName);

  return publicUrl;
}

// ============================================
// ADMIN FUNCTIONS
// ============================================

/**
 * Check if a user has admin role
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} True if admin
 */
export async function checkIsAdmin(userId) {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .single();

  return !error && data?.role === 'admin';
}

/**
 * Get current user's role
 * @returns {Promise<string|null>} Role string or null
 */
export async function getCurrentUserRole() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (error) return null;
  return data?.role || null;
}

/**
 * Get admin dashboard statistics
 * @returns {Promise<Object>} Stats object with totalUsers, totalPosts, totalComments
 */
export async function getAdminStats() {
  const [usersResult, postsResult, commentsResult] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('posts').select('id', { count: 'exact', head: true }),
    supabase.from('comments').select('id', { count: 'exact', head: true }),
  ]);

  return {
    totalUsers: usersResult.count || 0,
    totalPosts: postsResult.count || 0,
    totalComments: commentsResult.count || 0,
  };
}

/**
 * Get all users with their roles for admin panel
 * @returns {Promise<Array>} Array of users with role info
 */
export async function getAdminUsers() {
  // Get profiles with roles
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select(`
      id,
      username,
      full_name,
      avatar_url,
      created_at
    `)
    .order('created_at', { ascending: false });

  if (profilesError) throw profilesError;

  // Get all user roles
  const { data: roles, error: rolesError } = await supabase
    .from('user_roles')
    .select('user_id, role');

  if (rolesError) throw rolesError;

  // Build a role lookup map
  const roleMap = {};
  (roles || []).forEach(r => { roleMap[r.user_id] = r.role; });

  // We need emails from auth - get them via a workaround
  // Since we can't query auth.users directly from the client,
  // we'll leave email blank and let the edge functions handle it
  // Actually, we can store email in profiles or get it from the session
  // For now, let's use the profiles data and enrich with role

  return (profiles || []).map(p => ({
    ...p,
    role: roleMap[p.id] || 'user',
    email: '', // Will be fetched separately if needed
  }));
}

/**
 * Get recent posts for admin panel
 * @param {number} limit - Number of posts to fetch
 * @returns {Promise<Array>} Array of posts with author info
 */
export async function getAdminPosts(limit = 20) {
  const { data, error } = await supabase
    .from('posts')
    .select(`
      *,
      profiles:user_id (
        id,
        username,
        full_name,
        avatar_url
      )
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

/**
 * Delete a post (admin action - bypasses normal ownership check)
 * @param {string} postId - Post ID to delete
 */
export async function deletePostAdmin(postId) {
  // First delete related comments and likes
  const { error: likesError } = await supabase
    .from('likes')
    .delete()
    .eq('post_id', postId);

  if (likesError) console.warn('Error deleting post likes:', likesError);

  const { error: commentsError } = await supabase
    .from('comments')
    .delete()
    .eq('post_id', postId);

  if (commentsError) console.warn('Error deleting post comments:', commentsError);

  const { error } = await supabase
    .from('posts')
    .delete()
    .eq('id', postId);

  if (error) throw error;
}
