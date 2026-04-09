import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  Dimensions,
  Modal,
  Image,
  Share,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

const { width } = Dimensions.get('window');

const FILTERS = ['Popular', 'Newest', 'My posts', 'Following', 'Saved'];

const CATEGORIES = [
  { name: 'Hunger Tips', color: '#059669', bgFrom: '#059669', bgTo: '#34d399' },
  { name: 'Fasting Wins', color: '#f59e0b', bgFrom: '#f59e0b', bgTo: '#fbbf24' },
  { name: 'Motivation', color: '#8b5cf6', bgFrom: '#8b5cf6', bgTo: '#a78bfa' },
  { name: 'Recipes', color: '#ef4444', bgFrom: '#ef4444', bgTo: '#f87171' },
  { name: 'Struggles', color: '#3b82f6', bgFrom: '#3b82f6', bgTo: '#60a5fa' },
  { name: 'Science', color: '#06b6d4', bgFrom: '#06b6d4', bgTo: '#22d3ee' },
  { name: 'Confessions', color: '#ec4899', bgFrom: '#ec4899', bgTo: '#f472b6' },
];

const AVATAR_COLORS = ['#059669', '#8b5cf6', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#06b6d4', '#f97316'];
const WHISPER_ICONS = ['🦁', '🐯', '🦊', '🐺', '🦝', '🐻', '🐼', '🦄', '🐸', '🦋', '🦜', '🦚', '🦩', '🐬', '🦭', '🐆', '🦓', '🦒', '🦘', '🦫', '🦦', '🦥', '🐙', '🐘'];

const getUserIcon = (str = '') => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) & 0xffffffff;
  return WHISPER_ICONS[Math.abs(hash) % WHISPER_ICONS.length];
};

const getUserColor = (str = '') => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 37 + str.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const SAMPLE_POSTS = [
  {
    id: '1',
    initial: 'A',
    avatarColor: '#8b5cf6',
    name: 'Amara_fit',
    timestamp: '2h ago',
    text: 'Hour 18 and the hunger just... disappeared? Is this what they mean by the other side?',
    category: 'Fasting Wins',
    likes: 0,
    comments: 0,
    liked: false,
    bookmarked: false,
    isPage: false,
  },
  {
    id: '2',
    isPage: true,
    pageName: 'Weight Loss Tips',
    pageAvatar: '#059669',
    pageInitial: 'W',
    followable: true,
    timestamp: '4h ago',
    text: 'What food kills your hunger the fastest during a fast?',
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&h=400&fit=crop',
    category: 'Hunger Tips',
    likes: 0,
    comments: 0,
    liked: false,
    bookmarked: false,
  },
  {
    id: '3',
    initial: 'F',
    avatarColor: '#f59e0b',
    name: 'FastingFela',
    timestamp: '5h ago',
    text: 'Day 3 of 16:8 and I already feel lighter. Not just physically but mentally too.',
    category: 'Motivation',
    likes: 0,
    comments: 0,
    liked: false,
    bookmarked: false,
    isPage: false,
  },
  {
    id: '4',
    isPage: true,
    pageName: 'Fasting Stress',
    pageAvatar: '#ef4444',
    pageInitial: 'F',
    followable: true,
    timestamp: 'Today',
    text: 'Does fasting make you more emotional or is it just me?',
    image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600&h=400&fit=crop',
    category: 'Struggles',
    likes: 0,
    comments: 0,
    liked: false,
    bookmarked: false,
  },
  {
    id: '5',
    initial: 'K',
    avatarColor: '#3b82f6',
    name: 'KemiCleans',
    timestamp: '6h ago',
    text: 'Anyone else get super productive during their fasting window? I just cleaned my entire house.',
    category: 'Fasting Wins',
    likes: 0,
    comments: 0,
    liked: false,
    bookmarked: false,
    isPage: false,
  },
  {
    id: '6',
    isPage: true,
    pageName: 'Healthy Recipes',
    pageAvatar: '#ec4899',
    pageInitial: 'H',
    followable: true,
    timestamp: '8h ago',
    text: 'What is your go-to meal to break your fast?',
    image: 'https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?w=600&h=400&fit=crop',
    category: 'Recipes',
    likes: 0,
    comments: 0,
    liked: false,
    bookmarked: false,
  },
  {
    id: '7',
    initial: 'S',
    avatarColor: '#8b5cf6',
    name: 'SlimSade',
    timestamp: 'Yesterday',
    text: "The hardest part isn't the hunger, it's watching everyone else eat lunch at work.",
    category: 'Struggles',
    likes: 0,
    comments: 0,
    liked: false,
    bookmarked: false,
    isPage: false,
  },
  {
    id: '8',
    initial: 'N',
    avatarColor: '#059669',
    name: 'NaijaFaster',
    timestamp: '1d ago',
    text: 'Drinking warm lemon water during my fasting window has been a game changer. Kills the cravings instantly.',
    category: 'Hunger Tips',
    likes: 0,
    comments: 0,
    liked: false,
    bookmarked: false,
    isPage: false,
  },
  {
    id: '9',
    isPage: true,
    isPoll: true,
    pageName: 'Fasting Mindset',
    pageAvatar: '#0ea5e9',
    pageInitial: 'F',
    followable: true,
    timestamp: '',
    text: 'Signs your body needs a break from fasting: Which one hits you first?',
    pollOptions: [
      { label: 'Constant headaches', votes: 0 },
      { label: 'Extreme irritability', votes: 0 },
      { label: 'Can\'t sleep properly', votes: 0 },
      { label: 'Other, I\'ll share in the comments', votes: 0 },
    ],
    category: 'Science',
    likes: 0,
    comments: 0,
    liked: false,
    bookmarked: false,
  },
  {
    id: '10',
    isPage: true,
    pageName: 'Weight Gain Struggles',
    pageAvatar: '#8b5cf6',
    pageInitial: 'W',
    followable: true,
    timestamp: '',
    text: 'Have you ever gained weight while fasting? What went wrong?',
    image: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=600&h=400&fit=crop',
    category: 'Struggles',
    likes: 0,
    comments: 0,
    liked: false,
    bookmarked: false,
  },
  {
    id: '11',
    initial: 'D',
    avatarColor: '#ec4899',
    name: 'DamiLaja',
    timestamp: '3h ago',
    text: 'My skin has been glowing since I started 18:6. My coworkers keep asking what cream I use lol.',
    category: 'Fasting Wins',
    likes: 0,
    comments: 0,
    liked: false,
    bookmarked: false,
    isPage: false,
  },
  {
    id: '12',
    initial: 'T',
    avatarColor: '#f59e0b',
    name: 'TundeRuns',
    timestamp: '5h ago',
    text: 'Is it okay to exercise during a fast? I ran 5k this morning at hour 14 and felt amazing but my friend said it\'s dangerous.',
    category: 'Science',
    likes: 0,
    comments: 0,
    liked: false,
    bookmarked: false,
    isPage: false,
  },
  {
    id: '13',
    isPage: true,
    pageName: 'Fasting Science',
    pageAvatar: '#3b82f6',
    pageInitial: 'S',
    followable: true,
    timestamp: '',
    text: 'What happens to your body after 24 hours without food?',
    image: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=600&h=400&fit=crop',
    category: 'Science',
    likes: 0,
    comments: 0,
    liked: false,
    bookmarked: false,
  },
  {
    id: '14',
    initial: 'B',
    avatarColor: '#ef4444',
    name: 'BukolaEats',
    timestamp: '8h ago',
    text: 'Confession: I broke my fast at hour 11 because someone brought suya to the office. I have zero willpower.',
    category: 'Struggles',
    likes: 0,
    comments: 0,
    liked: false,
    bookmarked: false,
    isPage: false,
  },
  {
    id: '15',
    initial: 'O',
    avatarColor: '#059669',
    name: 'ObiWellness',
    timestamp: '10h ago',
    text: 'Week 4 of OMAD. Down 6kg. My relationship with food has completely changed. I eat to fuel, not to fill.',
    category: 'Motivation',
    likes: 0,
    comments: 0,
    liked: false,
    bookmarked: false,
    isPage: false,
  },
  {
    id: '16',
    isPage: true,
    pageName: 'African Recipes',
    pageAvatar: '#059669',
    pageInitial: 'A',
    followable: true,
    timestamp: '',
    text: 'What African dish keeps you full the longest after breaking your fast?',
    image: 'https://images.unsplash.com/photo-1574484284002-952d92456975?w=600&h=400&fit=crop',
    category: 'Recipes',
    likes: 0,
    comments: 0,
    liked: false,
    bookmarked: false,
  },
  {
    id: '17',
    initial: 'Y',
    avatarColor: '#8b5cf6',
    name: 'YemiGlow',
    timestamp: '12h ago',
    text: 'Started fasting for spiritual reasons during Ramadan. Now I do it for health too. Best decision ever.',
    category: 'Motivation',
    likes: 0,
    comments: 0,
    liked: false,
    bookmarked: false,
    isPage: false,
  },
  {
    id: '18',
    initial: 'C',
    avatarColor: '#3b82f6',
    name: 'ChiChi_fit',
    timestamp: '14h ago',
    text: 'Anyone else feel like their brain works 10x better when fasting? I wrote an entire proposal in 2 hours today.',
    category: 'Fasting Wins',
    likes: 0,
    comments: 0,
    liked: false,
    bookmarked: false,
    isPage: false,
  },
  {
    id: '19',
    initial: 'E',
    avatarColor: '#ec4899',
    name: 'EkaFasts',
    timestamp: '1d ago',
    text: 'My mum thinks I\'m starving myself. How do you explain intermittent fasting to African parents? Asking for a friend (me).',
    category: 'Struggles',
    likes: 0,
    comments: 0,
    liked: false,
    bookmarked: false,
    isPage: false,
  },
];

export default function WhispersTab({ whisperPosts: externalPosts, setWhisperPosts: externalSetPosts, userName = 'You', profileImage = null, userId = '' }) {
  const [localPosts, setLocalPosts] = useState(SAMPLE_POSTS);
  const posts = externalPosts && externalPosts.length > 0 ? externalPosts : localPosts;
  const setPosts = externalSetPosts || setLocalPosts;

  const [activeFilter, setActiveFilter] = useState('Popular');
  const [searchText, setSearchText] = useState('');
  const [showNewPost, setShowNewPost] = useState(false);
  const [newPostText, setNewPostText] = useState('');
  const [newPostCategory, setNewPostCategory] = useState('');
  const [postMenu, setPostMenu] = useState(null);
  const [votedPolls, setVotedPolls] = useState({});
  const [commentPostId, setCommentPostId] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [postComments, setPostComments] = useState({});
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [followedPages, setFollowedPages] = useState({});
  const [replyingTo, setReplyingTo] = useState(null);
  const [commentFilter, setCommentFilter] = useState('Top');
  const commentInputRef = useRef(null);


  const toggleLike = (postId) => {
    const updated = posts.map((p) => {
      if (p.id === postId) {
        return {
          ...p,
          liked: !p.liked,
          likes: p.liked ? p.likes - 1 : p.likes + 1,
        };
      }
      return p;
    });
    setPosts(updated);
  };

  const toggleBookmark = (postId) => {
    const updated = posts.map((p) => {
      if (p.id === postId) {
        return { ...p, bookmarked: !p.bookmarked };
      }
      return p;
    });
    setPosts(updated);
  };

  const handleNewPost = () => {
    if (!newPostText.trim()) return;
    const postId = Date.now().toString();
    const newPost = {
      id: postId,
      avatarImage: profileImage,
      isPage: false,
      timestamp: 'Just now',
      text: newPostText.trim(),
      category: newPostCategory || 'Motivation',
      likes: 0,
      comments: 0,
      liked: false,
      bookmarked: false,
    };
    setPosts([newPost, ...posts]);
    setNewPostText('');
    setNewPostCategory('');
    setShowNewPost(false);
  };

  const handleShare = async (post) => {
    try {
      await Share.share({
        message: `${post.text}\n\n— via Afri Fast Whispers`,
      });
    } catch (e) {}
  };

  const handleAddComment = () => {
    if (!commentText.trim() || !commentPostId) return;
    const newComment = {
      id: Date.now().toString(),
      name: userName,
      initial: userName.charAt(0).toUpperCase(),
      avatarColor: '#059669',
      avatarImage: profileImage,
      text: commentText.trim(),
      timestamp: 'Just now',
      likes: 0,
    };
    setPostComments({
      ...postComments,
      [commentPostId]: [...(postComments[commentPostId] || []), newComment],
    });
    // Increment comment count
    const updated = posts.map((p) => {
      if (p.id === commentPostId) return { ...p, comments: p.comments + 1 };
      return p;
    });
    setPosts(updated);
    setCommentText('');
    setReplyingTo(null);
  };

  const getCommentsForPost = (postId) => {
    const post = posts.find(p => p.id === postId);
    const saved = postComments[postId] || [];
    const fromTop = post?.topComment ? [{
      id: 'top',
      name: post.topComment.name,
      initial: post.topComment.name.charAt(0),
      avatarColor: '#f59e0b',
      text: post.topComment.text,
      timestamp: 'Earlier',
      likes: 0,
    }] : [];
    return [...fromTop, ...saved];
  };

  const renderPostCard = (post) => (
    <View key={post.id} style={styles.postCard}>
      {post.isPage ? (
        <>
          {/* Page post header */}
          <View style={styles.postHeader}>
            <View style={[styles.postAvatar, { backgroundColor: post.pageAvatar }]}>
              <Text style={styles.postAvatarText}>{post.pageInitial}</Text>
            </View>
            <View style={styles.postHeaderInfo}>
              <View style={styles.postNameRow}>
                <Text style={styles.postName}>{post.pageName}</Text>
                <Text style={styles.followDot}>{'\u00B7'}</Text>
                <TouchableOpacity onPress={() => setFollowedPages({ ...followedPages, [post.id]: !followedPages[post.id] })}>
                  <Text style={followedPages[post.id] ? styles.followingLink : styles.followLink}>
                    {followedPages[post.id] ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity style={styles.postMenuBtn} onPress={() => setPostMenu(postMenu === post.id ? null : post.id)}>
              <Ionicons name="ellipsis-horizontal" size={18} color="#9ca3af" />
            </TouchableOpacity>
            {postMenu === post.id && (
              <View style={styles.postMenuDropdown}>
                <TouchableOpacity style={styles.postMenuItem} onPress={() => setPostMenu(null)}>
                  <Ionicons name="eye-off-outline" size={16} color="#374151" />
                  <Text style={styles.postMenuItemText}>Hide</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.postMenuItem} onPress={() => setPostMenu(null)}>
                  <Ionicons name="flag-outline" size={16} color="#374151" />
                  <Text style={styles.postMenuItemText}>Report</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Poll or Image post */}
          {post.isPoll ? (
            <View style={styles.pollContainer}>
              <Text style={styles.pollQuestion}>{post.text}</Text>
              {(() => {
                const hasVoted = votedPolls[post.id] !== undefined;
                const totalVotes = post.pollOptions.reduce((sum, o) => sum + o.votes, 0);
                return post.pollOptions.map((opt, idx) => {
                  const isSelected = votedPolls[post.id] === idx;
                  const percent = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
                  const isTop = hasVoted && totalVotes > 0 && percent === Math.max(...post.pollOptions.map(o => totalVotes > 0 ? Math.round((o.votes / totalVotes) * 100) : 0));
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.pollOptionRow, isSelected && styles.pollOptionSelected]}
                      onPress={() => {
                        if (!hasVoted) {
                          setVotedPolls({ ...votedPolls, [post.id]: idx });
                          const updated = posts.map(p => {
                            if (p.id === post.id) {
                              const newOptions = [...p.pollOptions];
                              newOptions[idx] = { ...newOptions[idx], votes: newOptions[idx].votes + 1 };
                              return { ...p, pollOptions: newOptions };
                            }
                            return p;
                          });
                          setPosts(updated);
                        }
                      }}
                      activeOpacity={hasVoted ? 1 : 0.7}
                    >
                      {hasVoted && (
                        <View style={[styles.pollOptionBar, { width: `${percent}%`, backgroundColor: isTop ? '#D1FAE5' : '#F3F4F6' }]} />
                      )}
                      <Text style={[styles.pollOptionLabel, isTop && { fontWeight: '700' }]}>{opt.label}</Text>
                      {hasVoted && (
                        <Text style={[styles.pollOptionPercent, isTop && { color: '#059669', fontWeight: '700' }]}>{percent}%</Text>
                      )}
                    </TouchableOpacity>
                  );
                });
              })()}
            </View>
          ) : post.image ? (
            <View style={styles.pageImageContainer}>
              <Image source={{ uri: post.image }} style={styles.pageImage} resizeMode="cover" />
              <View style={styles.pageImageOverlay}>
                <Text style={styles.pageImageText}>{post.text}</Text>
              </View>
            </View>
          ) : null}

          {/* Action bar */}
          <View style={styles.postActions}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => toggleLike(post.id)}>
              <Ionicons name={post.liked ? 'heart' : 'heart-outline'} size={20} color={post.liked ? '#ef4444' : '#9ca3af'} />
              <Text style={[styles.actionText, post.liked && { color: '#ef4444' }]}>{post.likes}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => setCommentPostId(post.id)}>
              <Ionicons name="chatbubble-outline" size={19} color="#9ca3af" />
              <Text style={styles.actionText}>{post.comments}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => handleShare(post)}>
              <Ionicons name="paper-plane-outline" size={19} color="#9ca3af" />
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={() => toggleBookmark(post.id)}>
              <Ionicons name={post.bookmarked ? 'bookmark' : 'bookmark-outline'} size={20} color={post.bookmarked ? '#059669' : '#9ca3af'} />
            </TouchableOpacity>
          </View>

          {/* Top comment + view all */}
          {post.topComment && (
            <>
              <View style={styles.topCommentCard}>
                <View style={[styles.topCommentAvatar, { backgroundColor: '#f59e0b' }]}>
                  <Text style={styles.topCommentAvatarText}>{post.topComment.name.charAt(0)}</Text>
                </View>
                <View style={styles.topCommentBubble}>
                  <Text style={styles.topCommentText}>{post.topComment.text}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.viewAllCommentsBtn} onPress={() => setCommentPostId(post.id)}>
                <Text style={styles.viewAllComments}>View all {post.comments.toLocaleString()} comments</Text>
              </TouchableOpacity>
            </>
          )}
        </>
      ) : (
        <>
          {/* User post header */}
          <View style={styles.postHeader}>
            <View style={[styles.postAvatar, { backgroundColor: getUserColor(post.id) }]}>
              <Text style={styles.postAvatarIcon}>{getUserIcon(post.id)}</Text>
            </View>
            <View style={styles.postHeaderInfo} />
            <Text style={styles.postTimestamp}>{post.timestamp}</Text>
            <TouchableOpacity style={styles.postMenuBtn} onPress={() => setPostMenu(postMenu === post.id ? null : post.id)}>
              <Ionicons name="ellipsis-horizontal" size={18} color="#9ca3af" />
            </TouchableOpacity>
            {postMenu === post.id && (
              <View style={styles.postMenuDropdown}>
                <TouchableOpacity style={styles.postMenuItem} onPress={() => setPostMenu(null)}>
                  <Ionicons name="person-add-outline" size={16} color="#374151" />
                  <Text style={styles.postMenuItemText}>Follow</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.postMenuItem} onPress={() => setPostMenu(null)}>
                  <Ionicons name="eye-off-outline" size={16} color="#374151" />
                  <Text style={styles.postMenuItemText}>Hide</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.postMenuItem} onPress={() => setPostMenu(null)}>
                  <Ionicons name="ban-outline" size={16} color="#ef4444" />
                  <Text style={[styles.postMenuItemText, { color: '#ef4444' }]}>Block</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Post body */}
          <Text style={styles.postText}>{post.text}</Text>

          {/* Category tag */}
          <View style={styles.categoryChipRow}>
            <View style={styles.categoryChip}>
              <Text style={styles.categoryChipText}>{post.category}</Text>
            </View>
          </View>

          {/* Action bar */}
          <View style={styles.postActions}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => toggleLike(post.id)}>
              <Ionicons name={post.liked ? 'heart' : 'heart-outline'} size={20} color={post.liked ? '#ef4444' : '#9ca3af'} />
              <Text style={[styles.actionText, post.liked && { color: '#ef4444' }]}>{post.likes}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => setCommentPostId(post.id)}>
              <Ionicons name="chatbubble-outline" size={19} color="#9ca3af" />
              <Text style={styles.actionText}>{post.comments}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => handleShare(post)}>
              <Ionicons name="paper-plane-outline" size={19} color="#9ca3af" />
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={() => toggleBookmark(post.id)}>
              <Ionicons name={post.bookmarked ? 'bookmark' : 'bookmark-outline'} size={20} color={post.bookmarked ? '#059669' : '#9ca3af'} />
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerAvatar}>
          <Ionicons name="leaf" size={16} color="#fff" />
        </View>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color="#9ca3af" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search whispers..."
            placeholderTextColor="#9ca3af"
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>
        <TouchableOpacity style={styles.bellBtn}>
          <Ionicons name="notifications-outline" size={22} color="#374151" />
        </TouchableOpacity>
      </View>

      {/* Filter tabs */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {FILTERS.map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[styles.filterPill, activeFilter === filter && styles.filterPillActive]}
              onPress={() => setActiveFilter(filter)}
            >
              <Text style={[styles.filterText, activeFilter === filter && styles.filterTextActive]}>
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {Platform.OS === 'web' && <View style={{ height: 132 }} />}

      {/* Feed */}
      <ScrollView
        style={styles.feed}
        contentContainerStyle={styles.feedContent}
        showsVerticalScrollIndicator={false}
      >
        {(() => {
          const filtered = posts.filter((p) => {
            if (activeFilter === 'Popular') return true;
            if (activeFilter === 'Newest') {
              return p.timestamp === 'Just now' || p.timestamp === 'Today' || (p.timestamp && p.timestamp.includes('h ago'));
            }
            if (activeFilter === 'My posts') return !p.isPage && p.name === userName;
            if (activeFilter === 'Following') return p.isPage;
            if (activeFilter === 'Saved') return p.bookmarked;
            return true;
          });
          if (filtered.length === 0) {
            return (
              <View style={styles.emptyFilterState}>
                <Ionicons name={activeFilter === 'Saved' ? 'bookmark-outline' : activeFilter === 'My posts' ? 'person-outline' : 'search-outline'} size={40} color="#D1D5DB" />
                <Text style={styles.emptyFilterTitle}>
                  {activeFilter === 'Saved' ? 'No saved whispers yet' : activeFilter === 'My posts' ? 'You haven\'t posted yet' : activeFilter === 'Newest' ? 'No new whispers' : 'Nothing here yet'}
                </Text>
                <Text style={styles.emptyFilterSub}>
                  {activeFilter === 'Saved' ? 'Bookmark posts to find them here' : activeFilter === 'My posts' ? 'Tap "New post" to share your first whisper' : 'Check back later'}
                </Text>
              </View>
            );
          }
          return filtered.map(renderPostCard);
        })()}

        {/* Categories section */}
        <View style={styles.categoriesSection}>
          <View style={styles.categoriesHeader}>
            <Text style={styles.categoriesTitle}>Categories</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllLink}>See all &gt;</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesScroll}
          >
            {CATEGORIES.map((cat) => (
              <TouchableOpacity key={cat.name} style={[styles.categoryCard, { backgroundColor: cat.bgFrom }]}>
                <Text style={styles.categoryCardText}>{cat.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Bottom spacer for floating button */}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Floating new post button */}
      <View style={styles.fab}>
        <TouchableOpacity style={styles.fabInner} onPress={() => setShowNewPost(true)}>
          <Ionicons name="create-outline" size={20} color="#fff" />
          <Text style={styles.fabText}>New post</Text>
        </TouchableOpacity>
      </View>

      {/* New Post Modal */}
      <Modal visible={showNewPost} animationType="slide" transparent={false}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.newPostPage}>
          {/* Header */}
          <View style={styles.newPostHeader}>
            <TouchableOpacity onPress={() => { setShowNewPost(false); setShowCategoryDropdown(false); }}>
              <Ionicons name="close" size={24} color="#374151" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.newPostBtn, !newPostText.trim() && styles.newPostBtnDisabled]}
              onPress={handleNewPost}
              disabled={!newPostText.trim()}
            >
              <Text style={[styles.newPostBtnText, !newPostText.trim() && { opacity: 0.5 }]}>Post</Text>
            </TouchableOpacity>
          </View>

          {/* Compose area */}
          <View style={styles.newPostCompose}>
            {/* Avatar + input */}
            <View style={styles.newPostRow}>
              <View style={[styles.newPostAvatar, { backgroundColor: getUserColor(userId || userName) }]}>
                <Text style={styles.newPostAvatarText}>{getUserIcon(userId || userName)}</Text>
              </View>
              <View style={styles.newPostInputArea}>
                {/* Category chip */}
                <TouchableOpacity
                  style={styles.newPostCategoryChip}
                  onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}
                >
                  {newPostCategory ? (
                    <View style={styles.newPostCategorySelected}>
                      <View style={[styles.categoryDot, { backgroundColor: CATEGORIES.find(c => c.name === newPostCategory)?.color || '#059669' }]} />
                      <Text style={styles.newPostCategorySelectedText}>{newPostCategory}</Text>
                      <Ionicons name="chevron-down" size={12} color="#059669" />
                    </View>
                  ) : (
                    <View style={styles.newPostCategoryDefault}>
                      <Ionicons name="pricetag-outline" size={13} color="#9ca3af" />
                      <Text style={styles.newPostCategoryDefaultText}>Add topic</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <TextInput
                  style={styles.newPostInput}
                  placeholder="What's on your mind?"
                  placeholderTextColor="#bbb"
                  multiline
                  textAlignVertical="top"
                  value={newPostText}
                  onChangeText={setNewPostText}
                  autoFocus
                />
              </View>
            </View>

            {/* Category dropdown overlay */}
            {showCategoryDropdown && (
              <View style={styles.newPostDropdown}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.name}
                    style={[styles.newPostDropdownItem, newPostCategory === cat.name && { backgroundColor: '#ECFDF5' }]}
                    onPress={() => { setNewPostCategory(cat.name); setShowCategoryDropdown(false); }}
                  >
                    <View style={[styles.categoryDot, { backgroundColor: cat.color }]} />
                    <Text style={[styles.newPostDropdownText, newPostCategory === cat.name && { color: '#059669', fontWeight: '600' }]}>{cat.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Comment Modal — Full Page */}
      <Modal visible={commentPostId !== null} animationType="slide" transparent={false}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.commentPageContainer}
        >
          {/* Header */}
          <View style={styles.commentPageHeader}>
            <TouchableOpacity onPress={() => { setCommentPostId(null); setCommentText(''); setReplyingTo(null); }}>
              <Ionicons name="chevron-back" size={24} color="#374151" />
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <TouchableOpacity>
              <Ionicons name="notifications-outline" size={22} color="#374151" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.commentPageScroll} showsVerticalScrollIndicator={false}>
            {/* Original post */}
            {commentPostId && (() => {
              const post = posts.find(p => p.id === commentPostId);
              if (!post) return null;
              return (
                <View style={styles.commentOriginalPost}>
                  <View style={styles.commentOriginalHeader}>
                    <View style={[styles.commentOriginalAvatar, { backgroundColor: post.isPage ? post.pageAvatar : getUserColor(post.id) }]}>
                      <Text style={styles.commentOriginalAvatarText}>{post.isPage ? post.pageInitial : getUserIcon(post.id)}</Text>
                    </View>
                    <Text style={styles.commentOriginalTimestamp}>{post.timestamp || 'Today'}</Text>
                  </View>
                  <Text style={styles.commentOriginalText}>{post.text}</Text>
                  <View style={styles.categoryChipRow}>
                    <View style={styles.categoryChip}>
                      <Text style={styles.categoryChipText}>{post.category}</Text>
                    </View>
                  </View>
                  <View style={styles.commentOriginalActions}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => toggleLike(post.id)}>
                      <Ionicons name={post.liked ? 'heart' : 'heart-outline'} size={20} color={post.liked ? '#ef4444' : '#9ca3af'} />
                      <Text style={[styles.actionText, post.liked && { color: '#ef4444' }]}>{post.likes}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleShare(post)}>
                      <Ionicons name="paper-plane-outline" size={19} color="#9ca3af" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })()}

            {/* Divider */}
            <View style={styles.commentDivider} />

            {/* Comment filter tabs */}
            <View style={styles.commentFilterRow}>
              {['Top', 'Newest', 'My'].map((f) => (
                <TouchableOpacity key={f} style={[styles.commentFilterPill, commentFilter === f && styles.commentFilterPillActive]} onPress={() => setCommentFilter(f)}>
                  <Text style={[styles.commentFilterText, commentFilter === f && styles.commentFilterTextActive]}>{f}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Disclaimer */}
            <View style={styles.commentDisclaimer}>
              <Ionicons name="information-circle-outline" size={14} color="#9ca3af" />
              <Text style={styles.commentDisclaimerText}>Replies are from the community</Text>
            </View>

            {/* Comments list */}
            {commentPostId && getCommentsForPost(commentPostId).length > 0 ? (
              getCommentsForPost(commentPostId).map((c) => (
                <View key={c.id} style={styles.commentItem}>
                  {c.avatarImage ? (
                    <Image source={{ uri: c.avatarImage }} style={styles.commentAvatarImage} />
                  ) : (
                    <View style={[styles.commentAvatar, { backgroundColor: c.avatarColor }]}>
                      <Text style={styles.commentAvatarText}>{c.initial}</Text>
                    </View>
                  )}
                  <View style={styles.commentContent}>
                    <View style={styles.commentNameRow}>
                      <Text style={styles.commentName}>{c.name}</Text>
                      <Text style={styles.commentTime}>{c.timestamp}</Text>
                    </View>
                    <Text style={styles.commentBody}>{c.text}</Text>
                    <View style={styles.commentActionsRow}>
                      <TouchableOpacity style={styles.commentActionBtn}>
                        <Ionicons name="heart-outline" size={14} color="#9ca3af" />
                        <Text style={styles.commentActionText}>{c.likes}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.commentActionBtn} onPress={() => {
                        setReplyingTo(c.name);
                        setCommentText(`@${c.name} `);
                        commentInputRef.current?.focus();
                      }}>
                        <Text style={styles.commentActionText}>Reply</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.noCommentsContainer}>
                <Ionicons name="chatbubbles-outline" size={40} color="#D1D5DB" />
                <Text style={styles.noCommentsText}>No comments yet</Text>
                <Text style={styles.noCommentsSub}>Be the first to share your thoughts</Text>
              </View>
            )}
          </ScrollView>

          {/* Input bar */}
          <View style={styles.commentInputRow}>
            <TextInput
              ref={commentInputRef}
              style={styles.commentInput}
              placeholder={replyingTo ? `Reply to ${replyingTo}...` : "Write a comment..."}
              placeholderTextColor="#9ca3af"
              value={commentText}
              onChangeText={setCommentText}
            />
            <TouchableOpacity
              style={[styles.commentSendBtn, !commentText.trim() && { opacity: 0.4 }]}
              onPress={handleAddComment}
              disabled={!commentText.trim()}
            >
              <Ionicons name="arrow-up" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFBFF',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: '#FAFBFF',
    ...(Platform.OS === 'web' ? { position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10 } : {}),
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    paddingHorizontal: 14,
    height: 38,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    paddingVertical: 0,
  },
  bellBtn: {
    marginLeft: 12,
    padding: 4,
  },

  // Filter tabs
  filterContainer: {
    paddingTop: 4,
    paddingBottom: 8,
    backgroundColor: '#FAFBFF',
    ...(Platform.OS === 'web' ? { position: 'fixed', top: 84, left: 0, right: 0, zIndex: 9 } : {}),
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    marginRight: 8,
  },
  filterPillActive: {
    backgroundColor: '#059669',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  filterTextActive: {
    color: '#fff',
  },

  emptyFilterState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyFilterTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginTop: 12,
  },
  emptyFilterSub: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 4,
    textAlign: 'center',
  },

  // Feed
  feed: {
    flex: 1,
  },
  feedContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },

  // Post card
  postCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f0f1f3',
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  postAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  postAvatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
  },
  postAvatarIcon: {
    fontSize: 16,
  },
  postAvatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  postHeaderInfo: {
    flex: 1,
  },
  postNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  postName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  postMenuDropdown: {
    position: 'absolute',
    top: 36,
    right: 0,
    width: 140,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 8,
  },
  postMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  postMenuItemText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  postTimestamp: {
    fontSize: 12,
    color: '#9ca3af',
    marginRight: 6,
  },
  postMenuBtn: {
    padding: 4,
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 10,
  },
  pageImageContainer: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 4,
  },
  pageImage: {
    width: '100%',
    height: '100%',
  },
  pageImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  pageImageText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 26,
  },
  postNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  followDot: {
    fontSize: 14,
    color: '#9ca3af',
    fontWeight: '700',
  },
  followLink: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
  },
  followingLink: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9ca3af',
  },
  pollContainer: {
    marginBottom: 4,
  },
  pollQuestion: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    lineHeight: 24,
    marginBottom: 14,
  },
  pollOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    marginBottom: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  pollOptionSelected: {
    borderColor: '#059669',
    borderWidth: 1.5,
  },
  pollOptionBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 10,
  },
  pollOptionLabel: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
    zIndex: 1,
  },
  pollOptionPercent: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
    zIndex: 1,
  },
  topCommentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  topCommentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  topCommentAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  topCommentBubble: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    borderTopLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  topCommentText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  viewAllCommentsBtn: {
    marginTop: 10,
    alignItems: 'center',
  },
  viewAllComments: {
    fontSize: 13,
    color: '#059669',
    fontWeight: '600',
  },
  postText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#1f2937',
    marginBottom: 10,
  },
  categoryChipRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  categoryChip: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  categoryChipText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  postActions: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 10,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  actionText: {
    fontSize: 13,
    color: '#9ca3af',
    marginLeft: 5,
    fontWeight: '500',
  },

  // Categories section
  categoriesSection: {
    marginTop: 8,
    marginBottom: 8,
  },
  categoriesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoriesTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  seeAllLink: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '600',
  },
  categoriesScroll: {
    gap: 10,
  },
  categoryCard: {
    width: 130,
    height: 80,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  categoryCardText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  // FAB
  fab: {
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    bottom: 90,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  fabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 28,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 8,
  },

  // Modal

  // New post page
  newPostPage: {
    flex: 1,
    backgroundColor: '#fff',
  },
  newPostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'android' ? 12 : 54,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  newPostBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  newPostBtnDisabled: {
    backgroundColor: '#D1FAE5',
  },
  newPostBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  newPostCompose: {
    flex: 1,
    padding: 16,
  },
  newPostRow: {
    flexDirection: 'row',
    gap: 12,
  },
  newPostAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  newPostAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    flexShrink: 0,
  },
  newPostAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  newPostInputArea: {
    flex: 1,
  },
  newPostCategoryChip: {
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  newPostCategorySelected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  newPostCategorySelectedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
  newPostCategoryDefault: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  newPostCategoryDefaultText: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
  newPostInput: {
    fontSize: 17,
    color: '#1F1F1F',
    lineHeight: 24,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  newPostDropdown: {
    position: 'absolute',
    top: 36,
    left: 52,
    width: 170,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 100,
    overflow: 'hidden',
  },
  newPostDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  newPostDropdownText: {
    fontSize: 13,
    color: '#374151',
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  // Comment page
  commentPageContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  commentPageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'android' ? 12 : 52,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  commentPageScroll: {
    flex: 1,
    paddingHorizontal: 20,
  },
  commentOriginalPost: {
    paddingBottom: 12,
  },
  commentOriginalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  commentOriginalAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentOriginalAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  commentOriginalTimestamp: {
    fontSize: 12,
    color: '#9ca3af',
  },
  commentOriginalText: {
    fontSize: 16,
    color: '#1F1F1F',
    lineHeight: 23,
    marginBottom: 10,
  },
  commentOriginalActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 4,
  },
  commentDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.06)',
    marginVertical: 12,
  },
  commentFilterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  commentFilterPill: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  commentFilterPillActive: {
    backgroundColor: '#1F1F1F',
    borderColor: '#1F1F1F',
  },
  commentFilterText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  commentFilterTextActive: {
    color: '#fff',
  },
  commentDisclaimer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  commentDisclaimerText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  commentsList: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  commentItem: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  commentAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  commentAvatarImage: {
    width: 34,
    height: 34,
    borderRadius: 17,
    flexShrink: 0,
  },
  commentAvatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  commentContent: {
    flex: 1,
  },
  commentNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  commentName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },
  commentTime: {
    fontSize: 11,
    color: '#9ca3af',
  },
  commentBody: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  commentActionsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 6,
  },
  commentActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  commentActionText: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
  noCommentsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  noCommentsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginTop: 12,
  },
  noCommentsSub: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 4,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
    backgroundColor: '#fff',
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#374151',
  },
  commentSendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
