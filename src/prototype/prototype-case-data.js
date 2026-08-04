import { artPosts } from "../data/artPosts";
import { gamePosts } from "../data/gamePosts";
import { petPosts } from "../data/petPosts";
import { realBodyPosts } from "../data/realBodyPosts";
import { textPosts } from "../data/textPosts";

export const PROTOTYPE_CASE_CATEGORIES = [
  {
    categoryId: "game",
    categoryName: "Game Images as Suspicious Images",
    cnCategoryName: "游戏图像作为可疑图像",
    posts: gamePosts,
  },
  {
    categoryId: "real-body",
    categoryName: "Real Bodies as AI Suspects",
    cnCategoryName: "真人身体作为 AI 可疑对象",
    posts: realBodyPosts,
  },
  {
    categoryId: "art",
    categoryName: "Original Art as Suspicious Art",
    cnCategoryName: "原创艺术作为可疑艺术",
    posts: artPosts,
  },
  {
    categoryId: "pet",
    categoryName: "Pet Videos as Suspicious Daily Life",
    cnCategoryName: "宠物视频作为可疑日常生活",
    posts: petPosts,
  },
  {
    categoryId: "text",
    categoryName: "Text Posts Trapped by AI Labels",
    cnCategoryName: "被 AI 标签困住的文字内容",
    posts: textPosts,
  },
];

function selectRandomPost(posts) {
  if (!Array.isArray(posts) || posts.length === 0) {
    throw new Error("A prototype case category has no posts.");
  }

  return posts[Math.floor(Math.random() * posts.length)];
}

function toPrototypeCase(category, post) {
  return {
    caseId: post.id,
    categoryId: category.categoryId,
    categoryName: category.categoryName,
    cnCategoryName: category.cnCategoryName,
    image: post.image,
    title: post.title,
    cnTitle: post.cnTitle,
    description: post.body,
    cnDescription: post.cnBody,
    platformLabel: post.platformLabel,
    cnPlatformLabel: post.cnPlatformLabel,
    reality: post.reality,
    cnReality: post.cnReality,
  };
}

// Call once when a new account/session begins, then retain the returned cases.
// Calling this function again intentionally creates a new five-case selection.
export function createPrototypeCases() {
  return PROTOTYPE_CASE_CATEGORIES.map((category) =>
    toPrototypeCase(category, selectRandomPost(category.posts)),
  );
}
