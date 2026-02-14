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
      ),
      comments:comments(count),
      likes:likes(count)
    `)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return hydratePostLikeState(data || []);
}

/**
 * Get feed posts only from users the current user follows or is friends with
 * @param {number} limit - Number of posts to fetch
 * @param {number} offset - Offset for pagination
 * @returns {Promise<Array>} Array of posts
 */
export async function getFollowingFeedPosts(limit = 10, offset = 0, selectedAuthorId = null) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data: followingRows, error: followingError } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', user.id);

  if (followingError) throw followingError;

  const friendIds = await getAcceptedFriendIdsForUser(user.id);
  const authorIds = new Set((followingRows || []).map((row) => row.following_id).filter(Boolean));

  friendIds.forEach((friendId) => {
    authorIds.add(friendId);
  });

  authorIds.delete(user.id);

  let ids = Array.from(authorIds);

  if (selectedAuthorId) {
    if (!authorIds.has(selectedAuthorId)) return [];
    ids = [selectedAuthorId];
  }

  if (!ids.length) return [];

  const { data, error } = await supabase
    .from('posts')
    .select(`
      *,
      profiles:user_id (
        id,
        username,
        full_name,
        avatar_url
      ),
      comments:comments(count),
      likes:likes(count)
    `)
    .in('user_id', ids)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return hydratePostLikeState(data || []);
}

/**
 * Get merged list of accounts for Following tab filters
 * Includes users the current user follows and users they are friends with
 * @returns {Promise<Array>} Array of unique profile objects
 */
export async function getFollowingFeedAccounts() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const [following, friends] = await Promise.all([
    getFollowing(user.id),
    getFriendsList(),
  ]);

  const byId = new Map();

  (following || []).forEach((profile) => {
    if (!profile?.id || profile.id === user.id) return;
    byId.set(profile.id, { ...profile });
  });

  (friends || []).forEach((profile) => {
    if (!profile?.id || profile.id === user.id) return;
    if (byId.has(profile.id)) return;
    byId.set(profile.id, { ...profile });
  });

  return Array.from(byId.values());
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
      ),
      comments:comments(count),
      likes:likes(count)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return hydratePostLikeState(data || []);
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
export async function createComment(postId, content, parentCommentId = null) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('comments')
    .insert([
      {
        post_id: postId,
        user_id: user.id,
        content: content,
        parent_comment_id: parentCommentId,
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
      ),
      likes:likes(count)
    `)
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return hydrateCommentLikeState(data || []);
}

/**
 * Like a comment
 * @param {string} commentId - Comment ID
 */
export async function likeComment(commentId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { error } = await supabase
    .from('likes')
    .insert([
      {
        user_id: user.id,
        comment_id: commentId,
      }
    ]);

  if (error) throw error;
}

/**
 * Unlike a comment
 * @param {string} commentId - Comment ID
 */
export async function unlikeComment(commentId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { error } = await supabase
    .from('likes')
    .delete()
    .eq('user_id', user.id)
    .eq('comment_id', commentId);

  if (error) throw error;
}

/**
 * Check if user liked a comment
 * @param {string} commentId - Comment ID
 * @returns {Promise<boolean>} True if liked
 */
export async function isCommentLiked(commentId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from('likes')
    .select('id')
    .eq('user_id', user.id)
    .eq('comment_id', commentId)
    .single();

  return !error && !!data;
}

function resolveRelationCount(row, relationName, fallbackField) {
  const relation = row?.[relationName];
  if (Array.isArray(relation) && relation.length && relation[0]?.count != null) {
    const countValue = Number(relation[0].count);
    return Number.isFinite(countValue) ? countValue : 0;
  }
  if (Number.isFinite(row?.[fallbackField])) {
    return row[fallbackField];
  }
  return 0;
}

async function hydratePostLikeState(posts) {
  if (!posts.length) return [];

  const normalized = posts.map((post) => ({
    ...post,
    likes_count: resolveRelationCount(post, 'likes', 'likes_count'),
    comments_count: resolveRelationCount(post, 'comments', 'comments_count'),
  }));

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return normalized.map((post) => ({ ...post, liked_by_user: false }));

  const postIds = normalized.map((post) => post.id).filter(Boolean);
  if (!postIds.length) return normalized.map((post) => ({ ...post, liked_by_user: false }));

  const { data: likesData, error } = await supabase
    .from('likes')
    .select('post_id')
    .eq('user_id', user.id)
    .in('post_id', postIds);

  if (error) {
    return normalized.map((post) => ({ ...post, liked_by_user: false }));
  }

  const likedSet = new Set((likesData || []).map((like) => like.post_id));
  return normalized.map((post) => ({
    ...post,
    liked_by_user: likedSet.has(post.id),
  }));
}

async function hydrateCommentLikeState(comments) {
  if (!comments.length) return [];

  const normalized = comments.map((comment) => ({
    ...comment,
    likes_count: resolveRelationCount(comment, 'likes', 'likes_count'),
  }));

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return normalized.map((comment) => ({ ...comment, liked_by_user: false }));

  const commentIds = normalized.map((comment) => comment.id).filter(Boolean);
  if (!commentIds.length) return normalized.map((comment) => ({ ...comment, liked_by_user: false }));

  const { data: likesData, error } = await supabase
    .from('likes')
    .select('comment_id')
    .eq('user_id', user.id)
    .in('comment_id', commentIds);

  if (error) {
    return normalized.map((comment) => ({ ...comment, liked_by_user: false }));
  }

  const likedSet = new Set((likesData || []).map((like) => like.comment_id));
  return normalized.map((comment) => ({
    ...comment,
    liked_by_user: likedSet.has(comment.id),
  }));
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

/**
 * Update a comment
 * @param {string} commentId - Comment ID
 * @param {string} content - Updated comment content
 */
export async function updateComment(commentId, content) {
  const normalized = String(content || '').trim();
  if (!normalized) {
    throw new Error('Comment cannot be empty');
  }

  const { error } = await supabase
    .from('comments')
    .update({ content: normalized })
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
    .upsert([
      {
        follower_id: user.id,
        following_id: userId,
      }
    ], {
      onConflict: 'follower_id,following_id',
      ignoreDuplicates: true,
    });

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
// FRIEND REQUESTS
// ============================================

async function getAcceptedFriendIdsForUser(userId) {
  const { data, error } = await supabase
    .from('friend_requests')
    .select('requester_id, addressee_id')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

  if (error) throw error;

  const ids = new Set();
  (data || []).forEach((row) => {
    const otherId = row.requester_id === userId ? row.addressee_id : row.requester_id;
    if (otherId) ids.add(otherId);
  });

  return ids;
}

/**
 * Send a friend request
 * @param {string} userId - User ID to add
 */
export async function sendFriendRequest(userId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { error } = await supabase
    .from('friend_requests')
    .insert([
      {
        requester_id: user.id,
        addressee_id: userId,
        status: 'pending',
      }
    ]);

  if (error) throw error;
}

/**
 * Cancel a pending friend request (by target user id)
 * @param {string} userId - User ID to cancel request for
 */
export async function cancelFriendRequest(userId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { error } = await supabase
    .from('friend_requests')
    .delete()
    .eq('status', 'pending')
    .eq('requester_id', user.id)
    .eq('addressee_id', userId);

  if (error) throw error;
}

/**
 * Accept a friend request (by request id)
 * @param {string} requestId - Request ID
 */
export async function acceptFriendRequest(requestId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('friend_requests')
    .update({ status: 'accepted' })
    .select('requester_id, addressee_id')
    .eq('id', requestId)
    .eq('addressee_id', user.id)
    .single();

  if (error) throw error;

  // Automatically follow the new friend after accepting the request.
  // (Mutual follow is completed when the other user also accepts/loads relevant flows.)
  const requesterId = data?.requester_id;
  if (requesterId && requesterId !== user.id) {
    const { error: followError } = await supabase
      .from('follows')
      .upsert([
        {
          follower_id: user.id,
          following_id: requesterId,
        }
      ], {
        onConflict: 'follower_id,following_id',
        ignoreDuplicates: true,
      });

    if (followError) {
      // Keep friend acceptance successful even if follow auto-sync fails.
      console.warn('Auto-follow after accepting friend request failed:', followError);
    }
  }
}

/**
 * Decline a friend request (by request id)
 * @param {string} requestId - Request ID
 */
export async function declineFriendRequest(requestId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { error } = await supabase
    .from('friend_requests')
    .update({ status: 'declined' })
    .eq('id', requestId)
    .eq('addressee_id', user.id);

  if (error) throw error;
}

/**
 * Remove an accepted friend relationship (by user id)
 * @param {string} userId - Friend user ID
 */
export async function removeFriend(userId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { error } = await supabase
    .from('friend_requests')
    .delete()
    .eq('status', 'accepted')
    .or(
      `and(requester_id.eq.${user.id},addressee_id.eq.${userId}),and(requester_id.eq.${userId},addressee_id.eq.${user.id})`
    );

  if (error) throw error;
}

/**
 * Get pending friend requests for the current user (incoming)
 * @returns {Promise<Array>} Array of requester profiles
 */
export async function getFriendRequests() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('friend_requests')
    .select(`
      id,
      created_at,
      requester_id,
      profiles:requester_id (
        id,
        username,
        full_name,
        avatar_url
      )
    `)
    .eq('addressee_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((row) => ({
    ...row.profiles,
    request_id: row.id,
    requested_at: row.created_at,
  }));
}

/**
 * Get pending friend requests sent by the current user (outgoing)
 * @returns {Promise<Array>} Array of addressee profiles
 */
export async function getOutgoingFriendRequests() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('friend_requests')
    .select(`
      id,
      created_at,
      addressee_id,
      profiles:addressee_id (
        id,
        username,
        full_name,
        avatar_url
      )
    `)
    .eq('requester_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((row) => ({
    ...row.profiles,
    request_id: row.id,
    requested_at: row.created_at,
  }));
}

/**
 * Get accepted friends for the current user
 * @returns {Promise<Array>} Array of friend profiles
 */
export async function getFriendsList() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('friend_requests')
    .select(`
      id,
      requester_id,
      addressee_id,
      requester:requester_id (
        id,
        username,
        full_name,
        avatar_url
      ),
      addressee:addressee_id (
        id,
        username,
        full_name,
        avatar_url
      )
    `)
    .eq('status', 'accepted')
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((row) => {
    const isRequester = row.requester_id === user.id;
    const friendProfile = isRequester ? row.addressee : row.requester;
    return {
      ...friendProfile,
      friendship_id: row.id,
    };
  });
}

/**
 * Get accepted friends for a user with total count
 * @param {string} userId - User ID
 * @param {number} limit - Max number of friends to return
 * @returns {Promise<{ friends: Array, total: number }>} Friends and total count
 */
export async function getFriendsForUser(userId, limit = 6) {
  const { data: countData, error: countError } = await supabase
    .from('friend_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'accepted')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

  if (countError) throw countError;

  const { data, error } = await supabase
    .from('friend_requests')
    .select(`
      id,
      requester_id,
      addressee_id,
      requester:requester_id (
        id,
        username,
        full_name,
        avatar_url
      ),
      addressee:addressee_id (
        id,
        username,
        full_name,
        avatar_url
      )
    `)
    .eq('status', 'accepted')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  const friends = (data || []).map((row) => {
    const isRequester = row.requester_id === userId;
    const friendProfile = isRequester ? row.addressee : row.requester;
    return {
      ...friendProfile,
      friendship_id: row.id,
    };
  });

  return { friends, total: countData?.count || 0 };
}

/**
 * Get profile stats counters
 * @param {string} userId - Profile user ID
 * @returns {Promise<{ postsCount: number, friendsCount: number, followersCount: number }>}
 */
export async function getProfileStats(userId) {
  const [postsResult, followsResult, acceptedFriendsResult] = await Promise.all([
    supabase
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('follows')
      .select('follower_id')
      .eq('following_id', userId),
    supabase
      .from('friend_requests')
      .select('requester_id, addressee_id')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`),
  ]);

  if (postsResult.error) throw postsResult.error;
  if (followsResult.error) throw followsResult.error;
  if (acceptedFriendsResult.error) throw acceptedFriendsResult.error;

  const friendIds = new Set();
  (acceptedFriendsResult.data || []).forEach((row) => {
    const otherId = row.requester_id === userId ? row.addressee_id : row.requester_id;
    if (otherId) friendIds.add(otherId);
  });

  const followerIds = new Set((followsResult.data || []).map((row) => row.follower_id).filter(Boolean));

  // Friends should imply follow; include both sources so old data remains accurate.
  const effectiveFollowers = new Set([...followerIds, ...friendIds]);

  return {
    postsCount: postsResult.count || 0,
    friendsCount: friendIds.size,
    followersCount: effectiveFollowers.size,
  };
}

/**
 * Get relationship status with a specific user
 * @param {string} userId - Target user ID
 * @returns {Promise<{ status: string, direction?: string, requestId?: string }>} Relationship status
 */
export async function getFriendRelationship(userId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('friend_requests')
    .select('id, requester_id, addressee_id, status')
    .or(
      `and(requester_id.eq.${user.id},addressee_id.eq.${userId}),and(requester_id.eq.${userId},addressee_id.eq.${user.id})`
    )
    .maybeSingle();

  if (error) throw error;
  if (!data) return { status: 'none' };

  const direction = data.requester_id === user.id ? 'outgoing' : 'incoming';
  return {
    status: data.status,
    direction,
    requestId: data.id,
  };
}

/**
 * Get friend suggestions for the current user
 * @param {number} limit - Number of suggestions
 * @returns {Promise<Array>} Array of suggested profiles
 */
export async function getFriendSuggestions(limit = 5) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data: requestRows, error: requestError } = await supabase
    .from('friend_requests')
    .select('requester_id, addressee_id, status')
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
    .in('status', ['pending', 'accepted']);

  if (requestError) throw requestError;

  const excludedIds = new Set([user.id]);
  (requestRows || []).forEach((row) => {
    const otherId = row.requester_id === user.id ? row.addressee_id : row.requester_id;
    if (otherId) excludedIds.add(otherId);
  });

  let query = supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url, location, birthday, bio, work, education')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (excludedIds.size) {
    const excluded = Array.from(excludedIds).map((id) => `"${id}"`).join(',');
    query = query.not('id', 'in', `(${excluded})`);
  }

  const { data: profiles, error } = await query;
  if (error) throw error;

  const suggestions = profiles || [];
  if (!suggestions.length) return [];

  const friendSet = await getAcceptedFriendIdsForUser(user.id);
  if (!friendSet.size) {
    return suggestions.map((profile) => ({ ...profile, mutual_friends: 0 }));
  }

  const profileIds = suggestions.map((profile) => profile.id).filter(Boolean);
  if (!profileIds.length) {
    return suggestions.map((profile) => ({ ...profile, mutual_friends: 0 }));
  }

  const profileIdsCsv = profileIds.map((id) => `"${id}"`).join(',');

  const { data: acceptedRows, error: acceptedError } = await supabase
    .from('friend_requests')
    .select('requester_id, addressee_id')
    .eq('status', 'accepted')
    .or(`requester_id.in.(${profileIdsCsv}),addressee_id.in.(${profileIdsCsv})`);

  if (acceptedError) throw acceptedError;

  const mutualCounts = new Map();
  (acceptedRows || []).forEach((row) => {
    if (profileIds.includes(row.requester_id)) {
      if (friendSet.has(row.addressee_id)) {
        mutualCounts.set(row.requester_id, (mutualCounts.get(row.requester_id) || 0) + 1);
      }
    }
    if (profileIds.includes(row.addressee_id)) {
      if (friendSet.has(row.requester_id)) {
        mutualCounts.set(row.addressee_id, (mutualCounts.get(row.addressee_id) || 0) + 1);
      }
    }
  });

  return suggestions.map((profile) => ({
    ...profile,
    mutual_friends: mutualCounts.get(profile.id) || 0,
  }));
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
 * Get suggested users to follow (exclude self and already-followed users)
 * @param {number} limit - Number of suggestions to fetch
 * @returns {Promise<Array>} Array of user profiles
 */
export async function getSuggestedUsers(limit = 5) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data: followingRows, error: followingError } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', user.id);

  if (followingError) throw followingError;

  const followingIds = (followingRows || [])
    .map((row) => row.following_id)
    .filter(Boolean);

  const followingSet = new Set(followingIds);

  let query = supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url')
    .neq('id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (followingIds.length) {
    const excluded = followingIds.map((id) => `"${id}"`).join(',');
    query = query.not('id', 'in', `(${excluded})`);
  }

  const { data, error } = await query;
  if (error) throw error;

  const profiles = data || [];
  if (!profiles.length) return [];

  const profileIds = profiles.map((profile) => profile.id).filter(Boolean);
  if (!profileIds.length) return profiles.map((profile) => ({ ...profile, mutual_friends: 0 }));

  const { data: suggestedFollowing, error: suggestedError } = await supabase
    .from('follows')
    .select('follower_id, following_id')
    .in('follower_id', profileIds);

  if (suggestedError) throw suggestedError;

  const mutualCounts = new Map();
  (suggestedFollowing || []).forEach((row) => {
    if (!followingSet.has(row.following_id)) return;
    mutualCounts.set(row.follower_id, (mutualCounts.get(row.follower_id) || 0) + 1);
  });

  return profiles.map((profile) => ({
    ...profile,
    mutual_friends: mutualCounts.get(profile.id) || 0,
  }));
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
      ),
      comments:comments(count),
      likes:likes(count)
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []).map((post) => ({
    ...post,
    likes_count: resolveRelationCount(post, 'likes', 'likes_count'),
    comments_count: resolveRelationCount(post, 'comments', 'comments_count'),
  }));
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

// ============================================
// MESSAGING
// ============================================

function normalizeDirectConversationPair(userAId, userBId) {
  const a = String(userAId || '').trim();
  const b = String(userBId || '').trim();
  if (!a || !b) throw new Error('Invalid user ids');
  if (a === b) throw new Error('Cannot create a conversation with yourself');
  return a < b ? { low: a, high: b } : { low: b, high: a };
}

/**
 * Get (or create) a 1:1 direct conversation between the current user and another user.
 * Requires messaging migrations to be applied.
 * @param {string} otherUserId
 * @returns {Promise<{ id: string }>} Conversation
 */
export async function getOrCreateDirectConversation(otherUserId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // Use a server-side RPC to avoid RLS/SELECT edge cases and create participants atomically.
  const { data, error } = await supabase
    .rpc('get_or_create_direct_conversation', { other_user_id: otherUserId });

  if (error) throw error;
  if (!data) throw new Error('Could not create conversation');

  return { id: String(data) };
}

async function ensureConversationParticipant(conversationId, userId) {
  const { error } = await supabase
    .from('conversation_participants')
    .upsert(
      [{
        conversation_id: conversationId,
        user_id: userId,
      }],
      { onConflict: 'conversation_id,user_id', ignoreDuplicates: true }
    );

  if (error) throw error;
}

/**
 * List conversations for current user.
 * Returns lightweight summaries for dropdown/drawer list.
 * @param {number} limit
 * @returns {Promise<Array>} Conversation summaries
 */
export async function getMyConversations(limit = 10) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data: participantRows, error: participantsError } = await supabase
    .from('conversation_participants')
    .select('conversation_id, last_read_at')
    .eq('user_id', user.id);

  if (participantsError) throw participantsError;
  const conversationIds = (participantRows || []).map((row) => row.conversation_id).filter(Boolean);
  if (!conversationIds.length) return [];

  const { data: conversations, error: conversationsError } = await supabase
    .from('conversations')
    .select(`
      id,
      updated_at,
      is_group,
      direct_user_low,
      direct_user_high,
      participants:conversation_participants (
        user_id,
        profiles:user_id (
          id,
          username,
          full_name,
          avatar_url
        )
      )
    `)
    .in('id', conversationIds)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (conversationsError) throw conversationsError;

  const { data: recentMessages, error: messagesError } = await supabase
    .from('messages')
    .select(`
      id,
      conversation_id,
      sender_id,
      body,
      created_at,
      sender:sender_id (
        id,
        username,
        full_name,
        avatar_url
      )
    `)
    .in('conversation_id', conversationIds)
    .order('created_at', { ascending: false })
    .limit(Math.max(20, conversationIds.length * 2));

  if (messagesError) throw messagesError;

  const lastMessageByConversation = new Map();
  (recentMessages || []).forEach((msg) => {
    if (!lastMessageByConversation.has(msg.conversation_id)) {
      lastMessageByConversation.set(msg.conversation_id, msg);
    }
  });

  const lastReadByConversation = new Map();
  (participantRows || []).forEach((row) => {
    lastReadByConversation.set(row.conversation_id, row.last_read_at);
  });

  return (conversations || []).map((c) => {
    const participants = (c.participants || [])
      .map((p) => p?.profiles)
      .filter(Boolean);

    const otherParticipant = participants.find((p) => p.id !== user.id) || null;
    const lastMessage = lastMessageByConversation.get(c.id) || null;
    const lastReadAt = lastReadByConversation.get(c.id) || null;

    const hasUnread = lastMessage && lastReadAt
      ? new Date(lastMessage.created_at) > new Date(lastReadAt)
      : !!lastMessage;

    return {
      id: c.id,
      updated_at: c.updated_at,
      other: otherParticipant,
      last_message: lastMessage,
      has_unread: hasUnread,
    };
  });
}

/**
 * Get messages in a conversation.
 * @param {string} conversationId
 * @param {number} limit
 * @returns {Promise<Array>} Messages (ascending)
 */
export async function getConversationMessages(conversationId, limit = 50) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('messages')
    .select(`
      id,
      conversation_id,
      sender_id,
      body,
      created_at,
      sender:sender_id (
        id,
        username,
        full_name,
        avatar_url
      )
    `)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

/**
 * Send a message into a conversation.
 * @param {string} conversationId
 * @param {string} body
 */
export async function sendConversationMessage(conversationId, body) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const content = String(body || '').trim();
  if (!content) throw new Error('Message cannot be empty');

  const { data, error } = await supabase
    .from('messages')
    .insert([
      {
        conversation_id: conversationId,
        sender_id: user.id,
        body: content,
      }
    ])
    .select(`
      id,
      conversation_id,
      sender_id,
      body,
      created_at,
      sender:sender_id (
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
 * Mark a conversation as read by updating last_read_at for the current user.
 * @param {string} conversationId
 */
export async function markConversationRead(conversationId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { error } = await supabase
    .from('conversation_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id);

  if (error) throw error;
}

/**
 * Get unread counts for the current user.
 * Requires the DB function public.get_my_unread_counts() to exist.
 * @returns {Promise<{ unread_conversations: number, unread_messages: number }>} Unread counts
 */
export async function getMyUnreadCounts() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase.rpc('get_my_unread_counts');
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  return {
    unread_conversations: Number(row?.unread_conversations) || 0,
    unread_messages: Number(row?.unread_messages) || 0,
  };
}
