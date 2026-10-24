const getYoutubeId = (url: string) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);

  return match && match[2].length === 11 ? match[2] : null;
};

export const convertYoutubeUrl = (url: string) => {
  return `https://www.youtube.com/embed/${getYoutubeId(url)}`;
};

export const convertFigmaUrl = (url: string) => {
  if (url.includes('embed')) return url;
  return `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(url)}`;
};

const getBvid = (url: string) => {
  const regExp = /https:\/\/www\.bilibili\.com\/video\/(.*?)\//;
  const match = url.match(regExp);

  return match ? match[1] : null;
};

export const convertBilibiliUrl = (url: string) => {
  // Compare the parsed host instead of searching for a substring: a URL such as
  // https://evil.example/?player.bilibili.com would otherwise be embedded as-is.
  try {
    if (new URL(url).hostname === 'player.bilibili.com') {
      return url;
    }
  } catch {
    // Not an absolute URL, fall through and rebuild it.
  }
  return `https://player.bilibili.com/player.html?bvid=${getBvid(url)}`;
};
