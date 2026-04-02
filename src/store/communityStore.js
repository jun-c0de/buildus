const KEY = 'buildus_community_posts';

const SEED_POSTS = [
  { id:1,  category:'review',   title:'25평 전체 인테리어 완성 후기 (비용 포함)',         author:'인테리어고수',  date:'2026-03-28', views:1243, comments:34, hot:true,  pinned:false },
  { id:2,  category:'quote',    title:'상현마을 휴먼시아 84m² 견적 비교 공유합니다',       author:'절약왕',       date:'2026-03-27', views:876,  comments:21, hot:true,  pinned:false },
  { id:3,  category:'qna',      title:'욕실 타일 직접 시공 가능한가요?',                   author:'초보집주인',   date:'2026-03-27', views:432,  comments:15, hot:false, pinned:false },
  { id:4,  category:'material', title:'강화마루 vs LVT 바닥재 뭐가 나을까요?',             author:'바닥전문가',   date:'2026-03-26', views:654,  comments:28, hot:false, pinned:false },
  { id:5,  category:'apt',      title:'성복역 롯데캐슬 84평형 목공 후기',                  author:'롯데주민',     date:'2026-03-26', views:321,  comments:9,  hot:false, pinned:false },
  { id:6,  category:'review',   title:'도배+바닥 셀프 시공 비용 아끼는 법',                author:'DIY장인',      date:'2026-03-25', views:987,  comments:42, hot:true,  pinned:false },
  { id:7,  category:'quote',    title:'광교 힐스테이트 32평 총 견적 1,800만원 내역',       author:'견적고수',     date:'2026-03-25', views:1102, comments:31, hot:true,  pinned:false },
  { id:8,  category:'qna',      title:'샷시 교체 시 발코니 확장까지 같이 하면?',           author:'리모델링준비', date:'2026-03-24', views:289,  comments:7,  hot:false, pinned:false },
  { id:9,  category:'material', title:'KCC vs LG 샷시 비교 실사용 후기',                   author:'샷시전문가',   date:'2026-03-24', views:445,  comments:18, hot:false, pinned:false },
  { id:10, category:'apt',      title:'상현 자이 방 3개 도배 비용 얼마나 들까요',           author:'자이주민',     date:'2026-03-23', views:234,  comments:11, hot:false, pinned:false },
  { id:11, category:'review',   title:'주방 리모델링 직접 했습니다 (싱크대 교체)',          author:'주방장',       date:'2026-03-23', views:678,  comments:22, hot:false, pinned:false },
  { id:12, category:'quote',    title:'더샵 포레스트 욕실 2개 견적 공유',                  author:'더샵주민',     date:'2026-03-22', views:512,  comments:14, hot:false, pinned:false },
];

export function loadPosts() {
  try {
    const stored = localStorage.getItem(KEY);
    if (!stored) { localStorage.setItem(KEY, JSON.stringify(SEED_POSTS)); return SEED_POSTS; }
    return JSON.parse(stored);
  } catch { return SEED_POSTS; }
}

export function savePosts(posts) {
  localStorage.setItem(KEY, JSON.stringify(posts));
}

export function addPost(post) {
  const posts = loadPosts();
  const newPost = {
    ...post,
    id: Date.now(),
    date: new Date().toISOString().split('T')[0],
    views: 0,
    comments: 0,
    hot: false,
    pinned: false,
  };
  const next = [newPost, ...posts];
  savePosts(next);
  return next;
}

export function deletePost(id) {
  const next = loadPosts().filter(p => p.id !== id);
  savePosts(next);
  return next;
}

export function updatePost(id, updates) {
  const next = loadPosts().map(p => p.id === id ? { ...p, ...updates } : p);
  savePosts(next);
  return next;
}
